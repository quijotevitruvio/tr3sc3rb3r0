// Shell render: topbar + sidebar consistentes en todas las páginas autenticadas.
// Cada página tiene <header data-shell="top">, <aside data-shell="side"> y main propio.
// Usage: <script src="/app/assets/shell.js?v=1.0.3" defer></script> antes del JS de página.

const NAV = [
  { href: '/app/dashboard.html', icon: '📊', label: 'Inicio' },
  { href: '/app/crm.html', icon: '🎯', label: 'L-IA CRM', match: '/app/crm.html' },
  { href: '/app/crm-contacts.html', icon: '👤', label: 'Contactos', match: '/app/crm-contacts' },
  { href: '/app/crm-companies.html', icon: '🏢', label: 'Empresas', match: '/app/crm-companies' },
  { href: '/app/crm-deals.html', icon: '💰', label: 'Deals', match: '/app/crm-deals' },
  { href: '/app/crm-graph.html', icon: '🧠', label: 'Knowledge Graph', match: '/app/crm-graph' },
  { href: '/app/crm-chat.html', icon: '💬', label: 'Chat IA', match: '/app/crm-chat' },
  { href: '/app/crm-engine.html', icon: '🤖', label: 'Falsa IA', match: '/app/crm-engine' },
  { href: '/app/settings.html', icon: '⚙', label: 'Configuración', match: '/app/settings' },
];

// Items que solo se muestran a superadmins.
const ADMIN_NAV = [
  { href: '/app/admin.html', icon: '🛠', label: 'Admin', match: '/app/admin' },
];

const TIER_LABELS = {
  demo:   'DEMO',
  basico: 'BÁSICO',
  pro:    'PRO',
  max:    'MAX',
};

function renderTopbar(host, ctx) {
  host.innerHTML = `
    <a href="/app/dashboard.html" class="topbar-brand"><span>Tr3s</span>C3rb3r0</a>
    <div class="topbar-org">
      <span class="org-name">${escapeHtml(ctx.org?.name || '—')}</span>
      <span class="org-tier" data-tier="${ctx.org?.tier || 'basico'}">${TIER_LABELS[ctx.org?.tier] || ctx.org?.tier || ''}</span>
    </div>
    <span class="topbar-quota" id="topQuota" title="Acciones IA usadas este mes"></span>
    <div class="topbar-user">
      <span class="user-email">${escapeHtml(ctx.user?.email || '')}</span>
      <button id="logoutBtn" class="topbar-logout">Salir</button>
    </div>
  `;
  host.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    location.href = '/app/login.html';
  });
  // Cargar cuota IA en background (no bloquea topbar si falla)
  loadQuotaBadge();
}

async function loadQuotaBadge() {
  try {
    const r = await fetch('/api/ai/quota', { credentials: 'include' });
    if (!r.ok) return;
    const q = await r.json();
    const el = document.getElementById('topQuota');
    if (!el) return;
    if (q.limit === 0) {
      el.innerHTML = `🤖 <span style="color:var(--app-dim)">sin IA</span>`;
    } else if (q.limit >= 999999) {
      el.innerHTML = `🤖 <span style="color:var(--app-a)">∞</span>`;
    } else {
      const pct = q.used / q.limit;
      const color = pct >= 0.9 ? 'var(--app-err)' : pct >= 0.7 ? 'var(--app-warn)' : 'var(--app-a)';
      el.innerHTML = `🤖 <span style="color:${color}">${q.remaining}/${q.limit}</span>`;
    }
  } catch {}
}

function renderSidebar(host, ctx) {
  const path = location.pathname;
  const items = ctx?.user?.isSuperadmin ? [...NAV, ...ADMIN_NAV] : NAV;
  host.innerHTML = `<nav>${items.map((n) => {
    const active = n.match ? path.startsWith(n.match) : path === n.href;
    const cls = ['nav-item', active && 'active', n.disabled && 'disabled'].filter(Boolean).join(' ');
    const aria = n.disabled ? 'aria-disabled="true"' : '';
    const soon = n.soon ? `<span class="soon">${n.soon}</span>` : '';
    return `<a href="${n.href}" class="${cls}" ${aria}>${n.icon} ${n.label} ${soon}</a>`;
  }).join('')}</nav>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function loadContext() {
  const r = await fetch('/api/auth/me', { credentials: 'include' });
  if (!r.ok) {
    location.href = '/app/login.html';
    return null;
  }
  const { user, orgs } = await r.json();
  return { user, org: orgs[0] || null };
}

async function mountShell() {
  const top = document.querySelector('[data-shell="top"]');
  const side = document.querySelector('[data-shell="side"]');
  if (!top || !side) return null;

  const ctx = await loadContext();
  if (!ctx) return null;

  renderTopbar(top, ctx);
  renderSidebar(side, ctx);
  if (ctx.org?.tier === 'demo') renderDemoBanner(ctx);
  return ctx;
}

async function renderDemoBanner(ctx) {
  try {
    const r = await fetch('/api/demo/status');
    if (!r.ok) return;
    const s = await r.json();
    if (!s.hasDemo) return;
    const days = s.remainingDays;
    const expired = s.expired;
    const banner = document.createElement('div');
    banner.className = 'demo-banner' + (days <= 5 ? ' urgent' : '') + (expired ? ' expired' : '');
    banner.innerHTML = expired
      ? `<strong>⏱ Tu demo expiró.</strong> Los datos no se exportaron al plan Básico. Suscribite a Pro o Max para conservar todo.
         <a href="/#planes" class="btn-primary" style="margin-left:auto; padding:0.4rem 0.9rem; font-size:0.78rem;">Ver planes</a>`
      : `<strong>🧪 Modo Demo</strong> · Te quedan <strong>${days} día${days === 1 ? '' : 's'}</strong>${days <= 5 ? ' — el demo se bloquea al expirar' : ''}.
         <a href="/#planes" class="btn-primary" style="margin-left:auto; padding:0.4rem 0.9rem; font-size:0.78rem;">Convertir a Pro</a>`;
    document.body.prepend(banner);
  } catch {}
}

// Exponer para JS de página (await window.__shell)
window.__shell = mountShell();
window.__escapeHtml = escapeHtml;
