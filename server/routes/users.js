const express = require('express');
const User = require('../models/User');
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

const canManageUsers = (req, res, next) => {
  const userRoles = req.user.roles || [];
  const allowedRoles = ['admin', 'manager', 'hr', 'supervisor', 'site_engineer', 'inventory_manager'];
  
  if (!userRoles.some(role => allowedRoles.includes(role))) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

router.get('/', auth, canManageUsers, async (req, res) => {
  try {
    let query = {};
    
    // Filter users based on role permissions
    if (!req.user.roles.includes('admin')) {
      if (req.user.roles.includes('manager') || req.user.roles.includes('hr')) {
        query = { roles: { $nin: ['admin'] } };
      } else {
        // For supervisors, site_engineers, inventory_managers - show limited users
        query = { roles: { $nin: ['admin', 'manager'] } };
      }
    }
    
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, canManageUsers, async (req, res) => {
  try {
    const { name, email, roles } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Role-based restrictions
    const userRoles = req.user.roles;
    let allowedRoles = [];
    
    if (userRoles.includes('admin')) {
      allowedRoles = ['admin', 'manager', 'account_manager', 'hr', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('manager')) {
      allowedRoles = ['account_manager', 'hr', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('hr')) {
      allowedRoles = ['account_manager', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'employee'];
    } else if (userRoles.includes('supervisor') || userRoles.includes('site_engineer')) {
      allowedRoles = ['vendor'];
    } else if (userRoles.includes('inventory_manager')) {
      allowedRoles = ['store_keeper'];
    }
    
    const hasInvalidRole = roles.some(role => !allowedRoles.includes(role));
    if (hasInvalidRole) {
      return res.status(403).json({ message: 'You cannot assign these roles' });
    }

    const user = new User({
      name,
      email,
      password: 'password123',
      roles
    });

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, canManageUsers, async (req, res) => {
  try {
    const { name, email, roles, isActive } = req.body;
    
    // Role-based restrictions (same as create)
    const userRoles = req.user.roles;
    let allowedRoles = [];
    
    if (userRoles.includes('admin')) {
      allowedRoles = ['admin', 'manager', 'account_manager', 'hr', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('manager')) {
      allowedRoles = ['account_manager', 'hr', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('hr')) {
      allowedRoles = ['account_manager', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'employee'];
    } else if (userRoles.includes('supervisor') || userRoles.includes('site_engineer')) {
      allowedRoles = ['vendor'];
    } else if (userRoles.includes('inventory_manager')) {
      allowedRoles = ['store_keeper'];
    }
    
    const hasInvalidRole = roles.some(role => !allowedRoles.includes(role));
    if (hasInvalidRole) {
      return res.status(403).json({ message: 'You cannot assign these roles' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, roles, isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, canManageUsers, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;