// Hub CRM — KPIs + actividad reciente.
(async () => {
  await window.__shell;
  const { api, money, relativeDate } = window.crm;

  // KPIs en paralelo
  try {
    const [open, won, contacts, companies, tasks, activity] = await Promise.all([
      api('/api/crm/deals?status=open&pageSize=100'),
      api('/api/crm/deals?status=won&pageSize=100'),
      api('/api/crm/contacts?pageSize=1'),
      api('/api/crm/companies?pageSize=1'),
      api('/api/crm/tasks?assignedToMe=true&status=todo&pageSize=1'),
      api('/api/crm/activities?pageSize=15'),
    ]);

    const sumOpen = open.deals.reduce((s, d) => s + Number(d.amount), 0);
    const sumWon = won.deals.reduce((s, d) => s + Number(d.amount), 0);

    document.getElementById('kpiOpenDeals').textContent = open.pagination.total;
    document.getElementById('kpiOpenValue').textContent = money(sumOpen) + ' en pipeline';

    document.getElementById('kpiWonDeals').textContent = won.pagination.total;
    document.getElementById('kpiWonValue').textContent = money(sumWon) + ' ganados';

    document.getElementById('kpiContacts').textContent = contacts.pagination.total;
    document.getElementById('kpiCompanies').textContent = companies.pagination.total;
    document.getElementById('kpiTasks').textContent = tasks.pagination.total;

    // Timeline reciente
    const list = document.getElementById('recentActivity');
    if (!activity.activities.length) {
      list.innerHTML = '<li>Sin actividad todavía. Creá tu primer contacto.</li>';
    } else {
      list.innerHTML = activity.activities.map((a) => {
        const who = a.actor.name || a.actor.email || a.actor.kind;
        return `<li>${window.__escapeHtml(who)} <em style="color:var(--app-dim)">${a.verb}</em> ${a.entityType} <span style="color:var(--app-dim); font-size:0.8em;">· ${relativeDate(a.createdAt)}</span></li>`;
      }).join('');
    }
  } catch (err) {
    console.error('CRM hub error', err);
    document.querySelector('main.content').insertAdjacentHTML('afterbegin',
      `<div class="auth-error" style="display:block">No pudimos cargar el CRM: ${window.__escapeHtml(err.message)}</div>`);
  }
})();
