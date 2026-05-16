// ============================================================
// src/routes/settingsRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/settingsController');
const { requireRole }    = require('../middlewares/authMiddleware');
const { validateObjectId } = require('../middlewares/errorHandler');

router.get   ('/',                 ctrl.index);
router.patch ('/users/:id/toggle', validateObjectId, requireRole('admin'), ctrl.toggleUser);
router.delete('/users/:id',        validateObjectId, requireRole('admin'), ctrl.deleteUser);

module.exports = router;
