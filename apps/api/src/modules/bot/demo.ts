// Demo visible del motor "Fake IA" — imprime conversaciones reales como un chat.
// NO usa DB ni Meta: corre el motor puro y muestra las acciones que dispara.
// Correr:  npx tsx src/modules/bot/demo.ts

import { greeting, step, initState, type BotState, type StepResult } from './engine.js';
import { EXAMPLE_FLOW as FLOW } from './flow.example.js';

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bot: (s: string) => `\x1b[36m${s}\x1b[0m`, // cyan
  user: (s: string) => `\x1b[33m${s}\x1b[0m`, // amarillo
  act: (s: string) => `\x1b[32m${s}\x1b[0m`, // verde
  title: (s: string) => `\x1b[1m\x1b[35m${s}\x1b[0m`, // magenta bold
};

function printBot(r: StepResult) {
  console.log(`  ${C.bot('🤖')}  ${r.reply.text}`);
  if (r.reply.buttons?.length) {
    const btns = r.reply.buttons.map((b) => `[ ${b.title} ]`).join('  ');
    console.log(`      ${C.dim(btns)}`);
  }
  for (const a of r.actions) {
    if (a.type === 'create_lead') console.log(`      ${C.act('⚙ create_lead')} ${C.dim('→ CRM: crea contacto + deal')}`);
    else if (a.type === 'tag') console.log(`      ${C.act('⚙ tag')} ${C.dim(a.tag)}`);
    else if (a.type === 'show_catalog') console.log(`      ${C.act('⚙ show_catalog')} ${C.dim('→ envía catálogo')}`);
    else if (a.type === 'handoff') console.log(`      ${C.act('⚙ handoff')} ${C.dim('→ pasa a Live Chat (Módulo 2)')}`);
  }
  if (r.handoff) console.log(`      ${C.dim('— conversación transferida a un humano —')}`);
  if (r.done) console.log(`      ${C.dim('✓ conversación finalizada')}`);
}

function printUser(input: { text?: string; buttonId?: string }) {
  const label = input.buttonId ? `(botón: ${input.buttonId})` : input.text ?? '';
  console.log(`  ${C.user('👤')}  ${C.user(label)}`);
}

// Reproduce una conversación: arranca con el saludo y procesa cada turno del usuario.
function run(titulo: string, turns: Array<{ text?: string; buttonId?: string }>) {
  console.log('\n' + C.title(`━━━  ${titulo}  ━━━`));
  let state: BotState = initState(FLOW);
  printBot(greeting(FLOW, state));
  for (const input of turns) {
    printUser(input);
    const r = step(FLOW, state, input);
    printBot(r);
    state = r.state;
    if (r.done || r.handoff) break;
  }
}

console.log(C.dim('\nMotor "Fake IA" — 0 tokens, 0 red, 100% determinista.\n'));

run('1) Agendar cita — con typos y tildes', [
  { text: 'buenas, kiero agendar una sita' }, // fuzzy: "agendar cita"
  { text: 'Andrés Valencia' },
  { text: 'mi celu es 3001234567' }, // regex captura el número → create_lead
]);

run('2) Catálogo por botón', [
  { buttonId: 'catalogo' },
  { text: 'mejor agendo' }, // fuzzy → agendar
  { text: 'Lucía' },
  { text: '3019998877' },
]);

run('3) Pregunta frecuente (FAQ)', [
  { text: 'cuales son los horarios y hacen envios?' },
]);

run('4) Pide hablar con un humano → handoff', [
  { text: 'quiero hablar con un asesor de verdad' },
]);

run('5) No entiende 2 veces → escala a humano', [
  { text: 'asdf qwerty' }, // miss 1
  { text: 'zxcv 0000' }, // miss 2 → handoff
]);

console.log('');
