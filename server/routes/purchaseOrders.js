const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Material = require('../models/Material');
const User = require('../models/User');

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

// GET all purchase orders
router.get('/', auth, async (req, res) => {
  try {
    const { status, projectId, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (projectId) filter.projectId = projectId;
    
    // Role-based filtering
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isManager = roles.includes('manager');
    const isIM = roles.includes('inventory_manager');
    const isPE = roles.includes('procurement_engineer');
    
    // IM sees their own orders, PE sees all orders (to process), Admin/Manager see all
    if (!isAdmin && !isManager && !isPE) {
      if (isIM) {
        filter.createdBy = req.user.userId;
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('projectId', 'name')
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('items.materialId', 'name sku')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseOrder.countDocuments(filter)
    ]);
    
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single purchase order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate('projectId', 'name locationDetails')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('fulfilledBy', 'name email')
      .populate('items.materialId', 'name sku quantity uom');
    
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create purchase order (Inventory Manager only)
router.post('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isManager = roles.includes('manager');
    const isIM = roles.includes('inventory_manager');
    
    if (!isAdmin && !isManager && !isIM) {
      return res.status(403).json({ message: 'Only Inventory Managers can create purchase orders' });
    }
    
    const { projectId, supplier, items, deliveryDate, notes, priority } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    
    // Find a procurement engineer to assign
    let assignedTo = null;
    try {
      const procurementEngineer = await User.findOne({ 
        roles: 'procurement_engineer',
        status: { $ne: 'inactive' }
      });
      if (procurementEngineer) {
        assignedTo = procurementEngineer._id;
      }
    } catch (err) {
      console.log('No procurement engineer found, order will be unassigned');
    }
    
    const order = new PurchaseOrder({
      projectId: projectId || null,
      supplier,
      items,
      deliveryDate,
      notes,
      priority: priority || 'normal',
      status: 'pending',
      createdBy: req.user.userId,
      assignedTo
    });
    
    await order.save();
    
    const populated = await PurchaseOrder.findById(order._id)
      .populate('projectId', 'name')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email');
    
    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH approve purchase order (Procurement Engineer)
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isManager = roles.includes('manager');
    const isPE = roles.includes('procurement_engineer');
    
    if (!isAdmin && !isManager && !isPE) {
      return res.status(403).json({ message: 'Only Procurement Engineers can approve orders' });
    }
    
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be approved' });
    }
    
    order.status = 'approved';
    order.reviewedBy = req.user.userId;
    order.reviewedAt = new Date();
    order.reviewNotes = req.body?.notes || '';
    
    await order.save();
    
    const populated = await PurchaseOrder.findById(order._id)
      .populate('projectId', 'name')
      .populate('createdBy', 'name email')
      .populate('reviewedBy', 'name email');
    
    res.json(populated);
  } catch (error) {
    console.error('Error approving purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH reject purchase order (Procurement Engineer)
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isManager = roles.includes('manager');
    const isPE = roles.includes('procurement_engineer');
    
    if (!isAdmin && !isManager && !isPE) {
      return res.status(403).json({ message: 'Only Procurement Engineers can reject orders' });
    }
    
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be rejected' });
    }
    
    order.status = 'rejected';
    order.reviewedBy = req.user.userId;
    order.reviewedAt = new Date();
    order.reviewNotes = req.body.notes || req.body.reason || '';
    
    await order.save();
    
    res.json(order);
  } catch (error) {
    console.error('Error rejecting purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH fulfill purchase order (Procurement Engineer) - no inventory update yet
router.patch('/:id/fulfill', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isManager = roles.includes('manager');
    const isPE = roles.includes('procurement_engineer');
    
    if (!isAdmin && !isManager && !isPE) {
      return res.status(403).json({ message: 'Only Procurement Engineers can fulfill orders' });
    }
    
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    if (order.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved orders can be fulfilled' });
    }
    
    // Store delivered items (inventory will be updated on GRN receive)
    const { deliveredItems } = req.body || {};
    const fulfillmentDetails = [];
    
    for (const orderItem of order.items) {
      const materialId = orderItem.materialId;
      const delivered = deliveredItems?.find(d => String(d.materialId) === String(materialId));
      const deliveredQty = delivered ? Number(delivered.deliveredQty) : orderItem.quantity;
      
      fulfillmentDetails.push({
        materialId,
        requestedQty: orderItem.quantity,
        deliveredQty
      });
    }
    
    order.status = 'fulfilled';
    order.fulfilledBy = req.user.userId;
    order.fulfilledAt = new Date();
    order.fulfillmentDetails = fulfillmentDetails;
    
    await order.save();
    
    res.json(order);
  } catch (error) {
    console.error('Error fulfilling purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH receive purchase order - GRN submission (Inventory Manager)
router.patch('/:id/receive', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isManager = roles.includes('manager');
    const isIM = roles.includes('inventory_manager');
    
    if (!isAdmin && !isManager && !isIM) {
      return res.status(403).json({ message: 'Only Inventory Managers can receive orders' });
    }
    
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    if (order.status !== 'fulfilled') {
      return res.status(400).json({ message: 'Only fulfilled orders can be received' });
    }
    
    const { 
      receivedItems, 
      notes,
      deliveryDate,
      deliveryPersonName,
      deliveryPersonContact,
      vehicleNumber,
      overallCondition,
      conditionNotes,
      receiverName,
      acknowledgmentNotes
    } = req.body || {};
    
    const receivedItemsData = [];
    
    // Process received items and update inventory
    for (const fulfillItem of order.fulfillmentDetails) {
      const materialId = fulfillItem.materialId;
      const received = receivedItems?.find(r => String(r.materialId) === String(materialId));
      const receivedQty = received ? Number(received.receivedQty) : fulfillItem.deliveredQty;
      const condition = received?.condition || 'good';
      const remarks = received?.remarks || '';
      
      // Update material inventory
      if (receivedQty > 0) {
        const material = await Material.findById(materialId);
        if (material) {
          material.quantity = (material.quantity || 0) + receivedQty;
          await material.save();
        }
      }
      
      receivedItemsData.push({
        materialId,
        deliveredQty: fulfillItem.deliveredQty,
        receivedQty,
        condition,
        remarks
      });
    }
    
    // Generate GRN number
    const grnCount = await PurchaseOrder.countDocuments({ grnNumber: { $exists: true, $ne: null } });
    const grnNumber = `GRN-${String(grnCount + 1).padStart(5, '0')}`;
    
    order.status = 'received';
    order.receivedBy = req.user.userId;
    order.receivedAt = new Date();
    order.receivedItems = receivedItemsData;
    order.grnNumber = grnNumber;
    order.grnNotes = notes || '';
    
    // Enhanced GRN fields
    order.grnDeliveryDate = deliveryDate ? new Date(deliveryDate) : new Date();
    order.grnDeliveryPersonName = deliveryPersonName || '';
    order.grnDeliveryPersonContact = deliveryPersonContact || '';
    order.grnVehicleNumber = vehicleNumber || '';
    order.grnOverallCondition = overallCondition || 'good';
    order.grnConditionNotes = conditionNotes || '';
    order.grnReceiverName = receiverName || '';
    order.grnAcknowledgmentNotes = acknowledgmentNotes || '';
    
    await order.save();
    
    const populated = await PurchaseOrder.findById(order._id)
      .populate('projectId', 'name')
      .populate('createdBy', 'name email')
      .populate('receivedBy', 'name email');
    
    res.json(populated);
  } catch (error) {
    console.error('Error receiving purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH cancel purchase order (Creator only, if pending)
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin');
    const isCreator = String(order.createdBy) === String(req.user.userId);
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only the creator can cancel this order' });
    }
    
    if (!['pending', 'draft'].includes(order.status)) {
      return res.status(400).json({ message: 'Only pending or draft orders can be cancelled' });
    }
    
    order.status = 'cancelled';
    await order.save();
    
    res.json(order);
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
