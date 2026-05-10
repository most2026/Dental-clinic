// ============================================================
// src/controllers/xrayController.js — إدارة أشعة المرضى
// ============================================================
'use strict';

const path    = require('path');
const Patient = require('../models/Patient');
const {
  asyncHandler,
  buildValidationMessage,
} = require('../middlewares/errorHandler');
const {
  deleteFileFromDisk,
  buildPublicPath,
  validateUploadedFile,
  XRAY_TYPES_LABELS,
} = require('../utils/multerConfig');

// ────────────────────────────────────────────────────────────
// GET /patients/:patientId/xrays — معرض أشعة المريض
// ────────────────────────────────────────────────────────────
const index = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId)
    .select('firstName lastName patientCode xrays');

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  // ترتيب الأشعة من الأحدث للأقدم
  const xrays = [...patient.xrays].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  // تجميع الأشعة حسب النوع
  const groupedXrays = xrays.reduce((acc, xray) => {
    const type = xray.xrayType || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(xray);
    return acc;
  }, {});

  res.render('xrays/index', {
    title:         `أشعة — ${patient.firstName} ${patient.lastName}`,
    patient,
    xrays,
    groupedXrays,
    xrayTypesLabels: XRAY_TYPES_LABELS,
    totalCount:    xrays.length,
  });
});

// ────────────────────────────────────────────────────────────
// GET /patients/:patientId/xrays/upload — نموذج الرفع
// ────────────────────────────────────────────────────────────
const uploadForm = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId)
    .select('firstName lastName patientCode');

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  res.render('xrays/upload', {
    title:           `رفع أشعة — ${patient.firstName} ${patient.lastName}`,
    patient,
    xrayTypesLabels: XRAY_TYPES_LABELS,
    errors:          [],
  });
});

// ────────────────────────────────────────────────────────────
// POST /patients/:patientId/xrays — رفع أشعة جديدة
// يدعم رفع ملف واحد أو عدة ملفات دفعة واحدة
// ────────────────────────────────────────────────────────────
const upload = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId);

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  // التحقق من وجود ملفات مرفوعة
  if (!req.files || req.files.length === 0) {
    return res.render('xrays/upload', {
      title:           `رفع أشعة — ${patient.firstName} ${patient.lastName}`,
      patient,
      xrayTypesLabels: XRAY_TYPES_LABELS,
      errors:          ['لم يتم اختيار أي ملف للرفع'],
    });
  }

  const {
    xrayType,
    doctorNotes,
    relatedTeeth,
  } = req.body;

  // الأسنان المرتبطة بالأشعة
  const teethNumbers = relatedTeeth
    ? String(relatedTeeth).split(',')
        .map((t) => parseInt(t.trim()))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 32)
    : [];

  // بناء سجلات الأشعة من الملفات المرفوعة
  const newXrayRecords = req.files.map((file) => {
    const validation = validateUploadedFile(file);
    if (!validation.valid) return null;

    // بناء مسار URL للعرض في المتصفح
    const publicPath = buildPublicPath(file.path);

    return {
      filename:     file.filename,
      filepath:     publicPath,
      xrayType:     xrayType || 'other',
      relatedTeeth: teethNumbers,
      doctorNotes:  doctorNotes?.trim() || null,
      uploadedAt:   new Date(),
    };
  }).filter(Boolean);

  if (newXrayRecords.length === 0) {
    return res.render('xrays/upload', {
      title:           `رفع أشعة — ${patient.firstName} ${patient.lastName}`,
      patient,
      xrayTypesLabels: XRAY_TYPES_LABELS,
      errors:          ['فشل رفع الملفات، يرجى المحاولة مجدداً'],
    });
  }

  // إضافة الأشعة لمصفوفة المريض
  patient.xrays.push(...newXrayRecords);
  await patient.save();

  req.session.successMsg =
    `✅ تم رفع ${newXrayRecords.length} صورة أشعة بنجاح لـ ${patient.firstName} ${patient.lastName}`;
  res.redirect(`/patients/${patient._id}/xrays`);
});

// ────────────────────────────────────────────────────────────
// GET /patients/:patientId/xrays/:xrayId — عرض صورة أشعة
// ────────────────────────────────────────────────────────────
const show = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId)
    .select('firstName lastName patientCode xrays');

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  const xray = patient.xrays.id(req.params.xrayId);

  if (!xray) {
    req.session.errorMsg = 'صورة الأشعة غير موجودة';
    return res.redirect(`/patients/${patient._id}/xrays`);
  }

  // الأشعة السابقة والتالية للتنقل
  const xraysSorted = [...patient.xrays].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
  const currentIndex = xraysSorted.findIndex(
    (x) => x._id.toString() === xray._id.toString()
  );
  const prevXray = xraysSorted[currentIndex - 1] || null;
  const nextXray = xraysSorted[currentIndex + 1] || null;

  res.render('xrays/show', {
    title:           `أشعة — ${patient.firstName} ${patient.lastName}`,
    patient,
    xray,
    prevXray,
    nextXray,
    xrayTypesLabels: XRAY_TYPES_LABELS,
  });
});

// ────────────────────────────────────────────────────────────
// PATCH /patients/:patientId/xrays/:xrayId — تحديث ملاحظات
// ────────────────────────────────────────────────────────────
const updateNotes = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId);

  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود' });
  }

  const xray = patient.xrays.id(req.params.xrayId);
  if (!xray) {
    return res.status(404).json({ success: false, message: 'صورة الأشعة غير موجودة' });
  }

  const { doctorNotes, xrayType, relatedTeeth } = req.body;

  // تحديث البيانات
  if (doctorNotes   !== undefined) xray.doctorNotes = doctorNotes?.trim()  || null;
  if (xrayType)                    xray.xrayType    = xrayType;
  if (relatedTeeth  !== undefined) {
    xray.relatedTeeth = String(relatedTeeth)
      .split(',')
      .map((t) => parseInt(t.trim()))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 32);
  }

  xray.lastUpdated = new Date();
  await patient.save();

  res.json({
    success: true,
    message: 'تم تحديث ملاحظات الأشعة بنجاح',
    xray: {
      id:          xray._id,
      doctorNotes: xray.doctorNotes,
      xrayType:    xray.xrayType,
    },
  });
});

// ────────────────────────────────────────────────────────────
// DELETE /patients/:patientId/xrays/:xrayId — حذف أشعة
// ────────────────────────────────────────────────────────────
const destroy = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId);

  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود' });
  }

  const xray = patient.xrays.id(req.params.xrayId);
  if (!xray) {
    return res.status(404).json({ success: false, message: 'صورة الأشعة غير موجودة' });
  }

  // حذف الملف من القرص أولاً
  if (xray.filepath) {
    await deleteFileFromDisk(xray.filepath);
  }

  // حذف السجل من قاعدة البيانات
  xray.deleteOne();
  await patient.save();

  res.json({
    success: true,
    message: 'تم حذف صورة الأشعة بنجاح',
  });
});

// ────────────────────────────────────────────────────────────
// GET /patients/:patientId/xrays/compare — مقارنة أشعتين
// ────────────────────────────────────────────────────────────
const compare = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId)
    .select('firstName lastName patientCode xrays');

  if (!patient) {
    req.session.errorMsg = 'المريض غير موجود';
    return res.redirect('/patients');
  }

  const { xray1, xray2 } = req.query;

  const firstXray  = xray1 ? patient.xrays.id(xray1) : null;
  const secondXray = xray2 ? patient.xrays.id(xray2) : null;

  const allXrays = [...patient.xrays].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  res.render('xrays/compare', {
    title:           `مقارنة الأشعة — ${patient.firstName} ${patient.lastName}`,
    patient,
    allXrays,
    firstXray,
    secondXray,
    xrayTypesLabels: XRAY_TYPES_LABELS,
  });
});

module.exports = {
  index, uploadForm, upload, show,
  updateNotes, destroy, compare,
};
