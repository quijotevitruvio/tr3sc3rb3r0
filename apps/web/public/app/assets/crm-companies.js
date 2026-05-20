// Companies: tabla paginada con búsqueda + modal de creación/edición.
(async () => {
  await window.__shell;
  const { api, relativeDate, showError, hideError } = window.crm;
  const esc = window.__escapeHtml;

  const state = { page: 1, q: '', editing: null };

  const tableHost = document.getElementById('tableHost');
  const pagHost = document.getElementById('paginationHost');
  const searchInput = document.getElementById('searchInput');
  const dlg = document.getElementById('companyDialog');
  const form = document.getElementById('companyForm');
  const formErr = document.getElementById('formErr');
  const dialogTitle = document.getElementById('dialogTitle');
  const submitBtn = document.getElementById('submitBtn');

  const COUNTRY_NAMES = {
    CO: 'Colombia', MX: 'México', AR: 'Argentina', CL: 'Chile', PE: 'Perú',
    EC: 'Ecuador', US: 'Estados Unidos', ES: 'España', BR: 'Brasil',
  };

  async function loadList() {
    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: '20',
      ...(state.q ? { q: state.q } : {}),
    });
    try {
      const { companies, pagination } = await api('/api/crm/companies?' + params);
      renderTable(companies);
      renderPagination(pagination);
    } catch (e) {
      tableHost.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderTable(companies) {
    if (!companies.length) {
      tableHost.innerHTML = `
        <div class="crm-empty">
          <p>${state.q ? 'Sin resultados para tu búsqueda.' : 'Todavía no cargaste ninguna empresa.'}</p>
          ${!state.q ? '<button class="btn-primary" id="emptyCreate">Crear la primera</button>' : ''}
        </div>`;
      document.getElementById('emptyCreate')?.addEventListener('click', () => openCreate());
      return;
    }
    tableHost.innerHTML = `
      <table class="crm-table">
        <thead>
          <tr>
            <th>Nombre</th><th>Sitio</th><th>Industria</th><th>Tamaño</th><th>Ubicación</th><th>Creada</th>
          </tr>
        </thead>
        <tbody>
          ${companies.map((c) => `
            <tr data-id="${c.id}">
              <td><strong>${esc(c.name)}</strong></td>
              <td>${c.website ? `<a href="${esc(c.website.startsWith('http') ? c.website : 'https://' + c.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(c.website)}</a>` : '<span style="color:var(--app-dim)">—</span>'}</td>
              <td>${esc(c.industry || '—')}</td>
              <td>${c.sizeBucket ? `<span class="badge">${esc(c.sizeBucket)}</span>` : '<span style="color:var(--app-dim)">—</span>'}</td>
              <td>${[c.city, COUNTRY_NAMES[c.country] || c.country].filter(Boolean).join(', ') || '<span style="color:var(--app-dim)">—</span>'}</td>
              <td>${relativeDate(c.createdAt)}</td>
            </tr>
          `).join('')}
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

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchInput.value.trim();
      state.page = 1;
      loadList();
    }, 300);
  });

  function openCreate() {
    state.editing = null;
    dialogTitle.textContent = 'Nueva empresa';
    submitBtn.textContent = 'Crear empresa';
    form.reset();
    form.elements.country.value = 'CO'; // default Colombia
    hideError(formErr);
    dlg.showModal();
  }

  async function openEdit(id) {
    try {
      const { company } = await api(`/api/crm/companies/${id}`);
      state.editing = id;
      dialogTitle.textContent = 'Editar empresa';
      submitBtn.textContent = 'Guardar cambios';
      form.elements.name.value = company.name || '';
      form.elements.website.value = company.website || '';
      form.elements.industry.value = company.industry || '';
      form.elements.sizeBucket.value = company.sizeBucket || '';
      form.elements.country.value = company.country || '';
      form.elements.city.value = company.city || '';
      form.elements.notesShort.value = company.notesShort || '';
      hideError(formErr);
      dlg.showModal();
    } catch (e) {
      alert('No pudimos cargar la empresa: ' + e.message);
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
    Object.keys(data).forEach((k) => { if (data[k] === '') delete data[k]; });

    try {
      if (state.editing) {
        await api(`/api/crm/companies/${state.editing}`, { method: 'PATCH', body: JSON.stringify(data) });
      } else {
        await api('/api/crm/companies', { method: 'POST', body: JSON.stringify(data) });
      }
      dlg.close();
      state.page = 1;
      loadList();
    } catch (err) {
      showError(formErr, err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadList();
})();
