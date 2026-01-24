const express = require('express');
const jwt = require('jsonwebtoken');
const SystemSettings = require('../models/SystemSettings');
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

// Check if user is admin or manager
const isAdminOrManager = (roles) => roles.includes('admin') || roles.includes('manager');

// Get system settings (public for read, restricted for write)
router.get('/', auth, async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update system settings (admin/manager only)
router.put('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    
    if (!isAdminOrManager(roles)) {
      return res.status(403).json({ message: 'Only admins and managers can update settings.' });
    }

    const settings = await SystemSettings.getSettings();
    
    // Update inventory settings
    if (req.body.inventory) {
      if (typeof req.body.inventory.storeCreationEnabled === 'boolean') {
        settings.inventory.storeCreationEnabled = req.body.inventory.storeCreationEnabled;
      }
    }
    
    settings.updatedBy = req.user.userId;
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get inventory settings (for inventory users to check store creation status)
router.get('/inventory', auth, async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      storeCreationEnabled: settings.inventory?.storeCreationEnabled ?? true
    });
  } catch (error) {
    console.error('Error fetching inventory settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
