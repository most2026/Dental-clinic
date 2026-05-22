// ============================================================
// src/models/Invoice.js — نموذج الفواتير المالية
// ============================================================

'use strict';

const mongoose = require('mongoose');

// ============================================================
// Sub-Schema: بند في الفاتورة (Line Item)
// ============================================================
const invoiceItemSchema = new mongoose.Schema(
  {
    // ربط بنموذج العلاج (اختياري — لمرونة الإدخال اليدوي)
    treatment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Treatment',
      default: null,
    },

    // اسم البند (يُنسخ من العلاج أو يُدخل يدوياً)
    description: {
      type: String,
      required: [true, 'وصف البند مطلوب'],
      trim: true,
      maxlength: [200, 'الوصف لا يمكن أن يتجاوز 200 حرف'],
    },

    // الأسنان المرتبطة بهذا البند
    relatedTeeth: {
      type: [Number],
      default: [],
    },

    // الكمية (عادةً 1 لكل سن)
    quantity: {
      type: Number,
      required: true,
      min: [1, 'الكمية يجب أن تكون 1 على الأقل'],
      default: 1,
    },

    // سعر الوحدة
    unitPrice: {
      type: Number,
      required: [true, 'سعر الوحدة مطلوب'],
      min: [0, 'السعر لا يمكن أن يكون سالباً'],
    },

    // الخصم على هذا البند (نسبة مئوية 0-100)
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // الإجمالي الفرعي (يُحسب تلقائياً)
    subtotal: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

// حساب الإجمالي الفرعي قبل الحفظ
invoiceItemSchema.pre('save', function (next) {
  const discountAmount = (this.unitPrice * this.discount) / 100;
  this.subtotal = (this.unitPrice - discountAmount) * this.quantity;
  next();
});

// ============================================================
// Sub-Schema: سجل الدفعات
// ============================================================
const paymentSchema = new mongoose.Schema(
  {
    // المبلغ المدفوع
    amount: {
      type: Number,
      required: [true, 'مبلغ الدفعة مطلوب'],
      min: [0.01, 'مبلغ الدفعة يجب أن يكون أكبر من صفر'],
    },

    // طريقة الدفع
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'installment'],
      default: 'cash',
    },

    // تاريخ الدفعة
    paidAt: {
      type: Date,
      default: Date.now,
    },

    // ملاحظة على الدفعة
    note: {
      type: String,
      trim: true,
      maxlength: [200, 'الملاحظة لا يمكن أن تتجاوز 200 حرف'],
      default: null,
    },
  },
  { _id: true }
);

// ============================================================
// Main Schema: Invoice
// ============================================================
const invoiceSchema = new mongoose.Schema(
  {
    // --- رقم الفاتورة الفريد (يُولَّد تلقائياً) ---
    invoiceNumber: {
      type: String,
      unique: true,
    },

    // --- الربط بالمريض والموعد ---
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'يجب تحديد المريض'],
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },

    // --- بنود الفاتورة ---
    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'يجب أن تحتوي الفاتورة على بند واحد على الأقل',
      },
    },

    // --- الإجماليات (تُحسب بالـ pre-save hook) ---

    // المجموع قبل الخصم
    subtotalAmount: {
      type: Number,
      default: 0,
    },

    // الخصم الإجمالي على الفاتورة (نسبة مئوية)
    globalDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // قيمة الخصم بالمبلغ
    discountAmount: {
      type: Number,
      default: 0,
    },

    // الضريبة (نسبة مئوية — 0 إن لم تكن مطبقة)
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // قيمة الضريبة بالمبلغ
    taxAmount: {
      type: Number,
      default: 0,
    },

    // الإجمالي النهائي
    totalAmount: {
      type: Number,
      default: 0,
    },

    // --- الدفع ---
    payments: {
      type: [paymentSchema],
      default: [],
    },

    // المبلغ المدفوع (يُحسب من مجموع الدفعات)
    paidAmount: {
      type: Number,
      default: 0,
    },

    // المبلغ المتبقي
    remainingAmount: {
      type: Number,
      default: 0,
    },

    // حالة الفاتورة
    status: {
      type: String,
      enum: [
        'draft',      // مسودة
        'issued',     // صادرة
        'partial',    // مدفوعة جزئياً
        'paid',       // مدفوعة بالكامل
        'overdue',    // متأخرة
        'cancelled',  // ملغاة
        'refunded',   // مستردة
      ],
      default: 'draft',
    },

    // العملة
    currency: {
      type: String,
      default: 'IQD',
      enum: ['IQD', 'USD', 'SAR', 'AED'],
    },

    // تاريخ الاستحقاق
    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 يوم
    },

    // ملاحظات الفاتورة
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'الملاحظات لا يمكن أن تتجاوز 500 حرف'],
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
// Pre-Save Hook — توليد رقم الفاتورة وحساب الإجماليات
// ============================================================
invoiceSchema.pre('save', async function (next) {
  try {
    // 1. توليد رقم الفاتورة للفاتورة الجديدة
    if (this.isNew) {
      const year  = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const count = await mongoose.model('Invoice').countDocuments();
      this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
    }

    // 2. حساب الإجمالي من البنود
    this.subtotalAmount = this.items.reduce((sum, item) => {
      const discountedPrice = item.unitPrice * (1 - item.discount / 100);
      return sum + discountedPrice * item.quantity;
    }, 0);

    // 3. حساب الخصم الإجمالي على الفاتورة
    this.discountAmount = (this.subtotalAmount * this.globalDiscount) / 100;

    // 4. حساب الضريبة
    const afterDiscount = this.subtotalAmount - this.discountAmount;
    this.taxAmount = (afterDiscount * this.taxRate) / 100;

    // 5. الإجمالي النهائي
    this.totalAmount = afterDiscount + this.taxAmount;

    // 6. حساب المدفوع والمتبقي
    this.paidAmount = this.payments.reduce((sum, p) => sum + p.amount, 0);
    this.remainingAmount = Math.max(0, this.totalAmount - this.paidAmount);

    // 7. تحديث الحالة تلقائياً
    if (this.status !== 'cancelled' && this.status !== 'refunded') {
      if (this.paidAmount === 0) {
        this.status = this.status === 'draft' ? 'draft' : 'issued';
      } else if (this.paidAmount >= this.totalAmount) {
        this.status = 'paid';
      } else {
        this.status = 'partial';
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Virtual Properties
// ============================================================

// نسبة الدفع المكتمل
invoiceSchema.virtual('paymentProgress').get(function () {
  if (this.totalAmount === 0) return 100;
  return Math.min(100, Math.round((this.paidAmount / this.totalAmount) * 100));
});

// ── Indexes ───────────────────────────────────────────────────
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ patient: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ patient: 1, status: 1 });                    // ← جديد
invoiceSchema.index({ createdAt: 1, status: 1 });                  // ← جديد
invoiceSchema.index(
  { remainingAmount: 1, status: 1 },
  {
    name: 'idx_inv_remaining',
    partialFilterExpression: { remainingAmount: { $gt: 0 } },      // ← جديد: فهرس جزئي
  }
);

// ============================================================
// Static Methods
// ============================================================

// إجمالي إيرادات شهر محدد
invoiceSchema.statics.getMonthlyRevenue = function (year, month) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['paid', 'partial'] },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$paidAmount' },
        invoiceCount: { $sum: 1 },
      },
    },
  ]);
};

module.exports = mongoose.model('Invoice', invoiceSchema);
