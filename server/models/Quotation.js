const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  companyInfo: {
    logo: { type: String },
    name: { type: String },
    address: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  submittedTo: { type: String },
  attention: { type: String },
  offerReference: { type: String },
  enquiryNumber: { type: String },
  offerDate: { type: Date },
  enquiryDate: { type: Date },
  projectTitle: { type: String },
  introductionText: { type: String },

  scopeOfWork: [{
    description: String,
    quantity: Number,
    unit: String,
    locationRemarks: String
  }],

  priceSchedule: {
    items: [{
      description: String,
      quantity: Number,
      unit: String,
      unitRate: Number,
      totalAmount: Number
    }],
    subTotal: Number,
    grandTotal: Number,
    currency: { type: String, default: 'AED' },
    taxDetails: {
      vatRate: Number,
      vatAmount: Number
    }
  },

  ourViewpoints: { type: String },
  exclusions: [{ type: String }],

  paymentTerms: [{
    milestoneDescription: String,
    amountPercent: Number
  }],

  deliveryCompletionWarrantyValidity: {
    deliveryTimeline: String,
    warrantyPeriod: String,
    offerValidity: Number,
    authorizedSignatory: String
  },

  managementApproval: {
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    comments: String,
    logs: [
      {
        status: { type: String, enum: ['pending', 'approved', 'rejected'] },
        at: { type: Date, default: Date.now },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String
      }
    ]
  },

  edits: [{
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt: { type: Date, default: Date.now },
    changes: [{
      field: { type: String, required: true },
      from: { type: mongoose.Schema.Types.Mixed },
      to: { type: mongoose.Schema.Types.Mixed }
    }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('Quotation', QuotationSchema);


