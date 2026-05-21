// Knowledge Graph: vis-network + side panel con detalles y notas.
(async () => {
  await window.__shell;
  const { api, relativeDate, shortDate, showError, hideError } = window.crm;
  const esc = window.__escapeHtml;

  const canvas = document.getElementById('graphCanvas');
  const side = document.getElementById('nodePanel');
  const capInfo = document.getElementById('capInfo');
  let network = null;

  // Paleta coherente con landing: amber primario (contact = entidad principal del CRM).
  // company, deal y tag tienen colores secundarios para diferenciar visualmente.
  const COLORS = {
    contact: { bg: '#1f1505', border: '#FFB300', text: '#ffffff' },
    company: { bg: '#0a1820', border: '#00C8FF', text: '#ffffff' },
    deal:    { bg: '#0d1f0a', border: '#39ff14', text: '#ffffff' },
    tag:     { bg: '#1d091d', border: '#ff4cf0', text: '#ffffff' },
  };

  async function loadGraph() {
    side.innerHTML = '<div class="graph-side-empty">Cargando grafo…</div>';
    try {
      const data = await api('/api/crm/graph');
      renderGraph(data);
      capInfo.textContent = `${data.nodes.length} nodos · plan ${data.tier.toUpperCase()} (cap ${data.cap})`;
    } catch (e) {
      canvas.innerHTML = `<div class="crm-empty"><p>Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderGraph({ nodes, edges }) {
    if (!nodes.length) {
      canvas.innerHTML = `<div class="crm-empty"><p>Sin datos todavía. Cargá contactos, empresas o tags para ver el grafo.</p></div>`;
      side.innerHTML = '<div class="graph-side-empty">Seleccioná un nodo para ver detalles.</div>';
      return;
    }

    const visNodes = nodes.map((n) => {
      const c = COLORS[n.group];
      const isDeal = n.group === 'deal';
      const won = isDeal && n.meta?.status === 'won';
      const lost = isDeal && n.meta?.status === 'lost';
      return {
        id: n.id,
        label: n.label.length > 30 ? n.label.slice(0, 28) + '…' : n.label,
        title: n.label,
        group: n.group,
        shape: n.group === 'tag' ? 'box' : 'dot',
        size: n.group === 'tag' ? 10 : 18,
        color: {
          background: won ? '#0d2a0a' : lost ? '#2a0a0a' : c.bg,
          border: won ? '#39ff14' : lost ? '#ff4c4c' : c.border,
          highlight: { background: c.border, border: c.border },
        },
        font: { color: c.text, size: 12, face: 'system-ui' },
      };
    });

    const visEdges = edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
      label: e.label,
      arrows: 'to',
      color: { color: 'rgba(255,255,255,0.15)', highlight: '#FFB300' },
      font: { color: 'rgba(255,255,255,0.4)', size: 9, strokeWidth: 0, align: 'middle' },
      smooth: { type: 'continuous' },
    }));

    const options = {
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: { gravitationalConstant: -60, springLength: 100, springConstant: 0.08, avoidOverlap: 0.5 },
        stabilization: { iterations: 250 },
      },
      interaction: { hover: true, navigationButtons: false, keyboard: false },
      nodes: { borderWidth: 2 },
      edges: { width: 1 },
    };

    if (network) network.destroy();
    network = new vis.Network(canvas, { nodes: visNodes, edges: visEdges }, options);

    network.on('click', (params) => {
      if (params.nodes.length) renderSidePanel(params.nodes[0]);
    });
  }

  // ── Panel lateral con detalle del nodo + notas + tags ─────────
  async function renderSidePanel(nodeId) {
    const [type, hexId] = nodeId.split(':');
    // hexId no es UUID canónico todavía; lo formateamos.
    const uuid = `${hexId.slice(0,8)}-${hexId.slice(8,12)}-${hexId.slice(12,16)}-${hexId.slice(16,20)}-${hexId.slice(20)}`;

    side.innerHTML = '<div class="graph-side-empty">Cargando…</div>';
    try {
      if (type === 'tag') {
        // Para tags, mostrar el listado de entidades con ese tag (limitado).
        side.innerHTML = `<div class="graph-side-body"><h3>Tag</h3><p>ID: <code>${esc(uuid)}</code></p><p style="color:var(--app-dim)">Click en otro nodo para ver detalles enriquecidos.</p></div>`;
        return;
      }

      const endpoint = type === 'contact' ? 'contacts' : type === 'company' ? 'companies' : 'deals';
      const entityKey = type;
      const data = await api(`/api/crm/${endpoint}/${uuid}`);
      const entity = data[entityKey];

      const [tagsData, notesData] = await Promise.all([
        api(`/api/crm/tags/of/${type}/${uuid}`),
        api(`/api/crm/notes?entityType=${type}&entityId=${uuid}`),
      ]);

      side.innerHTML = renderEntityDetail(type, entity, tagsData.tags, notesData.notes);
      wireSidePanel(type, uuid);
    } catch (e) {
      side.innerHTML = `<div class="graph-side-body"><p style="color:var(--app-err)">Error: ${esc(e.message)}</p></div>`;
    }
  }

  function renderEntityDetail(type, entity, tags, notes) {
    let title = '';
    let body = '';
    if (type === 'contact') {
      title = `${entity.firstName} ${entity.lastName || ''}`.trim();
      body = `
        <p><strong>Email:</strong> ${esc(entity.email || '—')}</p>
        <p><strong>Teléfono:</strong> ${esc(entity.phone || '—')}</p>
        <p><strong>Cargo:</strong> ${esc(entity.jobTitle || '—')}</p>
        <p><strong>Score:</strong> ${entity.score}</p>`;
    } else if (type === 'company') {
      title = entity.name;
      body = `
        <p><strong>Web:</strong> ${esc(entity.website || '—')}</p>
        <p><strong>Industria:</strong> ${esc(entity.industry || '—')}</p>
        <p><strong>Tamaño:</strong> ${esc(entity.sizeBucket || '—')}</p>
        <p><strong>Ubicación:</strong> ${[entity.city, entity.country].filter(Boolean).join(', ') || '—'}</p>`;
    } else if (type === 'deal') {
      title = entity.title;
      body = `
        <p><strong>Monto:</strong> ${entity.amount} ${esc(entity.currency)}</p>
        <p><strong>Status:</strong> <span class="badge">${esc(entity.status)}</span></p>
        <p><strong>Cierre esperado:</strong> ${entity.expectedCloseDate || '—'}</p>`;
    }

    const tagsHtml = tags.length
      ? `<div class="tag-row">${tags.map((t) => `<span class="tag-pill" style="border-color:${esc(t.color)}; color:${esc(t.color)}">#${esc(t.name)}</span>`).join('')}</div>`
      : `<p style="color:var(--app-dim); font-size:0.85rem">Sin tags.</p>`;

    const notesHtml = notes.length
      ? notes.map((n) => `
        <div class="note-item">
          <div class="note-meta">${relativeDate(n.createdAt)}</div>
          <div class="note-body">${esc(n.body)}</div>
        </div>`).join('')
      : `<p style="color:var(--app-dim); font-size:0.85rem">Sin notas.</p>`;

    return `
      <div class="graph-side-body">
        <h3>${esc(title)}</h3>
        <small style="color:var(--app-dim); text-transform:uppercase; letter-spacing:0.08em">${type}</small>
        <div style="display:flex; gap:0.4rem; margin:0.6rem 0;">
          <a class="btn-ghost" style="padding:0.3rem 0.6rem; font-size:0.75rem;" href="/api/ai/export/${type}/${entity.id}.md" download target="_blank" rel="noopener">⬇ Export .md (Pro+)</a>
        </div>
        <div class="graph-side-meta">${body}</div>

        <h4>Tags</h4>
        ${tagsHtml}

        <h4>Notas (${notes.length})</h4>
        ${notesHtml}

        <h4>+ Agregar nota</h4>
        <form id="addNoteForm">
          <textarea id="noteBody" rows="3" placeholder="Escribí tu nota. Usá #tag para etiquetar y [[Nombre Entidad]] para conectar." style="width:100%; background:var(--app-bg); border:1px solid var(--app-border); color:var(--app-fg); padding:0.5rem; font-family:inherit; font-size:0.85rem;"></textarea>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
            <small style="color:var(--app-dim); font-size:0.7rem;">#tag o [[Entidad]]</small>
            <button class="btn-primary" type="submit" style="padding:0.4rem 0.8rem; font-size:0.75rem;">Guardar</button>
          </div>
          <div class="err" id="noteErr" hidden style="margin-top:0.3rem;"></div>
          <div id="parseFeedback" style="margin-top:0.5rem; font-size:0.75rem;"></div>
        </form>
      </div>`;
  }

  function wireSidePanel(type, uuid) {
    const form = document.getElementById('addNoteForm');
    const err = document.getElementById('noteErr');
    const feedback = document.getElementById('parseFeedback');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError(err);
      feedback.innerHTML = '';
      const body = document.getElementById('noteBody').value.trim();
      if (!body) { showError(err, 'La nota no puede estar vacía.'); return; }
      try {
        const r = await api('/api/crm/notes', {
          method: 'POST',
          body: JSON.stringify({ entityType: type, entityId: uuid, body }),
        });
        const p = r.parsed || {};
        const msgs = [];
        if (p.hashtagsCreated?.length) msgs.push(`Tags creados: ${p.hashtagsCreated.map((t) => `#${t}`).join(', ')}`);
        if (p.hashtagsLinked?.length) msgs.push(`Tags vinculados: ${p.hashtagsLinked.map((t) => `#${t}`).join(', ')}`);
        if (p.wikilinksMatched?.length) msgs.push(`Conexiones: ${p.wikilinksMatched.map((w) => `[[${w.label}]]`).join(', ')}`);
        if (p.wikilinksBroken?.length) msgs.push(`Sin match: ${p.wikilinksBroken.map((w) => `[[${w}]]`).join(', ')}`);
        if (msgs.length) feedback.innerHTML = `<div style="color:var(--app-a)">✓ ${esc(msgs.join(' · '))}</div>`;
        // Recargar panel + grafo
        setTimeout(() => {
          renderSidePanel(`${type}:${uuid.replace(/-/g, '')}`);
          loadGraph();
        }, 800);
      } catch (er) {
        showError(err, er.message);
      }
    });
  }

  document.getElementById('fitBtn').addEventListener('click', () => network?.fit());
  document.getElementById('refreshBtn').addEventListener('click', loadGraph);

  loadGraph();
})();
