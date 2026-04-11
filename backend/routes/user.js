const express = require('express');
const router  = express.Router();
const { uploadSelfie } = require('../config/upload');
const { findMatches, sendSelectedEmail }  = require('../controllers/userController');

router.post('/find-matches', uploadSelfie.single('selfie'), findMatches);
router.post('/send-email', sendSelectedEmail);

module.exports = router;