// ============================================================
// src/models/Patient.js — نموذج بيانات المريض
// ============================================================

'use strict';

const mongoose = require('mongoose');

// ============================================================
// Sub-Schema: سجل الأسنان (Dental Chart)
// يمثل حالة كل سن من أسنان المريض الـ 32
// ============================================================
const toothRecordSchema = new mongoose.Schema(
  {
    // رقم السن (1-32 وفق الترقيم العالمي FDI أو Universal)
    toothNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 32,
    },

    // حالة السن الحالية
    status: {
      type: String,
      enum: [
        'healthy',    // سليم
        'decayed',    // نخر
        'filled',     // حشوة
        'crowned',    // تاج
        'missing',    // مفقود
        'implant',    // زراعة
        'root_canal', // علاج عصب
        'extracted',  // مخلوع
        'fractured',  // مكسور
      ],
      default: 'healthy',
    },

    // ملاحظات خاصة بهذا السن
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'الملاحظة لا يمكن أن تتجاوز 500 حرف'],
    },

    // تاريخ آخر تحديث لهذا السن
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // لا نحتاج _id لكل سن
);

// ============================================================
// Sub-Schema: ملف الأشعة (X-Ray Record)
// ============================================================
const xrayRecordSchema = new mongoose.Schema(
  {
    // اسم الملف بعد الرفع (سيُخزن في public/uploads)
    filename: {
      type: String,
      required: [true, 'اسم ملف الأشعة مطلوب'],
      trim: true,
    },

    // المسار الكامل للملف
    filepath: {
      type: String,
      required: true,
    },

    // نوع الأشعة
    xrayType: {
      type: String,
      enum: ['panoramic', 'periapical', 'bitewing', 'cbct', 'other'],
      default: 'periapical',
    },

    // الأسنان المرتبطة بهذه الأشعة
    relatedTeeth: [Number],

    // ملاحظات الطبيب على الأشعة
    doctorNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'الملاحظات لا يمكن أن تتجاوز 1000 حرف'],
    },

    // تاريخ رفع الأشعة
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ============================================================
// Sub-Schema: الحالة الطبية (Medical History)
// ============================================================
const medicalHistorySchema = new mongoose.Schema(
  {
    // أمراض مزمنة (مثال: سكري، ضغط)
    chronicDiseases: {
      type: [String],
      default: [],
    },

    // أدوية يتناولها المريض حالياً
    currentMedications: {
      type: [String],
      default: [],
    },

    // حساسية (مثال: حساسية من بنسلين)
    allergies: {
      type: [String],
      default: [],
    },

    // هل المريض مدخن؟
    isSmoker: {
      type: Boolean,
      default: false,
    },

    // ملاحظات طبية إضافية
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'الملاحظات لا يمكن أن تتجاوز 2000 حرف'],
    },
  },
  { _id: false }
);

// ============================================================
// Main Schema: Patient
// ============================================================
const patientSchema = new mongoose.Schema(
  {
    // --- البيانات الشخصية ---
    firstName: {
      type: String,
      required: [true, 'الاسم الأول مطلوب'],
      trim: true,
      maxlength: [50, 'الاسم الأول لا يمكن أن يتجاوز 50 حرف'],
    },

    lastName: {
      type: String,
      required: [true, 'اسم العائلة مطلوب'],
      trim: true,
      maxlength: [50, 'اسم العائلة لا يمكن أن يتجاوز 50 حرف'],
    },

    // رقم المريض الفريد (يُولَّد تلقائياً)
    patientCode: {
      type: String,
      unique: true,
      // سيُولَّد تلقائياً في الـ pre-save hook أدناه
    },

    gender: {
      type: String,
      enum: ['male', 'female'],
      required: [true, 'الجنس مطلوب'],
    },

    dateOfBirth: {
      type: Date,
      required: [true, 'تاريخ الميلاد مطلوب'],
    },

    phone: {
      type: String,
      required: [true, 'رقم الهاتف مطلوب'],
      trim: true,
      match: [
        /^[0-9+\-\s()]{7,20}$/,
        'رقم الهاتف غير صحيح',
      ],
    },

    // هاتف احتياطي (اختياري)
    alternativePhone: {
      type: String,
      trim: true,
      default: null,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'البريد الإلكتروني غير صحيح',
      ],
    },

    address: {
      type: String,
      trim: true,
      maxlength: [200, 'العنوان لا يمكن أن يتجاوز 200 حرف'],
      default: null,
    },

    // حالة المريض في النظام
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },

    // --- السجلات الطبية ---
    medicalHistory: {
      type: medicalHistorySchema,
      default: () => ({}),
    },

    // خريطة الأسنان (تُبنى عند الحاجة)
    dentalChart: {
      type: [toothRecordSchema],
      default: [],
    },

    // ملفات الأشعة
    xrays: {
      type: [xrayRecordSchema],
      default: [],
    },

    // ملاحظات الطبيب العامة
    generalNotes: {
      type: String,
      trim: true,
      maxlength: [3000, 'الملاحظات لا يمكن أن تتجاوز 3000 حرف'],
      default: null,
    },

    // تاريخ أول زيارة
    firstVisitDate: {
      type: Date,
      default: null,
    },

    // تاريخ آخر زيارة (يُحدَّث تلقائياً)
    lastVisitDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // يضيف createdAt و updatedAt تلقائياً
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================================
// Virtual Properties — حقول محسوبة (لا تُخزن في DB)
// ============================================================

// الاسم الكامل
patientSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// العمر المحسوب من تاريخ الميلاد
patientSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth  = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
});

// ============================================================
// Pre-Save Hook — توليد رقم المريض تلقائياً
// ============================================================
patientSchema.pre('save', async function () {
  // 1. لا نحتاج لـ next هنا عند استخدام async function
  if (!this.isNew) return;

  try {
    const year = new Date().getFullYear();
    
    // 2. استخدام this.constructor بدلاً من mongoose.model('Patient') 
    // لتجنب مشاكل الاستدعاء الدائري أو تأخر تعريف الموديل
    const count = await this.constructor.countDocuments();
    
    // رقم مكوّن من 5 خانات مع أصفار بادئة
    this.patientCode = `PT-${year}-${String(count + 1).padStart(5, '0')}`;
    
    // 3. لا داعي لاستدعاء next()، الدالة ستنتهي بنجاح هنا
  } catch (error) {
    // 4. في حالة الخطأ، نقوم برمي الخطأ مباشرة
    throw error; 
  }
});

// ============================================================
// Indexes — فهارس لتسريع عمليات البحث
// ============================================================
patientSchema.index({ patientCode: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ status: 1 });
// فهرس نصي للبحث باللغة العربية والإنجليزية
patientSchema.index(
  { firstName: 'text', lastName: 'text', phone: 'text', patientCode: 'text' },
  { name: 'patient_search_index' }
);

// ============================================================
// Static Methods — دوال على مستوى الـ Model
// ============================================================

// البحث عن مريض بالاسم أو رقم الهاتف أو الكود
patientSchema.statics.search = function (query) {
  const regex = new RegExp(query, 'i');
  return this.find({
    $or: [
      { firstName:   regex },
      { lastName:    regex },
      { phone:       regex },
      { patientCode: regex },
    ],
    status: { $ne: 'blocked' },
  }).select('firstName lastName patientCode phone gender dateOfBirth status');
};

module.exports = mongoose.model('Patient', patientSchema);
