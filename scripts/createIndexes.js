// ============================================================
// scripts/createIndexes.js — إنشاء جميع الفهارس وتصفية المتعارض
// التشغيل: node scripts/createIndexes.js
// ============================================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ متصل بقاعدة البيانات:', mongoose.connection.name);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const db = mongoose.connection.db;

    // ══════════════════════════════════════════════════════════
    // 1. جدول المرضى (patients)
    // ══════════════════════════════════════════════════════════
    console.log('📁 جدول المرضى...');
    const patients = db.collection('patients');
    
    // تنظيف الفهارس القديمة لتجنب تعارض الأسماء مثل patientCode_1
    try {
      await patients.dropIndexes();
      console.log('   🔄 تم تصفية الفهارس القديمة لجدول المرضى');
    } catch (e) {
      // يتجاهل الخطأ إذا كان الجدول فارغاً أو جديداً تماماً
    }

    await patients.createIndexes([
      // بحث رقم المريض الفريد
      { key: { patientCode: 1 }, unique: true, name: 'idx_patient_code' },

      // بحث بالهاتف
      { key: { phone: 1 }, name: 'idx_patient_phone' },

      // بحث بالاسم
      { key: { lastName: 1, firstName: 1 }, name: 'idx_patient_name' },

      // فلتر الحالة
      { key: { status: 1 }, name: 'idx_patient_status' },

      // ترتيب بالأحدث
      { key: { createdAt: -1 }, name: 'idx_patient_created' },

      // بحث مركب: حالة + تاريخ آخر زيارة
      {
        key:  { status: 1, lastVisitDate: -1 },
        name: 'idx_patient_status_visit',
      },

      // فهرس النص للبحث السريع
      {
        key: {
          firstName:   'text',
          lastName:    'text',
          phone:       'text',
          patientCode: 'text',
        },
        weights: {
          patientCode: 10, // الكود أهم في البحث
          phone:        8,
          firstName:    5,
          lastName:     5,
        },
        name:           'idx_patient_text_search',
        default_language: 'none', // لدعم العربية
      },
    ]);
    console.log('   ✅ تم إنشاء 7 فهارس بنجاح\n');

    // ══════════════════════════════════════════════════════════
    // 2. جدول المواعيد (appointments)
    // ══════════════════════════════════════════════════════════
    console.log('📁 جدول المواعيد...');
    const appointments = db.collection('appointments');
    
    try { await appointments.dropIndexes(); } catch (e) {}

    await appointments.createIndexes([
      // مواعيد مريض محدد
      { key: { patient: 1 }, name: 'idx_apt_patient' },

      // بحث بالتاريخ (التقويم اليومي)
      { key: { appointmentDate: 1 }, name: 'idx_apt_date' },

      // فلتر الحالة
      { key: { status: 1 }, name: 'idx_apt_status' },

      // التقويم اليومي المرتب بالوقت
      {
        key:  { appointmentDate: 1, startTime: 1 },
        name: 'idx_apt_date_time',
      },

      // مواعيد المريض مرتبة بالأحدث
      {
        key:  { patient: 1, appointmentDate: -1 },
        name: 'idx_apt_patient_date',
      },

      // استعلام التذكيرات: غير مُرسَل + تاريخ قانب
      {
        key:  { reminderSent: 1, appointmentDate: 1 },
        name: 'idx_apt_reminder',
      },

      // المواعيد النشطة حسب التاريخ (يستخدمه التقويم)
      {
        key:  { status: 1, appointmentDate: 1 },
        name: 'idx_apt_status_date',
      },

      // استعلام الإحصائيات الشهرية
      {
        key:  { appointmentDate: 1, status: 1, treatmentType: 1 },
        name: 'idx_apt_stats',
      },
    ]);
    console.log('   ✅ تم إنشاء 8 فهارس بنجاح\n');

    // ══════════════════════════════════════════════════════════
    // 3. جدول الفواتير (invoices)
    // ══════════════════════════════════════════════════════════
    console.log('📁 جدول الفواتير...');
    const invoices = db.collection('invoices');
    
    try { await invoices.dropIndexes(); } catch (e) {}

    await invoices.createIndexes([
      // رقم الفاتورة الفريد
      { key: { invoiceNumber: 1 }, unique: true, name: 'idx_inv_number' },

      // فواتير المريض
      { key: { patient: 1 }, name: 'idx_inv_patient' },

      // فلتر الحالة
      { key: { status: 1 }, name: 'idx_inv_status' },

      // الترتيب بالأحدث
      { key: { createdAt: -1 }, name: 'idx_inv_created' },

      // الفواتير المتأخرة
      {
        key:  { dueDate: 1, status: 1 },
        name: 'idx_inv_due_status',
      },

      // فواتير المريض المعلقة
      {
        key:  { patient: 1, status: 1 },
        name: 'idx_inv_patient_status',
      },

      // التقارير المالية الشهرية
      {
        key:  { createdAt: 1, status: 1 },
        name: 'idx_inv_created_status',
      },

      // المبلغ المتبقي (لاستعلام الديون)
      {
        key:  { remainingAmount: 1, status: 1 },
        name: 'idx_inv_remaining',
        partialFilterExpression: { remainingAmount: { $gt: 0 } },
      },
    ]);
    console.log('   ✅ تم إنشاء 8 فهارس بنجاح\n');

    // ══════════════════════════════════════════════════════════
    // 4. جدول المستخدمين (users)
    // ══════════════════════════════════════════════════════════
    console.log('📁 جدول المستخدمين...');
    const users = db.collection('users');
    
    try { await users.dropIndexes(); } catch (e) {}

    await users.createIndexes([
      // تسجيل الدخول بالبريد
      { key: { email: 1 }, unique: true, name: 'idx_user_email' },

      // المستخدمون النشطون حسب الدور
      {
        key:  { role: 1, isActive: 1 },
        name: 'idx_user_role_active',
      },

      // آخر تسجيل دخول (للتقارير)
      { key: { lastLogin: -1 }, name: 'idx_user_last_login' },
    ]);
    console.log('   ✅ تم إنشاء 3 فهارس بنجاح\n');

    // ══════════════════════════════════════════════════════════
    // 5. جدول العلاجات (treatments)
    // ══════════════════════════════════════════════════════════
    console.log('📁 جدول العلاجات...');
    const treatments = db.collection('treatments');
    
    try { await treatments.dropIndexes(); } catch (e) {}

    await treatments.createIndexes([
      // الكود الفريد
      { key: { code: 1 }, unique: true, name: 'idx_treat_code' },

      // العلاجات النشطة حسب التصنيف
      {
        key:  { category: 1, isActive: 1 },
        name: 'idx_treat_category_active',
      },

      // البحث النصي
      {
        key: { nameAr: 'text', nameEn: 'text', code: 'text' },
        name: 'idx_treat_text',
        default_language: 'none',
      },
    ]);
    console.log('   ✅ تم إنشاء 3 فهارس بنجاح\n');

    // ══════════════════════════════════════════════════════════
    // 6. جدول خطط العلاج (treatmentplans)
    // ══════════════════════════════════════════════════════════
    console.log('📁 جدول خطط العلاج...');
    const plans = db.collection('treatmentplans');
    
    try { await plans.dropIndexes(); } catch (e) {}

    await plans.createIndexes([
      // خطط المريض
      { key: { patient: 1 }, name: 'idx_plan_patient' },

      // فلتر الحالة
      { key: { status: 1 }, name: 'idx_plan_status' },

      // فلتر الفئة
      { key: { category: 1 }, name: 'idx_plan_category' },

      // الخطط النشطة للمريض
      {
        key:  { patient: 1, status: 1 },
        name: 'idx_plan_patient_status',
      },

      // خطط التقويم النشطة
      {
        key:  { category: 1, status: 1, orthodonticType: 1 },
        name: 'idx_plan_ortho',
        partialFilterExpression: { category: 'orthodontic' },
      },

      // ترتيب بتاريخ البدء
      { key: { startDate: -1 }, name: 'idx_plan_start_date' },
    ]);
    console.log('   ✅ تم إنشاء 6 فهارس بنجاح\n');

    // ══════════════════════════════════════════════════════════
    // عرض ملخص جميع الفهارس
    // ══════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ملخص الفهارس المُنشأة حالياً في قاعدة البيانات:\n');

    const collections = [
      { name: 'patients',       label: 'المرضى'        },
      { name: 'appointments',   label: 'المواعيد'      },
      { name: 'invoices',       label: 'الفواتير'      },
      { name: 'users',          label: 'المستخدمون'    },
      { name: 'treatments',     label: 'العلاجات'      },
      { name: 'treatmentplans', label: 'خطط العلاج'    },
    ];

    let totalIndexes = 0;

    for (const col of collections) {
      const indexes = await db.collection(col.name).indexes();
      const count   = indexes.length;
      totalIndexes += count;
      console.log(`   ${col.label.padEnd(15)} → ${count} فهرس (يشمل الـ _id)`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ الإجمالي: ${totalIndexes} فهرس نشط على 6 مجموعات`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('❌ خطأ غير متوقع:', err.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 تم إغلاق الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

createIndexes();
