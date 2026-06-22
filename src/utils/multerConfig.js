// ============================================================
// src/utils/multerConfig.js — رفع الأشعة عبر Cloudinary
// ============================================================
'use strict';

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const XRAY_TYPES_LABELS = {
  panoramic:  'بانورامية',
  periapical: 'حول ذروية',
  bitewing:   'عضية (Bitewing)',
  cbct:       'مقطعية (CBCT)',
  other:      'أخرى',
};

const ALLOWED_MIME_TYPES = {
  'image/jpeg':      true,
  'image/jpg':       true,
  'image/png':       true,
  'image/webp':      true,
  'image/tiff':      true,
  'application/pdf': true,
};

// ── إعداد التخزين السحابي ─────────────────────────────────────
const xrayStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const patientId   = req.params.patientId || 'general';
    const isPdf        = file.mimetype === 'application/pdf';

    return {
      folder:        `dental-clinic/xrays/${patientId}`,
      resource_type: isPdf ? 'raw' : 'image',
      public_id:     `xray_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
      // تحسين الصور تلقائياً (لا يؤثر على PDF)
      transformation: isPdf ? undefined : [{ quality: 'auto:good' }],
    };
  },
});

const xrayFileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`نوع الملف غير مدعوم: ${file.mimetype}`), false);
  }
};

const uploadXray = multer({
  storage:    xrayStorage,
  fileFilter: xrayFileFilter,
  limits:     { fileSize: 20 * 1024 * 1024, files: 10 },
});

// ── دالة مساعدة: التحقق من الملف ──────────────────────────────
const validateUploadedFile = (file) => {
  if (!file) return { valid: false, error: 'لم يتم رفع أي ملف' };
  return { valid: true };
};

module.exports = {
  uploadXray,
  deleteFromCloudinary,
  validateUploadedFile,
  ALLOWED_MIME_TYPES,
  XRAY_TYPES_LABELS,
};
