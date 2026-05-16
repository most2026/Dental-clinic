// ============================================================
// src/models/User.js — نموذج المستخدم
// ============================================================
'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'الاسم مطلوب'],
      trim:      true,
      maxlength: [60, 'الاسم لا يتجاوز 60 حرفاً'],
    },

    email: {
      type:      String,
      required:  [true, 'البريد الإلكتروني مطلوب'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'البريد الإلكتروني غير صحيح'],
    },

    password: {
      type:      String,
      required:  [true, 'كلمة المرور مطلوبة'],
      minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'],
      select:    false, // لا تُرجَع في الاستعلامات افتراضياً
    },

    role: {
      type:    String,
      enum:    ['admin', 'doctor', 'receptionist'],
      default: 'doctor',
    },

    // بيانات ظهور في الـ Sidebar
    avatar: {
      type:    String,
      default: null,
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    lastLogin: {
      type:    Date,
      default: null,
    },

  },
  {
    timestamps: true,
    toJSON:   { virtuals: true }, // ← مهم
    toObject: { virtuals: true }, // ← مهم
  },
  { timestamps: true }
);

// ── تشفير كلمة المرور قبل الحفظ ────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── مقارنة كلمة المرور ──────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── الحروف الأولى للاسم (للـ Avatar) ──────────────────────
userSchema.virtual('initials').get(function () {
  return this.name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
});

const ROLE_LABELS = {
  admin:        'مدير النظام',
  doctor:       'طبيب أسنان',
  receptionist: 'موظف استقبال',
};

userSchema.virtual('roleLabel').get(function () {
  return ROLE_LABELS[this.role] || this.role;
});

module.exports = mongoose.model('User', userSchema);
