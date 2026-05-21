// Contacts: tabla paginada con búsqueda + modal de creación/edición.
(async () => {
  await window.__shell;
  const { api, money, relativeDate, showError, hideError, toast, showSkeleton } = window.crm;
  const esc = window.__escapeHtml;

  const state = { page: 1, q: '', editing: null };
  let companiesCache = [];

  const tableHost = document.getElementById('tableHost');
  const pagHost = document.getElementById('paginationHost');
  const searchInput = document.getElementById('searchInput');
  const dlg = document.getElementById('contactDialog');
  const form = document.getElementById('contactForm');
  const formErr = document.getElementById('formErr');
  const dialogTitle = document.getElementById('dialogTitle');
  const submitBtn = document.getElementById('submitBtn');
  const companySel = form.elements.companyId;

  async function loadCompanies() {
    try {
      const { companies } = await api('/api/crm/companies?pageSize=100');
      companiesCache = companies;
      companySel.innerHTML = '<option value="">— Sin empresa —</option>' +
        companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    } catch (e) {
      console.warn('No se pudieron cargar empresas:', e);
    }
  }

  async function loadList() {
    showSkeleton(tableHost, 5);
    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: '20',
      ...(state.q ? { q: state.q } : {}),
    });
    try {
      const { contacts, pagination } = await api('/api/crm/contacts?' + params);
      renderTable(contacts);
      renderPagination(pagination);
    } catch (e) {
      tableHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
      toast(e.message, { type: 'error', title: 'No pudimos cargar contactos' });
    }
  }

  function renderTable(contacts) {
    if (!contacts.length) {
      tableHost.innerHTML = `
        <div class="crm-empty">
          <p>${state.q ? 'Sin resultados para tu búsqueda.' : 'Todavía no cargaste ningún contacto.'}</p>
          ${!state.q ? '<button class="btn-primary" id="emptyCreate">Crear el primero</button>' : ''}
        </div>`;
      document.getElementById('emptyCreate')?.addEventListener('click', () => openCreate());
      return;
    }
    tableHost.innerHTML = `
      <table class="crm-table">
        <thead>
          <tr>
            <th>Nombre</th><th>Empresa</th><th>Email</th><th>Teléfono</th><th>Cargo</th><th>Score</th><th>Creado</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map((c) => {
            const full = `${esc(c.firstName)} ${esc(c.lastName || '')}`.trim();
            return `<tr data-id="${c.id}">
              <td>${full}</td>
              <td>${c.company ? esc(c.company.name) : '<span style="color:var(--app-dim)">—</span>'}</td>
              <td>${esc(c.email || '')}</td>
              <td>${esc(c.phone || '')}</td>
              <td>${esc(c.jobTitle || '')}</td>
              <td><span class="badge">${c.score}</span></td>
              <td>${relativeDate(c.createdAt)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    tableHost.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => openEdit(tr.dataset.id));
    });
  }

  function renderPagination({ page, totalPages, total }) {
    if (totalPages <= 1) { pagHost.innerHTML = ''; return; }
    pagHost.innerHTML = `
      <button class="btn-ghost" ${page <= 1 ? 'disabled' : ''} data-act="prev">← Anterior</button>
      <span class="page-info">Página ${page} de ${totalPages} (${total} total)</span>
      <button class="btn-ghost" ${page >= totalPages ? 'disabled' : ''} data-act="next">Siguiente →</button>`;
    pagHost.querySelector('[data-act=prev]')?.addEventListener('click', () => { state.page--; loadList(); });
    pagHost.querySelector('[data-act=next]')?.addEventListener('click', () => { state.page++; loadList(); });
  }

  // Búsqueda con debounce simple
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchInput.value.trim();
      state.page = 1;
      loadList();
    }, 300);
  });

  // ── Modal crear/editar ────────────────────────────────────────
  function openCreate() {
    state.editing = null;
    dialogTitle.textContent = 'Nuevo contacto';
    submitBtn.textContent = 'Crear contacto';
    form.reset();
    hideError(formErr);
    dlg.showModal();
  }

  async function openEdit(id) {
    try {
      const { contact } = await api(`/api/crm/contacts/${id}`);
      state.editing = id;
      dialogTitle.textContent = 'Editar contacto';
      submitBtn.textContent = 'Guardar cambios';
      form.elements.firstName.value = contact.firstName || '';
      form.elements.lastName.value = contact.lastName || '';
      form.elements.email.value = contact.email || '';
      form.elements.phone.value = contact.phone || '';
      form.elements.jobTitle.value = contact.jobTitle || '';
      form.elements.source.value = contact.source || '';
      form.elements.companyId.value = contact.companyId || '';
      hideError(formErr);
      dlg.showModal();
    } catch (e) {
      alert('No pudimos cargar el contacto: ' + e.message);
    }
  }

  document.getElementById('newBtn').addEventListener('click', openCreate);
  document.getElementById('cancelBtn').addEventListener('click', () => dlg.close());
  document.getElementById('dialogClose').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(formErr);
    submitBtn.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    // Limpiar vacíos
    Object.keys(data).forEach((k) => { if (data[k] === '') delete data[k]; });

    try {
      if (state.editing) {
        await api(`/api/crm/contacts/${state.editing}`, { method: 'PATCH', body: JSON.stringify(data) });
        toast('Cambios guardados', { type: 'success', title: data.firstName });
      } else {
        await api('/api/crm/contacts', { method: 'POST', body: JSON.stringify(data) });
        toast(`${data.firstName} ${data.lastName || ''} creado`, { type: 'success', title: 'Contacto nuevo' });
      }
      dlg.close();
      state.page = 1;
      loadList();
    } catch (err) {
      const detail = err.details?.details?.email?.[0] || err.message;
      showError(formErr, detail);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Inicial
  loadCompanies();
  loadList();
})();
