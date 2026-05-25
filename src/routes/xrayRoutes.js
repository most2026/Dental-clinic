// ============================================================
// src/routes/xrayRoutes.js — مسارات نظام الأشعة
// ============================================================
'use strict';

const express  = require('express');
const router   = express.Router({ mergeParams: true }); // ← مهم لوراثة patientId
const ctrl     = require('../controllers/xrayController');
const { uploadXray } = require('../utils/multerConfig');
const { validateObjectId } = require('../middlewares/errorHandler');
const { uploadLimiter } = require('../middlewares/security');

// معالج أخطاء Multer المخصص
const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.session.errorMsg = 'حجم الملف كبير جداً (الحد الأقصى 20 ميجابايت)';
    return res.redirect('back');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    req.session.errorMsg = 'لا يمكن رفع أكثر من 10 ملفات دفعة واحدة';
    return res.redirect('back');
  }
  if (err.message) {
    req.session.errorMsg = err.message;
    return res.redirect('back');
  }
  next(err);
};

// GET  /patients/:patientId/xrays/compare  — مقارنة أشعتين
router.get('/compare', validateObjectId, ctrl.compare);

// GET  /patients/:patientId/xrays          — المعرض
router.get('/', validateObjectId, ctrl.index);

// GET  /patients/:patientId/xrays/upload   — نموذج الرفع
router.get('/upload', validateObjectId, ctrl.uploadForm);

// POST /patients/:patientId/xrays          — رفع الملفات
router.post(
  '/',
  validateObjectId,
  uploadLimiter, // ← إضافة Rate Limiting
  (req, res, next) => {
    // نمرر patientId لـ multerConfig عبر req.params
    uploadXray.array('xrayFiles', 10)(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  ctrl.upload
);

// GET    /patients/:patientId/xrays/:xrayId  — عرض صورة
router.get('/:xrayId', validateObjectId, ctrl.show);

// PATCH  /patients/:patientId/xrays/:xrayId  — تحديث ملاحظات
router.patch('/:xrayId', validateObjectId, ctrl.updateNotes);

// DELETE /patients/:patientId/xrays/:xrayId  — حذف
router.delete('/:xrayId', validateObjectId, ctrl.destroy);

module.exports = router;
