// ============================================================
// src/models/Treatment.js — قائمة العلاجات وأسعارها
// يُستخدم كـ "كتالوج" للخدمات المتاحة في العيادة
// ============================================================

'use strict';

const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema(
  {
    // اسم العلاج بالعربي
    nameAr: {
      type: String,
      required: [true, 'اسم العلاج بالعربي مطلوب'],
      trim: true,
      maxlength: [100, 'الاسم لا يمكن أن يتجاوز 100 حرف'],
    },

    // اسم العلاج بالإنجليزي (اختياري)
    nameEn: {
      type: String,
      trim: true,
      maxlength: [100, 'الاسم لا يمكن أن يتجاوز 100 حرف'],
      default: null,
    },

    // الكود المختصر (مثال: EXT-01)
    code: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // التصنيف
    category: {
      type: String,
      enum: [
        'preventive',    // وقائي
        'restorative',   // ترميمي
        'endodontic',    // علاج جذور
        'surgical',      // جراحي
        'prosthodontic', // تعويضي
        'orthodontic',   // تقويمي
        'cosmetic',      // تجميلي
        'diagnostic',    // تشخيصي
        'other',
      ],
      required: [true, 'تصنيف العلاج مطلوب'],
    },

    // السعر الافتراضي
    defaultPrice: {
      type: Number,
      required: [true, 'السعر الافتراضي مطلوب'],
      min: [0, 'السعر لا يمكن أن يكون سالباً'],
    },

    // العملة
    currency: {
      type: String,
      default: 'IQD',
      enum: ['IQD', 'USD', 'SAR', 'AED'],
    },

    // المدة الافتراضية بالدقائق
    defaultDuration: {
      type: Number,
      default: 30,
      min: 5,
    },

    // وصف العلاج
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'الوصف لا يمكن أن يتجاوز 1000 حرف'],
      default: null,
    },

    // هل العلاج نشط (معروض في القوائم)؟
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index
treatmentSchema.index({ code: 1 });
treatmentSchema.index({ category: 1, isActive: 1 });
treatmentSchema.index(
  { nameAr: 'text', nameEn: 'text', code: 'text' },
  { name: 'treatment_search_index' }
);

module.exports = mongoose.model('Treatment', treatmentSchema);
