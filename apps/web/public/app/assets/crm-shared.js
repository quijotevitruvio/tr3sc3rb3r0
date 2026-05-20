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

  return { api, money, relativeDate, shortDate, openModal, closeModal, showError, hideError };
})();
