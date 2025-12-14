
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Invoice } from '../utils/database.js';

dotenv.config();

const fixIndexes = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        console.log('Dropping invoiceNumber_1 index...');
        try {
            await mongoose.connection.collection('invoices').dropIndex('invoiceNumber_1');
            console.log('Index dropped successfully.');
        } catch (error) {
            if (error.code === 27) {
                console.log('Index does not exist (IndexNotFound).');
            } else {
                console.error('Error dropping index:', error.message);
            }
        }

        // We don't need to manually create it, Mongoose will creating it on next startup
        // but we can force ensureIndexes if we want.
        console.log('Ensuring indexes...');
        await Invoice.syncIndexes();
        console.log('Indexes synced.');

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Script error:', error);
        process.exit(1);
    }
};

fixIndexes();
