// ============================================================
// src/routes/patientRoutes.js — مسارات إدارة المرضى
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/patientController');
const { validateObjectId } = require('../middlewares/errorHandler');

// GET  /patients/search        — بحث AJAX (قبل /:id لتجنب التعارض)
router.get('/search', ctrl.search);

// GET  /patients               — قائمة المرضى
router.get('/', ctrl.index);

// GET  /patients/new           — نموذج إضافة
router.get('/new', ctrl.newForm);

// POST /patients               — حفظ مريض جديد
router.post('/', ctrl.create);

// GET  /patients/:id           — تفاصيل مريض
router.get('/:id', validateObjectId, ctrl.show);

// GET  /patients/:id/edit      — نموذج التعديل
router.get('/:id/edit', validateObjectId, ctrl.editForm);

// PUT  /patients/:id           — تحديث مريض (method-override)
router.put('/:id', validateObjectId, ctrl.update);

// DELETE /patients/:id         — حذف/تعطيل مريض
router.delete('/:id', validateObjectId, ctrl.destroy);

module.exports = router;
