// Tests del motor "Fake IA" — usan node:test integrado (sin instalar runner).
// Correr:  npx tsx --test src/modules/bot/engine.test.ts
//   (o)    node --import tsx --test src/modules/bot/engine.test.ts
//
// Cubre el determinismo: botones, fuzzy con typos/tildes, regex de captura,
// create_lead, y escalado a humano por fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, greeting, initState, render } from './engine.js';
import { normalize, bestKeywordScore } from './fuzzy.js';
import { EXAMPLE_FLOW as F } from './flow.example.js';

test('greeting entra al nodo menú con sus botones', () => {
  const g = greeting(F);
  assert.match(g.reply.text, /asistente/i);
  assert.equal(g.reply.buttons?.length, 3);
  assert.equal(g.state.nodeId, 'menu');
});

test('match por botón: catálogo dispara show_catalog', () => {
  const s = initState(F);
  const r = step(F, s, { buttonId: 'catalogo' });
  assert.equal(r.state.nodeId, 'catalogo');
  assert.ok(r.actions.some((a) => a.type === 'show_catalog'));
  assert.equal(r.handoff, false);
});

test('fuzzy: "agndar una sita" (con typos) cae en agendar', () => {
  const s = initState(F);
  const r = step(F, s, { text: 'quiero agndar una sita' });
  assert.equal(r.state.nodeId, 'agendar_nombre');
});

test('normaliza tildes: "catálogo" → catalogo', () => {
  assert.equal(normalize('CATÁLOGO'), 'catalogo');
  assert.ok(bestKeywordScore('quiero el catálogo', ['catalogo']) >= 0.72);
});

test('flujo de agendamiento captura nombre y teléfono y crea lead', () => {
  let s = initState(F);
  s = step(F, s, { buttonId: 'agendar' }).state;
  assert.equal(s.nodeId, 'agendar_nombre');

  let r = step(F, s, { text: 'Andrés Valencia' });
  assert.equal(r.state.vars.nombre, 'Andrés Valencia');
  assert.equal(r.state.nodeId, 'agendar_telefono');

  r = step(F, r.state, { text: 'mi numero es 3001234567' });
  assert.equal(r.state.vars.telefono, '3001234567'); // captura SOLO el número (regex)
  assert.ok(r.actions.some((a) => a.type === 'create_lead'));
  assert.equal(r.done, true); // nodo terminal
});

test('render reemplaza variables', () => {
  assert.equal(render('Hola {{nombre}} 👋', { nombre: 'Ana' }), 'Hola Ana 👋');
});

test('handoff explícito cuando piden asesor', () => {
  const s = initState(F);
  const r = step(F, s, { text: 'quiero hablar con un humano' });
  assert.equal(r.handoff, true);
  assert.ok(r.actions.some((a) => a.type === 'handoff'));
});

test('escala a humano tras 2 misses consecutivos', () => {
  let s = initState(F);
  let r = step(F, s, { text: 'asdfghjkl qwerty' }); // miss 1
  assert.equal(r.handoff, false);
  assert.equal(r.state.misses, 1);
  r = step(F, r.state, { text: 'zxcvbnm 0000' }); // miss 2 → handoff
  assert.equal(r.handoff, true);
  assert.ok(r.actions.some((a) => a.type === 'handoff' && a.reason === 'fallback'));
  assert.equal(r.state.misses, 0); // se resetea al escalar
});

test('regex de teléfono no acepta texto sin 10 dígitos', () => {
  let s = initState(F);
  s = step(F, s, { buttonId: 'agendar' }).state;
  s = step(F, s, { text: 'Ana' }).state; // → agendar_telefono
  const r = step(F, s, { text: 'no tengo' }); // no matchea regex
  assert.equal(r.state.nodeId, 'agendar_telefono'); // se queda pidiendo
  assert.ok(!r.actions.some((a) => a.type === 'create_lead'));
});
