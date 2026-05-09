// ============================================================
// src/controllers/patientController.js — إدارة المرضى
// CRUD كامل: عرض، إضافة، تفاصيل، تعديل، حذف، بحث
// ============================================================
'use strict';

const Patient     = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Invoice     = require('../models/Invoice');
const { asyncHandler, buildValidationMessage } = require('../middlewares/errorHandler');

// ────────────────────────────────────────────────────────────
// GET /patients — قائمة المرضى مع بحث وترقيم صفحات
// ────────────────────────────────────────────────────────────
const index = asyncHandler(async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page)  || 1);
  const limit   = Math.min(50, parseInt(req.query.limit) || 15);
  const skip    = (page - 1) * limit;
  const search  = req.query.search?.trim() || '';
  const status  = req.query.status || '';
  const gender  = req.query.gender || '';
  const sortBy  = req.query.sort   || '-createdAt';

  // بناء فلتر البحث الديناميكي
  const filter = {};

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { firstName:   regex },
      { lastName:    regex },
      { phone:       regex },
      { patientCode: regex },
    ];
  }

  if (status) filter.status = status;
  if (gender) filter.gender = gender;

  // تشغيل الاستعلامين بالتوازي
  const [patients, totalCount] = await Promise.all([
    Patient.find(filter)
      .select('firstName lastName phone patientCode gender dateOfBirth status lastVisitDate createdAt')
      .sort(sortBy)
      .skip(skip)
      .limit(limit),
    Patient.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  res.render('patients/index', {
    title: 'قائمة المرضى',
    patients,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    filters: { search, status, gender, sortBy },
  });
});

// ────────────────────────────────────────────────────────────
// GET /patients/new — نموذج إضافة مريض جديد
// ────────────────────────────────────────────────────────────
const newForm = asyncHandler(async (req, res, next) => { // أضف next هنا
  res.render('patients/new', {
    title:   'إضافة مريض جديد',
    patient: {},
    errors:  [],
  });
});
// ────────────────────────────────────────────────────────────
// POST /patients — حفظ مريض جديد
// ────────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res, next) => {
  const {
    firstName, lastName, gender, dateOfBirth,
    phone, alternativePhone, email, address,
    chronicDiseases, currentMedications, allergies,
    isSmoker, additionalNotes, generalNotes,
  } = req.body;

  try {
    const patient = await Patient.create({
      firstName:        firstName?.trim(),
      lastName:         lastName?.trim(),
      gender,
      dateOfBirth:      new Date(dateOfBirth),
      phone:            phone?.trim(),
      alternativePhone: alternativePhone?.trim() || null,
      email:            email?.trim()            || null,
      address:          address?.trim()          || null,
      generalNotes:     generalNotes?.trim()     || null,
      firstVisitDate:   new Date(),
      medicalHistory: {
        // تحويل النص المفصول بفواصل إلى مصفوفة
        chronicDiseases:    splitTags(chronicDiseases),
        currentMedications: splitTags(currentMedications),
        allergies:          splitTags(allergies),
        isSmoker:           isSmoker === 'on',
        additionalNotes:    additionalNotes?.trim() || null,
      },
    });

    req.session.successMsg = `✅ تم تسجيل المريض ${patient.fullName} بنجاح — كود: ${patient.patientCode}`;
    res.redirect(`/patients/${patient._id}`);

  } catch (error) {
    // إعادة النموذج مع البيانات وأخطاء التحقق
    res.render('patients/new', {
      title:   'إضافة مريض جديد',
      patient: req.body,
      errors:  [buildValidationMessage(error)],
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /patients/:id — تفاصيل المريض الكاملة
// ────────────────────────────────────────────────────────────
const show = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  // جلب سجل المواعيد والفواتير معاً بالتوازي
  const [appointments, invoices] = await Promise.all([
    Appointment.find({ patient: patient._id })
      .select('appointmentDate startTime treatmentType status duration sessionNotes')
      .sort({ appointmentDate: -1 })
      .limit(10),

    Invoice.find({ patient: patient._id })
      .select('invoiceNumber totalAmount paidAmount remainingAmount status createdAt')
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  res.render('patients/show', {
    title:        `${patient.fullName} — الملف الطبي`,
    patient,
    appointments,
    invoices,
  });
});

// ────────────────────────────────────────────────────────────
// GET /patients/:id/edit — نموذج تعديل المريض
// ────────────────────────────────────────────────────────────
const editForm = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  res.render('patients/edit', {
    title:   `تعديل — ${patient.fullName}`,
    patient,
    errors:  [],
  });
});

// ────────────────────────────────────────────────────────────
// PUT /patients/:id — تحديث بيانات المريض
// ────────────────────────────────────────────────────────────
const update = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  const {
    firstName, lastName, gender, dateOfBirth,
    phone, alternativePhone, email, address,
    chronicDiseases, currentMedications, allergies,
    isSmoker, additionalNotes, generalNotes, status,
  } = req.body;

  try {
    // تحديث الحقول الأساسية
    patient.firstName        = firstName?.trim();
    patient.lastName         = lastName?.trim();
    patient.gender           = gender;
    patient.dateOfBirth      = new Date(dateOfBirth);
    patient.phone            = phone?.trim();
    patient.alternativePhone = alternativePhone?.trim() || null;
    patient.email            = email?.trim()            || null;
    patient.address          = address?.trim()          || null;
    patient.generalNotes     = generalNotes?.trim()     || null;
    patient.status           = status                   || 'active';

    // تحديث السجل الطبي
    patient.medicalHistory.chronicDiseases    = splitTags(chronicDiseases);
    patient.medicalHistory.currentMedications = splitTags(currentMedications);
    patient.medicalHistory.allergies          = splitTags(allergies);
    patient.medicalHistory.isSmoker           = isSmoker === 'on';
    patient.medicalHistory.additionalNotes    = additionalNotes?.trim() || null;

    await patient.save();

    req.session.successMsg = `✅ تم تحديث بيانات المريض ${patient.fullName} بنجاح`;
    res.redirect(`/patients/${patient._id}`);

  } catch (error) {
    res.render('patients/edit', {
      title:   `تعديل — ${patient.fullName}`,
      patient: { ...patient.toObject(), ...req.body },
      errors:  [buildValidationMessage(error)],
    });
  }
});

// ────────────────────────────────────────────────────────────
// DELETE /patients/:id — حذف المريض (تعطيل وليس حذف حقيقي)
// ────────────────────────────────────────────────────────────
const destroy = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود' });
  }

  // "الحذف الناعم" — تغيير الحالة بدلاً من الحذف الفعلي
  // لحماية سجلات المواعيد والفواتير المرتبطة
  patient.status = 'inactive';
  await patient.save();

  // للطلبات القادمة من Fetch API
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, message: 'تم تعطيل المريض بنجاح' });
  }

  req.session.successMsg = `تم تعطيل سجل المريض ${patient.fullName}`;
  res.redirect('/patients');
});

// ────────────────────────────────────────────────────────────
// GET /patients/search — بحث AJAX سريع
// يُستخدم في نماذج اختيار المريض (مواعيد، فواتير)
// ────────────────────────────────────────────────────────────
const search = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim() || '';

  if (query.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const patients = await Patient.search(query);

  res.json({
    success: true,
    data: patients.map((p) => ({
      id:          p._id,
      name:        p.fullName,
      code:        p.patientCode,
      phone:       p.phone,
      gender:      p.gender,
      age:         p.age,
    })),
  });
});

// ────────────────────────────────────────────────────────────
// دالة مساعدة خاصة: تحويل النص إلى مصفوفة
// ────────────────────────────────────────────────────────────
const splitTags = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[،,\n]/)           // فصل بالفاصلة العربية أو الإنجليزية أو السطر الجديد
    .map((t) => t.trim())
    .filter(Boolean);
};

module.exports = { index, newForm, create, show, editForm, update, destroy, search };
