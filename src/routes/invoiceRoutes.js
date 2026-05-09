// ============================================================
// src/routes/invoiceRoutes.js — (سيكتمل في الخطوة التالية)
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();

router.get('/', (req, res) => {
  res.render('invoices/index', { title: 'الفواتير', invoices: [] });
});

router.get('/new', (req, res) => {
  res.render('invoices/new', { title: 'فاتورة جديدة', patient: null, errors: [] });
});

module.exports = router;
