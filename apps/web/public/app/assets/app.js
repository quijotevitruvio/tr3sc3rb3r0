// Tr3sC3rb3r0 app — auth + dashboard client. Vanilla, sin frameworks.
// Hablamos con api.trescerbero.com (configurable vía meta tag o window.__API_URL__).

// Same-origin: en dev el Express del web proxiéa /api/* a localhost:3001 (ver server/index.js).
// En prod cada app tiene su propio dominio y el frontend apunta directo a api.trescerbero.com.
const API_BASE = window.__API_URL__ || (
  location.hostname === 'localhost' || location.hostname.endsWith('.localhost')
    ? '' // mismo origen via proxy del web Express
    : 'https://api.trescerbero.com'
);

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}
function hideErr(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

function disable(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.dataset.original = btn.dataset.original || btn.textContent;
  btn.textContent = on ? 'Procesando…' : btn.dataset.original;
}

// ─── LOGIN ───────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const err = document.getElementById('loginErr');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr(err);
    const btn = loginForm.querySelector('button[type=submit]');
    disable(btn, true);
    const fd = new FormData(loginForm);
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    if (!r.ok) {
      showErr(err, r.data?.error?.message || 'No pudimos iniciar sesión.');
      disable(btn, false);
      return;
    }
    location.href = '/app/dashboard.html';
  });
}

// ─── REGISTER ────────────────────────────────────────────────────
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const err = document.getElementById('registerErr');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr(err);
    const btn = registerForm.querySelector('button[type=submit]');
    disable(btn, true);
    const fd = new FormData(registerForm);
    const r = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
        displayName: fd.get('displayName') || undefined,
        orgName: fd.get('orgName'),
      }),
    });
    if (!r.ok) {
      const details = r.data?.error?.details;
      const firstField = details ? Object.values(details)[0]?.[0] : null;
      showErr(err, firstField || r.data?.error?.message || 'No pudimos crear tu cuenta.');
      disable(btn, false);
      return;
    }
    location.href = '/app/dashboard.html';
  });
}

// ─── DASHBOARD ───────────────────────────────────────────────────
async function hydrateDashboard() {
  if (!document.body.classList.contains('app')) return;
  const r = await api('/api/auth/me');
  if (!r.ok) {
    location.href = '/app/login.html';
    return;
  }
  const { user, orgs } = r.data;
  const primary = orgs[0] || { name: 'Sin org', slug: '—', tier: 'free', role: 'admin_org' };

  document.getElementById('topEmail').textContent = user.email;
  document.querySelector('#topOrg .org-name').textContent = primary.name;
  const tierEl = document.querySelector('#topOrg .org-tier');
  tierEl.textContent = primary.tier;
  tierEl.dataset.tier = primary.tier;

  document.getElementById('welcome').textContent =
    `Hola ${user.displayName || user.email.split('@')[0]} 👋 — estás en ${primary.name}.`;

  const tierLabels = {
    demo:   { name: 'DEMO',    aux: 'Pro completo · 30 días · datos no exportables' },
    basico: { name: 'BÁSICO',  aux: 'Falsa IA full · sin IA generativa · 69.000 COP/mes' },
    pro:    { name: 'PRO',     aux: 'Falsa IA + IA generativa con cuota · exports habilitados' },
    max:    { name: 'MAX',     aux: 'IA profunda + agentes + RAG · BYOK obligatorio' },
  };
  const label = tierLabels[primary.tier] || { name: primary.tier.toUpperCase(), aux: '' };
  document.getElementById('tierValue').textContent = label.name;
  document.getElementById('tierAux').textContent = label.aux;

  document.getElementById('roleValue').textContent =
    primary.role === 'admin_org' ? 'Admin' : 'Miembro';

  const verifEl = document.getElementById('verifValue');
  const verifAux = document.getElementById('verifAux');
  if (user.emailVerifiedAt) {
    verifEl.textContent = '✓ Sí';
    verifAux.textContent = 'Verificado correctamente';
  } else {
    verifEl.textContent = '⚠ No';
    verifAux.textContent = 'Verificación por email — próximamente';
  }

  document.getElementById('slugValue').textContent = primary.slug;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/app/login.html';
  });
}

hydrateDashboard();
