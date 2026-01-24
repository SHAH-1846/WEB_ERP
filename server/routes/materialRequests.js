const express = require('express');
const jwt = require('jsonwebtoken');
const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const Material = require('../models/Material');
const User = require('../models/User');
const router = express.Router();

// Auth middleware
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

// Role checks
const canAccessMaterialRequests = (roles) => {
  return roles.some(r => ['admin', 'manager', 'inventory_manager', 'project_engineer'].includes(r));
};

const canCreateMaterialRequest = (roles) => {
  return roles.some(r => ['admin', 'manager', 'project_engineer'].includes(r));
};

const canReviewMaterialRequest = (roles) => {
  return roles.some(r => ['admin', 'manager', 'inventory_manager'].includes(r));
};

// Get all material requests (with filters)
router.get('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!canAccessMaterialRequests(roles)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    let query = {};

    // Filter by project
    if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by priority
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // Project engineers can only see their own requests (unless admin/manager)
    if (roles.includes('project_engineer') && !roles.some(r => ['admin', 'manager', 'inventory_manager'].includes(r))) {
      query.requestedBy = req.user.userId;
    }

    // Search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { requestNumber: searchRegex },
        { requesterName: searchRegex },
        { purpose: searchRegex }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      MaterialRequest.find(query)
        .populate('projectId', 'name')
        .populate('requestedBy', 'name email')
        .populate('reviewedBy', 'name email')
        .populate('items.materialId', 'name sku')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MaterialRequest.countDocuments(query)
    ]);

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching material requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get material requests for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!canAccessMaterialRequests(roles)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const requests = await MaterialRequest.find({ projectId: req.params.projectId })
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('items.materialId', 'name sku')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching project material requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single material request
router.get('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!canAccessMaterialRequests(roles)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const request = await MaterialRequest.findById(req.params.id)
      .populate('projectId', 'name locationDetails')
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('fulfilledBy', 'name email')
      .populate('items.materialId', 'name sku uom');

    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create material request
router.post('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!canCreateMaterialRequest(roles)) {
      return res.status(403).json({ message: 'Only project engineers, managers, and admins can create material requests.' });
    }

    const { projectId, items, priority, requiredDate, purpose, notes, requesterPhone } = req.body;

    if (!projectId || !items || items.length === 0) {
      return res.status(400).json({ message: 'Project and at least one item are required.' });
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Get requester info
    const requester = await User.findById(req.user.userId);
    
    const request = await MaterialRequest.create({
      projectId,
      items,
      priority: priority || 'normal',
      requiredDate,
      purpose,
      notes,
      requestedBy: req.user.userId,
      requesterName: requester?.name || '',
      requesterEmail: requester?.email || '',
      requesterPhone: requesterPhone || ''
    });

    await request.populate('projectId', 'name');
    await request.populate('requestedBy', 'name email');

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update material request (before approval)
router.put('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    // Only requester or admin/manager can update pending requests
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be updated.' });
    }

    if (request.requestedBy.toString() !== req.user.userId && !roles.some(r => ['admin', 'manager'].includes(r))) {
      return res.status(403).json({ message: 'You can only edit your own requests.' });
    }

    const { items, priority, requiredDate, purpose, notes, requesterPhone } = req.body;

    if (items) request.items = items;
    if (priority) request.priority = priority;
    if (requiredDate !== undefined) request.requiredDate = requiredDate;
    if (purpose !== undefined) request.purpose = purpose;
    if (notes !== undefined) request.notes = notes;
    if (requesterPhone !== undefined) request.requesterPhone = requesterPhone;

    await request.save();
    await request.populate('projectId', 'name');
    await request.populate('requestedBy', 'name email');

    res.json(request);
  } catch (error) {
    console.error('Error updating material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Review material request (approve/reject)
router.patch('/:id/review', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!canReviewMaterialRequest(roles)) {
      return res.status(403).json({ message: 'Only inventory managers, managers, and admins can review requests.' });
    }

    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be reviewed.' });
    }

    const { status, reviewNotes } = req.body;

    if (!['approved', 'partially_approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid review status.' });
    }

    request.status = status;
    request.reviewedBy = req.user.userId;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes || '';

    await request.save();
    await request.populate('projectId', 'name');
    await request.populate('requestedBy', 'name email');
    await request.populate('reviewedBy', 'name email');

    res.json(request);
  } catch (error) {
    console.error('Error reviewing material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as fulfilled
router.patch('/:id/fulfill', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!roles.some(r => ['admin', 'manager', 'inventory_manager', 'store_keeper'].includes(r))) {
      return res.status(403).json({ message: 'Only inventory staff can mark requests as fulfilled.' });
    }

    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    if (!['approved', 'partially_approved'].includes(request.status)) {
      return res.status(400).json({ message: 'Only approved requests can be fulfilled.' });
    }

    const { fulfillmentNotes } = req.body;

    request.status = 'fulfilled';
    request.fulfilledBy = req.user.userId;
    request.fulfilledAt = new Date();
    request.fulfillmentNotes = fulfillmentNotes || '';

    await request.save();
    await request.populate('projectId', 'name');
    await request.populate('requestedBy', 'name email');
    await request.populate('fulfilledBy', 'name email');

    res.json(request);
  } catch (error) {
    console.error('Error fulfilling material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel request
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    // Only requester or admin/manager can cancel
    const roles = req.user.roles || [];
    if (request.requestedBy.toString() !== req.user.userId && !roles.some(r => ['admin', 'manager'].includes(r))) {
      return res.status(403).json({ message: 'You can only cancel your own requests.' });
    }

    if (!['pending', 'approved'].includes(request.status)) {
      return res.status(400).json({ message: 'This request cannot be cancelled.' });
    }

    request.status = 'cancelled';
    await request.save();

    res.json(request);
  } catch (error) {
    console.error('Error cancelling material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete request (admin only, pending only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Only admins can delete requests.' });
    }

    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be deleted.' });
    }

    await MaterialRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Material request deleted successfully' });
  } catch (error) {
    console.error('Error deleting material request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
