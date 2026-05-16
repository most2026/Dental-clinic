// ============================================================
// src/routes/index.js — تجميع جميع مسارات التطبيق
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { getDashboard } = require('../controllers/dashboardController');

// ── تطبيق الحماية على كل المسارات التالية ──────────────────
router.use(requireAuth);

// --- الصفحة الرئيسية ---
router.get('/', getDashboard);

// --- تحميل باقي المسارات ---
router.use('/patients',     require('./patientRoutes'));
router.use('/patients/:patientId/xrays',     require('./xrayRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/invoices',     require('./invoiceRoutes'));
router.use ('/settings',                   require('./settingsRoutes'));

module.exports = router;
