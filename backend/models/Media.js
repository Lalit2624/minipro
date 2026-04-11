const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  publicId:    { type: String, required: true },
  url:         { type: String, required: true },
  secureUrl:   { type: String, required: true },
  resourceType:{ type: String, enum: ['image', 'video'], required: true },
  originalName:{ type: String },
  hash:        { type: String },
  faceCount:   { type: Number, default: 0 },
  processed:   { type: Boolean, default: false },
  processingError: { type: String },
  uploadedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Media', MediaSchema);