// ============================================================
// src/routes/appointmentRoutes.js — (سيكتمل في الخطوة التالية)
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();

router.get('/', (req, res) => {
  res.render('appointments/index', { title: 'المواعيد', appointments: [] });
});

router.get('/today', (req, res) => {
  res.render('appointments/today', { title: 'مواعيد اليوم', appointments: [] });
});

router.get('/new', (req, res) => {
  res.render('appointments/new', { title: 'حجز موعد جديد', patient: null, errors: [] });
});

module.exports = router;
