const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const sendMatchEmail = async (recipientEmail, matchedMedia) => {
  try {
    let transporter;
    let senderEmail = '"AI Face Recognition" <no-reply@aifacematch.local>';

    // If SMTP credentials aren't provided, use a test Ethereal account
    if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: 'gmail', // Standardizing on Gmail as per default config
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      senderEmail = '"AI Face Recognition" <' + process.env.SMTP_EMAIL + '>';
    } else {
      console.warn('Real SMTP credentials not found in .env. Falling back to Ethereal Email for testing...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      senderEmail = '"AI Face Recognition Test" <' + testAccount.user + '>';
    }

    const host = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const mediaItemsHtml = matchedMedia.map(item => {
      const isVideo = item.resourceType === 'video';
      return `
        <div style="margin-bottom: 20px; display: inline-block; width: 45%; margin-right: 5%; text-align: center;">
          <a href="${item.secureUrl}" target="_blank" style="text-decoration: none;">
            ${isVideo
              ? `<div style="background: #333; height: 150px; display: flex; align-items: center; justify-content: center; color: white;">Video: Click to view</div>`
              : `<img src="${item.secureUrl}" style="max-width: 100%; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;" alt="Match" />`
            }
          </a>
          <br />
          <a href="${item.secureUrl}" target="_blank" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background-color: #4F46E5; color: white; border-radius: 4px; text-decoration: none; font-size: 14px;">
            Open High-Res
          </a>
        </div>
      `;
    }).join('');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4F46E5;">Good News! Face Matches Found.</h2>
        <p>Hello,</p>
        <p>Our facial recognition system successfully scanned your uploaded selfie and found matches in our database!</p>
        <p><strong>You can view and save your full-resolution images using the secure links below.</strong> <i>(Attachments omitted to ensure fast delivery)</i></p>
        <div style="margin-top: 20px;">
          ${mediaItemsHtml}
        </div>
        <hr style="border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">This is an automated message from the AI Face Recognition Service.</p>
      </div>
    `;

    const mailOptions = {
      from: senderEmail,
      to: recipientEmail,
      subject: 'Found your matching photos! ✨',
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email successfully sent to:', recipientEmail, 'MessageId:', info.messageId);
    
    // Auto-generate test URL for debugging Ethereal emails
    if (!process.env.SMTP_EMAIL) {
      console.log('Preview URL for test email: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send matching images email:', error);
    return false;
  }
};

module.exports = {
  sendMatchEmail,
};
