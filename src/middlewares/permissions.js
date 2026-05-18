// ============================================================
// src/middlewares/permissions.js — صلاحيات الأدوار
// ============================================================
'use strict';

// ── تعريف صلاحيات كل دور ─────────────────────────────────────
const PERMISSIONS = {

  admin: {
    patients:        ['view','create','edit','delete'],
    appointments:    ['view','create','edit','delete'],
    invoices:        ['view','create','edit','delete'],
    treatmentPlans:  ['view','create','edit','delete'],
    xrays:           ['view','upload','delete'],
    settings:        ['view','manage'],
    treatments:      ['view','create','edit','delete'],
    users:           ['view','create','edit','delete'],
  },

  doctor: {
    patients:        ['view','create','edit'],
    appointments:    ['view','create','edit','delete'],
    invoices:        ['view','create','edit'],
    treatmentPlans:  ['view','create','edit','delete'],
    xrays:           ['view','upload','delete'],
    settings:        ['view'],
    treatments:      ['view'],
    users:           [],
  },

  receptionist: {
    patients:        ['view','create'],
    appointments:    ['view','create','edit'],
    invoices:        ['view','create'],
    treatmentPlans:  ['view'],
    xrays:           ['view'],
    settings:        ['view'],
    treatments:      ['view'],
    users:           [],
  },
};

// ── دالة التحقق من الصلاحية ──────────────────────────────────
const can = (user, resource, action) => {
  if (!user || !user.role) return false;
  const rolePerms = PERMISSIONS[user.role];
  if (!rolePerms) return false;
  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(action);
};

// ── Middleware: التحقق من صلاحية محددة ───────────────────────
const checkPermission = (resource, action) => (req, res, next) => {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  if (can(req.user, resource, action)) {
    return next();
  }

  // لا توجد صلاحية
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(403).json({
      success: false,
      message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
    });
  }

  return res.status(403).render('errors/403', {
    title:   '403 — غير مصرح',
    message: `ليس لديك صلاحية (${action}) على هذا القسم`,
  });
};

// ── إضافة دوال الصلاحيات لكل طلب (للقوالب) ──────────────────
const injectPermissions = (req, res, next) => {
  if (req.user) {
    // دالة can متاحة في كل قالب EJS
    res.locals.can = (resource, action) => can(req.user, resource, action);
    res.locals.userRole = req.user.role;
  } else {
    res.locals.can = () => false;
    res.locals.userRole = null;
  }
  next();
};

module.exports = { can, checkPermission, injectPermissions, PERMISSIONS };
