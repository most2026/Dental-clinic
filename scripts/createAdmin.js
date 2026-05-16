// ============================================================
// scripts/createAdmin.js — إنشاء حساب المدير الأول
// التشغيل: node scripts/createAdmin.js
// ============================================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../src/models/User');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ متصل بقاعدة البيانات');

    const existing = await User.findOne({ email: 'admin@clinic.com' });
    if (existing) {
      console.log('⚠️  المدير موجود مسبقاً:', existing.email);
      return process.exit(0);
    }

    const admin = await User.create({
      name:     'مدير النظام',
      email:    'admin@clinic.com',
      password: 'admin123',
      role:     'admin',
      isActive: true,
    });

    console.log('🎉 تم إنشاء حساب المدير بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 البريد:       admin@clinic.com');
    console.log('🔑 كلمة المرور:  admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  غيّر كلمة المرور فور تسجيل الدخول!');

  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

createAdmin();
