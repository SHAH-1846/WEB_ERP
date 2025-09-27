const express = require('express');
const Project = require('../models/Project');
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

// Get all projects
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('assignedSiteEngineer', 'name email')
      .populate('createdBy', 'name email')
      .populate('revisions.createdBy', 'name')
      .populate('revisions.approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign site engineer
router.patch('/:id/assign-engineer', auth, async (req, res) => {
  try {
    const { siteEngineerId } = req.body;
    const userRoles = req.user.roles;
    
    const canAssign = userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('supervisor');
    if (!canAssign) {
      return res.status(403).json({ message: 'Not authorized to assign engineers' });
    }

    const engineer = await User.findById(siteEngineerId);
    if (!engineer || !engineer.roles.includes('site_engineer')) {
      return res.status(400).json({ message: 'Invalid site engineer' });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { assignedSiteEngineer: siteEngineerId },
      { new: true }
    ).populate('assignedSiteEngineer', 'name email');

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create revision
router.post('/:id/revisions', auth, async (req, res) => {
  try {
    const { type, description, changes } = req.body;
    const project = await Project.findById(req.params.id);
    
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const canCreateRevision = req.user.roles.includes('manager') || req.user.roles.includes('admin');
    if (!canCreateRevision) {
      return res.status(403).json({ message: 'Only managers can create revisions' });
    }

    const version = project.revisions.length + 1;
    const revision = {
      version,
      type,
      description,
      changes,
      createdBy: req.user.userId
    };

    project.revisions.push(revision);
    await project.save();
    
    await project.populate('revisions.createdBy', 'name');
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve revision
router.patch('/:id/revisions/:revisionId/approve', auth, async (req, res) => {
  try {
    const { status, comments } = req.body;
    const project = await Project.findById(req.params.id);
    
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const canApprove = req.user.roles.includes('manager') || req.user.roles.includes('admin');
    if (!canApprove) {
      return res.status(403).json({ message: 'Not authorized to approve revisions' });
    }

    const revision = project.revisions.id(req.params.revisionId);
    if (!revision) return res.status(404).json({ message: 'Revision not found' });

    revision.status = status;
    revision.approvedBy = req.user.userId;
    revision.approvedAt = new Date();
    revision.comments = comments;

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;