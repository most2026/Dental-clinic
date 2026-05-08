// ============================================================
// src/routes/index.js — المسارات الرئيسية للتطبيق
// ============================================================

'use strict';

const express = require('express');
const router  = express.Router();

// --- الصفحة الرئيسية (Dashboard) ---
router.get('/', (req, res) => {
  res.render('dashboard/index', {
    title: 'لوحة التحكم',
    // بيانات وهمية مؤقتة — سيتم استبدالها بالبيانات الحقيقية في الخطوة 5
    stats: {
      totalPatients:     0,
      todayAppointments: 0,
      pendingInvoices:   0,
      monthlyRevenue:    0,
    },
  });
});

module.exports = router;
