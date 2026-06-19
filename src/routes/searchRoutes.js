// ============================================================
// src/routes/searchRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { searchLimiter } = require('../middlewares/security');

// GET /search?q=...
router.get('/', searchLimiter, globalSearch);

module.exports = router;
