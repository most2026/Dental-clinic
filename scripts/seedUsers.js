// ============================================================
// scripts/seedUsers.js — إنشاء حسابات الأدوار الثلاثة
// التشغيل: node scripts/seedUsers.js
// ============================================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../src/models/User');

const USERS = [
  {
    name:     'مدير النظام',
    email:    'admin@clinic.com',
    password: 'admin123',
    role:     'admin',
  },
  {
    name:     'د. أحمد الأنصاري',
    email:    'doctor@clinic.com',
    password: 'doctor123',
    role:     'doctor',
  },
  {
    name:     'سارة الموظفة',
    email:    'reception@clinic.com',
    password: 'reception123',
    role:     'receptionist',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ متصل بقاعدة البيانات\n');

    for (const userData of USERS) {
      const existing = await User.findOne({ email: userData.email });

      if (existing) {
        console.log(`⚠️  الحساب موجود مسبقاً: ${userData.email}`);
        continue;
      }

      const user = await User.create({ ...userData, isActive: true });
      console.log(`✅ تم إنشاء: ${user.name} (${user.role})`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧  admin@clinic.com       🔑  admin123      → مدير');
    console.log('📧  doctor@clinic.com      🔑  doctor123     → طبيب');
    console.log('📧  reception@clinic.com   🔑  reception123  → استقبال');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️   غيّر كلمات المرور فور تسجيل الدخول!\n');

  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();
