// ============================================================
// server.js — نقطة الدخول الرئيسية لتطبيق عيادة الأسنان
// Dental Clinic ERP - Main Server Entry Point
// ============================================================

'use strict';

// --- 1. استيراد المكتبات الأساسية ---
const express    = require('express');
const mongoose   = require('mongoose');
const path       = require('path');
const morgan     = require('morgan');         // تسجيل طلبات HTTP في التطوير
const session    = require('express-session');
const MongoStore = require('connect-mongo').default;  // تخزين الجلسات في MongoDB
const methodOverride = require('method-override'); // دعم PUT و DELETE من HTML forms
const {
  helmetMiddleware,
  generalLimiter,
  searchLimiter,
  securityLogger,
} = require('./src/middlewares/security');

// --- 2. تحميل متغيرات البيئة من ملف .env ---
require('dotenv').config();

// --- تحميل النماذج مبكراً لضمان تسجيلها في Mongoose ---
require('./src/models/Patient');
require('./src/models/Appointment');
require('./src/models/Treatment');
require('./src/models/Invoice');
require('./src/models/User');


// --- 3. إنشاء تطبيق Express ---
const app = express();

// ============================================================
// 🔧 إعداد المحرك والقوالب (View Engine — EJS)
// ============================================================
app.set('view engine', 'ejs');
// تحديد مجلد القوالب بشكل مطلق لتجنب أخطاء المسار
app.set('views', path.join(__dirname, 'views'));

// ============================================================
// 5. Middlewares الأساسية
// ============================================================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true , limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// معالجة طلب favicon.ico الافتراضي من المتصفحات
// (يمنع ظهور خطأ 404 في الـ Console واللوجات)
// ============================================================
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
});

// ============================================================
// 🔐 إعدادات الأمان
// ============================================================

// Helmet — رؤوس HTTP الأمنية
app.use(helmetMiddleware);
app.use(securityLogger); 

// Rate Limit العام — 200 طلب / 15 دقيقة
app.use(generalLimiter);

// Rate Limit البحث السريع
app.use('/patients/search',    searchLimiter);
app.use('/appointments/available-slots', searchLimiter);

// ============================================================
// 6. إعداد الجلسات
// ============================================================
app.use(
  session({
    secret:            process.env.SESSION_SECRET || 'dental_clinic_secret',
    resave:            false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl:   process.env.MONGODB_URI,
      touchAfter: 24 * 3600,
    }),
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   1000 * 60 * 60 * 24 * 7,
    },
    name: 'dental.sid',
  })
);

// ============================================================
// 7. loadUser — يجب أن يكون هنا بعد session مباشرة
// ============================================================
const { loadUser } = require('./src/middlewares/authMiddleware');
app.use(loadUser); // ← هذا السطر هو المهم

// ============================================================
// 8. المتغيرات العامة لقوالب EJS
// ============================================================
app.use((req, res, next) => {
  res.locals.clinicName  = process.env.CLINIC_NAME || 'عيادة الأسنان';
  res.locals.successMsg  = req.session.successMsg   || null;
  res.locals.errorMsg    = req.session.errorMsg     || null;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.currentPath = req.path;
  delete req.session.successMsg;
  delete req.session.errorMsg;
  // res.locals.user تم تعيينه من loadUser أعلاه
  next();
});

// ============================================================
// 9. المسارات
// ============================================================
app.use('/auth', require('./src/routes/authRoutes'));
app.use('/',     require('./src/routes/index'));

// ============================================================
// ❌ معالجة الأخطاء (Error Handling)
// ============================================================

// --- 404: الصفحة غير موجودة ---
app.use((req, res, next) => {
  res.status(404).render('errors/404', {
    title: '404 - الصفحة غير موجودة',
    url: req.originalUrl,
  });
});

// --- 500: خطأ عام في السيرفر ---
// يجب أن يكون له 4 parameters دائماً لكي يعمل Express كـ error handler
app.use((err, req, res, next) => {
  console.error('🔴 Server Error:', err.stack);
  res.status(err.status || 500).render('errors/500', {
    title: '500 - خطأ في السيرفر',
    message: process.env.NODE_ENV === 'development' ? err.message : 'حدث خطأ غير متوقع',
    stack: process.env.NODE_ENV === 'development' ? err.stack : null,
  });
});

// ============================================================
// 🚀 الاتصال بـ MongoDB وتشغيل السيرفر
// ============================================================
const PORT       = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// الاتصال بقاعدة البيانات أولاً، ثم تشغيل السيرفر
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ تم الاتصال بـ MongoDB بنجاح');
    console.log(`📦 قاعدة البيانات: ${mongoose.connection.name}`);

    // تشغيل السيرفر بعد الاتصال الناجح بقاعدة البيانات
    app.listen(PORT, () => {
      console.log('============================================');
      console.log(`🦷 ${process.env.CLINIC_NAME || 'Dental Clinic ERP'}`);
      console.log(`🚀 السيرفر يعمل على: http://localhost:${PORT}`);
      console.log(`🌍 البيئة: ${process.env.NODE_ENV || 'development'}`);
      console.log('============================================');
    });
  })
  .catch((err) => {
    console.error('❌ فشل الاتصال بـ MongoDB:', err.message);
    process.exit(1); // إيقاف التطبيق عند فشل الاتصال بقاعدة البيانات
  });

// ============================================================
// معالجة الإغلاق الآمن (Graceful Shutdown)
// ============================================================
process.on('SIGTERM', async () => {
  console.log('⚠️  إغلاق السيرفر بأمان...');
  await mongoose.connection.close();
  process.exit(0);
});
