const express = require('express');
const jwt = require('jsonwebtoken');
const ProjectVariation = require('../models/ProjectVariation');
const Project = require('../models/Project');
const Quotation = require('../models/Quotation');
const Revision = require('../models/Revision');
const router = express.Router();

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all project variations
router.get('/', auth, async (req, res) => {
  try {
    const { parentProject } = req.query;
    const query = {};
    if (parentProject) query.parentProject = parentProject;
    
    const variations = await ProjectVariation.find(query)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name')
      .populate('managementApproval.approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(variations);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single project variation
router.get('/:id', auth, async (req, res) => {
  try {
    const variation = await ProjectVariation.findById(req.params.id)
      .populate('parentProject')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name')
      .populate('managementApproval.approvedBy', 'name');
    if (!variation) return res.status(404).json({ message: 'Variation not found' });
    res.json(variation);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a project variation from a project
router.post('/', auth, async (req, res) => {
  try {
    const { parentProjectId, parentVariationId, data } = req.body;
    if (!parentProjectId && !parentVariationId) return res.status(400).json({ message: 'parentProjectId or parentVariationId is required' });
    
    let sourceDoc;
    let parentProjectId_final;
    
    if (parentVariationId) {
      sourceDoc = await ProjectVariation.findById(parentVariationId)
        .populate('lead')
        .populate('createdBy')
        .populate('edits.editedBy')
        .populate('managementApproval.requestedBy')
        .populate('managementApproval.approvedBy');
      if (!sourceDoc) return res.status(404).json({ message: 'Source variation not found' });
      parentProjectId_final = sourceDoc.parentProject;
    } else {
      // Get the project and its source quotation/revision to use as base
      const project = await Project.findById(parentProjectId)
        .populate('sourceQuotation')
        .populate('sourceRevision')
        .populate('leadId');
      if (!project) return res.status(404).json({ message: 'Project not found' });
      
      // Use source revision if available, otherwise use source quotation
      if (project.sourceRevision) {
        const revision = await Revision.findById(project.sourceRevision._id || project.sourceRevision)
          .populate('lead')
          .populate('createdBy');
        sourceDoc = revision;
      } else if (project.sourceQuotation) {
        const quotation = await Quotation.findById(project.sourceQuotation._id || project.sourceQuotation)
          .populate('lead')
          .populate('createdBy');
        sourceDoc = quotation;
      } else {
        return res.status(400).json({ message: 'Project has no source quotation or revision to base variation on' });
      }
      parentProjectId_final = parentProjectId;
    }

    // If creating from a variation, block if a child variation already exists
    if (parentVariationId) {
      const childCount = await ProjectVariation.countDocuments({ parentVariation: parentVariationId });
      if (childCount > 0) {
        return res.status(400).json({ message: 'A child variation already exists for this variation.' });
      }
    }
    
    const existingCount = await ProjectVariation.countDocuments({ parentProject: parentProjectId_final });
    const variationNumber = existingCount + 1;

    const base = sourceDoc.toObject({ depopulate: true });
    delete base._id;
    delete base.createdAt;
    delete base.updatedAt;
    delete base.edits;
    delete base.managementApproval;
    if (base.parentQuotation) delete base.parentQuotation;
    if (base.parentRevision) delete base.parentRevision;
    if (base.revisionNumber) delete base.revisionNumber;

    const allowedFields = [
      'companyInfo', 'submittedTo', 'attention', 'offerReference', 'enquiryNumber',
      'offerDate', 'enquiryDate', 'projectTitle', 'introductionText',
      'scopeOfWork', 'priceSchedule', 'ourViewpoints', 'exclusions',
      'paymentTerms', 'deliveryCompletionWarrantyValidity'
    ];

    const nextData = { ...base };
    const diffs = [];
    for (const field of allowedFields) {
      if (typeof data?.[field] === 'undefined') continue;
      const normalizeForDiff = (f, v) => {
        if (v === '' || typeof v === 'undefined') return null;
        if (['offerDate', 'enquiryDate'].includes(f)) {
          if (!v) return null;
          const d = new Date(v);
          if (isNaN(d)) return null;
          return d.toISOString().slice(0, 10);
        }
        return v;
      };
      const fromValRaw = base[field];
      const toValRaw = data[field];
      const fromVal = normalizeForDiff(field, fromValRaw);
      const toVal = normalizeForDiff(field, toValRaw);
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        diffs.push({ field, from: fromVal, to: toVal });
        if (['offerDate', 'enquiryDate'].includes(field)) {
          nextData[field] = toVal ? new Date(toVal) : null;
        } else {
          nextData[field] = toValRaw;
        }
      }
    }

    if (diffs.length === 0) {
      return res.status(400).json({ message: 'No changes detected. Please modify data before creating a variation.' });
    }

    // Get lead from project
    const project = await Project.findById(parentProjectId_final).populate('leadId');
    const leadId = project.leadId?._id || project.leadId;

    const variation = await ProjectVariation.create({
      ...nextData,
      parentProject: parentProjectId_final,
      parentVariation: parentVariationId || undefined,
      variationNumber,
      lead: leadId,
      createdBy: req.user.userId,
      diffFromParent: diffs,
      edits: [],
      managementApproval: {}
    });

    const populated = await ProjectVariation.findById(variation._id)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name')
      .populate('managementApproval.approvedBy', 'name');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating project variation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project variation
router.put('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('manager') || roles.includes('admin') || roles.includes('estimation_engineer'))) {
      return res.status(403).json({ message: 'Not authorized to update variations' });
    }

    const variation = await ProjectVariation.findById(req.params.id);
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    const oldData = variation.toObject();
    const updates = req.body;
    const changes = [];

    Object.keys(updates).forEach(key => {
      if (key === '_id' || key === 'createdAt' || key === 'updatedAt' || key === 'edits') return;
      if (JSON.stringify(oldData[key]) !== JSON.stringify(updates[key])) {
        changes.push({ field: key, from: oldData[key], to: updates[key] });
        variation[key] = updates[key];
      }
    });

    if (changes.length > 0) {
      variation.edits = variation.edits || [];
      variation.edits.push({
        editedBy: req.user.userId,
        editedAt: new Date(),
        changes
      });
    }

    await variation.save();
    const populated = await ProjectVariation.findById(variation._id)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name')
      .populate('managementApproval.approvedBy', 'name');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete project variation
router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('manager') || roles.includes('admin'))) {
      return res.status(403).json({ message: 'Not authorized to delete variations' });
    }

    const variation = await ProjectVariation.findById(req.params.id);
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    // Check if there are child variations
    const childCount = await ProjectVariation.countDocuments({ parentVariation: req.params.id });
    if (childCount > 0) {
      return res.status(400).json({ message: 'Cannot delete variation with child variations' });
    }

    await ProjectVariation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Variation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Request approval for variation
router.post('/:id/request-approval', auth, async (req, res) => {
  try {
    const variation = await ProjectVariation.findById(req.params.id);
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    variation.managementApproval = variation.managementApproval || {};
    variation.managementApproval.status = 'pending';
    variation.managementApproval.requestedBy = req.user.userId;
    variation.managementApproval.logs = variation.managementApproval.logs || [];
    variation.managementApproval.logs.push({
      status: 'pending',
      requestedBy: req.user.userId,
      note: req.body.note || ''
    });

    await variation.save();
    const populated = await ProjectVariation.findById(variation._id)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name')
      .populate('managementApproval.approvedBy', 'name');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/reject variation
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('manager') || roles.includes('admin'))) {
      return res.status(403).json({ message: 'Not authorized to approve variations' });
    }

    const { status, note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const variation = await ProjectVariation.findById(req.params.id);
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    variation.managementApproval = variation.managementApproval || {};
    variation.managementApproval.status = status;
    variation.managementApproval.approvedBy = req.user.userId;
    variation.managementApproval.approvedAt = new Date();
    variation.managementApproval.comments = note || '';
    variation.managementApproval.logs = variation.managementApproval.logs || [];
    variation.managementApproval.logs.push({
      status,
      decidedBy: req.user.userId,
      note: note || ''
    });

    await variation.save();
    const populated = await ProjectVariation.findById(variation._id)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name')
      .populate('managementApproval.approvedBy', 'name');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

