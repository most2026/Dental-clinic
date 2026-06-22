// ============================================================
// src/routes/xrayRoutes.js — محدّث لـ Cloudinary
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true });
const ctrl    = require('../controllers/xrayController');
const { uploadXray } = require('../utils/multerConfig');
const { validateObjectId } = require('../middlewares/errorHandler');
const { uploadLimiter } = require('../middlewares/security');

const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.session.errorMsg = 'حجم الملف كبير جداً (الحد الأقصى 20 ميجابايت)';
    return res.redirect('back');
  }
  if (err.message) {
    req.session.errorMsg = err.message;
    return res.redirect('back');
  }
  next(err);
};

router.get('/compare', validateObjectId, ctrl.compare);
router.get('/',        validateObjectId, ctrl.index);
router.get('/upload',  validateObjectId, ctrl.uploadForm);

router.post(
  '/',
  validateObjectId,
  uploadLimiter,
  (req, res, next) => {
    uploadXray.array('xrayFiles', 10)(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  ctrl.upload
);

router.get   ('/:xrayId', validateObjectId, ctrl.show);
router.patch ('/:xrayId', validateObjectId, ctrl.updateNotes);
router.delete('/:xrayId', validateObjectId, ctrl.destroy);

module.exports = router;
