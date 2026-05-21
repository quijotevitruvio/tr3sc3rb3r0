// Página Configuración: info de la org + BYOK self-service (solo Max).
(async () => {
  const ctx = await window.__shell;
  const { api, relativeDate, showError, hideError } = window.crm;
  const esc = window.__escapeHtml;

  if (!ctx?.org) return;
  const TIER_LABELS = { demo: 'DEMO', basico: 'BÁSICO', pro: 'PRO', max: 'MAX' };
  const TIER_AUX = {
    demo: '30 días gratis · Pro completo · datos no exportables',
    basico: 'Falsa IA · sin IA generativa · 69.000 COP/mes',
    pro: 'Falsa IA + IA generativa con cuota · exports MD habilitados',
    max: 'IA profunda + Sonnet + agentes + RAG · BYOK obligatorio',
  };

  document.getElementById('kPlan').textContent = TIER_LABELS[ctx.org.tier] || ctx.org.tier.toUpperCase();
  document.getElementById('kPlanAux').textContent = TIER_AUX[ctx.org.tier] || '';
  document.getElementById('kOrg').textContent = ctx.org.name;
  document.getElementById('kSlug').textContent = ctx.org.slug;
  document.getElementById('kRole').textContent = ctx.org.role === 'admin_org' ? 'Admin' : 'Miembro';

  const byokSection = document.getElementById('byokSection');
  const noByokSection = document.getElementById('noBYOKSection');
  const dlg = document.getElementById('keysDialog');
  const form = document.getElementById('keysForm');
  const formErr = document.getElementById('keysErr');
  const keysHost = document.getElementById('keysHost');

  if (ctx.org.tier === 'max') {
    byokSection.hidden = false;
    loadKeys();
  } else {
    noByokSection.hidden = false;
  }

  async function loadKeys() {
    keysHost.innerHTML = '<div class="crm-empty"><p>Cargando…</p></div>';
    try {
      const { keys } = await api('/api/me/api-keys');
      renderKeys(keys);
    } catch (e) {
      keysHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderKeys(keys) {
    const providers = [
      { key: 'anthropic', label: 'Anthropic (Claude)', recommend: true },
      { key: 'openrouter', label: 'OpenRouter (multi-modelo)', recommend: true },
      { key: 'openai', label: 'OpenAI (GPT)' },
      { key: 'gemini', label: 'Google Gemini' },
    ];
    keysHost.innerHTML = `
      <table class="crm-table">
        <thead><tr><th>Proveedor</th><th>Estado</th><th>Actualizada</th><th></th></tr></thead>
        <tbody>
        ${providers.map((p) => {
          const k = keys[p.key];
          return `<tr>
            <td><strong>${esc(p.label)}</strong>${p.recommend ? ' <span class="badge" style="color:var(--app-a); border-color:var(--app-a); font-size:0.6rem;">recomendado</span>' : ''}</td>
            <td>${k ? `<span class="badge" style="color:var(--app-a); border-color:var(--app-a);">${esc(k.hint)}</span>` : '<span style="color:var(--app-dim)">No configurada</span>'}</td>
            <td><small style="color:var(--app-dim)">${k ? relativeDate(k.updatedAt) : '—'}</small></td>
            <td>${k ? `<button class="btn-ghost" data-act="del" data-prov="${p.key}" style="padding:0.3rem 0.6rem; font-size:0.75rem;">Borrar</button>` : ''}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>`;
    keysHost.querySelectorAll('[data-act="del"]').forEach((b) => {
      b.addEventListener('click', async (e) => {
        const prov = e.target.dataset.prov;
        if (!confirm(`¿Borrar tu API key de ${prov}? La IA dejará de funcionar con ese proveedor.`)) return;
        try {
          await api(`/api/me/api-keys/${prov}`, { method: 'DELETE' });
          loadKeys();
        } catch (er) {
          alert('Error: ' + er.message);
        }
      });
    });
  }

  function openKeysDialog() {
    form.reset();
    api('/api/me/api-keys').then(({ keys }) => {
      document.getElementById('kAnthropic').textContent = keys.anthropic ? `Actual: ${keys.anthropic.hint}` : 'No configurada';
      document.getElementById('kOpenrouter').textContent = keys.openrouter ? `Actual: ${keys.openrouter.hint}` : 'No configurada';
      document.getElementById('kOpenai').textContent = keys.openai ? `Actual: ${keys.openai.hint}` : 'No configurada';
      document.getElementById('kGemini').textContent = keys.gemini ? `Actual: ${keys.gemini.hint}` : 'No configurada';
    });
    hideError(formErr);
    dlg.showModal();
  }

  document.getElementById('editKeysBtn').addEventListener('click', openKeysDialog);
  document.getElementById('keysCancelBtn').addEventListener('click', () => dlg.close());
  document.getElementById('keysClose').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(formErr);
    const fd = new FormData(form);
    const updates = [];
    for (const provider of ['anthropic', 'openrouter', 'openai', 'gemini']) {
      const val = (fd.get(provider) || '').toString().trim();
      if (val) updates.push({ provider, key: val });
    }
    if (!updates.length) { showError(formErr, 'No hay cambios.'); return; }
    try {
      for (const u of updates) {
        await api('/api/me/api-keys', { method: 'POST', body: JSON.stringify(u) });
      }
      dlg.close();
      loadKeys();
    } catch (err) {
      showError(formErr, err.message);
    }
  });
})();
