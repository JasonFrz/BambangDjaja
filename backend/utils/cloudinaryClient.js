const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file to Cloudinary.
 * @param {Object} file - The file object from multer (req.file)
 * @returns {Promise<string>} The secure_url of the uploaded file
 */
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

    // Hapus file sementara dari server lokal setelah berhasil diupload
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    // Hapus file sementara meskipun gagal
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
};
