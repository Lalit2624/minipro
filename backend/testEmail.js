require('dotenv').config();
const mongoose = require('mongoose');
const { sendMatchEmail } = require('./utils/emailService');
const Media = require('./models/Media');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to DB');
    const media = await Media.find().limit(2);
    console.log('Media items found:', media.length);
    if(media.length > 0) {
      console.log('Testing with publicId:', media[0].publicId);
      const success = await sendMatchEmail('test@example.com', media);
      console.log('Email sent success:', success);
    }
    mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
    mongoose.disconnect();
  });
