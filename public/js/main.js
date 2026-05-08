// ============================================================
// public/js/main.js — JavaScript الرئيسي للواجهة الأمامية
// ============================================================

'use strict';

/* ============================================================
   تشغيل الكود بعد تحميل الصفحة كاملاً
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  // ── 1. Toggle الشريط الجانبي (موبايل) ──────────────────
  const sidebarToggle  = document.getElementById('sidebarToggle');
  const appSidebar     = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    appSidebar?.classList.add('show');
    sidebarOverlay?.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    appSidebar?.classList.remove('show');
    sidebarOverlay?.classList.remove('show');
    document.body.style.overflow = '';
  }

  sidebarToggle?.addEventListener('click', () => {
    appSidebar?.classList.contains('show') ? closeSidebar() : openSidebar();
  });

  // إغلاق الـ Sidebar عند الضغط على الـ Overlay
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // إغلاق الـ Sidebar عند تغيير حجم الشاشة للكبير
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 992) closeSidebar();
  });

  // ── 2. عرض التاريخ الحالي بالعربي ──────────────────────
  const dateDisplay = document.getElementById('currentDateDisplay');
  if (dateDisplay) {
    const now = new Date();
    const options = {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    };
    dateDisplay.textContent = now.toLocaleDateString('ar-IQ', options);
  }

  // ── 3. إغلاق رسائل الـ Flash تلقائياً بعد 5 ثواني ──────
  const flashAlerts = document.querySelectorAll('.flash-alert');
  flashAlerts.forEach((alert) => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      bsAlert?.close();
    }, 5000);
  });

  // ── 4. البحث السريع العالمي ─────────────────────────────
  const globalSearch = document.getElementById('globalSearch');
  let searchTimeout  = null;

  globalSearch?.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();

    if (query.length < 2) return;

    // تأخير 500ms قبل الإرسال (Debounce)
    searchTimeout = setTimeout(() => {
      // سيتم تفعيله بالكامل في الخطوة 5
      console.log('🔍 بحث عن:', query);
    }, 500);
  });

  // ── 5. تأكيد عمليات الحذف ───────────────────────────────
  // أضف data-confirm="رسالة التأكيد" لأي زر حذف
  document.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      const msg = this.dataset.confirm || 'هل أنت متأكد من تنفيذ هذه العملية؟';
      if (!confirm(msg)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  });

  // ── 6. إظهار مؤشر التحميل عند إرسال الفورم ─────────────
  document.querySelectorAll('form[data-loading]').forEach((form) => {
    form.addEventListener('submit', function () {
      const btn = this.querySelector('[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          جاري الحفظ...
        `;
      }
    });
  });

  // ── 7. Tooltip لـ Bootstrap ──────────────────────────────
  const tooltipTriggers = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggers.forEach((el) => new bootstrap.Tooltip(el));

  console.log('✅ Dental Clinic ERP — الواجهة جاهزة');
});

/* ============================================================
   دوال مساعدة عامة (Global Helpers)
   ============================================================ */

/**
 * تنسيق الأرقام بالعربي
 * @param {number} num
 * @returns {string}
 */
window.formatNumber = (num) =>
  new Intl.NumberFormat('ar-IQ').format(num);

/**
 * تنسيق التاريخ للعرض
 * @param {string|Date} date
 * @returns {string}
 */
window.formatDate = (date) =>
  new Date(date).toLocaleDateString('ar-IQ', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

/**
 * إرسال طلب DELETE عبر Fetch API
 * @param {string} url
 * @param {string} confirmMsg
 */
window.deleteRecord = async (url, confirmMsg = 'هل أنت متأكد من الحذف؟') => {
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json();
      alert('❌ ' + (data.message || 'حدث خطأ أثناء الحذف'));
    }
  } catch (err) {
    alert('❌ خطأ في الاتصال بالسيرفر');
    console.error(err);
  }
};
