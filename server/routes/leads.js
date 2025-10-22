const express = require('express');
const Lead = require('../models/Lead');
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
      .populate('approvals.accounts.approvedBy', 'name')
      .populate('approvals.management.approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(leads);
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

// Submit lead for approval
router.patch('/:id/submit', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (lead.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check required fields
    if (!lead.name || !lead.locationDetails) {
      return res.status(400).json({ message: 'Name and Location Details are required' });
    }

    lead.status = 'submitted';
    await lead.save();
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/Reject lead
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const { type, status, comments } = req.body; // type: 'accounts' or 'management'
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const userRoles = req.user.roles;
    const canApprove = (type === 'accounts' && userRoles.includes('account_manager')) ||
                      (type === 'management' && (userRoles.includes('manager') || userRoles.includes('admin')));

    if (!canApprove) {
      return res.status(403).json({ message: 'Not authorized to approve' });
    }

    lead.approvals[type] = {
      status,
      approvedBy: req.user.userId,
      approvedAt: new Date(),
      comments
    };

    // Check if both approvals are done
    if (lead.approvals.accounts.status === 'approved' && lead.approvals.management.status === 'approved') {
      lead.status = 'approved';
    } else if (lead.approvals.accounts.status === 'rejected' || lead.approvals.management.status === 'rejected') {
      lead.status = 'rejected';
    }

    await lead.save();
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

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

    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;