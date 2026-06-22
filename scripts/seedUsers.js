// ============================================================
// scripts/seedUsers.js — إنشاء الحسابات من متغيرات البيئة
// التشغيل: node scripts/seedUsers.js
// ============================================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../src/models/User');

// ── بناء قائمة المستخدمين من .env ───────────────────────────
const buildUsersList = () => {
  const users = [];

  // التحقق من توفر كل مجموعة بيانات قبل إضافتها
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    users.push({
      name:     process.env.ADMIN_NAME || 'مدير النظام',
      email:    process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role:     'admin',
    });
  }

  if (process.env.DOCTOR_EMAIL && process.env.DOCTOR_PASSWORD) {
    users.push({
      name:     process.env.DOCTOR_NAME || 'طبيب الأسنان',
      email:    process.env.DOCTOR_EMAIL,
      password: process.env.DOCTOR_PASSWORD,
      role:     'doctor',
    });
  }

  if (process.env.RECEPTIONIST_EMAIL && process.env.RECEPTIONIST_PASSWORD) {
    users.push({
      name:     process.env.RECEPTIONIST_NAME || 'موظف الاستقبال',
      email:    process.env.RECEPTIONIST_EMAIL,
      password: process.env.RECEPTIONIST_PASSWORD,
      role:     'receptionist',
    });
  }

  return users;
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ متصل بقاعدة البيانات\n');

    const USERS = buildUsersList();

    if (USERS.length === 0) {
      console.log('⚠️  لا توجد بيانات حسابات في ملف .env');
      console.log('   أضف ADMIN_EMAIL و ADMIN_PASSWORD على الأقل\n');
      return;
    }

    for (const userData of USERS) {
      const existing = await User.findOne({ email: userData.email });

      if (existing) {
        console.log(`⚠️  الحساب موجود مسبقاً: ${userData.role}`);
        continue;
      }

      const user = await User.create({ ...userData, isActive: true });
      console.log(`✅ تم إنشاء حساب: ${user.role}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ تمت العملية بنجاح');
    console.log('   البيانات محفوظة في ملف .env الخاص بك فقط');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();
