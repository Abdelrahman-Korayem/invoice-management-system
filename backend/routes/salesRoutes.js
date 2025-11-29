import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { User, Invoice } from '../utils/database.js';

const router = express.Router();

// All sales routes require authentication and sales role
router.use(authenticateToken);
router.use(requireRole('sales'));

// Get my clients
router.get('/my-clients', async (req, res) => {
  try {
    const invoices = await Invoice.find({ salesPerson: req.user.id }).distinct('client');
    const clients = await User.find({ _id: { $in: invoices } }).select('-password');
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get my invoices (invoices for my clients)
router.get('/my-invoices', async (req, res) => {
  try {
    const myInvoices = await Invoice.find({ salesPerson: req.user.id }).populate('client', 'username');
    res.json(myInvoices);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get invoice details
router.get('/invoice/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, salesPerson: req.user.id }).populate('client', 'username email');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update invoice status
router.put('/invoice/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, salesPerson: req.user.id },
      { 
        $set: { status: status },
        $push: { statusHistory: { status: status, changedBy: req.user.id } }
      },
      { new: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(updatedInvoice);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add client communication
router.post('/invoice/:id/communication', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const communication = {
        sender: req.user.id,
        message,
      };

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $push: { communications: communication } },
      { new: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(communication);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get invoice communications
router.get('/invoice/:id/communications', async (req, res) => {
    try {
      const invoice = await Invoice.findOne({ _id: req.params.id, salesPerson: req.user.id }).populate('communications.sender', 'username');
  
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
  
      res.json(invoice.communications || []);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

export default router;