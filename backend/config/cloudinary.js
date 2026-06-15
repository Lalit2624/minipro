const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("KEY:", process.env.CLOUDINARY_API_KEY);
console.log("SECRET:", process.env.CLOUDINARY_API_SECRET);

// Storage for admin media uploads (images + videos)
const mediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: 'face-recognition/media',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'avi'],
      transformation: isVideo ? [] : [{ quality: 'auto', fetch_format: 'auto' }],
    };
  },
});

// Storage for user selfies
const selfieStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'face-recognition/selfies',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ quality: 'auto' }],
  },
});

const uploadMedia  = multer({ storage: mediaStorage,  limits: { fileSize: 100 * 1024 * 1024 } });
const uploadSelfie = multer({ storage: selfieStorage, limits: { fileSize: 10  * 1024 * 1024 } });

module.exports = { cloudinary, uploadMedia, uploadSelfie };