const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const adminExists = await User.findOne({ email: 'admin@wbes.com' });
    if (!adminExists) {
      await User.create({
        name: 'WBES Admin',
        email: 'admin@wbes.com',
        password: 'admin123',
        roles: ['admin']
      });
      
      await User.create({
        name: 'Test Manager',
        email: 'manager@wbes.com',
        password: 'manager123',
        roles: ['manager']
      });
      
      await User.create({
        name: 'Test HR',
        email: 'hr@wbes.com',
        password: 'hr123',
        roles: ['hr']
      });
      
      await User.create({
        name: 'Test Supervisor',
        email: 'supervisor@wbes.com',
        password: 'supervisor123',
        roles: ['supervisor']
      });
      
      await User.create({
        name: 'Test Inventory Manager',
        email: 'inventory@wbes.com',
        password: 'inventory123',
        roles: ['inventory_manager']
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