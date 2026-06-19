// ============================================================
// src/routes/index.js — تجميع جميع مسارات التطبيق
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { injectPermissions, checkPermission } = require('../middlewares/permissions');
const { getDashboard } = require('../controllers/dashboardController');

// ── تطبيق الحماية على كل المسارات التالية ──────────────────
router.use(requireAuth);
router.use(injectPermissions);

// --- الصفحة الرئيسية ---
router.get('/', getDashboard);

// --- تحميل باقي المسارات ---
router.use('/patients',     require('./patientRoutes'));
router.use('/patients/:patientId/xrays',     require('./xrayRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/invoices',     require('./invoiceRoutes'));
router.use ('/settings',                   require('./settingsRoutes'));
router.use ('/treatments',                 require('./treatmentRoutes'));
router.use('/treatment-plans', require('./treatmentPlanRoutes'));
router.use('/search', require('./searchRoutes'));


module.exports = router;
