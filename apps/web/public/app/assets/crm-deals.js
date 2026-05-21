// Deals kanban con drag&drop nativo HTML5.
// - Status "open": kanban por stages, drag&drop entre columnas
// - Status "won"/"lost": vista lista (no aplica mover stages)
(async () => {
  await window.__shell;
  const { api, money, relativeDate, showError, hideError, toast } = window.crm;
  const esc = window.__escapeHtml;

  const state = {
    pipelines: [],
    currentPipelineId: null,
    stages: [],
    deals: [],
    status: 'open',
    q: '',
    editing: null,
    closingId: null,
    contacts: [],
    companies: [],
  };

  const pipelineSel = document.getElementById('pipelineSel');
  const kanban = document.getElementById('kanbanHost');
  const searchInput = document.getElementById('searchInput');
  const filterBtns = {
    open: document.getElementById('filterOpen'),
    won: document.getElementById('filterWon'),
    lost: document.getElementById('filterLost'),
  };
  const dlg = document.getElementById('dealDialog');
  const form = document.getElementById('dealForm');
  const formErr = document.getElementById('formErr');
  const dialogTitle = document.getElementById('dialogTitle');
  const submitBtn = document.getElementById('submitBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const closeDlg = document.getElementById('closeDialog');
  const closeForm = document.getElementById('closeForm');
  const closeDealTitle = document.getElementById('closeDealTitle');

  // ── Carga inicial ───────────────────────────────────────────
  async function init() {
    const { pipelines } = await api('/api/crm/pipelines');
    state.pipelines = pipelines;
    if (!pipelines.length) {
      kanban.innerHTML = '<div class="crm-empty"><p>No hay pipelines configurados.</p></div>';
      return;
    }
    pipelineSel.innerHTML = pipelines.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    state.currentPipelineId = pipelines[0].id;
    await loadPipeline();
    loadDeals();
    loadRelations();
  }

  async function loadPipeline() {
    const { pipeline } = await api(`/api/crm/pipelines/${state.currentPipelineId}`);
    state.stages = pipeline.stages;
  }

  async function loadDeals() {
    const params = new URLSearchParams({
      pipelineId: state.currentPipelineId,
      status: state.status,
      pageSize: '200',
      ...(state.q ? { q: state.q } : {}),
    });
    try {
      const { deals } = await api('/api/crm/deals?' + params);
      state.deals = deals;
      render();
    } catch (e) {
      kanban.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  async function loadRelations() {
    try {
      const [{ contacts }, { companies }] = await Promise.all([
        api('/api/crm/contacts?pageSize=100'),
        api('/api/crm/companies?pageSize=100'),
      ]);
      state.contacts = contacts;
      state.companies = companies;
    } catch {}
  }

  // ── Render ──────────────────────────────────────────────────
  function render() {
    if (state.status !== 'open') return renderList();
    renderKanban();
  }

  function renderKanban() {
    kanban.classList.remove('deals-list');
    kanban.classList.add('kanban-host');
    kanban.innerHTML = state.stages.map((s) => {
      const dealsInStage = state.deals.filter((d) => d.stage?.id === s.id);
      const total = dealsInStage.reduce((sum, d) => sum + Number(d.amount), 0);
      return `
        <div class="kanban-col">
          <div class="kanban-col-head">
            <span class="kanban-col-name">${esc(s.name)} <small style="color:var(--app-dim); font-weight:400">${s.winProbability}%</small></span>
            <span class="kanban-col-count">${dealsInStage.length}</span>
          </div>
          <div class="kanban-col-total">${money(total)}</div>
          <div class="kanban-col-body" data-stage-id="${s.id}">
            ${dealsInStage.map(dealCard).join('')}
          </div>
        </div>`;
    }).join('');
    wireDragAndDrop();
    wireCardClicks();
  }

  function renderList() {
    kanban.classList.remove('kanban-host');
    kanban.classList.add('deals-list');
    if (!state.deals.length) {
      kanban.innerHTML = `<div class="crm-empty"><p>Sin deals ${state.status === 'won' ? 'ganados' : 'perdidos'}.</p></div>`;
      return;
    }
    kanban.innerHTML = state.deals.map(dealCard).join('');
    wireCardClicks();
  }

  function dealCard(d) {
    const meta = [];
    if (d.company) meta.push(esc(d.company.name));
    if (d.contact) meta.push(esc(d.contact.name));
    const closeBtn = d.status === 'open'
      ? `<button class="close-btn" data-act="close" data-id="${d.id}">Cerrar</button>`
      : `<span class="badge">${d.status === 'won' ? '🏆 won' : '❌ lost'}</span>`;
    return `
      <div class="deal-card" draggable="${d.status === 'open'}" data-id="${d.id}" data-status="${d.status}">
        <div class="deal-card-title">${esc(d.title)}</div>
        <div class="deal-card-amount">${money(d.amount, d.currency)}</div>
        <div class="deal-card-meta">
          <span>${meta.join(' · ') || '—'}</span>
          ${closeBtn}
        </div>
      </div>`;
  }

  // ── Drag & drop ─────────────────────────────────────────────
  function wireDragAndDrop() {
    kanban.querySelectorAll('.deal-card[draggable="true"]').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    kanban.querySelectorAll('.kanban-col-body').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const dealId = e.dataTransfer.getData('text/plain');
        const newStageId = col.dataset.stageId;
        const deal = state.deals.find((d) => d.id === dealId);
        if (!deal || deal.stage?.id === newStageId) return;
        // Optimistic update
        deal.stage = state.stages.find((s) => s.id === newStageId);
        render();
        try {
          await api(`/api/crm/deals/${dealId}/move`, {
            method: 'POST',
            body: JSON.stringify({ stageId: newStageId }),
          });
        } catch (err) {
          toast(err.message, { type: 'error', title: 'No pudimos mover el deal' });
          loadDeals(); // rollback re-fetching
        }
      });
    });
  }

  function wireCardClicks() {
    kanban.querySelectorAll('.deal-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        // Botón "Cerrar" tiene su propio handler
        if (e.target.dataset.act === 'close') {
          e.stopPropagation();
          openCloseDialog(e.target.dataset.id);
          return;
        }
        openEdit(card.dataset.id);
      });
    });
  }

  // ── Filtros ─────────────────────────────────────────────────
  Object.entries(filterBtns).forEach(([status, btn]) => {
    btn.addEventListener('click', () => {
      state.status = status;
      Object.values(filterBtns).forEach((b) => b.classList.remove('active-status'));
      btn.classList.add('active-status');
      loadDeals();
    });
  });

  pipelineSel.addEventListener('change', async () => {
    state.currentPipelineId = pipelineSel.value;
    await loadPipeline();
    loadDeals();
  });

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = searchInput.value.trim(); loadDeals(); }, 300);
  });

  // ── Modal crear/editar ──────────────────────────────────────
  function openCreate() {
    state.editing = null;
    dialogTitle.textContent = 'Nuevo deal';
    submitBtn.textContent = 'Crear deal';
    deleteBtn.style.display = 'none';
    form.reset();
    form.elements.amount.value = '0';
    populateSelects();
    if (state.stages[0]) form.elements.stageId.value = state.stages[0].id;
    hideError(formErr);
    dlg.showModal();
  }

  async function openEdit(id) {
    try {
      const { deal } = await api(`/api/crm/deals/${id}`);
      state.editing = id;
      dialogTitle.textContent = 'Editar deal';
      submitBtn.textContent = 'Guardar cambios';
      deleteBtn.style.display = 'inline-block';
      populateSelects();
      form.elements.title.value = deal.title || '';
      form.elements.amount.value = Number(deal.amount) || 0;
      form.elements.expectedCloseDate.value = deal.expectedCloseDate || '';
      form.elements.stageId.value = deal.stageId || '';
      form.elements.companyId.value = deal.companyId || '';
      form.elements.contactId.value = deal.contactId || '';
      hideError(formErr);
      dlg.showModal();
    } catch (e) {
      toast(e.message, { type: 'error', title: 'No pudimos cargar el deal' });
    }
  }

  function populateSelects() {
    form.elements.stageId.innerHTML = state.stages.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    form.elements.companyId.innerHTML = '<option value="">— Sin empresa —</option>' +
      state.companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    form.elements.contactId.innerHTML = '<option value="">— Sin contacto —</option>' +
      state.contacts.map((c) => `<option value="${c.id}">${esc(`${c.firstName} ${c.lastName || ''}`.trim())}</option>`).join('');
  }

  document.getElementById('newBtn').addEventListener('click', openCreate);
  document.getElementById('cancelBtn').addEventListener('click', () => dlg.close());
  document.getElementById('dialogClose').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(formErr);
    submitBtn.disabled = true;
    const fd = new FormData(form);
    const data = {
      title: fd.get('title'),
      amount: Number(fd.get('amount')) || 0,
      stageId: fd.get('stageId'),
      pipelineId: state.currentPipelineId,
    };
    const close = fd.get('expectedCloseDate');
    if (close) data.expectedCloseDate = close;
    const co = fd.get('companyId'); if (co) data.companyId = co;
    const ct = fd.get('contactId'); if (ct) data.contactId = ct;

    try {
      if (state.editing) {
        await api(`/api/crm/deals/${state.editing}`, { method: 'PATCH', body: JSON.stringify(data) });
      } else {
        await api('/api/crm/deals', { method: 'POST', body: JSON.stringify(data) });
      }
      dlg.close();
      loadDeals();
    } catch (err) {
      showError(formErr, err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!state.editing) return;
    if (!confirm('¿Borrar este deal? Se puede recuperar después.')) return;
    try {
      await api(`/api/crm/deals/${state.editing}`, { method: 'DELETE' });
      dlg.close();
      loadDeals();
    } catch (err) {
      showError(formErr, err.message);
    }
  });

  // ── Modal cerrar (won/lost) ─────────────────────────────────
  function openCloseDialog(id) {
    state.closingId = id;
    const deal = state.deals.find((d) => d.id === id);
    closeDealTitle.textContent = deal?.title || '';
    closeForm.reset();
    closeForm.elements.outcome.value = 'won';
    document.getElementById('lostReasonLabel').hidden = true;
    closeDlg.showModal();
  }
  closeForm.elements.outcome.addEventListener('change', (e) => {
    document.getElementById('lostReasonLabel').hidden = e.target.value !== 'lost';
  });
  document.getElementById('closeCancelBtn').addEventListener('click', () => closeDlg.close());
  document.getElementById('closeDialogX').addEventListener('click', () => closeDlg.close());
  closeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.closingId) return;
    const fd = new FormData(closeForm);
    const body = { outcome: fd.get('outcome') };
    if (body.outcome === 'lost') body.lostReason = fd.get('lostReason') || undefined;
    try {
      await api(`/api/crm/deals/${state.closingId}/close`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const verb = body.outcome === 'won' ? '🏆 Deal ganado' : '❌ Deal perdido';
      toast(`Cerraste el deal como ${body.outcome === 'won' ? 'won' : 'lost'}.`, { type: body.outcome === 'won' ? 'success' : 'warn', title: verb });
      closeDlg.close();
      loadDeals();
    } catch (err) {
      toast(err.message, { type: 'error', title: 'Error al cerrar el deal' });
    }
  });

  init();
})();
