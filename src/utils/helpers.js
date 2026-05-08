// ============================================================
// src/utils/helpers.js — دوال مساعدة مشتركة
// ============================================================

'use strict';

/**
 * تنسيق التاريخ للعرض بالعربي
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
const formatDate = (date, locale = 'ar-IQ') => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * تنسيق المبلغ المالي
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
const formatCurrency = (amount, currency = 'IQD') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * توليد slug آمن من نص عربي/إنجليزي
 * @param {string} text
 * @returns {string}
 */
const generateSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * التحقق من صحة رقم الهاتف العراقي
 * @param {string} phone
 * @returns {boolean}
 */
const isValidIraqiPhone = (phone) =>
  /^(07[3-9]\d{8}|(\+964|0964)7[3-9]\d{8})$/.test(phone.replace(/\s/g, ''));

module.exports = {
  formatDate,
  formatCurrency,
  generateSlug,
  isValidIraqiPhone,
};
