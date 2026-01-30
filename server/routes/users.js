const express = require('express');
const User = require('../models/User');
const Role = require('../models/Role');
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
      const adminRole = await Role.findOne({ key: 'admin' }).select('_id');
      const managerRole = await Role.findOne({ key: 'manager' }).select('_id');
      if (req.user.roles.includes('manager') || req.user.roles.includes('hr')) {
        query = { roles: { $nin: [adminRole?._id].filter(Boolean) } };
      } else {
        // For supervisors, site_engineers, inventory_managers - show limited users
        query = { roles: { $nin: [adminRole?._id, managerRole?._id].filter(Boolean) } };
      }
    }
    
    const users = await User.find(query).select('-password').populate('roles').sort({ createdAt: -1 });
    const mapped = users.map(u => {
      const roleKeys = (u.roles || []).map(r => (typeof r === 'string' ? r : r.key));
      const roleIds = (u.roles || []).map(r => (typeof r === 'string' ? null : r._id)).filter(Boolean);
      const obj = u.toObject();
      delete obj.password;
      return { ...obj, roles: roleKeys, roleIds };
    });
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, canManageUsers, async (req, res) => {
  try {
    const { name, email, roles, roleIds } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Role-based restrictions
    const userRoles = req.user.roles;
    let allowedRoles = [];
    
    if (userRoles.includes('admin')) {
      allowedRoles = ['admin', 'manager', 'account_manager', 'hr', 'inventory_manager', 'procurement_engineer', 'store_keeper', 'supervisor', 'site_engineer', 'sales_engineer', 'project_engineer', 'estimation_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('manager')) {
      allowedRoles = ['account_manager', 'hr', 'inventory_manager', 'procurement_engineer', 'store_keeper', 'supervisor', 'site_engineer', 'sales_engineer', 'project_engineer', 'estimation_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('hr')) {
      allowedRoles = ['account_manager', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'employee'];
    } else if (userRoles.includes('supervisor') || userRoles.includes('site_engineer')) {
      allowedRoles = ['vendor'];
    } else if (userRoles.includes('inventory_manager')) {
      allowedRoles = ['store_keeper'];
    }
    // roles can be provided as keys or ids; normalize to keys for permission validation
    let incomingRoleKeys = roles || [];
    if ((!incomingRoleKeys || incomingRoleKeys.length === 0) && Array.isArray(roleIds) && roleIds.length > 0) {
      const rolesDocs = await Role.find({ _id: { $in: roleIds } });
      incomingRoleKeys = rolesDocs.map(r => r.key);
    }

    const hasInvalidRole = incomingRoleKeys.some(role => !allowedRoles.includes(role));
    if (hasInvalidRole) {
      return res.status(403).json({ message: 'You cannot assign these roles' });
    }

    // map to Role ids
    let roleObjectIds = [];
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      roleObjectIds = roleIds;
    } else if (Array.isArray(incomingRoleKeys) && incomingRoleKeys.length > 0) {
      const rolesDocs = await Role.find({ key: { $in: incomingRoleKeys } });
      roleObjectIds = rolesDocs.map(r => r._id);
    }

    const user = new User({
      name,
      email,
      password: 'password123',
      roles: roleObjectIds
    });

    await user.save();
    await user.populate('roles');

    const roleKeys = (user.roles || []).map(r => (typeof r === 'string' ? r : r.key));
    const roleIdsResp = (user.roles || []).map(r => (typeof r === 'string' ? null : r._id)).filter(Boolean);
    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(201).json({ ...userResponse, roles: roleKeys, roleIds: roleIdsResp });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, canManageUsers, async (req, res) => {
  try {
    const { name, email, roles, roleIds, isActive } = req.body;
    
    // Role-based restrictions (same as create)
    const userRoles = req.user.roles;
    let allowedRoles = [];
    
    if (userRoles.includes('admin')) {
      allowedRoles = ['admin', 'manager', 'account_manager', 'hr', 'inventory_manager', 'procurement_engineer', 'store_keeper', 'supervisor', 'site_engineer', 'sales_engineer', 'project_engineer', 'estimation_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('manager')) {
      allowedRoles = ['account_manager', 'hr', 'inventory_manager', 'procurement_engineer', 'store_keeper', 'supervisor', 'site_engineer', 'sales_engineer', 'project_engineer', 'estimation_engineer', 'vendor', 'employee'];
    } else if (userRoles.includes('hr')) {
      allowedRoles = ['account_manager', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'employee'];
    } else if (userRoles.includes('supervisor') || userRoles.includes('site_engineer')) {
      allowedRoles = ['vendor'];
    } else if (userRoles.includes('inventory_manager')) {
      allowedRoles = ['store_keeper'];
    }
    
    let incomingRoleKeys = roles || [];
    if ((!incomingRoleKeys || incomingRoleKeys.length === 0) && Array.isArray(roleIds) && roleIds.length > 0) {
      const rolesDocs = await Role.find({ _id: { $in: roleIds } });
      incomingRoleKeys = rolesDocs.map(r => r.key);
    }

    const hasInvalidRole = (incomingRoleKeys || []).some(role => !allowedRoles.includes(role));
    if (hasInvalidRole) {
      return res.status(403).json({ message: 'You cannot assign these roles' });
    }
    
    // map to Role ids
    let roleObjectIds = undefined;
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      roleObjectIds = roleIds;
    } else if (Array.isArray(incomingRoleKeys) && incomingRoleKeys.length > 0) {
      const rolesDocs = await Role.find({ key: { $in: incomingRoleKeys } });
      roleObjectIds = rolesDocs.map(r => r._id);
    }

    const update = { name, email, isActive };
    if (roleObjectIds) update.roles = roleObjectIds;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select('-password').populate('roles');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const roleKeys = (user.roles || []).map(r => (typeof r === 'string' ? r : r.key));
    const roleIdsResp = (user.roles || []).map(r => (typeof r === 'string' ? null : r._id)).filter(Boolean);
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json({ ...userResponse, roles: roleKeys, roleIds: roleIdsResp });
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