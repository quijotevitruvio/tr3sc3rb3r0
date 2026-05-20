// Panel superadmin: tabla de orgs + setear API keys de IA por org.
(async () => {
  const ctx = await window.__shell;
  const { api, relativeDate, showError, hideError } = window.crm;
  const esc = window.__escapeHtml;

  const gate = document.getElementById('adminGate');
  const body = document.getElementById('adminBody');
  const tableHost = document.getElementById('orgsTableHost');
  const dlg = document.getElementById('keysDialog');
  const form = document.getElementById('keysForm');
  const dialogTitle = document.getElementById('keysDialogTitle');
  const orgInfo = document.getElementById('keysOrgInfo');
  const formErr = document.getElementById('keysErr');
  const submitBtn = document.getElementById('keysSubmitBtn');

  if (!ctx?.user?.isSuperadmin) {
    gate.hidden = false;
    return;
  }
  body.hidden = false;

  let state = { editingOrg: null };

  async function loadOrgs() {
    tableHost.innerHTML = '<div class="crm-empty"><p>Cargando…</p></div>';
    try {
      const { orgs } = await api('/api/admin/orgs');
      renderTable(orgs);
    } catch (e) {
      tableHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderTable(orgs) {
    if (!orgs.length) {
      tableHost.innerHTML = '<div class="crm-empty"><p>Sin orgs todavía.</p></div>';
      return;
    }
    tableHost.innerHTML = `
      <table class="crm-table">
        <thead>
          <tr>
            <th>Organización</th><th>Plan</th><th>Miembros</th>
            <th>Contactos</th><th>Deals</th>
            <th>Anthropic</th><th>OpenAI</th><th>Gemini</th>
            <th>Creada</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${orgs.map((o) => `
            <tr data-org='${esc(JSON.stringify(o))}'>
              <td><strong>${esc(o.name)}</strong><br><small style="color:var(--app-dim)">${esc(o.slug)}</small></td>
              <td><span class="badge">${esc(o.tier.toUpperCase())}</span></td>
              <td>${o.members}</td>
              <td>${o.contacts}</td>
              <td>${o.deals}</td>
              <td>${keyCell(o.apiKeys?.anthropic)}</td>
              <td>${keyCell(o.apiKeys?.openai)}</td>
              <td>${keyCell(o.apiKeys?.gemini)}</td>
              <td><small style="color:var(--app-dim)">${relativeDate(o.createdAt)}</small></td>
              <td><button class="btn-ghost" data-act="configure" style="padding:0.3rem 0.6rem; font-size:0.75rem;">Configurar keys</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    tableHost.querySelectorAll('[data-act="configure"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const orgData = JSON.parse(tr.dataset.org);
        openKeysDialog(orgData);
      });
    });
  }

  function keyCell(meta) {
    if (!meta) return `<span style="color:var(--app-dim); font-size:0.75rem">—</span>`;
    return `<span class="badge" style="border-color:var(--app-a); color:var(--app-a)">${esc(meta.hint || '****')}</span>`;
  }

  function openKeysDialog(org) {
    state.editingOrg = org;
    dialogTitle.textContent = `Configurar keys — ${org.name}`;
    orgInfo.innerHTML = `Plan: <strong>${org.tier.toUpperCase()}</strong> · Slug: <code>${esc(org.slug)}</code> · ID: <code>${esc(org.id)}</code>`;
    form.reset();
    document.getElementById('anthropicCurrent').textContent = org.apiKeys?.anthropic ? `Actual: ${org.apiKeys.anthropic.hint}` : 'No configurada';
    document.getElementById('openaiCurrent').textContent = org.apiKeys?.openai ? `Actual: ${org.apiKeys.openai.hint}` : 'No configurada';
    document.getElementById('geminiCurrent').textContent = org.apiKeys?.gemini ? `Actual: ${org.apiKeys.gemini.hint}` : 'No configurada';
    hideError(formErr);
    dlg.showModal();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.editingOrg) return;
    hideError(formErr);
    submitBtn.disabled = true;

    const fd = new FormData(form);
    const updates = [];
    for (const provider of ['anthropic', 'openai', 'gemini']) {
      const val = (fd.get(provider) || '').toString().trim();
      if (val) updates.push({ provider, key: val });
    }

    if (!updates.length) {
      showError(formErr, 'No hay cambios para guardar.');
      submitBtn.disabled = false;
      return;
    }

    try {
      for (const u of updates) {
        await api(`/api/admin/orgs/${state.editingOrg.id}/api-keys`, {
          method: 'POST',
          body: JSON.stringify(u),
        });
      }
      dlg.close();
      loadOrgs();
    } catch (err) {
      showError(formErr, err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('keysCancelBtn').addEventListener('click', () => dlg.close());
  document.getElementById('keysDialogClose').addEventListener('click', () => dlg.close());
  document.getElementById('refreshBtn').addEventListener('click', loadOrgs);

  loadOrgs();
})();
