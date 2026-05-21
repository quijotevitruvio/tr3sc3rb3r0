// Configurador de Falsa IA: tabs para rules / automations / templates.
(async () => {
  const ctx = await window.__shell;
  const { api, relativeDate, showError, hideError } = window.crm;
  const esc = window.__escapeHtml;

  const isAdmin = ctx?.org?.role === 'admin_org' || ctx?.user?.isSuperadmin;
  let meta = { triggers: [], actionTypes: [], templateCategories: [], conditionFields: [] };

  // ── Tabs ─────────────────────────────────────────────────────
  document.querySelectorAll('.engine-tabs .tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.engine-tabs .tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const target = t.dataset.tab;
      document.querySelectorAll('.engine-panel').forEach((p) => p.hidden = p.dataset.panel !== target);
    });
  });

  // ── Load meta + listas iniciales ─────────────────────────────
  try {
    meta = await api('/api/engine/meta');
    populateTriggerSelects();
  } catch {}

  function populateTriggerSelects() {
    const opts = meta.triggers.map((t) => `<option value="${t}">${esc(t)}</option>`).join('');
    document.getElementById('ruleTrigger').innerHTML = opts;
    document.getElementById('autoTrigger').innerHTML = opts;
  }

  // ════════════════════════════════════════════════════════════
  // RULES
  // ════════════════════════════════════════════════════════════
  const rulesHost = document.getElementById('rulesHost');
  const ruleDlg = document.getElementById('ruleDialog');
  const ruleForm = document.getElementById('ruleForm');
  const ruleErr = document.getElementById('ruleErr');
  const ruleTitle = document.getElementById('ruleTitle');
  const ruleSubmitBtn = document.getElementById('ruleSubmitBtn');
  const ruleDeleteBtn = document.getElementById('ruleDeleteBtn');
  let editingRuleId = null;

  async function loadRules() {
    rulesHost.innerHTML = '<div class="crm-empty"><p>Cargando…</p></div>';
    try {
      const { rules } = await api('/api/engine/rules');
      renderRules(rules);
    } catch (e) {
      rulesHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderRules(rules) {
    if (!rules.length) { rulesHost.innerHTML = '<div class="crm-empty"><p>Sin reglas. Creá la primera.</p></div>'; return; }
    rulesHost.innerHTML = `
      <table class="crm-table">
        <thead><tr><th>Nombre</th><th>Trigger</th><th>Δ</th><th>Condición</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        ${rules.map((r) => `
          <tr data-rule='${esc(JSON.stringify(r))}'>
            <td><strong>${esc(r.name)}</strong></td>
            <td><code style="font-size:0.78rem">${esc(r.trigger)}</code></td>
            <td><span class="badge" style="border-color:${r.delta >= 0 ? 'var(--app-a)' : 'var(--app-err)'}; color:${r.delta >= 0 ? 'var(--app-a)' : 'var(--app-err)'}">${r.delta > 0 ? '+' : ''}${r.delta}</span></td>
            <td><small style="color:var(--app-dim)">${condSummary(r.condition)}</small></td>
            <td><span class="badge">${r.enabled ? '✓ activa' : '⏸ pausada'}</span></td>
            <td>${isAdmin ? `<button class="btn-ghost" data-act="edit" style="padding:0.3rem 0.6rem; font-size:0.75rem;">Editar</button>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    rulesHost.querySelectorAll('[data-act="edit"]').forEach((b) => {
      b.addEventListener('click', (e) => openRuleEdit(JSON.parse(e.target.closest('tr').dataset.rule)));
    });
  }

  function condSummary(cond) {
    const c = parseJson(cond);
    if (!c) return '—';
    return Object.entries(c).map(([k, v]) => `${k}=${v}`).join(', ') || '—';
  }

  function parseJson(v) {
    if (!v) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return v;
  }

  function openRuleNew() {
    editingRuleId = null;
    ruleTitle.textContent = 'Nueva regla';
    ruleSubmitBtn.textContent = 'Crear';
    ruleDeleteBtn.hidden = true;
    ruleForm.reset();
    ruleForm.elements.enabled.checked = true;
    hideError(ruleErr);
    ruleDlg.showModal();
  }

  function openRuleEdit(rule) {
    editingRuleId = rule.id;
    ruleTitle.textContent = 'Editar regla';
    ruleSubmitBtn.textContent = 'Guardar';
    ruleDeleteBtn.hidden = false;
    ruleForm.reset();
    ruleForm.elements.name.value = rule.name;
    ruleForm.elements.trigger.value = rule.trigger;
    ruleForm.elements.delta.value = rule.delta;
    ruleForm.elements.enabled.checked = !!rule.enabled;
    const cond = parseJson(rule.condition) || {};
    for (const k of ['amountMin', 'amountMax', 'stageName', 'tagName', 'status', 'currency']) {
      if (cond[k] !== undefined) ruleForm.elements[k].value = cond[k];
    }
    hideError(ruleErr);
    ruleDlg.showModal();
  }

  document.getElementById('newRuleBtn').addEventListener('click', openRuleNew);
  document.getElementById('ruleCancelBtn').addEventListener('click', () => ruleDlg.close());
  document.getElementById('ruleClose').addEventListener('click', () => ruleDlg.close());

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(ruleErr);
    const fd = new FormData(ruleForm);
    const body = {
      name: fd.get('name'),
      trigger: fd.get('trigger'),
      delta: Number(fd.get('delta')),
      enabled: fd.get('enabled') === 'on',
      conditionJson: collectCondition(ruleForm),
    };
    try {
      if (editingRuleId) await api(`/api/engine/rules/${editingRuleId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/api/engine/rules', { method: 'POST', body: JSON.stringify(body) });
      ruleDlg.close();
      loadRules();
    } catch (err) { showError(ruleErr, err.message); }
  });

  ruleDeleteBtn.addEventListener('click', async () => {
    if (!editingRuleId || !confirm('¿Borrar esta regla?')) return;
    try {
      await api(`/api/engine/rules/${editingRuleId}`, { method: 'DELETE' });
      ruleDlg.close();
      loadRules();
    } catch (err) { showError(ruleErr, err.message); }
  });

  function collectCondition(form) {
    const cond = {};
    const fields = ['amountMin', 'amountMax', 'stageName', 'tagName', 'status', 'currency'];
    for (const k of fields) {
      const v = (form.elements[k]?.value || '').trim();
      if (!v) continue;
      cond[k] = k === 'amountMin' || k === 'amountMax' ? Number(v) : v;
    }
    return Object.keys(cond).length ? cond : null;
  }

  // ════════════════════════════════════════════════════════════
  // AUTOMATIONS
  // ════════════════════════════════════════════════════════════
  const autosHost = document.getElementById('automationsHost');
  const autoDlg = document.getElementById('autoDialog');
  const autoForm = document.getElementById('autoForm');
  const autoErr = document.getElementById('autoErr');
  const autoTitle = document.getElementById('autoTitle');
  const autoSubmitBtn = document.getElementById('autoSubmitBtn');
  const autoDeleteBtn = document.getElementById('autoDeleteBtn');
  const actionList = document.getElementById('actionList');
  let editingAutoId = null;

  async function loadAutomations() {
    autosHost.innerHTML = '<div class="crm-empty"><p>Cargando…</p></div>';
    try {
      const { automations } = await api('/api/engine/automations');
      renderAutomations(automations);
    } catch (e) {
      autosHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderAutomations(autos) {
    if (!autos.length) { autosHost.innerHTML = '<div class="crm-empty"><p>Sin automatizaciones.</p></div>'; return; }
    autosHost.innerHTML = `
      <table class="crm-table">
        <thead><tr><th>Nombre</th><th>Trigger</th><th>Acciones</th><th>Corridas</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        ${autos.map((a) => `
          <tr data-auto='${esc(JSON.stringify(a))}'>
            <td><strong>${esc(a.name)}</strong><br><small style="color:var(--app-dim)">${esc(a.description || '')}</small></td>
            <td><code style="font-size:0.78rem">${esc(a.trigger)}</code></td>
            <td>${actionsSummary(a.actionsJson)}</td>
            <td>${a.runsCount}<br><small style="color:var(--app-dim)">${a.lastRunAt ? relativeDate(a.lastRunAt) : 'nunca'}</small></td>
            <td><span class="badge">${a.enabled ? '✓ activa' : '⏸ pausada'}</span></td>
            <td>${isAdmin ? `<button class="btn-ghost" data-act="edit" style="padding:0.3rem 0.6rem; font-size:0.75rem;">Editar</button>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    autosHost.querySelectorAll('[data-act="edit"]').forEach((b) => {
      b.addEventListener('click', (e) => openAutoEdit(JSON.parse(e.target.closest('tr').dataset.auto)));
    });
  }

  function actionsSummary(actions) {
    const arr = parseJson(actions) || [];
    if (!Array.isArray(arr)) return '—';
    return arr.map((a) => `<code style="font-size:0.7rem">${esc(a.type)}</code>`).join(' ');
  }

  function renderActionRow(action = { type: 'create_task' }) {
    const i = actionList.children.length;
    const row = document.createElement('div');
    row.className = 'action-row';
    row.innerHTML = `
      <select data-field="type">
        <option value="create_task" ${action.type === 'create_task' ? 'selected' : ''}>create_task</option>
        <option value="add_tag" ${action.type === 'add_tag' ? 'selected' : ''}>add_tag</option>
        <option value="move_deal_to_stage" ${action.type === 'move_deal_to_stage' ? 'selected' : ''}>move_deal_to_stage</option>
      </select>
      <input data-field="param1" placeholder="title / tagName / stageName" value="${esc(action.title || action.tagName || action.stageName || '')}">
      <input data-field="param2" placeholder="dueOffsetDays (opc)" type="number" min="0" value="${action.dueOffsetDays ?? ''}">
      <button type="button" data-act="remove" class="btn-ghost" style="padding:0.3rem 0.5rem;">✕</button>
    `;
    row.querySelector('[data-act="remove"]').addEventListener('click', () => row.remove());
    actionList.appendChild(row);
  }

  function readActions() {
    return Array.from(actionList.children).map((row) => {
      const type = row.querySelector('[data-field="type"]').value;
      const p1 = row.querySelector('[data-field="param1"]').value.trim();
      const p2 = row.querySelector('[data-field="param2"]').value.trim();
      const a = { type };
      if (type === 'create_task') {
        a.title = p1;
        if (p2) a.dueOffsetDays = Number(p2);
        a.attachToSource = true;
      } else if (type === 'add_tag') {
        a.tagName = p1.toLowerCase();
      } else if (type === 'move_deal_to_stage') {
        a.stageName = p1;
      }
      return a;
    }).filter((a) => {
      if (a.type === 'create_task') return !!a.title;
      if (a.type === 'add_tag') return !!a.tagName;
      if (a.type === 'move_deal_to_stage') return !!a.stageName;
      return false;
    });
  }

  function openAutoNew() {
    editingAutoId = null;
    autoTitle.textContent = 'Nueva automatización';
    autoSubmitBtn.textContent = 'Crear';
    autoDeleteBtn.hidden = true;
    autoForm.reset();
    autoForm.elements.enabled.checked = true;
    actionList.innerHTML = '';
    renderActionRow();
    hideError(autoErr);
    autoDlg.showModal();
  }

  function openAutoEdit(auto) {
    editingAutoId = auto.id;
    autoTitle.textContent = 'Editar automatización';
    autoSubmitBtn.textContent = 'Guardar';
    autoDeleteBtn.hidden = false;
    autoForm.reset();
    autoForm.elements.name.value = auto.name;
    autoForm.elements.description.value = auto.description || '';
    autoForm.elements.trigger.value = auto.trigger;
    autoForm.elements.enabled.checked = !!auto.enabled;
    const cond = parseJson(auto.condition) || {};
    for (const k of ['amountMin', 'amountMax', 'stageName', 'tagName']) {
      if (cond[k] !== undefined) autoForm.elements[k].value = cond[k];
    }
    const actions = parseJson(auto.actions) || [];
    actionList.innerHTML = '';
    actions.forEach((a) => renderActionRow(a));
    if (!actions.length) renderActionRow();
    hideError(autoErr);
    autoDlg.showModal();
  }

  document.getElementById('newAutomationBtn').addEventListener('click', openAutoNew);
  document.getElementById('autoCancelBtn').addEventListener('click', () => autoDlg.close());
  document.getElementById('autoClose').addEventListener('click', () => autoDlg.close());
  document.getElementById('addActionBtn').addEventListener('click', () => renderActionRow());

  autoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(autoErr);
    const fd = new FormData(autoForm);
    const actions = readActions();
    if (!actions.length) { showError(autoErr, 'Agregá al menos 1 acción válida'); return; }
    const body = {
      name: fd.get('name'),
      description: fd.get('description') || undefined,
      trigger: fd.get('trigger'),
      enabled: fd.get('enabled') === 'on',
      conditionJson: collectCondition(autoForm),
      actionsJson: actions,
    };
    try {
      if (editingAutoId) await api(`/api/engine/automations/${editingAutoId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/api/engine/automations', { method: 'POST', body: JSON.stringify(body) });
      autoDlg.close();
      loadAutomations();
    } catch (err) { showError(autoErr, err.message); }
  });

  autoDeleteBtn.addEventListener('click', async () => {
    if (!editingAutoId || !confirm('¿Borrar esta automatización?')) return;
    try {
      await api(`/api/engine/automations/${editingAutoId}`, { method: 'DELETE' });
      autoDlg.close();
      loadAutomations();
    } catch (err) { showError(autoErr, err.message); }
  });

  // ════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════
  const tplHost = document.getElementById('templatesHost');
  const tplDlg = document.getElementById('tplDialog');
  const tplForm = document.getElementById('tplForm');
  const tplErr = document.getElementById('tplErr');
  const tplTitle = document.getElementById('tplTitle');
  const tplSubmitBtn = document.getElementById('tplSubmitBtn');
  const tplDeleteBtn = document.getElementById('tplDeleteBtn');
  let editingTplId = null;

  async function loadTemplates() {
    tplHost.innerHTML = '<div class="crm-empty"><p>Cargando…</p></div>';
    try {
      const { templates } = await api('/api/engine/templates');
      renderTemplates(templates);
    } catch (e) {
      tplHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderTemplates(tpls) {
    if (!tpls.length) { tplHost.innerHTML = '<div class="crm-empty"><p>Sin plantillas.</p></div>'; return; }
    tplHost.innerHTML = `
      <table class="crm-table">
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Asunto</th><th>Actualizada</th><th></th></tr></thead>
        <tbody>
        ${tpls.map((t) => `
          <tr data-tpl='${esc(JSON.stringify(t))}'>
            <td><strong>${esc(t.name)}</strong></td>
            <td><span class="badge">${esc(t.category)}</span></td>
            <td><code style="font-size:0.78rem">${esc(t.subject.slice(0, 60))}${t.subject.length > 60 ? '…' : ''}</code></td>
            <td><small style="color:var(--app-dim)">${relativeDate(t.updatedAt)}</small></td>
            <td>${isAdmin ? `<button class="btn-ghost" data-act="edit" style="padding:0.3rem 0.6rem; font-size:0.75rem;">Editar</button>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    tplHost.querySelectorAll('[data-act="edit"]').forEach((b) => {
      b.addEventListener('click', (e) => openTplEdit(JSON.parse(e.target.closest('tr').dataset.tpl)));
    });
  }

  function openTplNew() {
    editingTplId = null;
    tplTitle.textContent = 'Nueva plantilla';
    tplSubmitBtn.textContent = 'Crear';
    tplDeleteBtn.hidden = true;
    tplForm.reset();
    hideError(tplErr);
    tplDlg.showModal();
  }

  function openTplEdit(tpl) {
    editingTplId = tpl.id;
    tplTitle.textContent = 'Editar plantilla';
    tplSubmitBtn.textContent = 'Guardar';
    tplDeleteBtn.hidden = false;
    tplForm.reset();
    tplForm.elements.name.value = tpl.name;
    tplForm.elements.category.value = tpl.category;
    tplForm.elements.subject.value = tpl.subject;
    tplForm.elements.body.value = tpl.body;
    hideError(tplErr);
    tplDlg.showModal();
  }

  document.getElementById('newTemplateBtn').addEventListener('click', openTplNew);
  document.getElementById('tplCancelBtn').addEventListener('click', () => tplDlg.close());
  document.getElementById('tplClose').addEventListener('click', () => tplDlg.close());

  tplForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(tplErr);
    const fd = new FormData(tplForm);
    const body = {
      name: fd.get('name'), subject: fd.get('subject'), body: fd.get('body'),
      category: fd.get('category'),
    };
    try {
      if (editingTplId) await api(`/api/engine/templates/${editingTplId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/api/engine/templates', { method: 'POST', body: JSON.stringify(body) });
      tplDlg.close();
      loadTemplates();
    } catch (err) { showError(tplErr, err.message); }
  });

  tplDeleteBtn.addEventListener('click', async () => {
    if (!editingTplId || !confirm('¿Borrar plantilla?')) return;
    try {
      await api(`/api/engine/templates/${editingTplId}`, { method: 'DELETE' });
      tplDlg.close();
      loadTemplates();
    } catch (err) { showError(tplErr, err.message); }
  });

  // ── Cargas iniciales (las 3 tabs en paralelo) ────────────────
  loadRules();
  loadAutomations();
  loadTemplates();
})();
