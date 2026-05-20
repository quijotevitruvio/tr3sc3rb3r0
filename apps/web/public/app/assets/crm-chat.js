// Chat con el CRM. Asistente IA con tool calling.
(async () => {
  await window.__shell;
  const { api, relativeDate } = window.crm;
  const esc = window.__escapeHtml;

  const state = {
    sessionId: null,
    messages: [], // {role, content (string|array), actions?}
    sending: false,
  };

  const messagesHost = document.getElementById('messages');
  const composer = document.getElementById('composer');
  const input = document.getElementById('composerInput');
  const sendBtn = document.getElementById('sendBtn');
  const statusBar = document.getElementById('chatStatus');
  const actionsLog = document.getElementById('actionsLog');
  const actionsList = document.getElementById('actionsList');
  const sessionList = document.getElementById('sessionList');

  async function loadSessions() {
    try {
      const { sessions } = await api('/api/chat/sessions');
      renderSessions(sessions);
    } catch (e) {
      sessionList.innerHTML = `<li style="color:var(--app-err); font-size:0.8rem">${esc(e.message)}</li>`;
    }
  }

  function renderSessions(sessions) {
    if (!sessions.length) {
      sessionList.innerHTML = '<li style="color:var(--app-dim); font-size:0.8rem">Sin conversaciones todavía.</li>';
      return;
    }
    sessionList.innerHTML = sessions.map((s) => `
      <li class="${s.id === state.sessionId ? 'active' : ''}" data-id="${s.id}">
        <span class="sess-title">${esc(s.title || 'Conversación')}</span>
        <span class="sess-date">${relativeDate(s.lastMessageAt)}</span>
      </li>
    `).join('');
    sessionList.querySelectorAll('li[data-id]').forEach((li) => {
      li.addEventListener('click', () => loadSession(li.dataset.id));
    });
  }

  async function loadSession(id) {
    try {
      const { messages } = await api(`/api/chat/sessions/${id}`);
      state.sessionId = id;
      state.messages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));
      render();
      loadSessions();
    } catch (e) {
      alert('Error cargando conversación: ' + e.message);
    }
  }

  function render() {
    if (!state.messages.length) {
      messagesHost.innerHTML = `
        <div class="chat-empty">
          <h3>👋 Probá pidiendo algo como:</h3>
          <ul>
            <li>"Dame un resumen de mi CRM"</li>
            <li>"Creá una empresa llamada Beta Solutions, industria tech"</li>
            <li>"Buscá contactos llamados Juan"</li>
            <li>"Creá un deal para Acme por 5 millones"</li>
            <li>"Agregale una nota al deal: cliente #interesado en demo"</li>
          </ul>
        </div>`;
      return;
    }
    messagesHost.innerHTML = state.messages.map(renderMessage).join('');
    messagesHost.scrollTop = messagesHost.scrollHeight;
  }

  function renderMessage(m) {
    if (m.role === 'user') {
      const text = typeof m.content === 'string' ? m.content : '';
      return `<div class="msg msg-user"><div class="msg-body">${esc(text).replace(/\n/g, '<br>')}</div></div>`;
    }
    // assistant: content puede ser string o array (blocks de Anthropic)
    let text = '';
    let toolCalls = [];
    if (typeof m.content === 'string') {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === 'text') text += block.text + '\n';
        if (block.type === 'tool_use') toolCalls.push(`${block.name}(${formatArgs(block.input)})`);
      }
    }
    return `<div class="msg msg-assistant">
      <div class="msg-body">${esc(text.trim()).replace(/\n/g, '<br>')}</div>
      ${toolCalls.length ? `<div class="msg-tools">⚙ ${toolCalls.map(esc).join(' · ')}</div>` : ''}
    </div>`;
  }

  function formatArgs(input) {
    if (!input || typeof input !== 'object') return '';
    return Object.entries(input).slice(0, 3).map(([k, v]) =>
      `${k}=${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v)}`
    ).join(', ');
  }

  // ── Composer ────────────────────────────────────────────────
  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.sending) return;
    const msg = input.value.trim();
    if (!msg) return;

    state.messages.push({ role: 'user', content: msg });
    render();
    input.value = '';
    state.sending = true;
    sendBtn.disabled = true;
    statusBar.textContent = '🧠 Pensando…';

    try {
      const body = state.sessionId ? { message: msg, sessionId: state.sessionId } : { message: msg };
      const r = await api('/api/chat', { method: 'POST', body: JSON.stringify(body) });
      state.sessionId = r.sessionId;
      // El backend ya guardó todo; recargamos los mensajes para reflejar el estado real.
      const { messages } = await api(`/api/chat/sessions/${r.sessionId}`);
      state.messages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
      render();
      renderActions(r.actions, r.usage);
      loadSessions();
    } catch (err) {
      state.messages.push({ role: 'assistant', content: `❌ Error: ${err.message}` });
      render();
    } finally {
      state.sending = false;
      sendBtn.disabled = false;
      statusBar.textContent = '';
    }
  });

  // Enter envía, Shift+Enter nueva línea
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  function renderActions(actions, usage) {
    if (!actions || !actions.length) { actionsLog.hidden = true; return; }
    actionsLog.hidden = false;
    actionsList.innerHTML = actions.map((a) => {
      const ok = !a.result?.error;
      return `<li class="${ok ? 'ok' : 'err'}">
        <span class="act-name">${esc(a.tool)}</span>
        <span class="act-result">${ok ? '✓' : '✗'} ${esc(JSON.stringify(a.result).slice(0, 200))}</span>
      </li>`;
    }).join('');
    if (usage) {
      actionsList.insertAdjacentHTML('beforeend',
        `<li style="color:var(--app-dim); font-size:0.7rem; margin-top:0.5rem;">Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out</li>`);
    }
  }

  document.getElementById('newSessionBtn').addEventListener('click', () => {
    state.sessionId = null;
    state.messages = [];
    render();
    actionsLog.hidden = true;
    input.focus();
  });

  loadSessions();
  input.focus();
})();
