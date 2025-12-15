import express from 'express';
import { processInvoiceReminders } from '../cron/emailReminder.js';

const router = express.Router();

// This route will be triggered by Vercel Cron
router.get('/reminders', async (req, res) => {
    try {
        // You might want to add authentication here to prevent unauthorized access
        // For Vercel Cron, you can check for the Authorization header with CRON_SECRET if configured
        // or just rely on obscurity if not critical, but verifying the header is best practice.

        // Check for authorization header if you set CRON_SECRET env var in Vercel
        const authHeader = req.headers.authorization;
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log('Triggering manual invoice reminder check via Cron route');
        await processInvoiceReminders();
        res.status(200).json({ message: 'Reminder process completed' });
    } catch (error) {
        console.error('Error in cron route:', error);
        res.status(500).json({ message: 'Error processing reminders', error: error.message });
    }
});

export default router;
