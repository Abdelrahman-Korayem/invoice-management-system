import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import { connectDB } from './utils/database.js';
import cronRoutes from './routes/cronRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
// Connect to database (Non-blocking)
connectDB().catch(err => console.error('Initial DB connection failed:', err));

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Serve uploaded files
// Serve uploaded files - DISABLED FOR SERVERLESS
// app.use('/uploads', express.static(path.join(__dirname, '..', 'frontend', 'uploads')));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/invoices', clientRoutes);
app.use('/api/cron', cronRoutes);

// Only listen if running locally (not in serverless environment)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;