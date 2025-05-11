import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables if not already loaded
dotenv.config();

// Configure SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', // Use your provider (Gmail, Outlook, etc.)
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER, // Your email
        pass: process.env.SMTP_PASS // App password or real password
    }
});

/**
 * Send an email using the configured SMTP transport
 * @param {Object} options Email options
 * @param {string} options.to Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.text Email plain text body
 * @param {string=} options.html Optional HTML body
 * @returns {Object} Response object with content array
 */
export const sendEmail = async ({ to, subject, text, html }) => {
    try {
        // Input validation
        if (!to || !subject || (!text && !html)) {
            throw new Error('Missing required email fields');
        }

        // Additional validation
        if (!process.env.SMTP_USER) {
            throw new Error('SMTP_USER environment variable is not set');
        }

        const mailOptions = {
            from: process.env.SMTP_USER,
            to,
            subject,
            text: text || '',
            html: html || ''
        };

        const info = await transporter.sendMail(mailOptions);

        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Email sent successfully to ${to}. Message ID: ${info.messageId}`
                }
            ]
        };
    } catch (error) {
        console.error('Email sending error:', error);
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Failed to send email: ${error.message}`
                }
            ]
        };
    }
};

/**
 * Verify SMTP connection is working
 * @returns {Object} Response object with connection status
 */
export const verifyEmailConnection = async () => {
    try {
        await transporter.verify();
        return {
            content: [
                {
                    type: 'text',
                    text: '✅ SMTP connection verified successfully!'
                }
            ]
        };
    } catch (error) {
        console.error('SMTP verification error:', error);
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ SMTP verification failed: ${error.message}`
                }
            ]
        };
    }
};