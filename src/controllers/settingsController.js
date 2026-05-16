// ============================================================
// src/controllers/settingsController.js
// ============================================================
'use strict';

const User    = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Invoice     = require('../models/Invoice');
const Treatment   = require('../models/Treatment');
const { asyncHandler } = require('../middlewares/errorHandler');

// GET /settings
const index = asyncHandler(async (req, res) => {
  // إحصائيات النظام
  const [
    totalPatients,
    totalAppointments,
    totalInvoices,
    totalTreatments,
    totalUsers,
    dbStats,
  ] = await Promise.all([
    Patient.countDocuments(),
    Appointment.countDocuments(),
    Invoice.countDocuments(),
    Treatment.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: true }),
    // حجم مجموعات قاعدة البيانات
    Promise.resolve(null),
  ]);

  // قائمة المستخدمين (الأدمن فقط)
  const users = req.user?.role === 'admin'
    ? await User.find().select('-password').sort({ createdAt: -1 })
    : [];

  res.render('settings/index', {
    title:   'الإعدادات',
    systemStats: {
      totalPatients,
      totalAppointments,
      totalInvoices,
      totalTreatments,
      totalUsers,
    },
    users,
    clinicName:  process.env.CLINIC_NAME || 'عيادة الأسنان',
    nodeVersion: process.version,
    env:         process.env.NODE_ENV || 'development',
  });
});

// POST /settings/users/:id/toggle — تفعيل/تعطيل مستخدم (أدمن)
const toggleUser = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'غير مصرح' });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  // لا يمكن تعطيل نفسك
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'لا يمكنك تعطيل حسابك الخاص' });
  }

  user.isActive = !user.isActive;
  await user.save();

  res.json({
    success:  true,
    isActive: user.isActive,
    message:  `تم ${user.isActive ? 'تفعيل' : 'تعطيل'} حساب ${user.name}`,
  });
});

// DELETE /settings/users/:id — حذف مستخدم (أدمن)
const deleteUser = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'غير مصرح' });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك الخاص' });
  }

  await User.findByIdAndDelete(req.params.id);

  res.json({ success: true, message: `تم حذف حساب ${user.name} بنجاح` });
});

module.exports = { index, toggleUser, deleteUser };
