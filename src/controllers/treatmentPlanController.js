// ============================================================
// src/controllers/treatmentPlanController.js
// ============================================================
'use strict';

const TreatmentPlan = require('../models/TreatmentPlan');
const Patient       = require('../models/Patient');
const path          = require('path');
const fs            = require('fs');
const multer        = require('multer');
const { asyncHandler, buildValidationMessage } = require('../middlewares/errorHandler');

// ── ثوابت ────────────────────────────────────────────────────
const CATEGORY_LABELS = {
  orthodontic: 'تقويم أسنان',
  implant:     'زراعة أسنان',
  root_canal:  'علاج عصب',
  cosmetic:    'تجميل أسنان',
  surgery:     'جراحة فم',
  other:       'أخرى',
};

const ORTHODONTIC_LABELS = {
  metal:         'تقويم معدني',
  ceramic:       'تقويم خزفي',
  clear_aligner: 'تقويم شفاف (Aligners)',
  lingual:       'تقويم لساني',
  retainer:      'مثبّت (Retainer)',
  functional:    'أجهزة وظيفية',
};

const STATUS_LABELS = {
  planning:   'تخطيط',
  active:     'جاري',
  paused:     'موقوف',
  completed:  'مكتمل',
  cancelled:  'ملغى',
};

const WIRE_LABELS = {
  round_niti:        'دائري NiTi',
  round_ss:          'دائري Steel',
  rectangular_niti:  'مستطيل NiTi',
  rectangular_ss:    'مستطيل Steel',
  copper_niti:       'نحاسي NiTi',
  beta_titanium:     'بيتا تيتانيوم',
  other:             'أخرى',
};

const ANGLE_LABELS = {
  front:  'أمامي',
  left:   'جانبي أيسر',
  right:  'جانبي أيمن',
  upper:  'علوي',
  lower:  'سفلي',
  smile:  'ابتسامة',
  xray:   'أشعة',
  other:  'أخرى',
};

// ── إعداد رفع صور المراحل ────────────────────────────────────
const stagePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const planId   = req.params.id || 'general';
    const dir      = path.join(__dirname, '../../public/uploads/treatment-plans', planId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `stage_${Date.now()}_${Math.round(Math.random() * 1e5)}${ext}`);
  },
});

const uploadStagePhotos = multer({
  storage:    stagePhotoStorage,
  limits:     { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('صور فقط (JPG, PNG, WEBP)'), false);
    }
  },
}).array('stagePhotos', 6);

// ────────────────────────────────────────────────────────────
// GET /treatment-plans — جميع الخطط
// ────────────────────────────────────────────────────────────
const index = asyncHandler(async (req, res) => {
  const status   = req.query.status   || '';
  const category = req.query.category || '';
  const search   = req.query.search?.trim() || '';

  const filter = {};
  if (status)   filter.status   = status;
  if (category) filter.category = category;

  let plans = await TreatmentPlan.find(filter)
    .populate('patient', 'firstName lastName patientCode phone')
    .sort({ createdAt: -1 });

  // فلتر بحث بالاسم
  if (search) {
    const regex = new RegExp(search, 'i');
    plans = plans.filter(p =>
      regex.test(p.patient?.firstName) ||
      regex.test(p.patient?.lastName)  ||
      regex.test(p.patient?.patientCode) ||
      regex.test(p.title)
    );
  }

  // إحصائيات
  const stats = {
    total:     plans.length,
    active:    plans.filter(p => p.status === 'active').length,
    completed: plans.filter(p => p.status === 'completed').length,
    orthodontic: plans.filter(p => p.category === 'orthodontic').length,
  };

  res.render('treatment-plans/index', {
    title:             'خطط العلاج والتقويم',
    plans,
    stats,
    categoryLabels:    CATEGORY_LABELS,
    orthodonticLabels: ORTHODONTIC_LABELS,
    statusLabels:      STATUS_LABELS,
    filters:           { status, category, search },
  });
});

// ────────────────────────────────────────────────────────────
// GET /treatment-plans/new
// ────────────────────────────────────────────────────────────
const newForm = asyncHandler(async (req, res) => {
  let preselectedPatient = null;
  if (req.query.patient) {
    preselectedPatient = await Patient.findById(req.query.patient)
      .select('firstName lastName patientCode phone');
  }

  res.render('treatment-plans/new', {
    title:             'خطة علاج جديدة',
    plan:              {},
    preselectedPatient,
    categoryLabels:    CATEGORY_LABELS,
    orthodonticLabels: ORTHODONTIC_LABELS,
    errors:            [],
  });
});

// ────────────────────────────────────────────────────────────
// POST /treatment-plans — إنشاء خطة
// ────────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
  const {
    patientId, title, category, orthodonticType,
    startDate, estimatedEndDate, totalCost, currency,
    totalAlignersTrays, alignerBrand,
    bracketSystem, bracketBrand,
    treatmentGoals, generalNotes,
  } = req.body;

  try {
    const patient = await Patient.findById(patientId);
    if (!patient) throw new Error('المريض المحدد غير موجود');

    const plan = await TreatmentPlan.create({
      patient:          patientId,
      createdBy:        req.user?._id || null,
      title:            title?.trim(),
      category,
      orthodonticType:  orthodonticType || null,
      startDate:        new Date(startDate),
      estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
      totalCost:        parseFloat(totalCost) || 0,
      currency:         currency || 'IQD',
      totalAlignersTrays: totalAlignersTrays ? parseInt(totalAlignersTrays) : null,
      alignerBrand:     alignerBrand || null,
      bracketSystem:    bracketSystem?.trim() || null,
      bracketBrand:     bracketBrand?.trim()  || null,
      treatmentGoals:   treatmentGoals?.trim() || null,
      generalNotes:     generalNotes?.trim()   || null,
      status:           'active',
    });

    req.session.successMsg = `✅ تم إنشاء خطة العلاج "${plan.title}" بنجاح`;
    res.redirect(`/treatment-plans/${plan._id}`);

  } catch (error) {
    let preselectedPatient = null;
    if (patientId) {
      preselectedPatient = await Patient.findById(patientId)
        .select('firstName lastName patientCode phone').catch(() => null);
    }
    res.render('treatment-plans/new', {
      title:             'خطة علاج جديدة',
      plan:              req.body,
      preselectedPatient,
      categoryLabels:    CATEGORY_LABELS,
      orthodonticLabels: ORTHODONTIC_LABELS,
      errors:            [buildValidationMessage(error)],
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /treatment-plans/:id — تفاصيل الخطة
// ────────────────────────────────────────────────────────────
const show = asyncHandler(async (req, res) => {
  const plan = await TreatmentPlan.findById(req.params.id)
    .populate('patient',   'firstName lastName patientCode phone dateOfBirth gender')
    .populate('createdBy', 'name role');

  if (!plan) {
    req.session.errorMsg = 'خطة العلاج غير موجودة';
    return res.redirect('/treatment-plans');
  }

  // ترتيب المراحل حسب الرقم
  plan.stages.sort((a, b) => a.stageNumber - b.stageNumber);

  res.render('treatment-plans/show', {
    title:             `${plan.title} — متابعة العلاج`,
    plan,
    categoryLabels:    CATEGORY_LABELS,
    orthodonticLabels: ORTHODONTIC_LABELS,
    statusLabels:      STATUS_LABELS,
    wireLabels:        WIRE_LABELS,
    angleLabels:       ANGLE_LABELS,
  });
});

// ────────────────────────────────────────────────────────────
// GET /treatment-plans/:id/stages/add — نموذج إضافة مرحلة
// ────────────────────────────────────────────────────────────
const addStageForm = asyncHandler(async (req, res) => {
  const plan = await TreatmentPlan.findById(req.params.id)
    .populate('patient', 'firstName lastName patientCode');

  if (!plan) {
    req.session.errorMsg = 'خطة العلاج غير موجودة';
    return res.redirect('/treatment-plans');
  }

  const nextNumber = plan.stages.length + 1;

  res.render('treatment-plans/add-stage', {
    title:             `إضافة مرحلة ${nextNumber} — ${plan.title}`,
    plan,
    nextNumber,
    wireLabels:        WIRE_LABELS,
    angleLabels:       ANGLE_LABELS,
    errors:            [],
  });
});

// ────────────────────────────────────────────────────────────
// POST /treatment-plans/:id/stages — حفظ مرحلة جديدة
// ────────────────────────────────────────────────────────────
const addStage = asyncHandler(async (req, res) => {
  // رفع الصور أولاً
  await new Promise((resolve, reject) => {
    uploadStagePhotos(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const plan = await TreatmentPlan.findById(req.params.id);
  if (!plan) {
    req.session.errorMsg = 'خطة العلاج غير موجودة';
    return res.redirect('/treatment-plans');
  }

  const {
    visitDate, nextVisitDate,
    alignerTrayStart, alignerTrayEnd, wearingHours,
    wireType, wireSize, bracketAdjustment,
    procedures, painLevel, compliance, toothMovement,
    doctorNotes, patientFeedback,
    photoAngles, photoNotes,
  } = req.body;

  // بناء الصور
  const photos = (req.files || []).map((file, i) => {
    const publicPath = file.path
      .substring(file.path.indexOf('public') + 'public'.length)
      .replace(/\\/g, '/');

    const angleArr = Array.isArray(photoAngles) ? photoAngles : [photoAngles];
    const noteArr  = Array.isArray(photoNotes)  ? photoNotes  : [photoNotes];

    return {
      filepath: publicPath,
      filename: file.filename,
      angle:    angleArr[i] || 'front',
      note:     noteArr[i]?.trim() || null,
    };
  });

  // معالجة الإجراءات
  const proceduresArr = Array.isArray(procedures)
    ? procedures.filter(Boolean)
    : procedures ? [procedures] : [];

  const newStage = {
    stageNumber:       plan.stages.length + 1,
    visitDate:         new Date(visitDate),
    nextVisitDate:     nextVisitDate ? new Date(nextVisitDate) : null,
    alignerTrayStart:  alignerTrayStart ? parseInt(alignerTrayStart) : null,
    alignerTrayEnd:    alignerTrayEnd   ? parseInt(alignerTrayEnd)   : null,
    wearingHours:      wearingHours     ? parseInt(wearingHours)     : null,
    wireType:          wireType         || null,
    wireSize:          wireSize?.trim() || null,
    bracketAdjustment: bracketAdjustment?.trim() || null,
    procedures:        proceduresArr,
    painLevel:         parseInt(painLevel)  || 0,
    compliance:        parseInt(compliance) || 100,
    toothMovement:     toothMovement?.trim() || null,
    photos,
    doctorNotes:       doctorNotes?.trim()     || null,
    patientFeedback:   patientFeedback?.trim() || null,
    isCompleted:       true,
    completedAt:       new Date(),
  };

  plan.stages.push(newStage);

  // تحديث الطقم الحالي للتقويم الشفاف
  if (plan.category === 'orthodontic' &&
      plan.orthodonticType === 'clear_aligner' &&
      alignerTrayEnd) {
    plan.currentAlignerTray = parseInt(alignerTrayEnd);
  }

  // تحديث حالة الخطة
  if (plan.status === 'planning') plan.status = 'active';

  await plan.save();

  req.session.successMsg = `✅ تمت إضافة المرحلة ${newStage.stageNumber} بنجاح`;
  res.redirect(`/treatment-plans/${plan._id}`);
});

// ────────────────────────────────────────────────────────────
// PATCH /treatment-plans/:id/status — تحديث الحالة
// ────────────────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const plan = await TreatmentPlan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({ success: false, message: 'الخطة غير موجودة' });
  }

  plan.status = status;
  if (status === 'completed') {
    plan.actualEndDate = new Date();
  }

  await plan.save();

  res.json({
    success:     true,
    newStatus:   status,
    statusLabel: STATUS_LABELS[status],
    message:     `تم تحديث حالة الخطة إلى "${STATUS_LABELS[status]}"`,
  });
});

// ────────────────────────────────────────────────────────────
// DELETE /treatment-plans/:id/stages/:stageId — حذف مرحلة
// ────────────────────────────────────────────────────────────
const deleteStage = asyncHandler(async (req, res) => {
  const plan = await TreatmentPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, message: 'الخطة غير موجودة' });

  const stage = plan.stages.id(req.params.stageId);
  if (!stage) return res.status(404).json({ success: false, message: 'المرحلة غير موجودة' });

  // حذف صور المرحلة من القرص
  for (const photo of stage.photos) {
    const fullPath = path.join(__dirname, '../../public', photo.filepath);
    fs.unlink(fullPath, () => {});
  }

  stage.deleteOne();

  // إعادة ترقيم المراحل
  plan.stages.sort((a, b) => a.stageNumber - b.stageNumber);
  plan.stages.forEach((s, i) => { s.stageNumber = i + 1; });

  await plan.save();

  res.json({ success: true, message: 'تم حذف المرحلة بنجاح' });
});

// ────────────────────────────────────────────────────────────
// GET /treatment-plans/:id/compare — مقارنة قبل/بعد
// ────────────────────────────────────────────────────────────
const compare = asyncHandler(async (req, res) => {
  const plan = await TreatmentPlan.findById(req.params.id)
    .populate('patient', 'firstName lastName patientCode');

  if (!plan) {
    req.session.errorMsg = 'خطة العلاج غير موجودة';
    return res.redirect('/treatment-plans');
  }

  // فقط المراحل التي تحتوي على صور
  const stagesWithPhotos = plan.stages
    .filter(s => s.photos && s.photos.length > 0)
    .sort((a, b) => a.stageNumber - b.stageNumber);

  // المرحلة الأولى كـ "قبل" والأخيرة كـ "بعد" افتراضياً
  const beforeId = req.query.before || stagesWithPhotos[0]?._id?.toString();
  const afterId  = req.query.after  || stagesWithPhotos[stagesWithPhotos.length - 1]?._id?.toString();

  const beforeStage = plan.stages.id(beforeId) || null;
  const afterStage  = plan.stages.id(afterId)  || null;

  res.render('treatment-plans/compare', {
    title:          `مقارنة قبل/بعد — ${plan.title}`,
    plan,
    stagesWithPhotos,
    beforeStage,
    afterStage,
    beforeId,
    afterId,
    angleLabels:    ANGLE_LABELS,
    orthodonticLabels: ORTHODONTIC_LABELS,
  });
});
module.exports = {
  index, newForm, create, show,
  addStageForm, addStage,
  updateStatus, deleteStage,
  CATEGORY_LABELS, ORTHODONTIC_LABELS, STATUS_LABELS, compare,
};
