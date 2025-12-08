const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const GeneralAuditLog = require('../models/GeneralAuditLog');
const router = express.Router();

// Helper function to get client IP address
const getClientIp = (req) => {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         'unknown';
};

// Helper function to get user agent
const getUserAgent = (req) => {
  return req.get('user-agent') || 'unknown';
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    const user = await User.findOne({ email, isActive: true }).populate('roles');
    
    // Log failed login attempt
    if (!user || !(await user.comparePassword(password))) {
      try {
        await GeneralAuditLog.create({
          action: 'login_failed',
          module: 'authentication',
          entityType: 'user',
          entityName: email,
          performedBy: user?._id || null, // null if user doesn't exist
          description: `Failed login attempt for email: ${email}`,
          ipAddress,
          userAgent,
          success: false,
          errorMessage: user ? 'Invalid password' : 'User not found or inactive'
        });
      } catch (auditError) {
        console.error('Error creating audit log for failed login:', auditError);
      }
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const roleKeys = (user.roles || []).map(r => (typeof r === 'string' ? r : r.key));
    const token = jwt.sign(
      { userId: user._id, email: user.email, roles: roleKeys },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log successful login
    try {
      await GeneralAuditLog.create({
        action: 'user_login',
        module: 'authentication',
        entityType: 'user',
        entityId: user._id,
        entityName: user.name || user.email,
        performedBy: user._id,
        description: `User ${user.name || user.email} logged in successfully`,
        ipAddress,
        userAgent,
        success: true,
        details: {
          email: user.email,
          roles: roleKeys,
          loginTime: new Date()
        }
      });
    } catch (auditError) {
      console.error('Error creating audit log for successful login:', auditError);
      // Don't fail the login if audit logging fails
    }

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: roleKeys,
        roleIds: (user.roles || []).map(r => (typeof r === 'string' ? null : r._id)).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    let userId = null;
    let userEmail = 'unknown';
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        userEmail = decoded.email;
      } catch (e) {
        // Token invalid or expired, but we still log the logout attempt
      }
    }

    // Log logout action
    if (userId) {
      try {
        const user = await User.findById(userId);
        await GeneralAuditLog.create({
          action: 'user_logout',
          module: 'authentication',
          entityType: 'user',
          entityId: userId,
          entityName: user?.name || userEmail,
          performedBy: userId,
          description: `User ${user?.name || userEmail} logged out`,
          ipAddress,
          userAgent,
          success: true,
          details: {
            email: userEmail,
            logoutTime: new Date()
          }
        });
      } catch (auditError) {
        console.error('Error creating audit log for logout:', auditError);
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;