// ============================================================
// src/models/Appointment.js — نموذج المواعيد
// ============================================================

'use strict';

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    // --- ربط المريض ---
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'يجب تحديد المريض'],
    },

    // --- تفاصيل الموعد ---
    appointmentDate: {
      type: Date,
      required: [true, 'تاريخ الموعد مطلوب'],
    },

    // وقت البداية (بصيغة HH:MM)
    startTime: {
      type: String,
      required: [true, 'وقت بداية الموعد مطلوب'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صحيحة (HH:MM)'],
    },

    // مدة الموعد بالدقائق
    duration: {
      type: Number,
      required: [true, 'مدة الموعد مطلوبة'],
      min: [10, 'الحد الأدنى للموعد 10 دقائق'],
      max: [480, 'الحد الأقصى للموعد 8 ساعات'],
      default: 30,
    },

    // نوع العلاج المخطط
    treatmentType: {
      type: String,
      enum: [
        'checkup',          // كشف وفحص
        'cleaning',         // تنظيف وتلميع
        'filling',          // حشو
        'extraction',       // خلع
        'root_canal',       // علاج عصب
        'crown',            // تاج
        'bridge',           // جسر
        'implant',          // زراعة
        'whitening',        // تبييض
        'orthodontics',     // تقويم
        'surgery',          // جراحة
        'consultation',     // استشارة
        'other',            // أخرى
      ],
      required: [true, 'نوع العلاج مطلوب'],
    },

    // حالة الموعد
    status: {
      type: String,
      enum: [
        'scheduled',   // مجدول (الافتراضي)
        'confirmed',   // مؤكد
        'in_progress', // جاري الفحص
        'completed',   // مكتمل
        'cancelled',   // ملغى
        'no_show',     // لم يحضر
        'rescheduled', // أُعيد جدولته
      ],
      default: 'scheduled',
    },

    // سبب الزيارة (بكلمات المريض)
    chiefComplaint: {
      type: String,
      trim: true,
      maxlength: [500, 'الشكوى الرئيسية لا يمكن أن تتجاوز 500 حرف'],
      default: null,
    },

    // ملاحظات الطبيب بعد الجلسة
    sessionNotes: {
      type: String,
      trim: true,
      maxlength: [3000, 'الملاحظات لا يمكن أن تتجاوز 3000 حرف'],
      default: null,
    },

    // الأسنان التي تمت معالجتها في هذا الموعد
    treatedTeeth: {
      type: [Number],
      default: [],
    },

    // هل تمت إضافة فاتورة لهذا الموعد؟
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },

    // سبب الإلغاء (إن وُجد)
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [300, 'سبب الإلغاء لا يمكن أن يتجاوز 300 حرف'],
      default: null,
    },

    // هل تم تذكير المريض بالموعد؟
    reminderSent: {
      type: Boolean,
      default: false,
    },
    // في appointmentSchema أضف:
    reminderSent: {
        type:    Boolean,
        default: false,
    },
    reminderSentAt: {
        type:    Date,
        default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================================
// Virtual Properties
// ============================================================

// حساب وقت نهاية الموعد
appointmentSchema.virtual('endTime').get(function () {
  if (!this.startTime || !this.duration) return null;

  const [hours, minutes] = this.startTime.split(':').map(Number);
  const startInMinutes = hours * 60 + minutes;
  const endInMinutes   = startInMinutes + this.duration;

  const endHours   = Math.floor(endInMinutes / 60) % 24;
  const endMinutes = endInMinutes % 60;

  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
});

// ── Indexes ───────────────────────────────────────────────────
appointmentSchema.index({ patient: 1 });
appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ appointmentDate: 1, startTime: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: -1 });
appointmentSchema.index({ reminderSent: 1, appointmentDate: 1 }); // ← جديد
appointmentSchema.index({ status: 1, appointmentDate: 1 });        // ← جديد
appointmentSchema.index(
  { appointmentDate: 1, status: 1, treatmentType: 1 },
  { name: 'idx_apt_stats' }                                        // ← جديد
);

// ============================================================
// Static Methods
// ============================================================

// الحصول على مواعيد يوم محدد
appointmentSchema.statics.getDayAppointments = function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled'] },
  })
    .populate('patient', 'firstName lastName phone patientCode')
    .sort({ startTime: 1 });
};

// عدد مواعيد اليوم
appointmentSchema.statics.getTodayCount = function () {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return this.countDocuments({
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled', 'no_show'] },
  });
};

module.exports = mongoose.model('Appointment', appointmentSchema);
