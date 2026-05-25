// ============================================================
// src/middlewares/security.js — إعدادات الأمان
// ============================================================
'use strict';

const helmet    = require('helmet');
const { rateLimit, ipKeyGenerator} = require('express-rate-limit');

// ══════════════════════════════════════════════════════════════
// 1. HELMET — رؤوس HTTP الأمنية
// ══════════════════════════════════════════════════════════════
const helmetMiddleware = helmet({

  // منع تضمين الموقع في iframe (حماية Clickjacking)
  frameguard: { action: 'deny' },

  // إخفاء معلومات السيرفر
  hidePoweredBy: true,

  // منع MIME type sniffing
  noSniff: true,

  // منع تسرب الـ Referrer
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // XSS Protection
  xssFilter: true,

  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",         // EJS يحتاجه
        'cdn.jsdelivr.net',        // Bootstrap + Chart.js
        'cdnjs.cloudflare.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'cdn.jsdelivr.net',
        'fonts.googleapis.com',
      ],
      fontSrc: [
        "'self'",
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'cdn.jsdelivr.net',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
      ],
      connectSrc: [
        "'self'",
        'wa.me',                   // واتساب
        'api.whatsapp.com',
      ],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },

  // HSTS: فرض HTTPS (فقط في الإنتاج)
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Permissions Policy
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

// ══════════════════════════════════════════════════════════════
// 2. RATE LIMITING — تحديد معدل الطلبات
// ══════════════════════════════════════════════════════════════

// ── دالة مساعدة: رسالة الخطأ ─────────────────────────────────
const rateLimitHandler = (req, res) => {
  // إذا كان طلب API
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(429).json({
      success: false,
      message: 'طلبات كثيرة جداً، يرجى الانتظار قليلاً ثم المحاولة مجدداً.',
      retryAfter: res.getHeader('Retry-After'),
    });
  }

  // إذا كان طلب صفحة عادية
  res.status(429).send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>429 — طلبات كثيرة</title>
      <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css"/>
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #1a1f36, #0d1b4b);
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
        }
        .box {
          background: #fff; border-radius: 20px; padding: 48px 40px;
          text-align: center; max-width: 420px; width: 100%;
          box-shadow: 0 24px 64px rgba(0,0,0,.3);
        }
        .code { font-size: 80px; font-weight: 900; color: #dc3545; }
        #timer { font-size: 36px; font-weight: 800; color: #0d6efd; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="code">429</div>
        <h2 class="fw-bold mb-2">طلبات كثيرة جداً</h2>
        <p class="text-muted mb-4">
          تجاوزت الحد المسموح به من الطلبات.<br/>
          يرجى الانتظار قبل المحاولة مجدداً.
        </p>
        <div id="timer">...</div>
        <p class="text-muted small mt-2">ثانية متبقية</p>
        <a href="/" class="btn btn-primary mt-3 px-4">العودة للرئيسية</a>
      </div>
      <script>
        var seconds = ${res.getHeader('Retry-After') || 60};
        var el = document.getElementById('timer');
        var interval = setInterval(function() {
          el.textContent = seconds--;
          if (seconds < 0) {
            clearInterval(interval);
            window.location.reload();
          }
        }, 1000);
      </script>
    </body>
    </html>
  `);
};

// ── أ. حد عام للموقع كله ─────────────────────────────────────
// 200 طلب كل 15 دقيقة لكل IP
const generalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,   // 15 دقيقة
  max:              200,               // 200 طلب
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          'طلبات كثيرة جداً',
  handler:          rateLimitHandler,
  skip: (req) => {
    // تجاهل الملفات الثابتة (CSS, JS, Images)
    return req.path.startsWith('/css') ||
           req.path.startsWith('/js')  ||
           req.path.startsWith('/images');
  },
});

// ── ب. حد صارم لتسجيل الدخول ─────────────────────────────────
// 5 محاولات فقط كل 15 دقيقة
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,    // 15 دقيقة
  max:             5,                  // 5 محاولات فقط
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,        // لا يحسب الطلبات الناجحة
  handler: (req, res) => {
    // احسب الوقت المتبقي
    const retryAfter = Math.ceil(
      (req.rateLimit.resetTime - Date.now()) / 1000 / 60
    );

    // سجّل محاولة اختراق
    console.warn(
      `🚨 [${new Date().toISOString()}] محاولات دخول مشبوهة من IP: ${
        req.ip
      } — Email: ${req.body?.email || 'unknown'}`
    );

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(429).json({
        success: false,
        message: `تم تجاوز الحد المسموح. حاول بعد ${retryAfter} دقيقة.`,
      });
    }

    // إعادة صفحة الدخول مع رسالة خطأ
    res.status(429).render('auth/login', {
      title:      'تسجيل الدخول',
      clinicName: process.env.CLINIC_NAME || 'عيادة الأسنان',
      currentYear: new Date().getFullYear(),
      error: `🔒 تم قفل الحساب مؤقتاً بسبب محاولات متعددة. حاول بعد ${retryAfter} دقيقة.`,
      info:  null,
    });
  },
     keyGenerator: async (req, res) => {
       // 1. توليد IP آمن وموحد يدعم IPv6 بدون مشاكل
       const safeIp = await ipKeyGenerator(req, res);
    
       // 2. مزج الـ IP الآمن مع الـ Email الخاص بالمستخدم
       return `${safeIp}_${req.body?.email || 'unknown'}`;
      },
});

// ── ج. حد رفع الملفات ────────────────────────────────────────
// 20 رفع كل 10 دقائق
const uploadLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,    // 10 دقائق
  max:             20,                 // 20 عملية رفع
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'تجاوزت حد رفع الملفات. انتظر 10 دقائق.',
    });
  },
});

// ── د. حد API البحث ───────────────────────────────────────────
// 60 طلب بحث كل دقيقة
const searchLimiter = rateLimit({
  windowMs:        60 * 1000,          // دقيقة واحدة
  max:             60,                 // 60 طلب
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      data:    [],
      message: 'طلبات بحث كثيرة جداً، انتظر لحظة.',
    });
  },
});

// ── هـ. حد API الواتساب ──────────────────────────────────────
// 30 رسالة كل ساعة
const whatsappLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,    // ساعة
  max:             30,                 // 30 رسالة
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'تجاوزت حد إرسال رسائل واتساب لهذه الساعة.',
    });
  },
});
// ══════════════════════════════════════════════════════════════
// 3. SECURITY LOGGER — تسجيل الأحداث الأمنية
// ══════════════════════════════════════════════════════════════
const securityLogger = (req, res, next) => {
  // تسجيل الطلبات المشبوهة فقط
  const suspiciousPatterns = [
    /\.\.\//,            // Path traversal
    /<script/i,          // XSS
    /union.*select/i,    // SQL Injection
    /javascript:/i,      // JS injection
    /eval\(/i,           // Code injection
  ];

  const url  = req.originalUrl || '';
  const body = JSON.stringify(req.body || '');

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(body)) {
      console.warn(
        `🚨 [SECURITY] ${new Date().toISOString()} ` +
        `IP: ${req.ip} | ` +
        `Method: ${req.method} | ` +
        `URL: ${url} | ` +
        `Pattern: ${pattern}`
      );
      return res.status(400).json({
        success: false,
        message: 'طلب غير مسموح به',
      });
    }
  }

  next();
};

module.exports = {
  helmetMiddleware,
  generalLimiter,
  loginLimiter,
  uploadLimiter,
  searchLimiter,
  whatsappLimiter,
  securityLogger,     // ← أضفه
};
