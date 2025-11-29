import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { User, Invoice } from '../utils/database.js';
import dayjs from 'dayjs';
import mongoose from 'mongoose';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// Get dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const stats = await Invoice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const userStats = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const paidInvoices = stats.find(s => s._id === 'paid')?.count || 0;
    const pendingInvoices = stats.find(s => s._id === 'pending')?.count || 0;
    const overdueInvoices = stats.find(s => s._id === 'overdue')?.count || 0;
    const totalInvoices = paidInvoices + pendingInvoices + overdueInvoices;

    const clients = userStats.find(s => s._id === 'client')?.count || 0;
    const sales = userStats.find(s => s._id === 'sales')?.count || 0;

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      clients,
      sales,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all invoices
router.get('/dashboard/all-invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('client salesPerson');
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get monthly revenue chart data
router.get('/dashboard/monthly-revenue', async (req, res) => {
    try {
      const monthlyData = await Invoice.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } },
            revenue: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
  
      const chartData = monthlyData.map(item => ({
        month: item._id,
        revenue: item.revenue
      }));
  
      res.json(chartData);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

// Get all clients
router.get('/clients', async (req, res) => {
  try {
    const clients = await User.find({ role: 'client' }).select('-password');
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sales Management - Get all sales
router.get('/sales', async (req, res) => {
  try {
    const sales = await User.find({ role: 'sales' }).select('-password');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sales Management - Create sales
router.post('/sales', async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;
  
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email and password are required' });
      }
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newSales = new User({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'sales',
      });
  
      await newSales.save();
  
      const { password: _, ...salesWithoutPassword } = newSales.toObject();
      res.status(201).json(salesWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  

// Sales Management - Update sales
router.put('/sales/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, firstName, lastName, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({ error: 'Email already in use' });
    }

    const updateData = { username, email, firstName, lastName };
    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedSales = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');

    if (!updatedSales) {
      return res.status(404).json({ error: 'Sales representative not found' });
    }

    res.json(updatedSales);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sales Management - Delete sales
router.delete('/sales/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSales = await User.findOneAndDelete({ _id: id, role: 'sales' });

    if (!deletedSales) {
      return res.status(404).json({ error: 'Sales representative not found' });
    }

    res.json({ message: 'Sales representative deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Invoice
router.post('/invoices', async (req, res) => {
  try {
    const { clientId, salesPersonId, amount, dueDate, items, clientName, invoiceNumber } = req.body;

    if (!clientId || !salesPersonId || !amount || !dueDate) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const client = await User.findById(clientId);
    if (!client || client.role !== 'client') {
      return res.status(404).json({ error: 'Client not found' });
    }

    const salesPerson = await User.findById(salesPersonId);
    if (!salesPerson || salesPerson.role !== 'sales') {
        return res.status(404).json({ error: 'Sales representative not found' });
    }

    const newInvoice = new Invoice({
      client: clientId,
      salesPerson: salesPersonId,
      amount: parseFloat(amount),
      dueDate,
      items,
      clientName: clientName || `${client.firstName} ${client.lastName}`,
      invoiceNumber,
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: req.user.id }]
    });

    await newInvoice.save();

    res.status(201).json(newInvoice);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get clients with their sales reps
router.get('/clients-with-sales', async (req, res) => {
    try {
      const clients = await User.find({ role: 'client' }).select('-password');
      const invoices = await Invoice.find().populate('salesPerson', 'username email');
  
      const clientsWithSales = clients.map(client => {
        const clientInvoices = invoices.filter(inv => inv.client.toString() === client._id.toString());
        const salesReps = [...new Set(clientInvoices.map(inv => inv.salesPerson))];
        
        return {
          ...client.toObject(),
          salesReps,
          invoiceCount: clientInvoices.length
        };
      });
  
      res.json(clientsWithSales);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Get analytics with filters
  router.get('/analytics', async (req, res) => {
    try {
      const { period, status, groupBy } = req.query;
      let filter = {};
  
      // Filter by status
      if (status && status !== 'all') {
        filter.status = status;
      }
  
      // Filter by period
      const today = dayjs();
      if (period === 'day') {
        filter.createdAt = { $gte: today.startOf('day').toDate(), $lte: today.endOf('day').toDate() };
      } else if (period === 'week') {
        filter.createdAt = { $gte: today.subtract(1, 'week').startOf('day').toDate() };
      } else if (period === 'month') {
        filter.createdAt = { $gte: today.startOf('month').toDate(), $lte: today.endOf('month').toDate() };
      } else if (period === 'year') {
        filter.createdAt = { $gte: today.startOf('year').toDate(), $lte: today.endOf('year').toDate() };
      }
  
      const invoices = await Invoice.find(filter);
      
      let groupedData = {};
      if (groupBy === 'status') {
        groupedData = await Invoice.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
        ]);
      } else if (groupBy === 'date') {
        groupedData = await Invoice.aggregate([
            { $match: filter },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
            { $sort: { _id: 1 } }
        ]);
      } else {
        // Default: return summary
        const summary = await Invoice.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
        ]);
        groupedData = summary[0] || { total: 0, totalAmount: 0 };
      }
  
      res.json({
        period,
        status,
        data: groupedData,
        invoices
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Get invoice communications (admin can see all)
  router.get('/invoice/:id/communications', async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id).populate('communications.sender', 'username');
  
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
  
      res.json(invoice.communications || []);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Comprehensive Analytics Dashboard Data
router.get('/advanced-analytics', async (req, res) => {
    try {
        const today = dayjs();

        const kpiAggregation = await Invoice.aggregate([
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    collectedAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
                    outstandingAmount: { $sum: { $cond: [{ $in: ['$status', ['pending', 'overdue']] }, '$amount', 0] } },
                    overdueAmount: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } },
                    totalInvoices: { $sum: 1 }
                }
            }
        ]);
        const kpis = kpiAggregation[0] || {};

        const invoicesByStatus = await Invoice.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const userCounts = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        const salesPerformance = await Invoice.aggregate([
            { $group: { _id: '$salesPerson', totalAssigned: { $sum: '$amount' }, collected: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } }, totalInvoices: { $sum: 1 } } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'salesPerson' } },
            { $unwind: '$salesPerson' },
            { $project: { name: '$salesPerson.username', email: '$salesPerson.email', totalAssigned: 1, collected: 1, totalInvoices: 1, collectionRate: { $cond: [{ $gt: ['$totalAssigned', 0] }, { $multiply: [{ $divide: ['$collected', '$totalAssigned'] }, 100] }, 0] } } }
        ]);

        // This is a simplified version of the original. A full implementation would be more complex.
        res.json({
            kpis: {
                totalInvoices: kpis.totalInvoices || 0,
                totalAmount: kpis.totalAmount || 0,
                collectedAmount: kpis.collectedAmount || 0,
                outstandingAmount: kpis.outstandingAmount || 0,
                overdueAmount: kpis.overdueAmount || 0,
                collectionRate: kpis.totalAmount ? (kpis.collectedAmount / kpis.totalAmount) * 100 : 0,
                clientCount: userCounts.find(u => u._id === 'client')?.count || 0,
                salesCount: userCounts.find(u => u._id === 'sales')?.count || 0
            },
            invoicesByStatus: invoicesByStatus.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
            salesPerformance,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Advanced analytics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Export data as JSON
router.get('/export/invoices', async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        let filter = {};
        if (status && status !== 'all') filter.status = status;
        if (startDate) filter.createdAt = { ...filter.createdAt, $gte: dayjs(startDate).toDate() };
        if (endDate) filter.createdAt = { ...filter.createdAt, $lte: dayjs(endDate).toDate() };

        const invoices = await Invoice.find(filter).populate('client salesPerson', 'username email');
        res.json({ data: invoices, summary: { totalRecords: invoices.length } });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;