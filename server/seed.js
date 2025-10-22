const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const adminExists = await User.findOne({ email: 'admin@wbes.com' });
    // Require admin role to exist
    const adminRole = await Role.findOne({ key: 'admin' });
    if (!adminRole) {
      console.error('Admin role not found. Run "npm run seed:roles" first.');
      process.exit(1);
    }
    if (!adminExists) {
      await User.create({
        name: 'WBES Admin',
        email: 'admin@wbes.com',
        password: 'admin123',
        roles: [adminRole._id]
      });
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();