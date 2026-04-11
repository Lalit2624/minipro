const mongoose = require('mongoose');

const FaceEncodingSchema = new mongoose.Schema({
  mediaId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
  mediaUrl:   { type: String, required: true },
  encoding:   { type: [Number], required: true }, // 128-dimensional face vector
  faceIndex:  { type: Number, default: 0 },       // which face in the image
  boundingBox:{ type: Object },                   // {top, right, bottom, left}
}, { timestamps: true });

// Index for faster queries
FaceEncodingSchema.index({ mediaId: 1 });

module.exports = mongoose.model('FaceEncoding', FaceEncodingSchema);