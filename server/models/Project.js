const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  type: { type: String, enum: ['price', 'management'], required: true },
  description: String,
  changes: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  comments: String
}, { timestamps: true });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  budget: Number,
  locationDetails: { type: String, required: true },
  workingHours: String,
  manpowerCount: Number,
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  assignedSiteEngineer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedProjectEngineer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'completed', 'on_hold'], default: 'active' },
  revisions: [revisionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceRevision: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision' },
  sourceQuotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  edits: [{
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt: { type: Date, default: Date.now },
    changes: [{
      field: { type: String, required: true },
      from: { type: mongoose.Schema.Types.Mixed },
      to: { type: mongoose.Schema.Types.Mixed }
    }]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);