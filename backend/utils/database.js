import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Cache the database connection
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
      bufferCommands: false, // Disable Mongoose buffering to fail fast if no connection
    });

    cachedConnection = conn;
    console.log('MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Don't exit process in serverless; let it throw so the request fails cleanly with a log
    throw error;
  }
};

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'sales', 'client'], required: true },
  email: { type: String, required: true, unique: true },
  firstName: { type: String },
  lastName: { type: String },
  phoneNumber: { type: String },
});

const invoiceSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'paid', 'overdue', 'cancelled'], default: 'pending' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    description: String,
    quantity: Number,
    price: Number,
  }],
  invoiceNumber: { type: String, unique: true, sparse: true },
  filePath: { type: String },
  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  }],
  communications: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    type: { type: String, enum: ['email', 'call', 'message', 'other'], default: 'other' },
    timestamp: { type: Date, default: Date.now },
  }],
  emailNotifications: [{
    type: String,
    recipient: String,
    success: Boolean,
    sentAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);

export { connectDB, User, Invoice };