import bcrypt from 'bcryptjs';
import { connectDB, User } from '../utils/database.js';

// This script creates an admin user
// Usage: node backend/scripts/createAdmin.js

const createAdmin = async () => {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('Usage: node backend/scripts/createAdmin.js <name> <email> <password> <phoneNumber>');
    console.log('Example: node backend/scripts/createAdmin.js "Admin User" admin@example.com password123 1234567890');
    process.exit(1);
  }

  const [name, email, password, phoneNumber] = args;

  try {
    await connectDB();
    
    // Check if admin already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('Error: User with this email already exists');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Split name into first and last name for the schema
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const admin = new User({
      username: email, // Using email as username for simplicity or you can add a username arg
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: 'admin',
      // phoneNumber is not in the schema shown in database.js, so omitting it or we need to update schema
    });

    await admin.save();

    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Role: admin`);
    console.log('You can now login with these credentials.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();

