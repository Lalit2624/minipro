const axios        = require('axios');
const FaceEncoding = require('../models/FaceEncoding');
const Media        = require('../models/Media');
const { sendMatchEmail } = require('../utils/emailService');

exports.findMatches = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No selfie uploaded' });

    // Get all stored encodings from DB
    const storedEncodings = await FaceEncoding.find().lean();
    if (!storedEncodings.length)
      return res.json({ success: true, matches: [], message: 'No faces in database yet' });

    // Send selfie URL + stored encodings to Python for comparison
    const serverSelfieUrl = `${req.protocol}://${req.get('host')}/uploads/selfies/${req.file.filename}`;
    const { data } = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/compare-faces`,
      {
        selfieUrl: serverSelfieUrl,
        storedEncodings: storedEncodings.map(e => ({
          id:        e._id.toString(),
          mediaId:   e.mediaId.toString(),
          mediaUrl:  e.mediaUrl,
          encoding:  e.encoding,
        })),
        tolerance: 0.52, // Stricter tolerance combined with high num_jitters avoids false positive matches
      }
    );

    if (!data.success)
      return res.status(500).json({ success: false, message: data.message });

    // Filter out matches with strictly less than 50% confidence
    const highConfidenceMatches = data.matchedIds.filter(m => m.confidence >= 50);

    // Get unique matched media details
    const matchedMediaIds = [...new Set(highConfidenceMatches.map(m => m.mediaId))];
    const matchedMedia    = await Media.find({ _id: { $in: matchedMediaIds } });

    // Explicit email sending is now handled by the sendSelectedEmail endpoint

    res.json({
      success: true,
      matches: matchedMedia,
      matchCount: matchedMedia.length,
      confidence: highConfidenceMatches,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendSelectedEmail = async (req, res) => {
  try {
    const { email, mediaIds } = req.body;
    if (!email || !mediaIds || !mediaIds.length) {
      return res.status(400).json({ success: false, message: 'Email and selected media IDs are required' });
    }

    const matchedMedia = await Media.find({ _id: { $in: mediaIds } });
    if (!matchedMedia.length) {
      return res.status(404).json({ success: false, message: 'No media found for the provided IDs' });
    }

    const emailSent = await sendMatchEmail(email, matchedMedia);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send the email' });
    }

    res.json({ success: true, message: 'Email sent successfully with selected media' });
  } catch (err) {
    console.error('Error sending selected email:', err);
    res.status(500).json({ success: false, message: 'Internal server error while sending email' });
  }
};