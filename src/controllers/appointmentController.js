// ============================================================
// src/controllers/appointmentController.js — إدارة المواعيد
// ============================================================
'use strict';
const whatsapp = require('../utils/whatsapp');
const Appointment = require('../models/Appointment');
const Patient     = require('../models/Patient');
const { asyncHandler, buildValidationMessage } = require('../middlewares/errorHandler');

// خريطة أنواع العلاج بالعربي
const TREATMENT_TYPES = {
  checkup:       'كشف وفحص',
  cleaning:      'تنظيف وتلميع',
  filling:       'حشو',
  extraction:    'خلع',
  root_canal:    'علاج عصب',
  crown:         'تاج',
  bridge:        'جسر',
  implant:       'زراعة',
  whitening:     'تبييض',
  orthodontics:  'تقويم',
  surgery:       'جراحة',
  consultation:  'استشارة',
  other:         'أخرى',
};

// خريطة الحالات بالعربي
const STATUS_LABELS = {
  scheduled:   'مجدول',
  confirmed:   'مؤكد',
  in_progress: 'جاري',
  completed:   'مكتمل',
  cancelled:   'ملغى',
  no_show:     'لم يحضر',
  rescheduled: 'أُعيد جدولته',
};

// ────────────────────────────────────────────────────────────
// GET /appointments — قائمة المواعيد مع فلترة وترقيم
// ────────────────────────────────────────────────────────────
const index = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = 15;
  const skip   = (page - 1) * limit;

  // الفلاتر
  const status        = req.query.status        || '';
  const treatmentType = req.query.treatmentType || '';
  const dateFrom      = req.query.dateFrom      || '';
  const dateTo        = req.query.dateTo        || '';

  const filter = {};
  if (status)        filter.status        = status;
  if (treatmentType) filter.treatmentType = treatmentType;

  // فلتر التاريخ
  if (dateFrom || dateTo) {
    filter.appointmentDate = {};
    if (dateFrom) filter.appointmentDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.appointmentDate.$lte = end;
    }
  }

  const [appointments, totalCount] = await Promise.all([
    Appointment.find(filter)
      .populate('patient', 'firstName lastName phone patientCode')
      .sort({ appointmentDate: -1, startTime: -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  res.render('appointments/index', {
    title: 'جميع المواعيد',
    appointments,
    treatmentTypes: TREATMENT_TYPES,
    statusLabels:   STATUS_LABELS,
    pagination: {
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    },
    filters: { status, treatmentType, dateFrom, dateTo },
  });
});

// ────────────────────────────────────────────────────────────
// GET /appointments/today — مواعيد اليوم (التقويم اليومي)
// ────────────────────────────────────────────────────────────
const today = asyncHandler(async (req, res) => {
  // دعم عرض يوم مخصص عبر query param
  const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
  const targetDate    = new Date(targetDateStr);

  const appointments = await Appointment.getDayAppointments(targetDate);

  // بناء شبكة ساعات العمل (8 صباحاً → 8 مساءً)
  const workHours = [];
  for (let h = 8; h <= 20; h++) {
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    const slotApts = appointments.filter((a) => {
      const [aptH] = a.startTime.split(':').map(Number);
      return aptH === h;
    });
    workHours.push({ hour: h, timeStr, appointments: slotApts });
  }

  // التنقل بين الأيام
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  res.render('appointments/today', {
    title:         'مواعيد اليوم',
    appointments,
    workHours,
    targetDate,
    targetDateStr,
    prevDateStr:   prevDate.toISOString().split('T')[0],
    nextDateStr:   nextDate.toISOString().split('T')[0],
    isToday:       targetDateStr === new Date().toISOString().split('T')[0],
    treatmentTypes: TREATMENT_TYPES,
    statusLabels:   STATUS_LABELS,
  });
});

// ────────────────────────────────────────────────────────────
// GET /appointments/new — نموذج حجز موعد جديد
// ────────────────────────────────────────────────────────────
const newForm = asyncHandler(async (req, res) => {
  // دعم تمرير المريض مسبقاً من صفحة ملف المريض
  let preselectedPatient = null;
  if (req.query.patient) {
    preselectedPatient = await Patient.findById(req.query.patient)
      .select('firstName lastName patientCode phone');
  }

  // التاريخ الافتراضي = اليوم
  const defaultDate = req.query.date || new Date().toISOString().split('T')[0];

  res.render('appointments/new', {
    title:              'حجز موعد جديد',
    appointment:        {},
    preselectedPatient,
    defaultDate,
    treatmentTypes:     TREATMENT_TYPES,
    errors:             [],
  });
});

// ────────────────────────────────────────────────────────────
// POST /appointments — حفظ موعد جديد
// ────────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
  const {
    patientId, appointmentDate, startTime,
    duration, treatmentType, chiefComplaint,
  } = req.body;

  try {
    // التحقق من وجود المريض
    const patient = await Patient.findById(patientId);
    if (!patient) throw new Error('المريض المحدد غير موجود');

    // التحقق من عدم تعارض الأوقات
    const conflict = await checkTimeConflict(
      new Date(appointmentDate),
      startTime,
      parseInt(duration),
      null
    );
    if (conflict) throw new Error(`تعارض في الوقت مع موعد آخر (${conflict.startTime} - ${conflict.endTime})`);

    const appointment = await Appointment.create({
      patient:        patientId,
      appointmentDate: new Date(appointmentDate),
      startTime,
      duration:       parseInt(duration) || 30,
      treatmentType,
      chiefComplaint: chiefComplaint?.trim() || null,
      status:         'scheduled',
    });

    // تحديث تاريخ آخر زيارة للمريض
    await Patient.findByIdAndUpdate(patientId, {
      lastVisitDate: new Date(appointmentDate),
      $setOnInsert: { firstVisitDate: new Date(appointmentDate) },
    });

    req.session.successMsg =
      `✅ تم حجز الموعد لـ ${patient.fullName} بتاريخ ${new Date(appointmentDate).toLocaleDateString('ar-IQ')}`;
    res.redirect(`/appointments/${appointment._id}`);

  } catch (error) {
    let preselectedPatient = null;
    if (patientId) {
      preselectedPatient = await Patient.findById(patientId)
        .select('firstName lastName patientCode phone').catch(() => null);
    }

    res.render('appointments/new', {
      title:              'حجز موعد جديد',
      appointment:        req.body,
      preselectedPatient,
      defaultDate:        appointmentDate || new Date().toISOString().split('T')[0],
      treatmentTypes:     TREATMENT_TYPES,
      errors:             [buildValidationMessage(error)],
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /appointments/:id — تفاصيل الموعد
// ────────────────────────────────────────────────────────────
const show = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName phone patientCode gender dateOfBirth medicalHistory')
    .populate('invoice',  'invoiceNumber totalAmount paidAmount status');

  if (!appointment) {
    req.session.errorMsg = 'الموعد غير موجود';
    return res.redirect('/appointments');
  }

  res.render('appointments/show', {
    title:          `موعد — ${appointment.patient.fullName}`,
    appointment,
    treatmentTypes: TREATMENT_TYPES,
    statusLabels:   STATUS_LABELS,
  });
});

// ────────────────────────────────────────────────────────────
// GET /appointments/:id/edit — نموذج تعديل الموعد
// ────────────────────────────────────────────────────────────
const editForm = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName patientCode phone');

  if (!appointment) {
    req.session.errorMsg = 'الموعد غير موجود';
    return res.redirect('/appointments');
  }

  res.render('appointments/edit', {
    title:          `تعديل موعد — ${appointment.patient.fullName}`,
    appointment,
    treatmentTypes: TREATMENT_TYPES,
    statusLabels:   STATUS_LABELS,
    errors:         [],
  });
});

// ────────────────────────────────────────────────────────────
// PUT /appointments/:id — تحديث الموعد
// ────────────────────────────────────────────────────────────
const update = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName');

  if (!appointment) {
    req.session.errorMsg = 'الموعد غير موجود';
    return res.redirect('/appointments');
  }

  const {
    appointmentDate, startTime, duration,
    treatmentType, chiefComplaint, sessionNotes,
    status, treatedTeeth, cancellationReason,
  } = req.body;

  try {
    // التحقق من التعارض عند تغيير الوقت
    const dateChanged = appointmentDate &&
      new Date(appointmentDate).toDateString() !== appointment.appointmentDate.toDateString();
    const timeChanged = startTime && startTime !== appointment.startTime;

    if (dateChanged || timeChanged) {
      const conflict = await checkTimeConflict(
        new Date(appointmentDate || appointment.appointmentDate),
        startTime || appointment.startTime,
        parseInt(duration) || appointment.duration,
        appointment._id
      );
      if (conflict) throw new Error(`تعارض في الوقت مع موعد آخر (${conflict.startTime})`);
    }

    // تحديث الحقول
    if (appointmentDate) appointment.appointmentDate = new Date(appointmentDate);
    if (startTime)       appointment.startTime       = startTime;
    if (duration)        appointment.duration        = parseInt(duration);
    if (treatmentType)   appointment.treatmentType   = treatmentType;
    if (chiefComplaint !== undefined) appointment.chiefComplaint = chiefComplaint?.trim() || null;
    if (sessionNotes   !== undefined) appointment.sessionNotes   = sessionNotes?.trim()   || null;
    if (status)                       appointment.status         = status;
    if (cancellationReason !== undefined) appointment.cancellationReason = cancellationReason?.trim() || null;

    // الأسنان المعالجة
    if (treatedTeeth) {
      appointment.treatedTeeth = String(treatedTeeth)
        .split(',')
        .map((t) => parseInt(t.trim()))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 32);
    }

    await appointment.save();

    req.session.successMsg = `✅ تم تحديث الموعد بنجاح`;
    res.redirect(`/appointments/${appointment._id}`);

  } catch (error) {
    res.render('appointments/edit', {
      title:          `تعديل موعد — ${appointment.patient.fullName}`,
      appointment:    { ...appointment.toObject(), ...req.body },
      treatmentTypes: TREATMENT_TYPES,
      statusLabels:   STATUS_LABELS,
      errors:         [buildValidationMessage(error)],
    });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /appointments/:id/status — تحديث الحالة فقط (AJAX)
// ────────────────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = Object.keys(STATUS_LABELS);

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'حالة غير صالحة' });
  }

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  ).populate('patient', 'firstName lastName');

  if (!appointment) {
    return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
  }

  res.json({
    success:     true,
    message:     `تم تغيير حالة الموعد إلى "${STATUS_LABELS[status]}"`,
    newStatus:   status,
    statusLabel: STATUS_LABELS[status],
  });
});

// ────────────────────────────────────────────────────────────
// DELETE /appointments/:id — إلغاء/حذف الموعد
// ────────────────────────────────────────────────────────────
const destroy = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName');

  if (!appointment) {
    return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
  }

  // تغيير الحالة إلى "ملغى" بدلاً من الحذف الفعلي
  appointment.status             = 'cancelled';
  appointment.cancellationReason = req.body.reason || 'ألغي من النظام';
  await appointment.save();

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, message: 'تم إلغاء الموعد بنجاح' });
  }

  req.session.successMsg = `تم إلغاء موعد ${appointment.patient.fullName}`;
  res.redirect('/appointments');
});

// ────────────────────────────────────────────────────────────
// GET /appointments/available-slots — فحص الأوقات المتاحة (AJAX)
// ────────────────────────────────────────────────────────────
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { date, duration = 30 } = req.query;
  if (!date) return res.json({ success: false, message: 'التاريخ مطلوب' });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // جلب جميع مواعيد ذلك اليوم
  const bookedAppointments = await Appointment.find({
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status:          { $nin: ['cancelled', 'no_show'] },
  }).select('startTime duration');

  // بناء قائمة الأوقات المتاحة (كل 30 دقيقة من 8ص إلى 8م)
  const allSlots    = generateTimeSlots(8, 20, 30);
  const durMinutes  = parseInt(duration);

  const availableSlots = allSlots.filter((slot) => {
    return !hasConflict(slot, durMinutes, bookedAppointments);
  });

  res.json({ success: true, data: availableSlots });
});

// ============================================================
// دوال مساعدة خاصة
// ============================================================

/** التحقق من تعارض الأوقات */
async function checkTimeConflict(date, startTime, duration, excludeId) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const query = {
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status:          { $nin: ['cancelled', 'no_show'] },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await Appointment.find(query).select('startTime duration');

  const [sh, sm]   = startTime.split(':').map(Number);
  const startMins  = sh * 60 + sm;
  const endMins    = startMins + duration;

  for (const apt of existing) {
    const [ah, am]  = apt.startTime.split(':').map(Number);
    const aptStart  = ah * 60 + am;
    const aptEnd    = aptStart + apt.duration;

    if (startMins < aptEnd && endMins > aptStart) {
      // تعارض وجد
      const endH = Math.floor(aptEnd / 60);
      const endM = aptEnd % 60;
      return {
        startTime: apt.startTime,
        endTime:   `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      };
    }
  }
  return null;
}

/** توليد قائمة فترات زمنية */
function generateTimeSlots(startHour, endHour, intervalMinutes) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

/** فحص إذا كان وقت محدد يتعارض مع المواعيد الموجودة */
function hasConflict(slot, duration, bookedAppointments) {
  const [sh, sm] = slot.split(':').map(Number);
  const start    = sh * 60 + sm;
  const end      = start + duration;

  return bookedAppointments.some((apt) => {
    const [ah, am] = apt.startTime.split(':').map(Number);
    const aStart   = ah * 60 + am;
    const aEnd     = aStart + apt.duration;
    return start < aEnd && end > aStart;
  });
}
// ────────────────────────────────────────────────────────────
// GET /appointments/reminders — صفحة إدارة التذكيرات
// ────────────────────────────────────────────────────────────
const reminders = asyncHandler(async (req, res) => {
  // مواعيد اليوم والغد لم يُرسَل لها تذكير
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = await Appointment.find({
    appointmentDate: { $gte: today, $lte: tomorrow },
    status:          { $nin: ['cancelled', 'no_show', 'completed'] },
  })
    .populate('patient', 'firstName lastName phone patientCode')
    .sort({ appointmentDate: 1, startTime: 1 });

  // كل مواعيد لم يُرسَل لها تذكير (آخر 7 أيام + قادمة)
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);

  const needReminder = await Appointment.find({
    appointmentDate:  { $gte: today, $lte: weekAhead },
    reminderSent:     false,
    status:           { $nin: ['cancelled', 'no_show'] },
  })
    .populate('patient', 'firstName lastName phone patientCode')
    .sort({ appointmentDate: 1, startTime: 1 });

  const clinicName = process.env.CLINIC_NAME || 'عيادة الأسنان';

  // بناء روابط الواتساب لكل موعد
  const appointmentsWithLinks = upcoming.map(apt => {
    const data = whatsapp.buildAppointmentData(apt, clinicName);
    const msg  = whatsapp.TEMPLATES.appointmentReminder(data);
    const link = whatsapp.buildWhatsAppLink(apt.patient.phone, msg);
    return { ...apt.toObject(), whatsappLink: link };
  });

  res.render('appointments/reminders', {
    title:              'إشعارات واتساب',
    upcoming:           appointmentsWithLinks,
    needReminder,
    clinicName,
    totalNeedReminder:  needReminder.length,
  });
});

// ────────────────────────────────────────────────────────────
// POST /appointments/:id/remind — تسجيل إرسال التذكير
// ────────────────────────────────────────────────────────────
const markReminderSent = asyncHandler(async (req, res) => {
  const apt = await Appointment.findByIdAndUpdate(
    req.params.id,
    {
      reminderSent:   true,
      reminderSentAt: new Date(),
    },
    { new: true }
  );

  if (!apt) {
    return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
  }

  res.json({ success: true, message: 'تم تسجيل إرسال التذكير ✅' });
});

// ────────────────────────────────────────────────────────────
// GET /appointments/:id/whatsapp — بناء رابط واتساب للموعد
// ────────────────────────────────────────────────────────────
const getWhatsAppLink = asyncHandler(async (req, res) => {
  const apt = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName phone');

  if (!apt) {
    return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
  }

  const { template = 'appointmentReminder' } = req.query;
  const clinicName = process.env.CLINIC_NAME || 'عيادة الأسنان';
  const data       = whatsapp.buildAppointmentData(apt, clinicName);

  const templateFn = whatsapp.TEMPLATES[template];
  if (!templateFn) {
    return res.status(400).json({ success: false, message: 'قالب غير موجود' });
  }

  const message = templateFn(data);
  const link    = whatsapp.buildWhatsAppLink(apt.patient.phone, message);

  res.json({ success: true, link, message });
});

module.exports = {
  index, today, newForm, create,
  show, editForm, update, updateStatus,
  destroy, getAvailableSlots,  reminders, markReminderSent, getWhatsAppLink,
};
