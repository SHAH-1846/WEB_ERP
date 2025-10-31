const express = require('express');
const jwt = require('jsonwebtoken');
const Quotation = require('../models/Quotation');
const Lead = require('../models/Lead');
const router = express.Router();

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// List quotations
router.get('/', auth, async (req, res) => {
  try {
    const list = await Quotation.find()
      .populate('lead', 'customerName projectTitle enquiryNumber enquiryDate')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name email')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get one
router.get('/:id', auth, async (req, res) => {
  try {
    const q = await Quotation.findById(req.params.id)
      .populate('lead', 'customerName projectTitle enquiryNumber enquiryDate')
      .populate('createdBy', 'name email')
      .populate('edits.editedBy', 'name email')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');
    if (!q) return res.status(404).json({ message: 'Quotation not found' });
    res.json(q);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create quotation (estimation engineers only)
router.post('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!roles.includes('estimation_engineer')) {
      return res.status(403).json({ message: 'Only estimation engineers can create quotations' });
    }

    const { lead: leadId } = req.body;
    if (!leadId) return res.status(400).json({ message: 'Lead is required' });
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const quotation = await Quotation.create({
      ...req.body,
      createdBy: req.user.userId
    });
    const populated = await Quotation.findById(quotation._id)
      .populate('lead', 'customerName projectTitle enquiryNumber enquiryDate')
      .populate('createdBy', 'name email');
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update quotation (creator or estimation engineers)
router.put('/:id', auth, async (req, res) => {
  try {
    const q = await Quotation.findById(req.params.id);
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    const roles = req.user.roles || [];
    const isCreator = q.createdBy.toString() === req.user.userId;
    if (!isCreator && !roles.includes('estimation_engineer')) {
      return res.status(403).json({ message: 'Not authorized to edit quotation' });
    }

    // Prevent edits once approved
    if (q.managementApproval?.status === 'approved') {
      return res.status(400).json({ message: 'Approved quotations cannot be edited' });
    }

    const updatableRootFields = [
      'submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText','ourViewpoints'
    ];

    const changes = [];

    for (const field of updatableRootFields) {
      if (typeof req.body[field] === 'undefined') continue;
      const from = q[field];
      const to = req.body[field];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field, from, to });
        q[field] = to;
      }
    }

    if (typeof req.body.companyInfo !== 'undefined') {
      const from = q.companyInfo;
      const to = req.body.companyInfo;
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: 'companyInfo', from, to });
        q.companyInfo = to;
      }
    }
    if (typeof req.body.scopeOfWork !== 'undefined') {
      const from = q.scopeOfWork;
      const to = req.body.scopeOfWork;
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: 'scopeOfWork', from, to });
        q.scopeOfWork = to;
      }
    }
    if (typeof req.body.priceSchedule !== 'undefined') {
      const from = q.priceSchedule;
      const to = req.body.priceSchedule;
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: 'priceSchedule', from, to });
        q.priceSchedule = to;
      }
    }
    if (typeof req.body.exclusions !== 'undefined') {
      const from = q.exclusions;
      const to = req.body.exclusions;
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: 'exclusions', from, to });
        q.exclusions = to;
      }
    }
    if (typeof req.body.paymentTerms !== 'undefined') {
      const from = q.paymentTerms;
      const to = req.body.paymentTerms;
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: 'paymentTerms', from, to });
        q.paymentTerms = to;
      }
    }
    if (typeof req.body.deliveryCompletionWarrantyValidity !== 'undefined') {
      const from = q.deliveryCompletionWarrantyValidity;
      const to = req.body.deliveryCompletionWarrantyValidity;
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field: 'deliveryCompletionWarrantyValidity', from, to });
        q.deliveryCompletionWarrantyValidity = to;
      }
    }

    if (changes.length > 0) {
      q.edits.push({ editedBy: req.user.userId, changes });
    }

    await q.save();
    await q.populate('edits.editedBy', 'name email');
    res.json(q);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Management approval
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const note = req.body.note ?? req.body.comments;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const q = await Quotation.findById(req.params.id);
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    const roles = req.user.roles || [];
    const isCreator = q.createdBy?.toString?.() === req.user.userId;

    if (status === 'pending') {
      if (!(isCreator || roles.includes('estimation_engineer'))) {
        return res.status(403).json({ message: 'Not authorized to request approval' });
      }
      const prev = q.managementApproval || {};
      q.managementApproval = {
        ...prev,
        status: 'pending',
        requestedBy: req.user.userId,
        approvedBy: undefined,
        approvedAt: undefined,
        comments: note || prev.comments
      };
      q.managementApproval.logs = Array.isArray(prev.logs) ? prev.logs : [];
      q.managementApproval.logs.push({ status: 'pending', requestedBy: req.user.userId, note });
    } else {
      if (!(roles.includes('manager') || roles.includes('admin'))) {
        return res.status(403).json({ message: 'Not authorized to approve/reject' });
      }
      const prev = q.managementApproval || {};
      q.managementApproval = {
        ...prev,
        status,
        approvedBy: req.user.userId,
        approvedAt: new Date(),
        comments: note || prev.comments,
        requestedBy: prev.requestedBy
      };
      q.managementApproval.logs = Array.isArray(prev.logs) ? prev.logs : [];
      q.managementApproval.logs.push({ status, decidedBy: req.user.userId, note });
    }

    await q.save();
    await q.populate('managementApproval.requestedBy', 'name email');
    await q.populate('managementApproval.approvedBy', 'name email');
    await q.populate('managementApproval.logs.requestedBy', 'name email');
    await q.populate('managementApproval.logs.decidedBy', 'name email');
    res.json(q);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


