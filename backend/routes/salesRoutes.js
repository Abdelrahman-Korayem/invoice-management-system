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
    let invoice = await Invoice.findOne({ _id: req.params.id, salesPerson: req.user.id })
      .populate('client', 'username email firstName lastName');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Manually populate statusHistory.changedBy
    if (invoice.statusHistory && invoice.statusHistory.length > 0) {
      const userIds = invoice.statusHistory.map(h => h.changedBy).filter(id => id);
      const users = await User.find({ _id: { $in: userIds } }).select('username email firstName lastName');
      const userMap = {};
      users.forEach(u => {
        userMap[u._id.toString()] = {
          _id: u._id,
          username: u.username,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName
        };
      });
      invoice = invoice.toObject();
      invoice.statusHistory = invoice.statusHistory.map(h => ({
        ...h,
        changedBy: h.changedBy ? userMap[h.changedBy.toString()] : null
      }));
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
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

    let updatedInvoice = await Invoice.findOneAndUpdate(
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

    // Manually populate statusHistory.changedBy
    if (updatedInvoice.statusHistory && updatedInvoice.statusHistory.length > 0) {
      const userIds = updatedInvoice.statusHistory.map(h => h.changedBy).filter(id => id);
      const users = await User.find({ _id: { $in: userIds } }).select('username email firstName lastName');
      const userMap = {};
      users.forEach(u => {
        userMap[u._id.toString()] = {
          _id: u._id,
          username: u.username,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName
        };
      });
      updatedInvoice = updatedInvoice.toObject();
      updatedInvoice.statusHistory = updatedInvoice.statusHistory.map(h => ({
        ...h,
        changedBy: h.changedBy ? userMap[h.changedBy.toString()] : null
      }));
    }

    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add client communication
router.post('/invoice/:id/communication', async (req, res) => {
  try {
    const { message, type } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const communication = {
      sender: req.user.id,
      message,
      type: type || 'other'
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
    let invoice = await Invoice.findOne({ _id: req.params.id, salesPerson: req.user.id });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Manually populate communications.sender
    if (invoice.communications && invoice.communications.length > 0) {
      const userIds = invoice.communications.map(c => c.sender).filter(id => id);
      const users = await User.find({ _id: { $in: userIds } }).select('username email firstName lastName');
      const userMap = {};
      users.forEach(u => {
        userMap[u._id.toString()] = {
          _id: u._id,
          username: u.username,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName
        };
      });

      const populatedComms = invoice.communications.map(c => ({
        _id: c._id,
        message: c.message,
        type: c.type,
        timestamp: c.timestamp,
        sender: c.sender ? userMap[c.sender.toString()] : null
      }));

      return res.json(populatedComms);
    }

    res.json(invoice.communications || []);
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;