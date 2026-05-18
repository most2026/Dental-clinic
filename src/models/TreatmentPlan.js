// ============================================================
// src/models/TreatmentPlan.js — خطة العلاج ومراحله
// ============================================================
'use strict';

const mongoose = require('mongoose');

// ── Sub-Schema: مرحلة / زيارة واحدة ─────────────────────────
const stageSchema = new mongoose.Schema(
  {
    stageNumber: { type: Number, required: true },

    // تاريخ الزيارة
    visitDate:     { type: Date, required: true },
    nextVisitDate: { type: Date, default: null },

    // ── خاص بالتقويم الشفاف (Aligners) ────────────────────
    alignerTrayStart: { type: Number, default: null }, // رقم الطقم الحالي
    alignerTrayEnd:   { type: Number, default: null }, // رقم آخر طقم في هذه المرحلة
    wearingHours:     { type: Number, default: null }, // ساعات الارتداء/يوم

    // ── خاص بالتقويم المعدني والخزفي ───────────────────────
    wireType: {
      type: String,
      enum: ['round_niti', 'round_ss', 'rectangular_niti', 'rectangular_ss',
             'copper_niti', 'beta_titanium', 'other'],
      default: null,
    },
    wireSize:         { type: String, default: null }, // مثال: 0.014, 0.018x0.025
    bracketAdjustment:{ type: String, default: null }, // تعديلات البراكيت

    // ── الإجراءات المنفذة ───────────────────────────────────
    procedures: { type: [String], default: [] },

    // ── قياسات وملاحظات ─────────────────────────────────────
    painLevel:  { type: Number, min: 0, max: 10, default: 0 }, // مستوى الألم
    compliance: { type: Number, min: 0, max: 100, default: 100 }, // نسبة الالتزام
    toothMovement: { type: String, default: null }, // وصف حركة الأسنان

    // ── صور المرحلة ─────────────────────────────────────────
    photos: [
      {
        filepath:  { type: String, required: true },
        filename:  { type: String, required: true },
        angle: {
          type: String,
          enum: ['front', 'left', 'right', 'upper', 'lower', 'smile', 'xray', 'other'],
          default: 'front',
        },
        note:      { type: String, default: null },
        takenAt:   { type: Date, default: Date.now }
        // تم حذف _id: true من هنا لأن Mongoose يضيفه تلقائياً ولا يقبل هذه الصيغة هنا
      },
    ],

    // ── ملاحظات ─────────────────────────────────────────────
    doctorNotes:     { type: String, maxlength: 2000, default: null },
    patientFeedback: { type: String, maxlength: 1000, default: null },

    // ── حالة المرحلة ─────────────────────────────────────────
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date,    default: null  },
  },
  { _id: true }
);

// ── Main Schema: TreatmentPlan ───────────────────────────────
const treatmentPlanSchema = new mongoose.Schema(
  {
    // ── الربط ───────────────────────────────────────────────
    patient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Patient',
      required: [true, 'يجب تحديد المريض'],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      default: null,
    },

    // ── معلومات الخطة ────────────────────────────────────────
    title: {
      type:      String,
      required:  [true, 'عنوان الخطة مطلوب'],
      trim:      true,
      maxlength: [100, 'العنوان لا يتجاوز 100 حرف'],
    },

    // الفئة الرئيسية
    category: {
      type: String,
      enum: ['orthodontic', 'implant', 'root_canal', 'cosmetic', 'surgery', 'other'],
      required: [true, 'فئة العلاج مطلوبة'],
    },

    // نوع التقويم (إذا كان الفئة orthodontic)
    orthodonticType: {
      type: String,
      enum: ['metal', 'ceramic', 'clear_aligner', 'lingual', 'retainer', 'functional'],
      default: null,
    },

    // ── التواريخ ─────────────────────────────────────────────
    startDate:         { type: Date, required: [true, 'تاريخ البدء مطلوب'] },
    estimatedEndDate:  { type: Date, default: null },
    actualEndDate:     { type: Date, default: null },

    // ── خاص بالتقويم الشفاف ──────────────────────────────────
    totalAlignersTrays:   { type: Number, default: null }, // إجمالي عدد الأطقم
    currentAlignerTray:   { type: Number, default: null }, // الطقم الحالي
    alignerBrand: {
      type: String,
      enum: ['invisalign', 'spark', 'suresmile', 'angelalign', 'local', 'other'],
      default: null,
    },

    // ── خاص بالتقويم المعدني/الخزفي ──────────────────────────
    bracketSystem: { type: String, default: null }, // مثال: Damon, MBT, Roth
    bracketBrand:  { type: String, default: null },

    // ── التكلفة ──────────────────────────────────────────────
    totalCost:   { type: Number, default: 0 },
    currency:    { type: String, enum: ['IQD','USD','SAR','AED'], default: 'IQD' },

    // ── الحالة ───────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['planning', 'active', 'paused', 'completed', 'cancelled'],
      default: 'planning',
    },

    // ── الأهداف والملاحظات ────────────────────────────────────
    treatmentGoals: { type: String, maxlength: 1000, default: null },
    generalNotes:   { type: String, maxlength: 2000, default: null },

    // ── المراحل ──────────────────────────────────────────────
    stages: { type: [stageSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ─────────────────────────────────────────────────

// نسبة الإنجاز
treatmentPlanSchema.virtual('completionPercentage').get(function () {
  if (!this.stages || this.stages.length === 0) return 0;
  const completed = this.stages.filter(s => s.isCompleted).length;
  return Math.round((completed / this.stages.length) * 100);
});

// نسبة تقدم الأطقم (للتقويم الشفاف)
treatmentPlanSchema.virtual('alignerProgress').get(function () {
  if (!this.totalAlignersTrays || !this.currentAlignerTray) return 0;
  return Math.round((this.currentAlignerTray / this.totalAlignersTrays) * 100);
});

// عدد المراحل المكتملة
treatmentPlanSchema.virtual('completedStagesCount').get(function () {
  return this.stages.filter(s => s.isCompleted).length;
});

// المرحلة التالية (الأولى غير المكتملة)
treatmentPlanSchema.virtual('nextStage').get(function () {
  return this.stages.find(s => !s.isCompleted) || null;
});

// Indexes
treatmentPlanSchema.index({ patient: 1 });
treatmentPlanSchema.index({ status:  1 });
treatmentPlanSchema.index({ category: 1 });
treatmentPlanSchema.index({ startDate: -1 });

module.exports = mongoose.model('TreatmentPlan', treatmentPlanSchema);
