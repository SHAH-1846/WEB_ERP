const express = require('express');
const jwt = require('jsonwebtoken');
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
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// List revisions
router.get('/', auth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.parentQuotation) filter.parentQuotation = req.query.parentQuotation
    const list = await Revision.find(filter)
      .populate('lead', 'customerName projectTitle enquiryNumber enquiryDate')
      .populate('createdBy', 'name email')
      .populate('parentQuotation', 'offerReference projectTitle')
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
    const r = await Revision.findById(req.params.id)
      .populate('lead', 'customerName projectTitle enquiryNumber enquiryDate')
      .populate('createdBy', 'name email')
      .populate('parentQuotation', 'offerReference projectTitle')
      .populate('edits.editedBy', 'name email')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');
    if (!r) return res.status(404).json({ message: 'Revision not found' });
    res.json(r);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a revision from an approved quotation
router.post('/', auth, async (req, res) => {
  try {
    const { sourceQuotationId, sourceRevisionId, data } = req.body;
    if (!sourceQuotationId && !sourceRevisionId) return res.status(400).json({ message: 'sourceQuotationId or sourceRevisionId is required' });
    const sourceDoc = sourceRevisionId ? await Revision.findById(sourceRevisionId) : await Quotation.findById(sourceQuotationId)
      .populate('lead')
      .populate('createdBy')
      .populate('edits.editedBy')
      .populate('managementApproval.requestedBy')
      .populate('managementApproval.approvedBy');
    if (!sourceDoc) return res.status(404).json({ message: 'Source not found' });
    if (!sourceRevisionId && sourceDoc.managementApproval?.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved quotations can be revised' });
    }

    const parentQuotationId = sourceRevisionId ? sourceDoc.parentQuotation : sourceDoc._id;
    const existingCount = await Revision.countDocuments({ parentQuotation: parentQuotationId });
    const revisionNumber = existingCount + 1;
    if (sourceQuotationId && existingCount > 0) {
      return res.status(400).json({ message: 'A revision already exists for this quotation. Delete all revisions to create a new one from the approved quotation.' });
    }

    const base = sourceDoc.toObject({ depopulate: true });
    delete base._id;
    delete base.createdAt;
    delete base.updatedAt;

    const allowedFields = [
      'companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText',
      'scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity'
    ];

    const nextData = { ...base };
    const diffs = [];
    for (const field of allowedFields) {
      if (typeof data?.[field] === 'undefined') continue;
      const normalizeForDiff = (f, v) => {
        if (v === '' || typeof v === 'undefined') return null;
        if (['offerDate','enquiryDate'].includes(f)) {
          if (!v) return null;
          const d = new Date(v);
          if (isNaN(d)) return null;
          return d.toISOString().slice(0,10);
        }
        return v;
      };
      const fromValRaw = base[field];
      const toValRaw = data[field];
      const fromVal = normalizeForDiff(field, fromValRaw);
      const toVal = normalizeForDiff(field, toValRaw);
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        diffs.push({ field, from: fromVal, to: toVal });
        // Persist normalized types for dates
        if (['offerDate','enquiryDate'].includes(field)) {
          nextData[field] = toVal ? new Date(toVal) : null;
        } else {
          nextData[field] = toValRaw;
        }
      }
    }

    if (diffs.length === 0) {
      return res.status(400).json({ message: 'No changes detected. Please modify data before creating a revision.' });
    }

    const revision = await Revision.create({
      ...nextData,
      parentQuotation: parentQuotationId,
      parentRevision: sourceRevisionId || undefined,
      revisionNumber,
      createdBy: req.user.userId,
      diffFromParent: diffs
    });

    const populated = await Revision.findById(revision._id)
      .populate('lead', 'customerName projectTitle enquiryNumber enquiryDate')
      .populate('createdBy', 'name email')
      .populate('parentQuotation', 'offerReference projectTitle')
      .populate('edits.editedBy', 'name email')
      .populate('managementApproval.requestedBy', 'name email')
      .populate('managementApproval.approvedBy', 'name email')
      .populate('managementApproval.logs.requestedBy', 'name email')
      .populate('managementApproval.logs.decidedBy', 'name email');

    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Undo first revision (managers/admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!roles.includes('estimation_engineer')) {
      return res.status(403).json({ message: 'Only estimation engineers can delete revisions' });
    }
    const rev = await Revision.findById(req.params.id);
    if (!rev) return res.status(404).json({ message: 'Revision not found' });
    const children = await Revision.countDocuments({ parentRevision: rev._id });
    if (children > 0) return res.status(400).json({ message: 'Cannot delete: subsequent revisions depend on this revision' });
    await Revision.deleteOne({ _id: rev._id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


