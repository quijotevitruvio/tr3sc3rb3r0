// Flujo "Fake IA" de ejemplo — PYME colombiana típica.
// Esto es exactamente lo que iría en la columna JSONB `flow_json` de la tabla de
// bots, editable sin deploy. Sirve de seed y de fixture para los tests.
//
// Recorrido: saludo → menú (Catálogo / Agendar / Preguntas / Asesor) → captura
// de datos → create_lead (→ CRM) y/o handoff (→ Live Chat, Módulo 2).

import type { Flow } from './engine.js';

export const EXAMPLE_FLOW: Flow = {
  id: 'demo-pyme',
  start: 'menu',
  threshold: 0.72,
  maxMisses: 2,
  nodes: {
    menu: {
      id: 'menu',
      say: '¡Hola! 👋 Soy el asistente de la tienda. ¿En qué te ayudo?',
      buttons: [
        { id: 'catalogo', title: 'Ver catálogo' },
        { id: 'agendar', title: 'Agendar cita' },
        { id: 'asesor', title: 'Hablar con asesor' },
      ],
      intents: [
        {
          id: 'i_catalogo',
          buttons: ['catalogo'],
          keywords: ['catalogo', 'productos', 'precios', 'que venden', 'ver productos'],
          next: 'catalogo',
          actions: [{ type: 'show_catalog' }],
        },
        {
          id: 'i_agendar',
          buttons: ['agendar'],
          keywords: ['agendar', 'cita', 'reservar', 'turno', 'hora'],
          next: 'agendar_nombre',
        },
        {
          id: 'i_faq',
          keywords: ['horario', 'donde quedan', 'direccion', 'envios', 'pago', 'pregunta'],
          next: 'faq',
        },
        {
          id: 'i_asesor',
          buttons: ['asesor'],
          keywords: ['asesor', 'humano', 'persona', 'hablar con alguien'],
          next: 'menu',
          actions: [{ type: 'handoff', reason: 'requested' }],
        },
      ],
      fallback: {
        say: 'No te entendí 🤔. Elegí una opción del menú o escribí "asesor" para hablar con el equipo.',
      },
    },

    catalogo: {
      id: 'catalogo',
      say: 'Te comparto el catálogo 📄. ¿Querés agendar una cita para verlo en persona o seguir por aquí?',
      buttons: [
        { id: 'agendar', title: 'Agendar cita' },
        { id: 'asesor', title: 'Hablar con asesor' },
      ],
      intents: [
        { id: 'c_agendar', buttons: ['agendar'], keywords: ['agendar', 'cita', 'si'], next: 'agendar_nombre' },
        { id: 'c_asesor', buttons: ['asesor'], keywords: ['asesor', 'humano'], next: 'menu', actions: [{ type: 'handoff', reason: 'requested' }] },
      ],
      fallback: { next: 'menu' },
    },

    faq: {
      id: 'faq',
      say: 'Estamos en Medellín, atendemos L-V 8am-6pm y hacemos envíos a todo el país 🚚. ¿Algo más?',
      buttons: [
        { id: 'agendar', title: 'Agendar cita' },
        { id: 'asesor', title: 'Hablar con asesor' },
      ],
      intents: [
        { id: 'f_agendar', buttons: ['agendar'], keywords: ['agendar', 'cita'], next: 'agendar_nombre' },
        { id: 'f_asesor', buttons: ['asesor'], keywords: ['asesor', 'humano'], next: 'menu', actions: [{ type: 'handoff', reason: 'requested' }] },
      ],
      fallback: { next: 'menu' },
    },

    // ── Agendamiento: captura nombre → teléfono → confirma + crea lead ──────────
    agendar_nombre: {
      id: 'agendar_nombre',
      say: 'Perfecto 🙌. ¿Cuál es tu nombre?',
      intents: [
        {
          id: 'a_nombre',
          regex: '.{2,}', // cualquier texto de 2+ chars
          captureAs: 'nombre',
          next: 'agendar_telefono',
          actions: [{ type: 'tag', tag: 'lead-whatsapp' }],
        },
      ],
      fallback: { say: 'Decime tu nombre para continuar 🙂' },
    },

    agendar_telefono: {
      id: 'agendar_telefono',
      say: 'Gracias {{nombre}}. ¿A qué número te contactamos? (10 dígitos)',
      intents: [
        {
          id: 'a_tel',
          regex: '\\b\\d{10}\\b', // celular colombiano
          captureAs: 'telefono',
          next: 'agendar_ok',
          actions: [{ type: 'create_lead' }],
        },
      ],
      fallback: { say: 'Pasame un número de 10 dígitos, por favor 📱' },
    },

    agendar_ok: {
      id: 'agendar_ok',
      say: '¡Listo {{nombre}}! Un asesor te escribe al {{telefono}} para confirmar la cita. ✅',
      terminal: true,
    },
  },
};
