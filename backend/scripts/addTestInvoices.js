import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Invoice } from '../utils/database.js';

dotenv.config();

const addTestInvoices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/invoice-system');
        console.log('Connected to MongoDB');

        // Get a sales person and client
        const salesPerson = await User.findOne({ role: 'sales' });
        const client = await User.findOne({ role: 'client' });

        if (!salesPerson || !client) {
            console.log('Need at least one sales person and one client');
            process.exit(1);
        }

        // Add pending invoice
        const pendingInvoice = new Invoice({
            client: client._id,
            salesPerson: salesPerson._id,
            amount: 5000,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            clientName: `${client.firstName} ${client.lastName}`,
            invoiceNumber: `INV-PENDING-${Date.now()}`,
            status: 'pending',
            statusHistory: [{ status: 'pending', changedBy: salesPerson._id }]
        });
        await pendingInvoice.save();
        console.log('✅ Added pending invoice');

        // Add overdue invoice
        const overdueInvoice = new Invoice({
            client: client._id,
            salesPerson: salesPerson._id,
            amount: 3000,
            dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
            clientName: `${client.firstName} ${client.lastName}`,
            invoiceNumber: `INV-OVERDUE-${Date.now()}`,
            status: 'overdue',
            statusHistory: [{ status: 'overdue', changedBy: salesPerson._id }]
        });
        await overdueInvoice.save();
        console.log('✅ Added overdue invoice');

        console.log('✅ Test invoices added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

addTestInvoices();
