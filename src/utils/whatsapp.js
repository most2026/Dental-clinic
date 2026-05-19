// ============================================================
// src/utils/whatsapp.js — خدمة إشعارات واتساب
// ============================================================
'use strict';

// ── تنسيق رقم الهاتف للواتساب ────────────────────────────────
// يحوّل: 07801234567 → 9647801234567
const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return null;

  // أزل المسافات والرموز
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // أزل + من البداية
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);

  // العراق: 07XX → 9647XX
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return '964' + cleaned.substring(1);
  }

  // إذا بدأ بـ 964 — صحيح
  if (cleaned.startsWith('964')) return cleaned;

  // السعودية: 05XX → 9665XX
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    return '966' + cleaned.substring(1);
  }

  return cleaned;
};

// ── قوالب الرسائل ─────────────────────────────────────────────
const TEMPLATES = {

  // تذكير بالموعد
  appointmentReminder: (data) => {
    const { patientName, clinicName, date, time, treatmentType } = data;
    return `🦷 *${clinicName}*

مرحباً ${patientName} 👋

نود تذكيركم بموعدكم:

📅 *التاريخ:* ${date}
🕐 *الوقت:* ${time}
🩺 *نوع العلاج:* ${treatmentType}

يرجى الحضور قبل الموعد بـ 10 دقائق.

في حال الرغبة بتأجيل الموعد يرجى التواصل معنا مسبقاً.

شكراً لثقتكم 🌟`;
  },

  // تأكيد الموعد
  appointmentConfirmed: (data) => {
    const { patientName, clinicName, date, time } = data;
    return `✅ *${clinicName}*

أهلاً ${patientName}،

تم تأكيد موعدكم بنجاح ✅

📅 *التاريخ:* ${date}
🕐 *الوقت:* ${time}

نتطلع لرؤيتكم 😊`;
  },

  // إلغاء الموعد
  appointmentCancelled: (data) => {
    const { patientName, clinicName, date, time } = data;
    return `❌ *${clinicName}*

عزيزنا ${patientName}،

نعتذر منكم، تم إلغاء موعدكم:

📅 *التاريخ:* ${date}
🕐 *الوقت:* ${time}

يرجى التواصل معنا لإعادة الجدولة.

نعتذر عن أي إزعاج 🙏`;
  },

  // تذكير بالدفع
  paymentReminder: (data) => {
    const { patientName, clinicName, invoiceNumber, amount, currency } = data;
    return `💰 *${clinicName}*

عزيزنا ${patientName}،

نود تذكيركم بوجود مبلغ مستحق:

🧾 *رقم الفاتورة:* ${invoiceNumber}
💵 *المبلغ المتبقي:* ${amount} ${currency}

يرجى التواصل معنا لتسوية المبلغ.

شكراً لتعاونكم 🙏`;
  },

  // رسالة ترحيب
  welcome: (data) => {
    const { patientName, clinicName, patientCode } = data;
    return `🦷 *${clinicName}*

أهلاً وسهلاً ${patientName} 🌟

يسعدنا انضمامكم لعائلة عيادتنا.

🪪 *رقمك في العيادة:* ${patientCode}

لا تترددوا في التواصل معنا بأي استفسار.

نتمنى لكم دوام الصحة والعافية 😊`;
  },

  // تذكير متابعة التقويم
  orthodonticFollowup: (data) => {
    const { patientName, clinicName, date, time, trayNumber } = data;
    return `😁 *${clinicName}*

مرحباً ${patientName}،

تذكير بموعد متابعة التقويم:

📅 *التاريخ:* ${date}
🕐 *الوقت:* ${time}
${trayNumber ? `🦷 *الطقم الحالي:* #${trayNumber}` : ''}

تذكر ارتداء الأطقم 22 ساعة يومياً للحصول على أفضل النتائج 💪

نراكم قريباً 😊`;
  },
};

// ── بناء رابط واتساب ─────────────────────────────────────────
const buildWhatsAppLink = (phone, message) => {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return null;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${formatted}?text=${encoded}`;
};

// ── تنسيق التاريخ للرسائل ────────────────────────────────────
const formatDateAr = (date) => {
  return new Date(date).toLocaleDateString('ar-IQ', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
};

// ── توليد بيانات الرسالة من موعد ─────────────────────────────
const buildAppointmentData = (appointment, clinicName) => {
  const TREATMENT_AR = {
    checkup:'كشف وفحص', cleaning:'تنظيف وتلميع', filling:'حشو',
    extraction:'خلع', root_canal:'علاج عصب', crown:'تاج',
    bridge:'جسر', implant:'زراعة', whitening:'تبييض',
    orthodontics:'تقويم', surgery:'جراحة', consultation:'استشارة', other:'أخرى',
  };

  return {
    patientName:   `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    clinicName:    clinicName || 'عيادة الأسنان',
    date:          formatDateAr(appointment.appointmentDate),
    time:          appointment.startTime,
    treatmentType: TREATMENT_AR[appointment.treatmentType] || appointment.treatmentType,
    phone:         appointment.patient.phone,
  };
};

module.exports = {
  formatPhoneForWhatsApp,
  buildWhatsAppLink,
  buildAppointmentData,
  formatDateAr,
  TEMPLATES,
};
