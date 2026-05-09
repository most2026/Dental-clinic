// ============================================================
// src/controllers/dashboardController.js — لوحة التحكم
// ============================================================
'use strict';

const Patient     = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Invoice     = require('../models/Invoice');
const { asyncHandler } = require('../middlewares/errorHandler');

// ────────────────────────────────────────────────────────────
// GET /  — عرض لوحة التحكم
// ────────────────────────────────────────────────────────────
const getDashboard = asyncHandler(async (req, res) => {

  // تشغيل الاستعلامات بالتوازي لتسريع التحميل
  const [
    totalPatients,
    todayAppointmentsCount,
    pendingInvoices,
    revenueData,
    todayAppointments,
    recentPatients,
  ] = await Promise.all([

    // إجمالي المرضى النشطين
    Patient.countDocuments({ status: 'active' }),

    // عدد مواعيد اليوم
    Appointment.getTodayCount(),

    // عدد الفواتير غير المكتملة
    Invoice.countDocuments({ status: { $in: ['issued', 'partial', 'overdue'] } }),

    // إيرادات الشهر الحالي
    Invoice.getMonthlyRevenue(
      new Date().getFullYear(),
      new Date().getMonth() + 1
    ),

    // قائمة مواعيد اليوم
    Appointment.getDayAppointments(new Date()),

    // آخر 5 مرضى مسجلين
    Patient.find({ status: 'active' })
      .select('firstName lastName phone patientCode status createdAt')
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  // استخراج الإيرادات من نتيجة الـ aggregate
  const monthlyRevenue = revenueData[0]?.totalRevenue || 0;

  res.render('dashboard/index', {
    title: 'لوحة التحكم',
    stats: {
      totalPatients,
      todayAppointments: todayAppointmentsCount,
      pendingInvoices,
      monthlyRevenue,
    },
    todayAppointments,
    recentPatients,
  });
});

module.exports = { getDashboard };
