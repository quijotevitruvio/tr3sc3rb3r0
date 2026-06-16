// apps/api/src/modules/bot/fuzzy.ts
function normalize(s) {
  return s.toLowerCase().replace(/ñ/g, "n").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}
function ratio(a, b) {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}
function commonPrefixLen(a, b) {
  let i = 0;
  const m = Math.min(a.length, b.length);
  while (i < m && a[i] === b[i]) i++;
  return i;
}
function tokenScore(tok, kw) {
  if (tok === kw) return 1;
  const p = commonPrefixLen(tok, kw);
  const shorter = Math.min(tok.length, kw.length);
  if (Math.abs(tok.length - kw.length) <= 2 && p >= 4 && p >= shorter - 1) return 0.9;
  return ratio(tok, kw);
}
function scoreKeyword(inputNorm, keywordNorm) {
  const inputTokens = inputNorm.split(" ").filter(Boolean);
  const kwTokens = keywordNorm.split(" ").filter(Boolean);
  if (!kwTokens.length || !inputTokens.length) return 0;
  let acc = 0;
  for (const kw of kwTokens) {
    let best = 0;
    for (const tok of inputTokens) {
      const s = tokenScore(tok, kw);
      if (s > best) best = s;
    }
    acc += best;
  }
  return acc / kwTokens.length;
}
function bestKeywordScore(input, keywords) {
  const inputNorm = normalize(input);
  let best = 0;
  for (const kw of keywords) {
    const s = scoreKeyword(inputNorm, normalize(kw));
    if (s > best) best = s;
  }
  return best;
}

// apps/api/src/modules/bot/engine.ts
var DEFAULT_THRESHOLD = 0.72;
var DEFAULT_MAX_MISSES = 2;
function initState(flow) {
  return { nodeId: flow.start, vars: {}, misses: 0 };
}
function render(text, vars) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}
function matchIntent(intent, input, threshold) {
  if (input.buttonId && intent.buttons?.includes(input.buttonId)) return 1;
  const text = input.text ?? "";
  if (!text.trim()) return 0;
  if (intent.regex) {
    try {
      if (new RegExp(intent.regex, "i").test(text)) return 1;
    } catch {
    }
  }
  if (intent.keywords?.length) {
    const s = bestKeywordScore(text, intent.keywords);
    return s >= threshold ? s : 0;
  }
  return 0;
}
function step(flow, state, input) {
  const threshold = flow.threshold ?? DEFAULT_THRESHOLD;
  const maxMisses = flow.maxMisses ?? DEFAULT_MAX_MISSES;
  const node = flow.nodes[state.nodeId];
  if (!node) {
    return {
      reply: { text: "Te paso con un asesor." },
      state: { ...state, misses: 0 },
      actions: [{ type: "handoff", reason: "flow" }],
      handoff: true,
      done: false
    };
  }
  let chosen = null;
  let bestScore = 0;
  for (const intent of node.intents ?? []) {
    const score = matchIntent(intent, input, threshold);
    if (score > bestScore) {
      bestScore = score;
      chosen = intent;
      if (score === 1) break;
    }
  }
  if (!chosen) {
    const misses = state.misses + 1;
    if (misses >= maxMisses) {
      return {
        reply: { text: "Dejame que te conecte con alguien del equipo \u{1F64C}" },
        state: { ...state, misses: 0 },
        actions: [{ type: "handoff", reason: "fallback" }],
        handoff: true,
        done: false
      };
    }
    const fb = node.fallback;
    const nextId = fb?.next ?? node.id;
    const next = flow.nodes[nextId] ?? node;
    const text = fb?.say ? render(fb.say, state.vars) : render(next.say, state.vars);
    return {
      reply: { text, buttons: next.buttons },
      state: { nodeId: nextId, vars: state.vars, misses },
      actions: [],
      handoff: false,
      done: false
    };
  }
  const vars = { ...state.vars };
  const actions = [];
  if (chosen.captureAs && input.text) {
    let value = input.text.trim();
    if (chosen.regex) {
      try {
        const m = input.text.match(new RegExp(chosen.regex, "i"));
        if (m) value = (m[1] ?? m[0]).trim();
      } catch {
      }
    }
    vars[chosen.captureAs] = value;
    actions.push({ type: "capture", key: chosen.captureAs, value });
  }
  for (const a of chosen.actions ?? []) actions.push(a);
  const nextNode = flow.nodes[chosen.next];
  if (!nextNode) {
    return {
      reply: { text: "Te paso con un asesor." },
      state: { nodeId: state.nodeId, vars, misses: 0 },
      actions: [...actions, { type: "handoff", reason: "flow" }],
      handoff: true,
      done: false
    };
  }
  const handoff = actions.some((a) => a.type === "handoff");
  return {
    reply: { text: render(nextNode.say, vars), buttons: nextNode.buttons },
    state: { nodeId: nextNode.id, vars, misses: 0 },
    actions,
    handoff,
    done: !!nextNode.terminal
  };
}
function greeting(flow, state = initState(flow)) {
  const node = flow.nodes[flow.start];
  return {
    reply: { text: render(node.say, state.vars), buttons: node.buttons },
    state,
    actions: [],
    handoff: false,
    done: !!node.terminal
  };
}

// apps/api/src/modules/bot/flow.example.ts
var EXAMPLE_FLOW = {
  id: "demo-pyme",
  start: "menu",
  threshold: 0.72,
  maxMisses: 2,
  nodes: {
    menu: {
      id: "menu",
      say: "\xA1Hola! \u{1F44B} Soy el asistente de la tienda. \xBFEn qu\xE9 te ayudo?",
      buttons: [
        { id: "catalogo", title: "Ver cat\xE1logo" },
        { id: "agendar", title: "Agendar cita" },
        { id: "asesor", title: "Hablar con asesor" }
      ],
      intents: [
        {
          id: "i_catalogo",
          buttons: ["catalogo"],
          keywords: ["catalogo", "productos", "precios", "que venden", "ver productos"],
          next: "catalogo",
          actions: [{ type: "show_catalog" }]
        },
        {
          id: "i_agendar",
          buttons: ["agendar"],
          keywords: ["agendar", "cita", "reservar", "turno", "hora"],
          next: "agendar_nombre"
        },
        {
          id: "i_faq",
          keywords: ["horario", "donde quedan", "direccion", "envios", "pago", "pregunta"],
          next: "faq"
        },
        {
          id: "i_asesor",
          buttons: ["asesor"],
          keywords: ["asesor", "humano", "persona", "hablar con alguien"],
          next: "menu",
          actions: [{ type: "handoff", reason: "requested" }]
        }
      ],
      fallback: {
        say: 'No te entend\xED \u{1F914}. Eleg\xED una opci\xF3n del men\xFA o escrib\xED "asesor" para hablar con el equipo.'
      }
    },
    catalogo: {
      id: "catalogo",
      say: "Te comparto el cat\xE1logo \u{1F4C4}. \xBFQuer\xE9s agendar una cita para verlo en persona o seguir por aqu\xED?",
      buttons: [
        { id: "agendar", title: "Agendar cita" },
        { id: "asesor", title: "Hablar con asesor" }
      ],
      intents: [
        { id: "c_agendar", buttons: ["agendar"], keywords: ["agendar", "cita", "si"], next: "agendar_nombre" },
        { id: "c_asesor", buttons: ["asesor"], keywords: ["asesor", "humano"], next: "menu", actions: [{ type: "handoff", reason: "requested" }] }
      ],
      fallback: { next: "menu" }
    },
    faq: {
      id: "faq",
      say: "Estamos en Medell\xEDn, atendemos L-V 8am-6pm y hacemos env\xEDos a todo el pa\xEDs \u{1F69A}. \xBFAlgo m\xE1s?",
      buttons: [
        { id: "agendar", title: "Agendar cita" },
        { id: "asesor", title: "Hablar con asesor" }
      ],
      intents: [
        { id: "f_agendar", buttons: ["agendar"], keywords: ["agendar", "cita"], next: "agendar_nombre" },
        { id: "f_asesor", buttons: ["asesor"], keywords: ["asesor", "humano"], next: "menu", actions: [{ type: "handoff", reason: "requested" }] }
      ],
      fallback: { next: "menu" }
    },
    // ── Agendamiento: captura nombre → teléfono → confirma + crea lead ──────────
    agendar_nombre: {
      id: "agendar_nombre",
      say: "Perfecto \u{1F64C}. \xBFCu\xE1l es tu nombre?",
      intents: [
        {
          id: "a_nombre",
          regex: ".{2,}",
          // cualquier texto de 2+ chars
          captureAs: "nombre",
          next: "agendar_telefono",
          actions: [{ type: "tag", tag: "lead-whatsapp" }]
        }
      ],
      fallback: { say: "Decime tu nombre para continuar \u{1F642}" }
    },
    agendar_telefono: {
      id: "agendar_telefono",
      say: "Gracias {{nombre}}. \xBFA qu\xE9 n\xFAmero te contactamos? (10 d\xEDgitos)",
      intents: [
        {
          id: "a_tel",
          regex: "\\b\\d{10}\\b",
          // celular colombiano
          captureAs: "telefono",
          next: "agendar_ok",
          actions: [{ type: "create_lead" }]
        }
      ],
      fallback: { say: "Pasame un n\xFAmero de 10 d\xEDgitos, por favor \u{1F4F1}" }
    },
    agendar_ok: {
      id: "agendar_ok",
      say: "\xA1Listo {{nombre}}! Un asesor te escribe al {{telefono}} para confirmar la cita. \u2705",
      terminal: true
    }
  }
};
export {
  EXAMPLE_FLOW,
  greeting,
  initState,
  step
};
