const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ProjectVariation = require('../models/ProjectVariation');
const Project = require('../models/Project');
const Quotation = require('../models/Quotation');
const Revision = require('../models/Revision');
const AuditLog = require('../models/AuditLog');
const router = express.Router();

// Configure multer for file uploads (variations)
const uploadsDir = path.join(__dirname, '..', 'uploads', 'variations');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|mp4|mov|avi|wmv|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, documents, and videos are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

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
    const { parentProject, parentVariation } = req.query;
    const query = {};
    if (parentProject) query.parentProject = parentProject;
    if (parentVariation) query.parentVariation = parentVariation;
    
    const variations = await ProjectVariation.find(query)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email')
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
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');
    if (!variation) return res.status(404).json({ message: 'Variation not found' });
    res.json(variation);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a project variation from a project
router.post('/', auth, (req, res, next) => {
  upload.array('attachments', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Maximum 10 files allowed' });
      }
      if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    // Parse data from FormData or JSON body
    let parentProjectId, parentVariationId, data;
    
    // Check if this is FormData (has files or data[...] keys)
    const isFormData = req.files && req.files.length > 0 || Object.keys(req.body).some(key => key.startsWith('data['));
    
    if (isFormData) {
      // FormData format
      parentProjectId = req.body.parentProjectId;
      parentVariationId = req.body.parentVariationId;
      data = {};
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('data[') && key.endsWith(']')) {
          const fieldName = key.slice(5, -1);
          try {
            data[fieldName] = JSON.parse(req.body[key]);
          } catch {
            data[fieldName] = req.body[key];
          }
        }
      });
    } else {
      // JSON format
      parentProjectId = req.body.parentProjectId;
      parentVariationId = req.body.parentVariationId;
      data = req.body.data;
    }
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
    
    // Get project to generate project key and lead
    const project = await Project.findById(parentProjectId_final).populate('leadId');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    // Generate project key from project name (uppercase, alphanumeric, max 8 chars)
    const projectKey = project.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8) || 'PROJ';
    
    // Count existing variations for this project
    const existingCount = await ProjectVariation.countDocuments({ parentProject: parentProjectId_final });
    const variationNum = existingCount + 1;
    const variationNumber = `${projectKey}-VAR-${String(variationNum).padStart(3, '0')}`;

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

    // Check if files are present - they count as a change
    const hasFiles = req.files && req.files.length > 0;
    
    if (diffs.length === 0 && !hasFiles) {
      // Clean up any uploaded files if validation fails
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          try {
            const filePath = path.join(uploadsDir, file.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Cleaned up uploaded file after validation failure: ${file.filename}`);
            }
          } catch (fileError) {
            console.error(`Error cleaning up file ${file.filename}:`, fileError);
          }
        });
      }
      return res.status(400).json({ message: 'No changes detected. Please modify data before creating a variation.' });
    }
    
    // If files are present, add them to diffs
    if (hasFiles && !diffs.find(d => d.field === 'attachments')) {
      diffs.push({ 
        field: 'attachments', 
        from: '(none)', 
        to: `${req.files.length} file(s) uploaded` 
      });
    }

    // Get lead from project (already fetched above)
    const leadId = project.leadId?._id || project.leadId;

    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/variations/${file.filename}`,
          mimetype: file.mimetype,
          size: file.size
        });
      });
    }

    const variation = await ProjectVariation.create({
      ...nextData,
      parentProject: parentProjectId_final,
      parentVariation: parentVariationId || undefined,
      variationNumber,
      lead: leadId,
      createdBy: req.user.userId,
      diffFromParent: diffs,
      edits: [],
      managementApproval: {},
      attachments: attachments
    });

    const populated = await ProjectVariation.findById(variation._id)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating project variation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project variation
router.put('/:id', auth, (req, res, next) => {
  upload.array('attachments', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Maximum 10 files allowed' });
      }
      if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('manager') || roles.includes('admin') || roles.includes('estimation_engineer'))) {
      return res.status(403).json({ message: 'Not authorized to update variations' });
    }

    const variation = await ProjectVariation.findById(req.params.id);
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    // Prevent editing approved variations
    if (variation.managementApproval?.status === 'approved') {
      return res.status(403).json({ message: 'Cannot edit an approved variation. The variation must be rejected or have its approval status reverted first.' });
    }

    // Parse data from FormData or JSON body
    let updateData;
    
    // Check if this is FormData (has files or data[...] keys or direct field keys)
    const isFormData = req.files && req.files.length > 0 || Object.keys(req.body).some(key => key.startsWith('data[')) || (req.body.removeAttachments !== undefined);
    
    if (isFormData) {
      // FormData format
      updateData = {};
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('data[') && key.endsWith(']')) {
          const fieldName = key.slice(5, -1);
          try {
            updateData[fieldName] = JSON.parse(req.body[key]);
          } catch {
            updateData[fieldName] = req.body[key];
          }
        } else if (key !== 'parentProjectId' && key !== 'parentVariationId' && key !== 'removeAttachments' && key !== 'attachments') {
          // Try to parse as JSON first, fallback to string
          try {
            updateData[key] = JSON.parse(req.body[key]);
          } catch {
            updateData[key] = req.body[key];
          }
        }
      });
    } else {
      // JSON format
      updateData = req.body;
    }

    const oldData = variation.toObject();
    const changes = [];

    // Handle file attachments
    if (req.files && req.files.length > 0) {
      if (!variation.attachments) variation.attachments = [];
      req.files.forEach(file => {
        variation.attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/variations/${file.filename}`,
          mimetype: file.mimetype,
          size: file.size
        });
      });
    }

    // Handle attachment removals
    if (req.body.removeAttachments) {
      const indicesToRemove = Array.isArray(req.body.removeAttachments) 
        ? req.body.removeAttachments 
        : [req.body.removeAttachments];
      
      // Delete files from filesystem and track removals
      for (const index of indicesToRemove) {
        const idx = parseInt(index);
        if (idx >= 0 && idx < variation.attachments.length) {
          const attachment = variation.attachments[idx];
          try {
            const filePath = path.join(__dirname, '..', 'uploads', 'variations', attachment.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Removed attachment: ${attachment.filename}`);
            }
          } catch (fileError) {
            console.error(`Error removing file ${attachment.filename}:`, fileError);
          }
        }
      }
      
      // Remove from database
      variation.attachments = variation.attachments.filter((_, idx) => 
        !indicesToRemove.includes(idx.toString())
      );
    }

    // Update other fields
    const allowedFields = [
      'companyInfo', 'submittedTo', 'attention', 'offerReference', 'enquiryNumber',
      'offerDate', 'enquiryDate', 'projectTitle', 'introductionText',
      'scopeOfWork', 'priceSchedule', 'ourViewpoints', 'exclusions',
      'paymentTerms', 'deliveryCompletionWarrantyValidity'
    ];

    allowedFields.forEach(key => {
      if (updateData[key] !== undefined) {
        const oldVal = oldData[key];
        const newVal = updateData[key];
        
        // Handle date fields
        if (['offerDate', 'enquiryDate'].includes(key) && newVal) {
          const dateVal = new Date(newVal);
          if (!isNaN(dateVal.getTime())) {
            if (JSON.stringify(oldVal) !== JSON.stringify(dateVal)) {
              changes.push({ field: key, from: oldVal, to: dateVal });
              variation[key] = dateVal;
            }
          }
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push({ field: key, from: oldVal, to: newVal });
          variation[key] = newVal;
        }
      }
    });

    // Track attachment changes
    const originalAttachmentCount = oldData.attachments ? oldData.attachments.length : 0;
    const newAttachmentCount = variation.attachments ? variation.attachments.length : 0;
    if (originalAttachmentCount !== newAttachmentCount) {
      const originalNames = oldData.attachments ? oldData.attachments.map(a => a.originalName || a.filename).sort() : [];
      const newNames = variation.attachments ? variation.attachments.map(a => a.originalName || a.filename).sort() : [];
      changes.push({ 
        field: 'attachments', 
        from: originalNames.length > 0 ? `${originalAttachmentCount} file(s): ${originalNames.join(', ')}` : '(none)',
        to: newNames.length > 0 ? `${newAttachmentCount} file(s): ${newNames.join(', ')}` : '(none)'
      });
    }

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
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');
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

    const variation = await ProjectVariation.findById(req.params.id)
      .populate('parentProject', 'name')
      .populate('lead', 'customerName projectTitle')
      .populate('createdBy', 'name email');
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    // Check if there are child variations
    const childCount = await ProjectVariation.countDocuments({ parentVariation: req.params.id });
    if (childCount > 0) {
      return res.status(400).json({ message: 'Cannot delete variation with child variations' });
    }

    // Create audit log before deletion
    const projectData = typeof variation.parentProject === 'object' ? variation.parentProject : null;
    const leadData = typeof variation.lead === 'object' ? variation.lead : null;
    let createdById = null;
    if (variation.createdBy) {
      if (typeof variation.createdBy === 'object' && variation.createdBy._id) {
        createdById = variation.createdBy._id;
      } else {
        createdById = variation.createdBy;
      }
    }
    
    try {
      await AuditLog.create({
        action: 'project_variation_deleted',
        entityType: 'project_variation',
        entityId: variation._id,
        entityData: {
          variationName: variation.name || null,
          projectName: projectData?.name || null,
          projectTitle: leadData?.projectTitle || null,
          customerName: leadData?.customerName || null,
          managementApprovalStatus: variation.managementApproval?.status || null,
          createdBy: createdById,
          createdAt: variation.createdAt || null
        },
        deletedBy: req.user.userId,
        deletedAt: new Date(),
        reason: (req.body && req.body.reason) ? req.body.reason : null,
        ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown'
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
    }

    // Delete attachment files from filesystem
    if (variation.attachments && Array.isArray(variation.attachments) && variation.attachments.length > 0) {
      variation.attachments.forEach(attachment => {
        try {
          const filePath = path.join(uploadsDir, attachment.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted attachment file: ${attachment.filename}`);
          }
        } catch (fileError) {
          console.error(`Error deleting attachment file ${attachment.filename}:`, fileError);
        }
      });
    }

    await ProjectVariation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Variation deleted successfully' });
  } catch (error) {
    console.error('Error deleting project variation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Management approval for variations (mirrors revisions module)
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const note = req.body.note ?? req.body.comments;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const variation = await ProjectVariation.findById(req.params.id);
    if (!variation) return res.status(404).json({ message: 'Variation not found' });

    const roles = req.user.roles || [];
    const isCreator = variation.createdBy?.toString?.() === req.user.userId;

    if (status === 'pending') {
      if (!(isCreator || roles.includes('estimation_engineer'))) {
        return res.status(403).json({ message: 'Not authorized to request approval' });
      }
      const prev = variation.managementApproval || {};
      variation.managementApproval = {
        ...prev,
        status: 'pending',
        requestedBy: req.user.userId,
        approvedBy: undefined,
        approvedAt: undefined,
        comments: note || prev.comments
      };
      variation.managementApproval.logs = Array.isArray(prev.logs) ? prev.logs : [];
      variation.managementApproval.logs.push({ 
        status: 'pending', 
        at: new Date(),
        requestedBy: req.user.userId, 
        note: note || '' 
      });
    } else {
      if (!(roles.includes('manager') || roles.includes('admin'))) {
        return res.status(403).json({ message: 'Not authorized to approve/reject' });
      }
      const prev = variation.managementApproval || {};
      variation.managementApproval = {
        ...prev,
        status,
        approvedBy: req.user.userId,
        approvedAt: new Date(),
        comments: note || prev.comments,
        requestedBy: prev.requestedBy
      };
      variation.managementApproval.logs = Array.isArray(prev.logs) ? prev.logs : [];
      variation.managementApproval.logs.push({ 
        status, 
        at: new Date(),
        decidedBy: req.user.userId, 
        note: note || '' 
      });
    }

    await variation.save();
    
    // Create audit log for approval/rejection actions
    try {
      let auditAction = null;
      if (status === 'pending') {
        auditAction = 'project_variation_approval_requested';
      } else if (status === 'approved') {
        auditAction = 'project_variation_approved';
      } else if (status === 'rejected') {
        auditAction = 'project_variation_rejected';
      }
      
      if (auditAction) {
        const projectData = typeof variation.parentProject === 'object' ? variation.parentProject : null;
        const leadData = typeof variation.lead === 'object' ? variation.lead : null;
        await AuditLog.create({
          action: auditAction,
          entityType: 'project_variation',
          entityId: variation._id,
          entityData: {
            variationName: variation.name || null,
            projectName: projectData?.name || null,
            projectTitle: leadData?.projectTitle || null,
            customerName: leadData?.customerName || null,
            managementApprovalStatus: status
          },
          performedBy: req.user.userId,
          performedAt: new Date(),
          reason: note || null,
          ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
          userAgent: req.get('user-agent') || 'unknown'
        });
      }
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
    }
    
    const populated = await ProjectVariation.findById(variation._id)
      .populate('parentProject', 'name')
      .populate('lead')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

