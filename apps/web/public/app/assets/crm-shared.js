// Helpers compartidos por todas las pantallas del CRM.

window.crm = (function () {
  async function api(path, opts = {}) {
    const r = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) {
      const err = new Error(data?.error?.message || `HTTP ${r.status}`);
      err.code = data?.error?.code;
      err.status = r.status;
      err.details = data?.error;
      throw err;
    }
    return data;
  }

  const fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  function money(amount, currency = 'COP') {
    const n = Number(amount) || 0;
    if (currency === 'COP') return fmtCOP.format(n);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency }).format(n);
  }

  function relativeDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'hace segundos';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function shortDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Modal genérico: abre/cierra un <dialog> por id.
  function openModal(id) {
    const dlg = document.getElementById(id);
    if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
  }
  function closeModal(id) {
    const dlg = document.getElementById(id);
    if (dlg && typeof dlg.close === 'function') dlg.close();
  }

  // Render simple de error en un <div data-err>
  function showError(host, msg) {
    if (!host) return;
    host.textContent = msg;
    host.hidden = false;
  }
  function hideError(host) {
    if (!host) return;
    host.textContent = '';
    host.hidden = true;
  }

  // ─── Toast notifications (reemplazo de alert/console) ─────────
  function getToastHost() {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, opts = {}) {
    const { type = 'info', title = '', timeout = 4000 } = opts;
    const host = getToastHost();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '⚠' : 'ℹ';
    el.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-body">
        ${title ? `<div class="toast-title">${escapeHtmlLocal(title)}</div>` : ''}
        <div class="toast-msg">${escapeHtmlLocal(message)}</div>
      </div>
    `;
    el.addEventListener('click', () => dismiss());
    host.appendChild(el);
    const t = setTimeout(dismiss, timeout);
    function dismiss() {
      clearTimeout(t);
      el.classList.add('exit');
      setTimeout(() => el.remove(), 220);
    }
    return dismiss;
  }
  function escapeHtmlLocal(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ─── Counter animation (KPIs) ──────────────────────────────────
  // Anima el textContent de un elemento desde 0 hasta target en ~600ms.
  // Respeta prefers-reduced-motion saltando directo al valor final.
  function animateCounter(el, target, opts = {}) {
    if (!el) return;
    const { duration = 700, formatter = (n) => String(Math.round(n)) } = opts;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || isNaN(Number(target))) {
      el.textContent = formatter(Number(target));
      return;
    }
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / duration);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = formatter(Number(target) * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── Skeleton helper ──────────────────────────────────────────
  // Reemplaza el innerHTML de un host con N filas de skeleton mientras carga.
  function showSkeleton(host, rows = 3) {
    if (!host) return;
    host.innerHTML = Array.from({ length: rows }).map((_, i) => {
      const widths = ['w90', 'w75', 'w50'];
      return `<div class="skeleton skeleton-text ${widths[i % 3]}"></div>`;
    }).join('');
  }

  return {
    api, money, relativeDate, shortDate,
    openModal, closeModal, showError, hideError,
    toast, animateCounter, showSkeleton,
  };
})();
