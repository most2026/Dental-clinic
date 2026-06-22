// ============================================================
// src/routes/treatmentPlanRoutes.js
// مسارات خطط العلاج والتقويم — مع الصلاحيات وحماية الرفع
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();

const ctrl    = require('../controllers/treatmentPlanController');
const { validateObjectId } = require('../middlewares/errorHandler');
const { checkPermission }  = require('../middlewares/permissions');
const { uploadLimiter }    = require('../middlewares/security');

// ── دوال الصلاحيات لكل عملية ──────────────────────────────────
const canView   = checkPermission('treatmentPlans', 'view');
const canCreate = checkPermission('treatmentPlans', 'create');
const canEdit   = checkPermission('treatmentPlans', 'edit');
const canDelete = checkPermission('treatmentPlans', 'delete');

// ════════════════════════════════════════════════════════════
// المسارات
// ════════════════════════════════════════════════════════════

// GET  /treatment-plans — قائمة الخطط
router.get('/', canView, ctrl.index);

// GET  /treatment-plans/new — نموذج خطة جديدة
router.get('/new', canCreate, ctrl.newForm);

// POST /treatment-plans — حفظ خطة جديدة
router.post('/', canCreate, ctrl.create);

// GET  /treatment-plans/:id — تفاصيل الخطة
router.get(
  '/:id',
  validateObjectId,
  canView,
  ctrl.show
);

// GET  /treatment-plans/:id/compare — مقارنة قبل/بعد
router.get(
  '/:id/compare',
  validateObjectId,
  canView,
  ctrl.compare
);

// GET  /treatment-plans/:id/stages/add — نموذج إضافة مرحلة
router.get(
  '/:id/stages/add',
  validateObjectId,
  canEdit,
  ctrl.addStageForm
);

// POST /treatment-plans/:id/stages — حفظ مرحلة جديدة (مع رفع صور Cloudinary)
router.post(
  '/:id/stages',
  validateObjectId,
  canEdit,
  uploadLimiter,
  ctrl.addStage
);

// PATCH /treatment-plans/:id/status — تحديث حالة الخطة
router.patch(
  '/:id/status',
  validateObjectId,
  canEdit,
  ctrl.updateStatus
);

// DELETE /treatment-plans/:id/stages/:stageId — حذف مرحلة
router.delete(
  '/:id/stages/:stageId',
  validateObjectId,
  canDelete,
  ctrl.deleteStage
);

module.exports = router;
