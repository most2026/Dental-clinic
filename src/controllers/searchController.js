// ============================================================
// src/controllers/searchController.js — البحث الشامل
// ============================================================
'use strict';

const Patient       = require('../models/Patient');
const Appointment   = require('../models/Appointment');
const Invoice       = require('../models/Invoice');
const TreatmentPlan = require('../models/TreatmentPlan');
const { asyncHandler } = require('../middlewares/errorHandler');

// ── خريطة أنواع العلاج ───────────────────────────────────────
const TREATMENT_AR = {
  checkup:'كشف', cleaning:'تنظيف', filling:'حشو',
  extraction:'خلع', root_canal:'علاج عصب', crown:'تاج',
  bridge:'جسر', implant:'زراعة', whitening:'تبييض',
  orthodontics:'تقويم', surgery:'جراحة',
  consultation:'استشارة', other:'أخرى',
};

// ────────────────────────────────────────────────────────────
// GET /search?q=... — البحث الشامل (JSON)
// ────────────────────────────────────────────────────────────
const globalSearch = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim() || '';

  // لا بحث إذا كان النص أقل من حرفين
  if (query.length < 2) {
    return res.json({ success: true, query, results: {}, total: 0 });
  }

  const regex   = new RegExp(query, 'i');
  const limit   = 5; // أقصى نتائج لكل قسم

  // ── تشغيل كل البحوث بالتوازي ────────────────────────────
  const [patients, appointments, invoices, plans] = await Promise.all([

    // 🔍 البحث في المرضى
    Patient.find({
      $or: [
        { firstName:   regex },
        { lastName:    regex },
        { phone:       regex },
        { patientCode: regex },
      ],
      status: { $ne: 'blocked' },
    })
      .select('firstName lastName patientCode phone status dateOfBirth')
      .limit(limit)
      .lean(),

    // 🔍 البحث في المواعيد
    Appointment.find({
      status: { $nin: ['cancelled'] },
    })
      .populate({
        path:  'patient',
        match: {
          $or: [
            { firstName:   regex },
            { lastName:    regex },
            { patientCode: regex },
          ],
        },
        select: 'firstName lastName patientCode',
      })
      .select('appointmentDate startTime treatmentType status patient')
      .sort({ appointmentDate: -1 })
      .limit(20)
      .lean()
      .then(apts =>
        // فلتر النتائج التي تحتوي على patient (وجد في البحث)
        apts.filter(a => a.patient).slice(0, limit)
      ),

    // 🔍 البحث في الفواتير
    Invoice.find({
      $or: [
        { invoiceNumber: regex },
      ],
      status: { $nin: ['cancelled'] },
    })
      .populate('patient', 'firstName lastName patientCode')
      .select('invoiceNumber totalAmount paidAmount remainingAmount status createdAt patient')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),

    // 🔍 البحث في خطط العلاج
    TreatmentPlan.find({
      $or: [{ title: regex }],
      status: { $nin: ['cancelled'] },
    })
      .populate('patient', 'firstName lastName patientCode')
      .select('title category orthodonticType status startDate patient')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),

  ]);

  // ── البحث في المرضى بالاسم الكامل أيضاً ─────────────────
  // (للبحث بالاسم المركب: أحمد محمد)
  const fullNamePatients = query.includes(' ')
    ? await Patient.find({
        $or: [
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$firstName', ' ', '$lastName'] },
                regex: query,
                options: 'i',
              },
            },
          },
        ],
        status: { $ne: 'blocked' },
      })
        .select('firstName lastName patientCode phone status')
        .limit(limit)
        .lean()
    : [];

  // دمج نتائج المرضى بدون تكرار
  const allPatients = [
    ...patients,
    ...fullNamePatients.filter(
      p => !patients.find(ep => ep._id.toString() === p._id.toString())
    ),
  ].slice(0, limit);

  // ── بناء نتائج منظمة ─────────────────────────────────────
  const results = {
    patients:     formatPatients(allPatients),
    appointments: formatAppointments(appointments),
    invoices:     formatInvoices(invoices),
    plans:        formatPlans(plans),
  };

  const total =
    results.patients.length +
    results.appointments.length +
    results.invoices.length +
    results.plans.length;

  res.json({ success: true, query, results, total });
});

// ────────────────────────────────────────────────────────────
// دوال التنسيق
// ────────────────────────────────────────────────────────────

function formatPatients(patients) {
  return patients.map(p => ({
    id:       p._id,
    type:     'patient',
    icon:     '👤',
    title:    `${p.firstName} ${p.lastName}`,
    subtitle: p.patientCode,
    meta:     p.phone,
    badge:    p.status === 'active' ? 'نشط' : 'غير نشط',
    badgeColor: p.status === 'active' ? 'success' : 'secondary',
    url:      `/patients/${p._id}`,
    initial:  p.firstName.charAt(0),
  }));
}

function formatAppointments(appointments) {
  return appointments.map(a => ({
    id:       a._id,
    type:     'appointment',
    icon:     '📅',
    title:    `${a.patient.firstName} ${a.patient.lastName}`,
    subtitle: TREATMENT_AR[a.treatmentType] || a.treatmentType,
    meta:     new Date(a.appointmentDate).toLocaleDateString('ar-IQ', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) + ' — ' + a.startTime,
    badge:    getStatusLabel(a.status),
    badgeColor: getStatusColor(a.status),
    url:      `/appointments/${a._id}`,
    initial:  a.patient.firstName.charAt(0),
  }));
}

function formatInvoices(invoices) {
  return invoices.map(i => ({
    id:       i._id,
    type:     'invoice',
    icon:     '🧾',
    title:    i.invoiceNumber,
    subtitle: i.patient
      ? `${i.patient.firstName} ${i.patient.lastName}`
      : '—',
    meta:     i.totalAmount?.toLocaleString('ar-IQ') + ' د.ع',
    badge:    getInvoiceStatusLabel(i.status),
    badgeColor: getInvoiceStatusColor(i.status),
    url:      `/invoices/${i._id}`,
    initial:  '🧾',
  }));
}

function formatPlans(plans) {
  return plans.map(p => ({
    id:       p._id,
    type:     'plan',
    icon:     '📋',
    title:    p.title,
    subtitle: p.patient
      ? `${p.patient.firstName} ${p.patient.lastName}`
      : '—',
    meta:     getCategoryLabel(p.category),
    badge:    getPlanStatusLabel(p.status),
    badgeColor: getPlanStatusColor(p.status),
    url:      `/treatment-plans/${p._id}`,
    initial:  p.title.charAt(0),
  }));
}

// ── دوال مساعدة ───────────────────────────────────────────────
function getStatusLabel(s) {
  const labels = {
    scheduled:'مجدول', confirmed:'مؤكد', in_progress:'جاري',
    completed:'مكتمل', no_show:'لم يحضر', rescheduled:'أُعيد',
  };
  return labels[s] || s;
}

function getStatusColor(s) {
  const colors = {
    scheduled:'primary', confirmed:'success', in_progress:'purple',
    completed:'secondary', no_show:'warning',
  };
  return colors[s] || 'secondary';
}

function getInvoiceStatusLabel(s) {
  const labels = {
    draft:'مسودة', issued:'صادرة', partial:'جزئية',
    paid:'مدفوعة', overdue:'متأخرة',
  };
  return labels[s] || s;
}

function getInvoiceStatusColor(s) {
  const colors = {
    draft:'secondary', issued:'primary', partial:'warning',
    paid:'success', overdue:'danger',
  };
  return colors[s] || 'secondary';
}

function getCategoryLabel(c) {
  const labels = {
    orthodontic:'تقويم', implant:'زراعة', root_canal:'علاج عصب',
    cosmetic:'تجميل', surgery:'جراحة', other:'أخرى',
  };
  return labels[c] || c;
}

function getPlanStatusLabel(s) {
  const labels = {
    planning:'تخطيط', active:'نشط', paused:'موقوف', completed:'مكتمل',
  };
  return labels[s] || s;
}

function getPlanStatusColor(s) {
  const colors = {
    planning:'info', active:'success', paused:'warning', completed:'secondary',
  };
  return colors[s] || 'secondary';
}

module.exports = { globalSearch };
