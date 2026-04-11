const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { uploadMedia }        = require('../config/upload');
const { uploadMediaFiles, getAllMedia, processMedia, deleteMedia, bulkDeleteMedia } = require('../controllers/adminController');

router.use(protect, adminOnly);
router.post('/upload',        uploadMedia.array('files', 100), uploadMediaFiles);
router.get('/media',          getAllMedia);
router.post('/process/:id',   processMedia);
router.post('/mass-delete', bulkDeleteMedia);
router.delete('/media/:id',   deleteMedia);

module.exports = router;