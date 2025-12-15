import cron from 'node-cron';
import nodemailer from 'nodemailer';
import dayjs from 'dayjs';
import { connectDB, Invoice, User } from '../utils/database.js';

// Get admin email from environment variables (SECURE - never hardcode)
const getAdminEmail = () => process.env.ADMIN_EMAIL;
const getAdminPassword = () => process.env.ADMIN_EMAIL_PASSWORD;

// Create transporter with environment variables
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: getAdminEmail(),
      pass: getAdminPassword()
    }
  });
};

// HTML Email Templates
const getEmailTemplate = (type, data) => {
  const baseStyle = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #F1F3E0;
    border-radius: 10px;
  `;

  const headerStyle = `
    background-color: #778873;
    color: white;
    padding: 20px;
    border-radius: 10px 10px 0 0;
    text-align: center;
  `;

  const contentStyle = `
    background-color: white;
    padding: 30px;
    border-radius: 0 0 10px 10px;
    border: 2px solid #D2DCB6;
  `;

  const buttonStyle = `
    display: inline-block;
    background-color: #A1BC98;
    color: white;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 5px;
    margin-top: 20px;
  `;

  const templates = {
    // Client reminder - 14 days before
    client_14_days: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <h1>📋 Invoice Reminder</h1>
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #778873;">Dear ${data.clientName},</h2>
          <p>This is a friendly reminder that your invoice is due in <strong>14 days</strong>.</p>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Invoice #:</strong> ${data.invoiceId}</p>
            <p><strong>Amount:</strong> $${data.amount}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
          </div>
          <p>Please ensure payment is made on time to avoid any late fees.</p>
          <p style="color: #A1BC98;">If you have any questions, please contact your sales representative.</p>
          <hr style="border: 1px solid #D2DCB6; margin: 20px 0;">
          <p style="font-size: 12px; color: #778873;">This is an automated message from Invoice Management System.</p>
        </div>
      </div>
    `,

    // Client reminder - 7 days before
    client_7_days: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <h1>⚠️ Invoice Due Soon</h1>
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #778873;">Dear ${data.clientName},</h2>
          <p style="color: #d9534f; font-weight: bold;">Your invoice is due in just <strong>7 days</strong>!</p>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #A1BC98;">
            <p><strong>Invoice #:</strong> ${data.invoiceId}</p>
            <p><strong>Amount:</strong> $${data.amount}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
          </div>
          <p>Please arrange payment as soon as possible to avoid late payment penalties.</p>
          <p style="color: #A1BC98;">Contact your sales representative if you need assistance.</p>
          <hr style="border: 1px solid #D2DCB6; margin: 20px 0;">
          <p style="font-size: 12px; color: #778873;">This is an automated message from Invoice Management System.</p>
        </div>
      </div>
    `,

    // Sales notification - 7 days before
    sales_7_days: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <h1>📊 Client Invoice Alert</h1>
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #778873;">Hello Sales Team,</h2>
          <p>A client invoice is approaching its due date. Please follow up with the client.</p>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #778873; margin-top: 0;">Client Information</h3>
            <p><strong>Client Name:</strong> ${data.clientName}</p>
            <p><strong>Client Email:</strong> ${data.clientEmail}</p>
          </div>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #778873; margin-top: 0;">Invoice Details</h3>
            <p><strong>Invoice #:</strong> ${data.invoiceId}</p>
            <p><strong>Amount:</strong> $${data.amount}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
            <p><strong>Days Until Due:</strong> 7 days</p>
          </div>
          <p style="color: #d9534f;">Action Required: Please contact the client to ensure timely payment.</p>
          <hr style="border: 1px solid #D2DCB6; margin: 20px 0;">
          <p style="font-size: 12px; color: #778873;">Invoice Management System - Sales Notification</p>
        </div>
      </div>
    `,

    // Manager notification - 1 day before
    manager_1_day: `
      <div style="${baseStyle}">
        <div style="background-color: #d9534f; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1>🚨 URGENT: Invoice Due Tomorrow</h1>
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #778873;">Dear Manager,</h2>
          <p style="color: #d9534f; font-weight: bold; font-size: 18px;">IMMEDIATE ATTENTION REQUIRED</p>
          <p>An invoice is due tomorrow and requires urgent follow-up.</p>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #d9534f;">
            <h3 style="color: #778873; margin-top: 0;">Invoice Details</h3>
            <p><strong>Invoice #:</strong> ${data.invoiceId}</p>
            <p><strong>Amount:</strong> $${data.amount}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
          </div>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #778873; margin-top: 0;">Client Information</h3>
            <p><strong>Client Name:</strong> ${data.clientName}</p>
            <p><strong>Client Email:</strong> ${data.clientEmail}</p>
          </div>
          <div style="background-color: #F1F3E0; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #778873; margin-top: 0;">Sales Representative</h3>
            <p><strong>Email:</strong> ${data.salesEmail}</p>
          </div>
          <p style="color: #d9534f; font-weight: bold;">Please take immediate action to ensure payment collection.</p>
          <hr style="border: 1px solid #D2DCB6; margin: 20px 0;">
          <p style="font-size: 12px; color: #778873;">Invoice Management System - Manager Alert</p>
        </div>
      </div>
    `
  };

  return templates[type] || '';
};

// Send email with HTML template
const sendEmail = async (to, subject, htmlContent, textContent) => {
  if (!to) {
    console.log('No recipient email provided');
    return;
  }

  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: `"Invoice Management System" <${getAdminEmail()}>`,
      to,
      subject,
      text: textContent,
      html: htmlContent
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error.message);
    return false;
  }
};

// Log email notification to database
const logEmailNotification = async (invoiceId, type, recipient, success) => {
  try {
    await Invoice.findByIdAndUpdate(invoiceId, {
      $push: {
        emailNotifications: {
          type,
          recipient,
          success,
          sentAt: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Error logging email notification:', error);
  }
};

// Main function to check and send reminders
const processInvoiceReminders = async () => {
  console.log(`[${new Date().toISOString()}] Running email reminder check...`);

  try {
    const invoices = await Invoice.find({ status: { $nin: ['paid', 'cancelled'] } })
      .populate('client', 'firstName lastName email')
      .populate('salesPerson', 'email');

    const today = dayjs().startOf('day');
    let emailsSent = 0;

    for (const invoice of invoices) {
      const dueDate = dayjs(invoice.dueDate).startOf('day');
      const daysUntilDue = dueDate.diff(today, 'day');

      const emailData = {
        invoiceId: invoice.id,
        clientName: invoice.client ? `${invoice.client.firstName} ${invoice.client.lastName}` : invoice.clientName,
        clientEmail: invoice.client ? invoice.client.email : null,
        salesEmail: invoice.salesPerson ? invoice.salesPerson.email : null,
        amount: invoice.amount,
        dueDate: dayjs(invoice.dueDate).format('MMMM D, YYYY')
      };

      // 14 days before - Client reminder
      if (daysUntilDue === 14) {
        const html = getEmailTemplate('client_14_days', emailData);
        const text = `Dear ${emailData.clientName}, Your invoice #${emailData.invoiceId} is due in 14 days. Amount: $${emailData.amount}. Due Date: ${emailData.dueDate}.`;

        const success = await sendEmail(
          emailData.clientEmail,
          '📋 Upcoming Invoice Due Date Reminder - 14 Days',
          html,
          text
        );

        await logEmailNotification(invoice.id, 'client_14_days', emailData.clientEmail, success);
        if (success) emailsSent++;
      }

      // 7 days before - Client reminder
      if (daysUntilDue === 7) {
        // Client email
        const clientHtml = getEmailTemplate('client_7_days', emailData);
        const clientText = `IMPORTANT: Dear ${emailData.clientName}, Your invoice #${emailData.invoiceId} is due in 7 days. Amount: $${emailData.amount}. Due Date: ${emailData.dueDate}. Please arrange payment soon.`;

        const clientSuccess = await sendEmail(
          emailData.clientEmail,
          '⚠️ Invoice Due in 7 Days - Action Required',
          clientHtml,
          clientText
        );

        await logEmailNotification(invoice.id, 'client_7_days', emailData.clientEmail, clientSuccess);
        if (clientSuccess) emailsSent++;

        // Sales email
        const salesHtml = getEmailTemplate('sales_7_days', emailData);
        const salesText = `Client ${emailData.clientName} has an invoice #${emailData.invoiceId} due in 7 days. Amount: $${emailData.amount}. Please follow up.`;

        const salesSuccess = await sendEmail(
          emailData.salesEmail,
          '📊 Client Invoice Approaching Due Date - Follow Up Required',
          salesHtml,
          salesText
        );

        await logEmailNotification(invoice.id, 'sales_7_days', emailData.salesEmail, salesSuccess);
        if (salesSuccess) emailsSent++;
      }

      // 1 day before - Manager notification
      if (daysUntilDue === 1) {
        const html = getEmailTemplate('manager_1_day', emailData);
        const text = `URGENT: Invoice #${emailData.invoiceId} for ${emailData.clientName} is due tomorrow. Amount: $${emailData.amount}. Sales Rep: ${emailData.salesEmail}. Immediate action required.`;

        const success = await sendEmail(
          getAdminEmail(),
          '🚨 URGENT: Client Invoice Due Tomorrow - Immediate Action Required',
          html,
          text
        );

        await logEmailNotification(invoice.id, 'manager_1_day', getAdminEmail(), success);
        if (success) emailsSent++;
      }
    }

    console.log(`[${new Date().toISOString()}] Email reminder check completed. Sent ${emailsSent} emails.`);
  } catch (error) {
    console.error('Error in email reminder job:', error);
  }
};

connectDB().then(() => {
  // Schedule cron job to run every day at midnight (00:00)
  cron.schedule('0 0 * * *', () => {
    processInvoiceReminders();
  }, {
    timezone: 'UTC'
  });

  // Also run at 9 AM for additional check
  cron.schedule('0 9 * * *', () => {
    processInvoiceReminders();
  }, {
    timezone: 'UTC'
  });

  console.log('📧 Email reminder system initialized');
  console.log('   - Daily check at 00:00 UTC');
  console.log('   - Additional check at 09:00 UTC');
});


// Export for manual triggering (testing)
export { processInvoiceReminders, sendEmail };
