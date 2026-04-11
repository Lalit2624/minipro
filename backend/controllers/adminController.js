const axios        = require('axios');
const Media        = require('../models/Media');
const FaceEncoding = require('../models/FaceEncoding');
const crypto       = require('crypto');
const fs           = require('fs');

const extractionQueue = [];
let isExtracting = false;

async function processExtractionQueue() {
  if (isExtracting) return;
  isExtracting = true;
  while (extractionQueue.length > 0) {
    const media = extractionQueue.shift();
    await extractFacesAsync(media);
  }
  isExtracting = false;
}

exports.uploadMediaFiles = async (req, res) => {
  try {
    if (!req.files?.length)
      return res.status(400).json({ success: false, message: 'No files uploaded' });

    const savedMedia = [];
    const duplicates = [];

    for (const file of req.files) {
      const buffer = fs.readFileSync(file.path);
      const fileHash = crypto.createHash('md5').update(buffer).digest('hex');

      const existing = await Media.findOne({ hash: fileHash });
      if (existing) {
        fs.unlinkSync(file.path);
        duplicates.push(file.originalname);
      } else {
        const serverUrl = `${req.protocol}://${req.get('host')}/uploads/media/${file.filename}`;
        const newMedia = await Media.create({
          publicId:     file.filename,
          url:          serverUrl,
          secureUrl:    serverUrl,
          resourceType: file.mimetype.startsWith('video/') ? 'video' : 'image',
          originalName: file.originalname,
          uploadedBy:   req.user._id,
          hash:         fileHash,
        });
        savedMedia.push(newMedia);
      }
    }

    // Safely queue face extraction sequentially
    savedMedia.forEach(media => extractionQueue.push(media));
    processExtractionQueue();

    let message = `${savedMedia.length} file(s) uploaded. Face extraction started.`;
    if (duplicates.length) {
      message += ` Skipped ${duplicates.length} duplicate(s) (${duplicates.join(', ')}).`;
    }

    res.status(201).json({
      success: true,
      message,
      media: savedMedia,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

async function extractFacesAsync(media) {
  try {
    const { data } = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/extract-faces`,
      { mediaId: media._id.toString(), mediaUrl: media.secureUrl, mediaType: media.resourceType }
    );

    if (data.success && data.encodings?.length) {
      await FaceEncoding.insertMany(
        data.encodings.map((enc, i) => ({
          mediaId:    media._id,
          mediaUrl:   media.secureUrl,
          encoding:   enc.encoding,
          faceIndex:  i,
          boundingBox:enc.bounding_box,
        }))
      );
      await Media.findByIdAndUpdate(media._id, {
        faceCount: data.encodings.length,
        processed: true,
      });
    } else {
      await Media.findByIdAndUpdate(media._id, { processed: true, faceCount: 0 });
    }
  } catch (err) {
    await Media.findByIdAndUpdate(media._id, { processed: true, processingError: err.message });
  }
}

exports.getAllMedia = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [media, totalMedia, totalFaces] = await Promise.all([
      Media.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('uploadedBy', 'email'),
      Media.countDocuments(),
      FaceEncoding.countDocuments()
    ]);

    res.json({ 
      success: true, 
      media, 
      totalFaces, 
      totalMedia, 
      currentPage: page, 
      totalPages: Math.ceil(totalMedia / limit) 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.processMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
    await Media.findByIdAndUpdate(media._id, { processed: false, processingError: null });
    extractFacesAsync(media);
    res.json({ success: true, message: 'Reprocessing started' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    // Remove from local storage
    const fs = require('fs');
    const path = require('path');
    if (media.publicId) {
      const filePath = path.join(__dirname, '../uploads/media', media.publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove from DB
    await FaceEncoding.deleteMany({ mediaId: media._id });
    await media.deleteOne();

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkDeleteMedia = async (req, res) => {
  try {
    const { mediaIds } = req.body;
    if (!mediaIds || !mediaIds.length) {
      return res.status(400).json({ success: false, message: 'No media IDs provided' });
    }

    const fs = require('fs');
    const path = require('path');
    
    const mediaItems = await Media.find({ _id: { $in: mediaIds } });
    
    // Remove all matched files from disk safely
    mediaItems.forEach(media => {
      if (media.publicId) {
        const filePath = path.join(__dirname, '../uploads/media', media.publicId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    // Remove from DB
    await FaceEncoding.deleteMany({ mediaId: { $in: mediaIds } });
    await Media.deleteMany({ _id: { $in: mediaIds } });

    res.json({ success: true, message: `${mediaItems.length} media items deleted successfully` });
  } catch (err) {
    const fs = require('fs');
    fs.appendFileSync('error_log.txt', `[${new Date().toISOString()}] BULK DELETE ERROR: ${err.stack}\n`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reprocessFailed = async (req, res) => {
  try {
    // Find media that either threw an error or has processed=false
    const failedMedia = await Media.find({
      $or: [
        { processed: false },
        { processingError: { $ne: null } }
      ]
    });
    
    if (!failedMedia.length) {
      return res.json({ success: true, message: 'All assets are already healthy. Nothing to repair.' });
    }

    failedMedia.forEach(media => extractionQueue.push(media));
    processExtractionQueue();

    res.json({ success: true, message: `Queued ${failedMedia.length} stale/failed assets for background repair processing.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};