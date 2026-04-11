const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const dns  = require('dns');
const util = require('util');
const resolveMx = util.promisify(dns.resolveMx);
const { pendingUsers, sendOtpEmail } = require('../utils/otpService');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.userLogin = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    email = email.toLowerCase().trim();

    // Deep check: Is the domain actually capable of receiving emails?
    const domain = email.split('@')[1];
    try {
      const addresses = await resolveMx(domain);
      if (!addresses || addresses.length === 0) {
        return res.status(400).json({ success: false, message: 'This email domain does not exist or cannot receive mail.' });
      }
    } catch (err) {
      return res.status(400).json({ success: false, message: 'This email domain does not exist or cannot receive mail.' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      pendingUsers.set(email, { otp, password, expiresAt: Date.now() + 10 * 60 * 1000 });
      
      const sent = await sendOtpEmail(email, otp);
      if (!sent) return res.status(500).json({ success: false, message: 'Could not send verification email.' });

      return res.json({ success: true, requires_otp: true, message: 'An OTP has been sent to your email.' });
    } else {
      if (!user.password) {
        // Legacy user with no password; set it during this login
        user.password = password;
        await user.save();
      } else if (!(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.requestOtp = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    email = email.toLowerCase().trim();
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email. Please sign up.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingUsers.set(email, { otp, isLogin: true, expiresAt: Date.now() + 10 * 60 * 1000 });
    
    const sent = await sendOtpEmail(email, otp);
    if (!sent) return res.status(500).json({ success: false, message: 'Could not send verification email.' });

    res.json({ success: true, message: 'An OTP has been sent to your email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.seedAdmin = async (req, res) => {
  try {
    const existing = await User.findOne({ role: 'admin' });
    if (existing) return res.json({ success: true, message: 'Admin already exists' });

    await User.create({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
    });
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    const emailTrimmed = email.toLowerCase().trim();
    const pending = pendingUsers.get(emailTrimmed);

    if (!pending) return res.status(400).json({ success: false, message: 'No pending registration found or session expired.' });
    
    if (pending.expiresAt < Date.now()) {
      pendingUsers.delete(emailTrimmed);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please try logging in again.' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    let user;
    if (pending.isLogin) {
       user = await User.findOne({ email: emailTrimmed });
    } else {
       const { password } = pending;
       user = await User.create({ email: emailTrimmed, password, role: 'user' });
    }
    pendingUsers.delete(emailTrimmed);
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

    res.json({ success: true, token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'No Google credential provided' });

    // Securely verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE",
    });
    const payload = ticket.getPayload();

    const email = payload.email;
    if (!email) return res.status(400).json({ success: false, message: 'Google account has no email' });
    
    const emailTrimmed = email.toLowerCase().trim();
    let user = await User.findOne({ email: emailTrimmed });
    
    if (!user) {
      // Create user with a random secure password (since schema requires one)
      const crypto = require('crypto');
      const randomPassword = crypto.randomBytes(16).toString('hex');
      user = await User.create({ email: emailTrimmed, password: randomPassword, role: 'user' });
    }

    const jwtToken = signToken(user._id);
    res.json({ success: true, token: jwtToken, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Google Login Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to securely authenticate with Google. Ensure GOOGLE_CLIENT_ID is correct.' });
  }
};