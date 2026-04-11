const nodemailer = require('nodemailer');

// Temporary in-memory store for OTP verification
// Format: pendingUsers.set(email, { otp, password, expiresAt });
const pendingUsers = new Map();

const sendOtpEmail = async (email, otp) => {
  try {
    let transporter;
    let senderEmail = '"AI Face Recognition" <no-reply@aifacematch.local>';

    if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      senderEmail = '"AI Face Recognition" <' + process.env.SMTP_EMAIL + '>';
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      senderEmail = '"AI Face Recognition Test" <' + testAccount.user + '>';
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4F46E5;">Email Verification Required</h2>
        <p>Hello,</p>
        <p>You are attempting to register for the FaceFind Intelligence system. To complete your registration and verify this email address, please enter the following 6-digit code:</p>
        <div style="font-size: 32px; font-weight: bold; padding: 20px; text-align: center; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0; color: #111;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: senderEmail,
      to: email,
      subject: 'Your Authentication Code',
      html: htmlBody,
    });
    
    if (!process.env.SMTP_EMAIL) {
      console.log('Preview URL for OTP email: %s', nodemailer.getTestMessageUrl(info));
    }
    return true;
  } catch (err) {
    console.error('Failed to send OTP:', err);
    return false;
  }
};

module.exports = {
  pendingUsers,
  sendOtpEmail
};
