import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { User, Invoice } from '../utils/database.js';
import { upload } from '../utils/fileUpload.js';

const router = express.Router();

// All client routes require authentication and client role
router.use(authenticateToken);
router.use(requireRole('client'));

// Get my invoices
router.get('/client/my-invoices', async (req, res) => {
  try {
    const myInvoices = await Invoice.find({ client: req.user.id }).populate('salesPerson', 'username email');
    res.json(myInvoices);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create invoice (Client)
router.post('/client/create', upload.single('attachment'), async (req, res) => {
  try {
    const { amount, dueDate, salesPersonId, description, items, invoiceNumber } = req.body;
    const clientId = req.user.id;

    if (!amount || !dueDate || !salesPersonId) {
      return res.status(400).json({ error: 'Amount, due date, and sales representative are required' });
    }

    const salesPerson = await User.findById(salesPersonId);
    if (!salesPerson || salesPerson.role !== 'sales') {
      return res.status(404).json({ error: 'Sales representative not found' });
    }

    const client = await User.findById(clientId);

    const newInvoice = new Invoice({
      client: clientId,
      salesPerson: salesPersonId,
      amount: parseFloat(amount),
      dueDate,
      description: description || '',
      items,
      invoiceNumber,
      clientName: `${client.firstName} ${client.lastName}`,
      status: 'pending',
      filePath: req.file ? `/uploads/invoices/${req.file.filename}` : null,
      statusHistory: [{
        status: 'pending',
        changedBy: clientId,
      }],
    });

    await newInvoice.save();

    res.status(201).json(newInvoice);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Get available sales reps for client
router.get('/client/available-sales', async (req, res) => {
  try {
    const sales = await User.find({ role: 'sales' }).select('username email _id');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;