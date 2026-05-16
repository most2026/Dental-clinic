// ============================================================
// src/routes/authRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { redirectIfAuth, requireAuth, requireRole } = require('../middlewares/authMiddleware');

// تسجيل الدخول
router.get ('/login',    redirectIfAuth, ctrl.loginForm);
router.post('/login',    redirectIfAuth, ctrl.login);

// تسجيل الخروج
router.get ('/logout',   requireAuth, ctrl.logout);

// إنشاء حساب (الأدمن فقط يصل له من لوحة التحكم)
router.get ('/register', requireAuth, requireRole('admin'), ctrl.registerForm);
router.post('/register', requireAuth, requireRole('admin'), ctrl.register);

// الملف الشخصي
router.get ('/profile',  requireAuth, ctrl.profile);
router.post('/profile',  requireAuth, ctrl.updateProfile);

module.exports = router;
