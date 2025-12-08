const express = require('express');
const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');
const GeneralAuditLog = require('../models/GeneralAuditLog');
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

// Get unified audit logs (combines both AuditLog and GeneralAuditLog)
router.get('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!roles.includes('manager') && !roles.includes('admin')) {
      return res.status(403).json({ message: 'Only managers and admins can view audit logs' });
    }

    const { 
      search, // General search query
      logSource, // 'estimation', 'general', or '' for all
      action, 
      module: moduleFilter, 
      entityType, 
      startDate, 
      endDate, 
      performedBy,
      deletedBy,
      page = 1, 
      limit = 50 
    } = req.query;

    const allLogs = [];

    // Fetch Estimation Audit Logs (if logSource is 'estimation' or empty)
    if (!logSource || logSource === 'estimation') {
      const estimationQuery = {};
      
      if (action) estimationQuery.action = action;
      if (entityType) estimationQuery.entityType = entityType;
      if (deletedBy) estimationQuery.deletedBy = deletedBy;
      if (performedBy) estimationQuery.performedBy = performedBy;
      
      // Search functionality for estimation logs
      if (search) {
        estimationQuery.$or = [
          { action: { $regex: search, $options: 'i' } },
          { entityType: { $regex: search, $options: 'i' } },
          { 'entityData.offerReference': { $regex: search, $options: 'i' } },
          { 'entityData.projectTitle': { $regex: search, $options: 'i' } },
          { 'entityData.customerName': { $regex: search, $options: 'i' } },
          { reason: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Date filtering - check both deletedAt and performedAt
      // Combine with search using $and if both exist
      if (startDate || endDate) {
        const dateQuery = {};
        if (startDate) dateQuery.$gte = new Date(startDate);
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999); // Include entire end date
          dateQuery.$lte = endDateObj;
        }
        
        const dateCondition = {
          $or: [
            { deletedAt: dateQuery },
            { performedAt: dateQuery },
            { createdAt: dateQuery }
          ]
        };
        
        // If search exists, combine with $and
        if (estimationQuery.$or) {
          estimationQuery.$and = [
            { $or: estimationQuery.$or },
            dateCondition
          ];
          delete estimationQuery.$or;
        } else {
          estimationQuery.$or = dateCondition.$or;
        }
      }

      const estimationLogs = await AuditLog.find(estimationQuery)
        .populate('deletedBy', 'name email roles')
        .populate('performedBy', 'name email roles')
        .populate('entityData.createdBy', 'name email')
        .sort({ deletedAt: -1, performedAt: -1, createdAt: -1 })
        .lean(); // Use lean() for better performance

      // Apply client-side search filter if search query exists (for populated fields)
      let filteredEstimationLogs = estimationLogs;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredEstimationLogs = estimationLogs.filter(log => {
          // Check populated user fields
          const deletedByName = log.deletedBy?.name?.toLowerCase() || '';
          const deletedByEmail = log.deletedBy?.email?.toLowerCase() || '';
          const performedByName = log.performedBy?.name?.toLowerCase() || '';
          const performedByEmail = log.performedBy?.email?.toLowerCase() || '';
          const createdByName = log.entityData?.createdBy?.name?.toLowerCase() || '';
          const createdByEmail = log.entityData?.createdBy?.email?.toLowerCase() || '';
          
          return deletedByName.includes(searchLower) ||
                 deletedByEmail.includes(searchLower) ||
                 performedByName.includes(searchLower) ||
                 performedByEmail.includes(searchLower) ||
                 createdByName.includes(searchLower) ||
                 createdByEmail.includes(searchLower);
        });
      }

      filteredEstimationLogs.forEach(log => {
        // Only use populated user objects, not ObjectIds
        // Check if it's a valid user object (has name property) and not an ObjectId string
        let performer = null;
        
        // Helper to check if value is a valid user object (not ObjectId)
        const isValidUser = (user) => {
          if (!user) return false;
          // If it's a string, it's likely an ObjectId (MongoDB ObjectIds are 24 char hex strings)
          if (typeof user === 'string') {
            // Check if it looks like an ObjectId (24 character hex string)
            if (/^[0-9a-fA-F]{24}$/.test(user)) return false;
            return false; // Any string is not a valid user object
          }
          // Check if it's an ObjectId object (has toString method and looks like ObjectId)
          if (user.toString && /^[0-9a-fA-F]{24}$/.test(user.toString())) return false;
          // If it's an object but doesn't have name, it's not populated properly
          if (typeof user === 'object' && user.name && typeof user.name === 'string') return true;
          return false;
        };
        
        if (isValidUser(log.deletedBy)) {
          performer = log.deletedBy;
        } else if (isValidUser(log.performedBy)) {
          performer = log.performedBy;
        }
        
        allLogs.push({
          ...log,
          logSource: 'estimation',
          timestamp: log.deletedAt || log.performedAt || log.createdAt,
          performer: performer
        });
      });
    }

    // Fetch General Audit Logs (if logSource is 'general' or empty)
    if (!logSource || logSource === 'general') {
      const generalQuery = {};
      
      if (action) generalQuery.action = { $regex: action, $options: 'i' };
      if (moduleFilter) generalQuery.module = moduleFilter;
      if (entityType) generalQuery.entityType = entityType;
      if (performedBy) generalQuery.performedBy = performedBy;
      
      // Search functionality for general logs
      if (search) {
        generalQuery.$or = [
          { action: { $regex: search, $options: 'i' } },
          { module: { $regex: search, $options: 'i' } },
          { entityType: { $regex: search, $options: 'i' } },
          { entityName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (startDate || endDate) {
        generalQuery.performedAt = {};
        if (startDate) generalQuery.performedAt.$gte = new Date(startDate);
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999); // Include entire end date
          generalQuery.performedAt.$lte = endDateObj;
        }
      }

      const generalLogs = await GeneralAuditLog.find(generalQuery)
        .populate('performedBy', 'name email roles')
        .sort({ performedAt: -1 })
        .lean(); // Use lean() for better performance

      // Apply client-side search filter if search query exists (for populated fields)
      let filteredGeneralLogs = generalLogs;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredGeneralLogs = generalLogs.filter(log => {
          // Check populated user fields
          const performedByName = log.performedBy?.name?.toLowerCase() || '';
          const performedByEmail = log.performedBy?.email?.toLowerCase() || '';
          
          return performedByName.includes(searchLower) ||
                 performedByEmail.includes(searchLower);
        });
      }

      filteredGeneralLogs.forEach(log => {
        // Only use populated user objects, not ObjectIds
        // Helper to check if value is a valid user object (not ObjectId)
        const isValidUser = (user) => {
          if (!user) return false;
          // If it's a string, it's likely an ObjectId (MongoDB ObjectIds are 24 char hex strings)
          if (typeof user === 'string') {
            // Check if it looks like an ObjectId (24 character hex string)
            if (/^[0-9a-fA-F]{24}$/.test(user)) return false;
            return false; // Any string is not a valid user object
          }
          // Check if it's an ObjectId object (has toString method and looks like ObjectId)
          if (user.toString && /^[0-9a-fA-F]{24}$/.test(user.toString())) return false;
          // If it's an object but doesn't have name, it's not populated properly
          if (typeof user === 'object' && user.name && typeof user.name === 'string') return true;
          return false;
        };
        
        const performer = isValidUser(log.performedBy) ? log.performedBy : null;
        
        allLogs.push({
          ...log,
          logSource: 'general',
          timestamp: log.performedAt || log.createdAt,
          performer: performer
        });
      });
    }

    // Sort all logs by timestamp (newest first)
    allLogs.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    // Apply pagination after combining
    const total = allLogs.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedLogs = allLogs.slice(skip, skip + parseInt(limit));

    res.json({
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (e) {
    console.error('Error fetching unified audit logs:', e);
    res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? e.message : undefined });
  }
});

module.exports = router;

