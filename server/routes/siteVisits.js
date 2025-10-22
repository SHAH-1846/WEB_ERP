const express = require('express');
const jwt = require('jsonwebtoken');
const SiteVisit = require('../models/SiteVisit');
const Project = require('../models/Project');
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

// Create a site visit (project engineers only)
router.post('/', auth, async (req, res) => {
  try {
    if (!req.user.roles.includes('project_engineer')) {
      return res.status(403).json({ message: 'Only project engineers can create site visits' });
    }

    const { projectId, visitAt, siteLocation, engineerName, workProgressSummary, safetyObservations, qualityMaterialCheck, issuesFound, actionItems, weatherConditions, description } = req.body;

    if (!projectId || !visitAt || !siteLocation || !engineerName || !workProgressSummary || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const siteVisit = await SiteVisit.create({
      project: projectId,
      visitAt,
      siteLocation,
      engineerName,
      workProgressSummary,
      safetyObservations,
      qualityMaterialCheck,
      issuesFound,
      actionItems,
      weatherConditions,
      description,
      createdBy: req.user.userId
    });

    res.status(201).json(siteVisit);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List visits for a project (auth required)
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const visits = await SiteVisit.find({ project: req.params.projectId }).sort({ visitAt: -1 });
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

