import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../utils/database.js';

const router = express.Router();

// Register (Client only)
router.post('/register', async (req, res) => {
  try {
    console.log('Register Request Body:', req.body);
    const { username, email, password, firstName, lastName, name, phoneNumber } = req.body;

    const finalUsername = username || name;

    if (!finalUsername || !email || !password) {
      return res.status(400).json({ error: 'Username (or Name), email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let finalFirstName = firstName;
    let finalLastName = lastName;

    if (!finalFirstName && name) {
      const parts = name.trim().split(' ');
      finalFirstName = parts[0];
      finalLastName = parts.slice(1).join(' ');
    }

    const newUser = new User({
      username: finalUsername,
      email,
      password: hashedPassword,
      firstName: finalFirstName,
      lastName: finalLastName,
      phoneNumber,
      role: 'client',
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;