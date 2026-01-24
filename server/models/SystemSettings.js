const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Inventory Settings
  inventory: {
    storeCreationEnabled: {
      type: Boolean,
      default: true
    }
  },
  // Add more settings categories as needed
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
