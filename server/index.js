const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leadRoutes = require('./routes/leads');
const roleRoutes = require('./routes/roles');
const projectRoutes = require('./routes/projects');
const siteVisitRoutes = require('./routes/siteVisits');
const quotationRoutes = require('./routes/quotations');
const revisionRoutes = require('./routes/revisions');
const projectVariationRoutes = require('./routes/projectVariations');
const auditLogRoutes = require('./routes/auditLogs');
const generalAuditLogRoutes = require('./routes/generalAuditLogs');
const unifiedAuditLogRoutes = require('./routes/unifiedAuditLogs');
const storeRoutes = require('./routes/stores');
const materialRoutes = require('./routes/materials');
const systemSettingsRoutes = require('./routes/systemSettings');

const app = express();
const path = require('path');

app.use(cors());
// Only parse JSON for non-multipart requests
app.use(express.json({ 
  type: ['application/json', 'text/json'] 
}));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/site-visits', siteVisitRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/revisions', revisionRoutes);
app.use('/api/project-variations', projectVariationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/general-audit-logs', generalAuditLogRoutes);
app.use('/api/unified-audit-logs', unifiedAuditLogRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/system-settings', systemSettingsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});