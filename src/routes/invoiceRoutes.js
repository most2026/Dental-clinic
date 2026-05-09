// ============================================================
// src/routes/invoiceRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/invoiceController');
const { validateObjectId } = require('../middlewares/errorHandler');

// GET  /invoices/summary        — ملخص مالي (AJAX)
router.get('/summary', ctrl.getSummary);

// GET  /invoices                — قائمة الفواتير
router.get('/', ctrl.index);

// GET  /invoices/new            — نموذج جديد
router.get('/new', ctrl.newForm);

// POST /invoices                — حفظ فاتورة
router.post('/', ctrl.create);

// GET  /invoices/:id/print      — طباعة
router.get('/:id/print', validateObjectId, ctrl.print);

// GET  /invoices/:id            — تفاصيل
router.get('/:id', validateObjectId, ctrl.show);

// POST /invoices/:id/payment    — إضافة دفعة
router.post('/:id/payment', validateObjectId, ctrl.addPayment);

// PATCH /invoices/:id/status    — تحديث الحالة
router.patch('/:id/status', validateObjectId, ctrl.updateStatus);

// DELETE /invoices/:id          — إلغاء
router.delete('/:id', validateObjectId, ctrl.destroy);

module.exports = router;
