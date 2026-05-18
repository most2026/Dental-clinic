// ============================================================
// src/routes/treatmentPlanRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/treatmentPlanController');
const { validateObjectId } = require('../middlewares/errorHandler');

router.get ('/',                             ctrl.index);
router.get ('/new',                          ctrl.newForm);
router.post('/',                             ctrl.create);
router.get ('/:id',           validateObjectId, ctrl.show);
router.get ('/:id/stages/add',validateObjectId, ctrl.addStageForm);
router.post('/:id/stages',    validateObjectId, ctrl.addStage);
router.patch('/:id/status',   validateObjectId, ctrl.updateStatus);
router.delete('/:id/stages/:stageId', validateObjectId, ctrl.deleteStage);

module.exports = router;
