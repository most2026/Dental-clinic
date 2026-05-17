// ============================================================
// src/controllers/treatmentController.js
// ============================================================
'use strict';

const Treatment = require('../models/Treatment');
const { asyncHandler, buildValidationMessage } = require('../middlewares/errorHandler');

const CATEGORY_LABELS = {
  preventive:    'وقائي',
  restorative:   'ترميمي',
  endodontic:    'علاج جذور',
  surgical:      'جراحي',
  prosthodontic: 'تعويضي',
  orthodontic:   'تقويمي',
  cosmetic:      'تجميلي',
  diagnostic:    'تشخيصي',
  other:         'أخرى',
};

// GET /treatments
const index = asyncHandler(async (req, res) => {
  const search   = req.query.search?.trim() || '';
  const category = req.query.category       || '';
  const filter   = {};

  if (search)   filter.$or = [
    { nameAr: new RegExp(search, 'i') },
    { nameEn: new RegExp(search, 'i') },
    { code:   new RegExp(search, 'i') },
  ];
  if (category) filter.category = category;

  const treatments = await Treatment.find(filter).sort({ category: 1, nameAr: 1 });

  // تجميع حسب التصنيف
  const grouped = treatments.reduce((acc, t) => {
    const cat = t.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  res.render('treatments/index', {
    title:          'كتالوج العلاجات',
    treatments,
    grouped,
    categoryLabels: CATEGORY_LABELS,
    filters:        { search, category },
    totalCount:     treatments.length,
  });
});

// GET /treatments/new
const newForm = (req, res) => {
  res.render('treatments/new', {
    title:          'إضافة علاج جديد',
    treatment:      {},
    categoryLabels: CATEGORY_LABELS,
    errors:         [],
  });
};

// POST /treatments
const create = asyncHandler(async (req, res) => {
  const {
    nameAr, nameEn, code, category,
    defaultPrice, currency, defaultDuration, description,
  } = req.body;

  try {
    const treatment = await Treatment.create({
      nameAr:          nameAr?.trim(),
      nameEn:          nameEn?.trim()      || null,
      code:            code?.trim().toUpperCase(),
      category,
      defaultPrice:    parseFloat(defaultPrice)    || 0,
      currency:        currency                    || 'IQD',
      defaultDuration: parseInt(defaultDuration)   || 30,
      description:     description?.trim()         || null,
      isActive:        true,
    });

    req.session.successMsg = `✅ تم إضافة العلاج "${treatment.nameAr}" بنجاح`;
    res.redirect('/treatments');

  } catch (error) {
    res.render('treatments/new', {
      title:          'إضافة علاج جديد',
      treatment:      req.body,
      categoryLabels: CATEGORY_LABELS,
      errors:         [buildValidationMessage(error)],
    });
  }
});

// GET /treatments/:id/edit
const editForm = asyncHandler(async (req, res) => {
  const treatment = await Treatment.findById(req.params.id);
  if (!treatment) {
    req.session.errorMsg = 'العلاج غير موجود';
    return res.redirect('/treatments');
  }
  res.render('treatments/edit', {
    title:          `تعديل — ${treatment.nameAr}`,
    treatment,
    categoryLabels: CATEGORY_LABELS,
    errors:         [],
  });
});

// PUT /treatments/:id
const update = asyncHandler(async (req, res) => {
  const treatment = await Treatment.findById(req.params.id);
  if (!treatment) {
    req.session.errorMsg = 'العلاج غير موجود';
    return res.redirect('/treatments');
  }

  const {
    nameAr, nameEn, code, category,
    defaultPrice, currency, defaultDuration, description, isActive,
  } = req.body;

  try {
    treatment.nameAr          = nameAr?.trim();
    treatment.nameEn          = nameEn?.trim()    || null;
    treatment.code            = code?.trim().toUpperCase();
    treatment.category        = category;
    treatment.defaultPrice    = parseFloat(defaultPrice)  || 0;
    treatment.currency        = currency || 'IQD';
    treatment.defaultDuration = parseInt(defaultDuration) || 30;
    treatment.description     = description?.trim()       || null;
    treatment.isActive        = isActive === 'on' || isActive === 'true';

    await treatment.save();

    req.session.successMsg = `✅ تم تحديث العلاج "${treatment.nameAr}"`;
    res.redirect('/treatments');

  } catch (error) {
    res.render('treatments/edit', {
      title:          `تعديل — ${treatment.nameAr}`,
      treatment:      { ...treatment.toObject(), ...req.body },
      categoryLabels: CATEGORY_LABELS,
      errors:         [buildValidationMessage(error)],
    });
  }
});

// DELETE /treatments/:id
const destroy = asyncHandler(async (req, res) => {
  const treatment = await Treatment.findById(req.params.id);
  if (!treatment) {
    return res.status(404).json({ success: false, message: 'العلاج غير موجود' });
  }

  // تعطيل بدلاً من الحذف
  treatment.isActive = false;
  await treatment.save();

  res.json({ success: true, message: `تم تعطيل العلاج "${treatment.nameAr}"` });
});

// PATCH /treatments/:id/toggle
const toggle = asyncHandler(async (req, res) => {
  const treatment = await Treatment.findById(req.params.id);
  if (!treatment) {
    return res.status(404).json({ success: false, message: 'العلاج غير موجود' });
  }

  treatment.isActive = !treatment.isActive;
  await treatment.save();

  res.json({
    success:  true,
    isActive: treatment.isActive,
    message:  `تم ${treatment.isActive ? 'تفعيل' : 'تعطيل'} العلاج`,
  });
});

module.exports = { index, newForm, create, editForm, update, destroy, toggle };
