// ============================================================
// src/middlewares/errorHandler.js — معالج الأخطاء المركزي
// ============================================================
'use strict';

/**
 * Middleware: التحقق من صحة ObjectId قبل استعلامات MongoDB
 * يمنع الـ CastError عند تمرير ID غير صالح في الـ URL
 */
const validateObjectId = (req, res, next) => {
  const mongoose = require('mongoose');
  const id = req.params.id;

  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    req.session.errorMsg = 'المعرّف المُدخَل غير صالح';
    return res.redirect('back');
  }
  next();
};

/**
 * Middleware: تغليف الـ async controllers لتجنب try/catch المتكرر
 * الاستخدام: router.get('/', asyncHandler(controller.index))
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * دالة مساعدة: بناء رسالة خطأ من Mongoose ValidationError
 */
const buildValidationMessage = (error) => {
  if (error.name === 'ValidationError') {
    return Object.values(error.errors)
      .map((e) => e.message)
      .join(' | ');
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const fieldNames = {
      phone:       'رقم الهاتف',
      email:       'البريد الإلكتروني',
      patientCode: 'كود المريض',
      invoiceNumber: 'رقم الفاتورة',
    };
    return `${fieldNames[field] || field} مستخدم مسبقاً`;
  }
  return error.message || 'حدث خطأ غير متوقع';
};

module.exports = { validateObjectId, asyncHandler, buildValidationMessage };
