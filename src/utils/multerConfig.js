// ============================================================
// src/utils/multerConfig.js — إعداد Multer لرفع الأشعة
// ============================================================
'use strict';

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── أنواع الملفات المسموح بها ────────────────────────────────
const ALLOWED_MIME_TYPES = {
  'image/jpeg':    '.jpg',
  'image/jpg':     '.jpg',
  'image/png':     '.png',
  'image/webp':    '.webp',
  'image/tiff':    '.tiff',
  'application/pdf': '.pdf',
};

const XRAY_TYPES_LABELS = {
  panoramic:  'بانورامية',
  periapical: 'حول ذروية',
  bitewing:   'عضية (Bitewing)',
  cbct:       'مقطعية (CBCT)',
  other:      'أخرى',
};

// ── إعداد مكان التخزين ───────────────────────────────────────
const xrayStorage = multer.diskStorage({

  destination: (req, file, cb) => {
    // تنظيم الملفات في مجلدات حسب ID المريض
    const patientId  = req.params.patientId || req.body.patientId || 'general';
    const uploadPath = path.join(__dirname, '../../public/uploads/xrays', patientId);

    // إنشاء المجلد إن لم يكن موجوداً
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    // اسم فريد: timestamp + رقم عشوائي + الامتداد الأصلي
    const ext      = path.extname(file.originalname).toLowerCase();
    const safeName = `xray_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  },
});

// ── فلتر نوع الملف ────────────────────────────────────────────
const xrayFileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `نوع الملف غير مدعوم (${file.mimetype}). ` +
        'الأنواع المسموح بها: JPG, PNG, WEBP, TIFF, PDF'
      ),
      false
    );
  }
};

// ── إعداد Multer النهائي ─────────────────────────────────────
const uploadXray = multer({
  storage:  xrayStorage,
  fileFilter: xrayFileFilter,
  limits: {
    fileSize:  20 * 1024 * 1024, // 20 ميجابايت كحد أقصى لكل ملف
    files:     10,               // 10 ملفات كحد أقصى في طلب واحد
  },
});

// ── دالة مساعدة: حذف ملف من القرص ──────────────────────────
const deleteFileFromDisk = (filepath) => {
  return new Promise((resolve) => {
    const absolutePath = path.join(__dirname, '../../', filepath);
    fs.unlink(absolutePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('⚠️  فشل حذف الملف:', absolutePath, err.message);
      }
      resolve(); // لا نريد إيقاف التطبيق بسبب خطأ في حذف ملف
    });
  });
};

// ── دالة مساعدة: بناء مسار URL عام للعرض ───────────────────
const buildPublicPath = (absoluteFilepath) => {
  // تحويل المسار المطلق إلى مسار URL نسبي
  const uploadsIndex = absoluteFilepath.indexOf('public');
  if (uploadsIndex === -1) return absoluteFilepath;
  return absoluteFilepath.substring(uploadsIndex + 'public'.length).replace(/\\/g, '/');
};

// ── دالة: التحقق من صحة الملف بعد الرفع ─────────────────────
const validateUploadedFile = (file) => {
  if (!file) return { valid: false, error: 'لم يتم رفع أي ملف' };
  if (file.size === 0) return { valid: false, error: 'الملف فارغ' };
  return { valid: true };
};

module.exports = {
  uploadXray,
  deleteFileFromDisk,
  buildPublicPath,
  validateUploadedFile,
  ALLOWED_MIME_TYPES,
  XRAY_TYPES_LABELS,
};
