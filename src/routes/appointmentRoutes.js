// ============================================================
// src/routes/appointmentRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/appointmentController');
const { validateObjectId } = require('../middlewares/errorHandler');

// GET  /appointments/available-slots  — أوقات متاحة (AJAX)
router.get('/available-slots', ctrl.getAvailableSlots);

// GET  /appointments/today            — تقويم اليوم
router.get('/today', ctrl.today);

// GET  /appointments                  — القائمة الكاملة
router.get('/', ctrl.index);

// GET  /appointments/new              — نموذج الحجز
router.get('/new', ctrl.newForm);

// POST /appointments                  — حفظ موعد جديد
router.post('/', ctrl.create);

// GET  /appointments/:id              — تفاصيل الموعد
router.get('/:id', validateObjectId, ctrl.show);

// GET  /appointments/:id/edit         — نموذج التعديل
router.get('/:id/edit', validateObjectId, ctrl.editForm);

// PUT  /appointments/:id              — تحديث كامل
router.put('/:id', validateObjectId, ctrl.update);

// PATCH /appointments/:id/status      — تحديث الحالة فقط (AJAX)
router.patch('/:id/status', validateObjectId, ctrl.updateStatus);

// DELETE /appointments/:id            — إلغاء موعد
router.delete('/:id', validateObjectId, ctrl.destroy);

module.exports = router;