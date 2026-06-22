// ============================================================
// src/config/cloudinary.js — إعداد Cloudinary
// ============================================================
'use strict';

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ── دالة حذف ملف من Cloudinary ──────────────────────────────
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('⚠️  فشل حذف الملف من Cloudinary:', publicId, err.message);
  }
};

module.exports = { cloudinary, deleteFromCloudinary };
