// ============================================================
// src/controllers/authController.js — تسجيل الدخول والخروج
// ============================================================
'use strict';

const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');

// ── GET /auth/login — صفحة تسجيل الدخول ────────────────────
const loginForm = (req, res) => {
  res.render('auth/login', {
    title:  'تسجيل الدخول',
    error:  req.session.authError  || null,
    info:   req.session.authInfo   || null,
  });
  // مسح الرسائل
  delete req.session.authError;
  delete req.session.authInfo;
};

// ── POST /auth/login — معالجة تسجيل الدخول ─────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;

  // التحقق من الحقول
  if (!email || !password) {
    req.session.authError = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
    return res.redirect('/auth/login');
  }

  // إيجاد المستخدم مع كلمة المرور (select: false)
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+password');

  // التحقق من المستخدم وكلمة المرور
  if (!user || !(await user.comparePassword(password))) {
    req.session.authError = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    return res.redirect('/auth/login');
  }

  // التحقق من أن الحساب نشط
  if (!user.isActive) {
    req.session.authError = 'هذا الحساب معطّل، يرجى التواصل مع المدير';
    return res.redirect('/auth/login');
  }

  // حفظ الجلسة
  req.session.userId = user._id.toString();

  // تذكرني: تمديد صلاحية الجلسة
  if (remember === 'on') {
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 يوم
  }

  // تحديث آخر تسجيل دخول
  await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

  // توجيه للصفحة المطلوبة أو الرئيسية
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;

  req.session.successMsg = `مرحباً ${user.name} 👋`;
  res.redirect(returnTo);
});

// ── GET /auth/logout — تسجيل الخروج ─────────────────────────
const logout = (req, res) => {

  // احفظ بيانات المستخدم قبل حذف الجلسة
  // لعرضها في صفحة الوداع
  const loggedOutUser = req.user
    ? {
        name:      req.user.name,
        initial:   req.user.name.charAt(0),
        roleLabel: req.user.roleLabel,
      }
    : null;

  // احذف الجلسة
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ خطأ في تسجيل الخروج:', err);
    }

    // امسح الـ Cookie
    res.clearCookie('dental.sid');

    // اعرض صفحة الوداع
    res.render('auth/logout', {
      title:         'تسجيل الخروج',
      loggedOutUser,
      // نمرر هذه يدوياً لأن الجلسة انتهت
      clinicName:    process.env.CLINIC_NAME || 'عيادة الأسنان',
      currentYear:   new Date().getFullYear(),
    });
  });
};
// ── GET /auth/register — نموذج إنشاء حساب (أدمن فقط) ────────
const registerForm = (req, res) => {
  res.render('auth/register', {
    title:  'إنشاء حساب جديد',
    error:  null,
    formData: {},
  });
};

// ── POST /auth/register — حفظ مستخدم جديد ──────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, role } = req.body;

  // التحقق الأساسي
  if (!name || !email || !password) {
    return res.render('auth/register', {
      title:    'إنشاء حساب جديد',
      error:    'جميع الحقول مطلوبة',
      formData: req.body,
    });
  }

  if (password !== confirmPassword) {
    return res.render('auth/register', {
      title:    'إنشاء حساب جديد',
      error:    'كلمتا المرور غير متطابقتين',
      formData: req.body,
    });
  }

  if (password.length < 6) {
    return res.render('auth/register', {
      title:    'إنشاء حساب جديد',
      error:    'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      formData: req.body,
    });
  }

  // التحقق من عدم تكرار البريد
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.render('auth/register', {
      title:    'إنشاء حساب جديد',
      error:    'هذا البريد الإلكتروني مسجّل مسبقاً',
      formData: req.body,
    });
  }

  await User.create({
    name:     name.trim(),
    email:    email.toLowerCase().trim(),
    password,
    role:     role || 'doctor',
  });

  req.session.authInfo = 'تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن';
  res.redirect('/auth/login');
});

// ── GET /auth/profile — صفحة الملف الشخصي ──────────────────
const profile = asyncHandler(async (req, res) => {
  res.render('auth/profile', {
    title: 'الملف الشخصي',
    error: null,
    success: null,
  });
});

// ── POST /auth/profile — تحديث الملف الشخصي ────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { name, currentPassword, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findById(req.user._id).select('+password');

    // تحديث الاسم
    if (name && name.trim()) user.name = name.trim();

    // تحديث كلمة المرور
    if (newPassword) {
      if (!(await user.comparePassword(currentPassword))) {
        return res.render('auth/profile', {
          title:   'الملف الشخصي',
          error:   'كلمة المرور الحالية غير صحيحة',
          success: null,
        });
      }
      if (newPassword !== confirmPassword) {
        return res.render('auth/profile', {
          title:   'الملف الشخصي',
          error:   'كلمتا المرور الجديدتان غير متطابقتين',
          success: null,
        });
      }
      if (newPassword.length < 6) {
        return res.render('auth/profile', {
          title:   'الملف الشخصي',
          error:   'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
          success: null,
        });
      }
      user.password = newPassword;
    }

    await user.save();

    res.render('auth/profile', {
      title:   'الملف الشخصي',
      error:   null,
      success: 'تم تحديث الملف الشخصي بنجاح ✅',
    });

  } catch (err) {
    res.render('auth/profile', {
      title:   'الملف الشخصي',
      error:   err.message || 'حدث خطأ غير متوقع',
      success: null,
    });
  }
});

module.exports = { loginForm, login, logout, registerForm, register, profile, updateProfile };
