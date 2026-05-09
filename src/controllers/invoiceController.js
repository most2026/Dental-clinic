// ============================================================
// src/controllers/invoiceController.js — إدارة الفواتير
// ============================================================
'use strict';

const Invoice     = require('../models/Invoice');
const Patient     = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Treatment   = require('../models/Treatment');
const { asyncHandler, buildValidationMessage } = require('../middlewares/errorHandler');

const PAYMENT_METHODS = {
  cash:          'نقداً',
  card:          'بطاقة ائتمان',
  bank_transfer: 'تحويل بنكي',
  installment:   'تقسيط',
};

const STATUS_LABELS = {
  draft:     'مسودة',
  issued:    'صادرة',
  partial:   'جزئية',
  paid:      'مدفوعة',
  overdue:   'متأخرة',
  cancelled: 'ملغاة',
  refunded:  'مستردة',
};

// ────────────────────────────────────────────────────────────
// GET /invoices — قائمة الفواتير
// ────────────────────────────────────────────────────────────
const index = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 15;
  const skip  = (page - 1) * limit;

  const status   = req.query.status   || '';
  const dateFrom = req.query.dateFrom || '';
  const dateTo   = req.query.dateTo   || '';
  const search   = req.query.search?.trim() || '';

  const filter = {};
  if (status) filter.status = status;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23,59,59,999));
  }

  // البحث برقم الفاتورة
  if (search) filter.invoiceNumber = new RegExp(search, 'i');

  const [invoices, totalCount, summaryData] = await Promise.all([
    Invoice.find(filter)
      .populate('patient', 'firstName lastName patientCode phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
    // ملخص إجمالي للصفحة الحالية
    Invoice.aggregate([
      { $match: filter },
      { $group: {
        _id:           null,
        totalAmount:   { $sum: '$totalAmount' },
        totalPaid:     { $sum: '$paidAmount' },
        totalPending:  { $sum: '$remainingAmount' },
      }},
    ]),
  ]);

  const summary = summaryData[0] || { totalAmount: 0, totalPaid: 0, totalPending: 0 };

  res.render('invoices/index', {
    title:        'الفواتير',
    invoices,
    summary,
    statusLabels: STATUS_LABELS,
    pagination: {
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
      hasNext:     page < Math.ceil(totalCount / limit),
      hasPrev:     page > 1,
    },
    filters: { status, dateFrom, dateTo, search },
  });
});

// ────────────────────────────────────────────────────────────
// GET /invoices/new — نموذج فاتورة جديدة
// ────────────────────────────────────────────────────────────
const newForm = asyncHandler(async (req, res) => {
  let preselectedPatient     = null;
  let preselectedAppointment = null;

  if (req.query.patient) {
    preselectedPatient = await Patient.findById(req.query.patient)
      .select('firstName lastName patientCode phone');
  }

  if (req.query.appointment) {
    preselectedAppointment = await Appointment.findById(req.query.appointment)
      .populate('patient', 'firstName lastName patientCode phone')
      .select('appointmentDate startTime treatmentType patient');

    if (preselectedAppointment && !preselectedPatient) {
      preselectedPatient = preselectedAppointment.patient;
    }
  }

  // كتالوج العلاجات
  const treatments = await Treatment.find({ isActive: true })
    .select('nameAr code defaultPrice defaultDuration category')
    .sort('category nameAr');

  res.render('invoices/new', {
    title:                  'فاتورة جديدة',
    invoice:                {},
    preselectedPatient,
    preselectedAppointment,
    treatments,
    paymentMethods:         PAYMENT_METHODS,
    errors:                 [],
  });
});

// ────────────────────────────────────────────────────────────
// POST /invoices — حفظ فاتورة جديدة
// ────────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
  const {
    patientId, appointmentId,
    globalDiscount, taxRate, notes, dueDate,
    // بنود الفاتورة — تأتي كمصفوفات
    itemDescription, itemQuantity, itemUnitPrice,
    itemDiscount, itemRelatedTeeth,
    // الدفعة الأولى (اختياري)
    initialPaymentAmount, initialPaymentMethod, initialPaymentNote,
  } = req.body;

  try {
    const patient = await Patient.findById(patientId);
    if (!patient) throw new Error('المريض المحدد غير موجود');

    // بناء مصفوفة البنود
    const descriptions = Array.isArray(itemDescription) ? itemDescription : [itemDescription];
    const quantities   = Array.isArray(itemQuantity)    ? itemQuantity    : [itemQuantity];
    const prices       = Array.isArray(itemUnitPrice)   ? itemUnitPrice   : [itemUnitPrice];
    const discounts    = Array.isArray(itemDiscount)    ? itemDiscount    : [itemDiscount];
    const teethArr     = Array.isArray(itemRelatedTeeth)? itemRelatedTeeth: [itemRelatedTeeth];

    const items = descriptions.map((desc, i) => ({
      description:  desc?.trim(),
      quantity:     parseInt(quantities[i])   || 1,
      unitPrice:    parseFloat(prices[i])     || 0,
      discount:     parseFloat(discounts[i])  || 0,
      relatedTeeth: parseTeeth(teethArr[i]),
    })).filter(item => item.description && item.unitPrice > 0);

    if (items.length === 0) throw new Error('يجب إضافة بند واحد على الأقل للفاتورة');

    // بناء الدفعات الأولية
    const payments = [];
    const initAmt  = parseFloat(initialPaymentAmount);
    if (initAmt > 0) {
      payments.push({
        amount:        initAmt,
        paymentMethod: initialPaymentMethod || 'cash',
        note:          initialPaymentNote?.trim() || null,
        paidAt:        new Date(),
      });
    }

    const invoice = await Invoice.create({
      patient:        patientId,
      appointment:    appointmentId || null,
      items,
      globalDiscount: parseFloat(globalDiscount) || 0,
      taxRate:        parseFloat(taxRate)         || 0,
      notes:          notes?.trim()               || null,
      dueDate:        dueDate ? new Date(dueDate) : undefined,
      payments,
      status:         'draft',
    });

    // ربط الفاتورة بالموعد إن وُجد
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, { invoice: invoice._id });
    }

    req.session.successMsg = `✅ تم إنشاء الفاتورة ${invoice.invoiceNumber} بنجاح`;
    res.redirect(`/invoices/${invoice._id}`);

  } catch (error) {
    const treatments = await Treatment.find({ isActive: true })
      .select('nameAr code defaultPrice defaultDuration category').sort('category nameAr');

    let preselectedPatient = null;
    if (patientId) {
      preselectedPatient = await Patient.findById(patientId)
        .select('firstName lastName patientCode phone').catch(() => null);
    }

    res.render('invoices/new', {
      title:                  'فاتورة جديدة',
      invoice:                req.body,
      preselectedPatient,
      preselectedAppointment: null,
      treatments,
      paymentMethods:         PAYMENT_METHODS,
      errors:                 [buildValidationMessage(error)],
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /invoices/:id — تفاصيل الفاتورة
// ────────────────────────────────────────────────────────────
const show = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patient',     'firstName lastName patientCode phone address')
    .populate('appointment', 'appointmentDate startTime treatmentType')
    .populate('items.treatment', 'nameAr code');

  if (!invoice) {
    req.session.errorMsg = 'الفاتورة غير موجودة';
    return res.redirect('/invoices');
  }

  res.render('invoices/show', {
    title:          `فاتورة ${invoice.invoiceNumber}`,
    invoice,
    statusLabels:   STATUS_LABELS,
    paymentMethods: PAYMENT_METHODS,
  });
});

// ────────────────────────────────────────────────────────────
// POST /invoices/:id/payment — إضافة دفعة جديدة
// ────────────────────────────────────────────────────────────
const addPayment = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName');

  if (!invoice) {
    return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
  }

  const { amount, paymentMethod, note } = req.body;
  const payAmt = parseFloat(amount);

  if (!payAmt || payAmt <= 0) {
    return res.status(400).json({ success: false, message: 'مبلغ الدفعة يجب أن يكون أكبر من صفر' });
  }

  if (payAmt > invoice.remainingAmount + 0.01) {
    return res.status(400).json({
      success: false,
      message: `المبلغ المدخل (${payAmt}) أكبر من المتبقي (${invoice.remainingAmount.toFixed(0)})`,
    });
  }

  invoice.payments.push({
    amount:        payAmt,
    paymentMethod: paymentMethod || 'cash',
    note:          note?.trim() || null,
    paidAt:        new Date(),
  });

  await invoice.save(); // الـ pre-save hook يحسب الإجماليات تلقائياً

  res.json({
    success:         true,
    message:         `تم تسجيل الدفعة بمبلغ ${payAmt.toLocaleString('ar-IQ')} بنجاح`,
    newStatus:       invoice.status,
    statusLabel:     STATUS_LABELS[invoice.status],
    paidAmount:      invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    paymentProgress: invoice.paymentProgress,
  });
});

// ────────────────────────────────────────────────────────────
// PATCH /invoices/:id/status — تحديث حالة الفاتورة
// ────────────────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!Object.keys(STATUS_LABELS).includes(status)) {
    return res.status(400).json({ success: false, message: 'حالة غير صالحة' });
  }

  const invoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

  res.json({ success: true, newStatus: status, statusLabel: STATUS_LABELS[status] });
});

// ────────────────────────────────────────────────────────────
// DELETE /invoices/:id — إلغاء الفاتورة
// ────────────────────────────────────────────────────────────
const destroy = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

  if (invoice.status === 'paid') {
    return res.status(400).json({ success: false, message: 'لا يمكن إلغاء فاتورة مدفوعة بالكامل' });
  }

  invoice.status = 'cancelled';
  await invoice.save();

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, message: 'تم إلغاء الفاتورة' });
  }

  req.session.successMsg = 'تم إلغاء الفاتورة بنجاح';
  res.redirect('/invoices');
});

// ────────────────────────────────────────────────────────────
// GET /invoices/:id/print — طباعة الفاتورة
// ────────────────────────────────────────────────────────────
const print = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName patientCode phone address')
    .populate('appointment', 'appointmentDate treatmentType')
    .populate('items.treatment', 'nameAr');

  if (!invoice) {
    req.session.errorMsg = 'الفاتورة غير موجودة';
    return res.redirect('/invoices');
  }

  res.render('invoices/print', {
    title:          `طباعة — ${invoice.invoiceNumber}`,
    invoice,
    statusLabels:   STATUS_LABELS,
    paymentMethods: PAYMENT_METHODS,
  });
});

// ────────────────────────────────────────────────────────────
// GET /invoices/summary — ملخص مالي (AJAX)
// ────────────────────────────────────────────────────────────
const getSummary = asyncHandler(async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  const [monthlyData, yearlyData, statusDist] = await Promise.all([
    Invoice.getMonthlyRevenue(year, month),
    // إيرادات كل شهر في السنة
    Invoice.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31, 23, 59, 59),
          },
          status: { $in: ['paid', 'partial'] },
        },
      },
      {
        $group: {
          _id:     { $month: '$createdAt' },
          revenue: { $sum: '$paidAmount' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // توزيع الحالات
    Invoice.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
    ]),
  ]);

  res.json({
    success:    true,
    monthly:    monthlyData[0] || { totalRevenue: 0, invoiceCount: 0 },
    yearlyData,
    statusDist,
  });
});

// ── دوال مساعدة ────────────────────────────────────────────
const parseTeeth = (str) => {
  if (!str) return [];
  return String(str).split(',').map(t => parseInt(t.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 32);
};

module.exports = {
  index, newForm, create, show,
  addPayment, updateStatus, destroy, print, getSummary,
};
