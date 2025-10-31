const express = require('express');
const Lead = require('../models/Lead');
const SiteVisit = require('../models/SiteVisit');
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');
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

// Get all leads
router.get('/', auth, async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single lead by id with populated fields
router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name email')
      ;
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create lead (Supervisors only)
router.post('/', auth, async (req, res) => {
  try {
    const canCreate = req.user.roles.includes('supervisor') || req.user.roles.includes('sales_engineer') || req.user.roles.includes('estimation_engineer');
    if (!canCreate) {
      return res.status(403).json({ message: 'Only supervisors, sales engineers or estimation engineers can create leads' });
    }

    const { customerName, projectTitle, enquiryNumber, enquiryDate, scopeSummary, submissionDueDate } = req.body;
    
    // Validate minimal required fields for the new role-based creation
    if ((req.user.roles.includes('sales_engineer') || req.user.roles.includes('estimation_engineer')) && (!customerName || !projectTitle || !enquiryNumber || !enquiryDate || !scopeSummary || !submissionDueDate)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const lead = new Lead({
      customerName,
      projectTitle,
      enquiryNumber,
      enquiryDate,
      scopeSummary,
      submissionDueDate,
      name: projectTitle,
      createdBy: req.user.userId
    });

    await lead.save();
    await lead.populate('createdBy', 'name email');
    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Note: Lead approval routes removed; approvals handled on Quotation level now.

// Convert lead to project
router.post('/:id/convert', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (lead.status !== 'approved') {
      return res.status(400).json({ message: 'Lead must be approved first' });
    }

    const project = new Project({
      name: lead.name,
      budget: lead.budget,
      locationDetails: lead.locationDetails,
      workingHours: lead.workingHours,
      manpowerCount: lead.manpowerCount,
      leadId: lead._id,
      createdBy: req.user.userId
    });

    await project.save();
    
    lead.status = 'converted';
    lead.projectId = project._id;
    await lead.save();

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update lead (creator can edit only when draft)
router.put('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const canEditByRole = (req.user.roles || []).some(r => ['sales_engineer', 'estimation_engineer'].includes(r));
    const isCreator = lead.createdBy.toString() === req.user.userId;
    if (!isCreator && !canEditByRole) {
      return res.status(403).json({ message: 'Not authorized to edit this lead' });
    }

    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be edited' });
    }

    const { customerName, projectTitle, enquiryNumber, enquiryDate, scopeSummary, submissionDueDate } = req.body;

    if ((req.user.roles.includes('sales_engineer') || req.user.roles.includes('estimation_engineer')) && (!customerName || !projectTitle || !enquiryNumber || !enquiryDate || !scopeSummary || !submissionDueDate)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const fields = { customerName, projectTitle, enquiryNumber, enquiryDate, scopeSummary, submissionDueDate };
    const changes = [];
    for (const [field, newValue] of Object.entries(fields)) {
      const oldValue = lead[field];
      const isDifferent = (oldValue instanceof Date || newValue instanceof Date)
        ? (new Date(oldValue).getTime() !== new Date(newValue).getTime())
        : oldValue !== newValue;
      if (typeof newValue !== 'undefined' && isDifferent) {
        changes.push({ field, from: oldValue, to: newValue });
        lead[field] = newValue;
      }
    }
    if (typeof projectTitle !== 'undefined') {
      lead.name = projectTitle;
    }

    if (changes.length > 0) {
      lead.edits.push({ editedBy: req.user.userId, changes });
    }

    await lead.save();
    await lead.populate('createdBy', 'name email');
    await lead.populate('edits.editedBy', 'name email');
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete lead (creator can delete only when draft)
router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (lead.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this lead' });
    }

    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be deleted' });
    }

    // Do not allow deletion if there are site visits
    const visitCount = await SiteVisit.countDocuments({ lead: lead._id });
    if (visitCount > 0) {
      return res.status(400).json({ message: 'Cannot delete lead with existing site visits' });
    }

    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Create a site visit for a lead (project engineers only)
router.post('/:id/site-visits', auth, async (req, res) => {
  try {
    if (!req.user.roles.includes('project_engineer')) {
      return res.status(403).json({ message: 'Only project engineers can create site visits' });
    }
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const { visitAt, siteLocation, engineerName, workProgressSummary, safetyObservations, qualityMaterialCheck, issuesFound, actionItems, weatherConditions, description } = req.body;
    if (!visitAt || !siteLocation || !engineerName || !workProgressSummary || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const siteVisit = await SiteVisit.create({
      lead: lead._id,
      visitAt,
      siteLocation,
      engineerName,
      workProgressSummary,
      safetyObservations,
      qualityMaterialCheck,
      issuesFound,
      actionItems,
      weatherConditions,
      description,
      createdBy: req.user.userId
    });

    res.status(201).json(siteVisit);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List site visits for a lead
router.get('/:id/site-visits', auth, async (req, res) => {
  try {
    const visits = await SiteVisit.find({ lead: req.params.id })
      .sort({ visitAt: -1 })
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name email');
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update site visit (project or estimation engineers)
router.put('/:leadId/site-visits/:visitId', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const canEdit = roles.includes('project_engineer') || roles.includes('estimation_engineer');
    if (!canEdit) return res.status(403).json({ message: 'Not authorized to edit site visit' });

    const sv = await SiteVisit.findOne({ _id: req.params.visitId, lead: req.params.leadId });
    if (!sv) return res.status(404).json({ message: 'Site visit not found' });

    const fields = ['visitAt','siteLocation','engineerName','workProgressSummary','safetyObservations','qualityMaterialCheck','issuesFound','actionItems','weatherConditions','description'];
    const changes = [];
    for (const field of fields) {
      if (typeof req.body[field] === 'undefined') continue;
      const oldValue = sv[field];
      const newValue = req.body[field];
      const isDifferent = (oldValue instanceof Date || newValue instanceof Date)
        ? (new Date(oldValue).getTime() !== new Date(newValue).getTime())
        : oldValue !== newValue;
      if (isDifferent) {
        changes.push({ field, from: oldValue, to: newValue });
        sv[field] = newValue;
      }
    }

    if (changes.length > 0) {
      sv.edits.push({ editedBy: req.user.userId, changes });
    }

    await sv.save();
    await sv.populate('edits.editedBy', 'name email');
    res.json(sv);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});