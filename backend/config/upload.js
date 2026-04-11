const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create directories if they do not exist
const mediaDir = path.join(__dirname, '../uploads/media');
const selfieDir = path.join(__dirname, '../uploads/selfies');

if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
if (!fs.existsSync(selfieDir)) fs.mkdirSync(selfieDir, { recursive: true });

// Storage for admin media uploads (images + videos)
const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, mediaDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'media-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Storage for user selfies
const selfieStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, selfieDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'selfie-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadMedia  = multer({ storage: mediaStorage,  limits: { fileSize: 100 * 1024 * 1024 } });
const uploadSelfie = multer({ storage: selfieStorage, limits: { fileSize: 10  * 1024 * 1024 } });

module.exports = { uploadMedia, uploadSelfie };
