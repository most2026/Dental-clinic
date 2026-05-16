// ============================================================
// src/middlewares/authMiddleware.js
// ============================================================
'use strict';

const mongoose = require('mongoose');

// ── تحميل بيانات المستخدم في كل طلب ────────────────────────
const loadUser = async (req, res, next) => {
  // القيم الافتراضية
  res.locals.user   = null;
  res.locals.isAuth = false;

  try {
    // لا توجد جلسة أو userId — تابع
    if (!req.session || !req.session.userId) {
      return next();
    }

    // نفس منطق debug-session الذي ثبت أنه يعمل
    const User = mongoose.model('User');
    const user = await User.findById(req.session.userId)
      .select('-password')
      .lean(); // plain JS object — أبسط وأسرع

    // المستخدم غير موجود
    if (!user) {
      console.warn('⚠️  loadUser: userId موجود في session لكن المستخدم غير موجود في DB');
      delete req.session.userId;
      return next();
    }

    // الحساب معطّل
    if (!user.isActive) {
      console.warn('⚠️  loadUser: الحساب معطّل:', user.email);
      delete req.session.userId;
      return next();
    }

    // ✅ نجح — أضف roleLabel للاستخدام في القوالب
    const ROLE_LABELS = {
      admin:        'مدير النظام',
      doctor:       'طبيب أسنان',
      receptionist: 'موظف استقبال',
    };

    user.roleLabel = ROLE_LABELS[user.role] || user.role;

    // اجعله متاحاً في كل مكان
    req.user          = user;
    res.locals.user   = user;
    res.locals.isAuth = true;

    console.log('✅ loadUser: تم تحميل المستخدم:', user.name);

  } catch (err) {
    console.error('❌ loadUser error:', err.message);
  }

  next();
};

// ── التحقق من تسجيل الدخول ──────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.originalUrl !== '/auth/login') {
    req.session.returnTo = req.originalUrl;
  }
  return res.redirect('/auth/login');
};

// ── إعادة التوجيه إذا كان مسجلاً دخوله ─────────────────────
const redirectIfAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
};

// ── التحقق من الدور ──────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).render('errors/403', {
      title:   '403 — غير مصرح',
      message: 'ليس لديك صلاحية للوصول لهذه الصفحة',
    });
  }
  next();
};

module.exports = { loadUser, requireAuth, redirectIfAuth, requireRole };
