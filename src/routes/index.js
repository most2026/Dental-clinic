// ============================================================
// src/routes/index.js — تجميع جميع مسارات التطبيق
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { getDashboard } = require('../controllers/dashboardController');

// --- الصفحة الرئيسية ---
router.get('/', getDashboard);

// --- تحميل باقي المسارات ---
router.use('/patients',     require('./patientRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/invoices',     require('./invoiceRoutes'));

module.exports = router;
