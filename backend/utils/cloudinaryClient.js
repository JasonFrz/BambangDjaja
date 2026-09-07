const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (file) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Konfigurasi Cloudinary belum lengkap di file .env');
  }

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'trafo_images',
      use_filename: true,
      unique_filename: true,
    });

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
};
