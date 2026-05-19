// ============================================================
// src/routes/appointmentRoutes.js
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/appointmentController');
const { validateObjectId } = require('../middlewares/errorHandler');

// 1. المسارات الثابتة (Static Routes) - يجب أن تكون في الأعلى دائماً
router.get('/available-slots', ctrl.getAvailableSlots);
router.get('/today', ctrl.today);
router.get('/new', ctrl.newForm);

// تم نقل مسار الإشعارات هنا ليعمل بشكل صحيح قبل فحص الـ ID
router.get('/reminders', ctrl.reminders); 

router.get('/', ctrl.index);
router.post('/', ctrl.create);


// 2. المسارات المتغيرة (Dynamic Routes) - تحتوي على :id وتوضع في الأسفل
router.get('/:id', validateObjectId, ctrl.show);
router.get('/:id/edit', validateObjectId, ctrl.editForm);
router.put('/:id', validateObjectId, ctrl.update);
router.patch('/:id/status', validateObjectId, ctrl.updateStatus);
router.delete('/:id', validateObjectId, ctrl.destroy);

// مسارات الواتس التابعة للـ ID
router.get ('/:id/whatsapp',        validateObjectId, ctrl.getWhatsAppLink);
router.post('/:id/remind',          validateObjectId, ctrl.markReminderSent);


module.exports = router;
