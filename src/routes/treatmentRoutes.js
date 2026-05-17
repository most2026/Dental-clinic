// ============================================================
// src/routes/treatmentRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/treatmentController');
const { validateObjectId } = require('../middlewares/errorHandler');

router.get ('/',              ctrl.index);
router.get ('/new',           ctrl.newForm);
router.post('/',              ctrl.create);
router.get ('/:id/edit',      validateObjectId, ctrl.editForm);
router.put ('/:id',           validateObjectId, ctrl.update);
router.patch('/:id/toggle',   validateObjectId, ctrl.toggle);
router.delete('/:id',         validateObjectId, ctrl.destroy);

module.exports = router;
