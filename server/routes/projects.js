const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Revision = require('../models/Revision');
const Lead = require('../models/Lead');
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
      .populate('assignedProjectEngineer', 'name email')
      .populate('createdBy', 'name email')
      .populate('sourceRevision')
      .populate('sourceQuotation')
      .populate('leadId')
      .populate('revisions.createdBy', 'name')
      .populate('revisions.approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// (moved below fixed routes to avoid shadowing)

// Update project with edit tracking (manager/admin/estimation_engineer)
router.put('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('manager') || roles.includes('admin') || roles.includes('estimation_engineer'))) {
      return res.status(403).json({ message: 'Not authorized to update projects' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const updatable = ['name','locationDetails','workingHours','manpowerCount','status','assignedProjectEngineer'];
    const changes = [];
    for (const field of updatable) {
      if (typeof req.body[field] === 'undefined') continue;
      const from = project[field];
      const to = req.body[field];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ field, from, to });
        project[field] = to;
      }
    }
    if (changes.length > 0) {
      project.edits = Array.isArray(project.edits) ? project.edits : [];
      project.edits.push({ editedBy: req.user.userId, changes });
    }
    await project.save();
    await project.populate('assignedSiteEngineer', 'name email');
    await project.populate('assignedProjectEngineer', 'name email');
    await project.populate('createdBy', 'name email');
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a project from an approved Revision
router.post('/from-revision/:revisionId', auth, async (req, res) => {
  try {
    const { revisionId } = req.params;
    const revision = await Revision.findById(revisionId)
      .populate('lead');
    if (!revision) return res.status(404).json({ message: 'Revision not found' });

    if (revision?.managementApproval?.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved revisions can be converted to a project' });
    }

    const existingProject = await Project.findOne({ sourceRevision: revision._id });
    if (existingProject) {
      return res.status(400).json({ message: 'A project already exists for this revision' });
    }

    // Enforce: Only allow creation from the last approved child revision in the chain
    // 1) Block if this revision has any child
    const hasChild = await Revision.countDocuments({ parentRevision: revision._id });
    if (hasChild > 0) {
      return res.status(400).json({ message: 'Project can only be created from the last approved child revision.' });
    }
    // 2) If there exists a later approved revision in the same quotation chain, block
    const latestApproved = await Revision.findOne({ parentQuotation: revision.parentQuotation, 'managementApproval.status': 'approved' })
      .sort({ revisionNumber: -1 })
      .select('_id revisionNumber');
    if (latestApproved && String(latestApproved._id) !== String(revision._id)) {
      return res.status(400).json({ message: `Only the latest approved revision (#${latestApproved.revisionNumber}) can be used to create a project.` });
    }

    const leadId = revision.lead ? (revision.lead._id || revision.lead) : null;
    const lead = leadId ? await Lead.findById(leadId) : null;

    const { name, locationDetails, workingHours, manpowerCount, assignedProjectEngineerId } = req.body || {};
    const project = new Project({
      name: name || revision.projectTitle || lead?.projectTitle || 'Project',
      budget: lead?.budget,
      locationDetails: (locationDetails ?? lead?.locationDetails ?? ''),
      workingHours: (workingHours ?? lead?.workingHours ?? ''),
      manpowerCount: (typeof manpowerCount === 'number' ? manpowerCount : lead?.manpowerCount),
      leadId: leadId,
      createdBy: req.user.userId,
      assignedProjectEngineer: assignedProjectEngineerId || undefined,
      sourceRevision: revision._id,
      sourceQuotation: revision.parentQuotation
    });

    await project.save();

    const populated = await Project.findById(project._id)
      .populate('assignedSiteEngineer', 'name email')
      .populate('assignedProjectEngineer', 'name email')
      .populate('createdBy', 'name email')
      .populate('sourceRevision')
      .populate('sourceQuotation')
      .populate('leadId')
      .populate('revisions.createdBy', 'name')
      .populate('revisions.approvedBy', 'name');

    return res.status(201).json(populated);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Check if a project exists for a given revision
router.get('/by-revision/:revisionId', auth, async (req, res) => {
  try {
    const project = await Project.findOne({ sourceRevision: req.params.revisionId }).select('_id name createdAt');
    if (!project) return res.status(404).json({ message: 'Not found' });
    return res.json(project);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// List Project Engineers (accessible to managers and estimation engineers)
router.get('/project-engineers', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('admin') || roles.includes('manager') || roles.includes('estimation_engineer'))) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    const Role = require('../models/Role');
    const roleDoc = await Role.findOne({ key: 'project_engineer' }).select('_id');
    if (!roleDoc) return res.json([]);
    const users = await User.find({ roles: roleDoc._id }).select('name email');
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get single project by id (populated)
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedSiteEngineer', 'name email')
      .populate('assignedProjectEngineer', 'name email')
      .populate('createdBy', 'name email')
      .populate('sourceRevision')
      .populate('sourceQuotation')
      .populate('leadId')
      .populate('revisions.createdBy', 'name')
      .populate('revisions.approvedBy', 'name')
      .populate('edits.editedBy', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a project (manager/admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    if (!(roles.includes('manager') || roles.includes('admin'))) {
      return res.status(403).json({ message: 'Only managers can delete projects' });
    }
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Project not found' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
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

    const engineer = await User.findById(siteEngineerId).populate('roles');
    const engineerRoleKeys = (engineer?.roles || []).map(r => (typeof r === 'string' ? r : r.key));
    if (!engineer || !engineerRoleKeys.includes('site_engineer')) {
      return res.status(400).json({ message: 'Invalid site engineer' });
    }

    const project = await Project.findById(req.params.id).populate('assignedSiteEngineer', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const prev = project.assignedSiteEngineer ? project.assignedSiteEngineer._id : null;
    project.assignedSiteEngineer = siteEngineerId;
    project.edits = Array.isArray(project.edits) ? project.edits : [];
    project.edits.push({ editedBy: req.user.userId, changes: [{ field: 'assignedSiteEngineer', from: prev, to: siteEngineerId }] });
    await project.save();

    await project.populate('assignedSiteEngineer', 'name email');

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