// ============================================================
// src/routes/treatmentPlanRoutes.js — مع صلاحيات
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/treatmentPlanController');
const { validateObjectId }   = require('../middlewares/errorHandler');
const { checkPermission }    = require('../middlewares/permissions');
const { uploadLimiter } = require('../middlewares/security');

const canView   = checkPermission('treatmentPlans', 'view');
const canCreate = checkPermission('treatmentPlans', 'create');
const canEdit   = checkPermission('treatmentPlans', 'edit');
const canDelete = checkPermission('treatmentPlans', 'delete');

router.get ('/',                        canView,   ctrl.index);
router.get ('/new',                     canCreate, ctrl.newForm);
router.post('/',                        canCreate, ctrl.create);
router.get ('/:id',         validateObjectId, canView,   ctrl.show);
router.get ('/:id/compare', validateObjectId, canView,   ctrl.compare);  // ← جديد
router.get ('/:id/stages/add', validateObjectId, canEdit, ctrl.addStageForm);
router.post('/:id/stages',     validateObjectId, uploadLimiter, canEdit, ctrl.addStage);
router.patch('/:id/status',    validateObjectId, canEdit, ctrl.updateStatus);
router.delete('/:id/stages/:stageId', validateObjectId, canDelete, ctrl.deleteStage);

module.exports = router;
