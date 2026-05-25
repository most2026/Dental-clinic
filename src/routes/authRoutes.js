'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/authController');
const { redirectIfAuth, requireAuth, requireRole } = require('../middlewares/authMiddleware');

// ← استيراد الـ limiters
const {
  loginLimiter,
  whatsappLimiter,
} = require('../middlewares/security');

// GET  /auth/login
router.get('/login',    redirectIfAuth, ctrl.loginForm);

// POST /auth/login — مع Rate Limiting الصارم
router.post('/login',   redirectIfAuth, loginLimiter, ctrl.login);

// GET  /auth/logout
router.get('/logout',   requireAuth, ctrl.logout);

// GET/POST /auth/register
router.get ('/register', requireAuth, requireRole('admin'), ctrl.registerForm);
router.post('/register', requireAuth, requireRole('admin'), ctrl.register);

// GET/POST /auth/profile
router.get ('/profile',  requireAuth, ctrl.profile);
router.post('/profile',  requireAuth, ctrl.updateProfile);

module.exports = router;