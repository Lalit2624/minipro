const express = require('express');
const router  = express.Router();
const { login, userLogin, requestOtp, verifyOtp, getMe, seedAdmin, googleLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login',        login);
router.post('/user-login',   userLogin);
router.post('/request-otp',  requestOtp);
router.post('/verify-otp',   verifyOtp);
router.post('/google-login', googleLogin);
router.get('/me',            protect, getMe);
router.post('/seed-admin',   seedAdmin); // Run once to create admin account
module.exports = router;