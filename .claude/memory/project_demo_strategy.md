---
name: project-demo-strategy
description: El Demo del CRM es canal de adquisición — los datos que el usuario carga se quedan con Tr3sC3rb3r0 como lead intelligence. Opción B elegida por Andrés (permite cargar datos reales) — requiere Habeas Data robusto.
metadata:
  type: project
---

## Decisión (2026-05-20)

**Opción B elegida:** el Demo permite que el usuario cargue **cualquier dato** (contactos reales, deals reales, importar CSV). Toda esa info **se guarda permanentemente para Tr3sC3rb3r0** como inteligencia de prospect y entrenamiento de producto.

**Why:** Andrés priorizó valor de captura sobre simplicidad legal. Cada demo activo es un lead caliente con información completa de su intención de uso (qué carga, qué pregunta al chat, cómo configura).

## Riesgo legal aceptado — Habeas Data (Ley 1581/2012 Colombia)

Si el usuario carga contactos de terceros (clientes/leads suyos que no consintieron), Tr3sC3rb3r0 queda como **responsable solidario** ante la SIC. Multas hasta 2.000 SMMLV.

**Mitigaciones obligatorias en la implementación del Demo (Fase 6):**

1. **Aviso de privacidad visible** en la entrada del demo, no en letra chica:
   > "Este Demo guarda toda la información que cargues, incluidos contactos de terceros. La usaremos para contactarte, mejorar el producto y entrenar nuestros modelos. Si no querés que se guarden datos reales, usá los datos de ejemplo precargados."

2. **Checkbox de consentimiento explícito** antes de poder usar el demo. Sin tildar → no entra. Texto exacto:
   > "Acepto que mis datos y los de mis contactos sean almacenados y tratados según la Política de Privacidad."

3. **Política de privacidad linkeada** desde el checkbox — debe declarar:
   - Qué datos capturamos (todos: contactos, deals, queries al chat, fingerprint, IP)
   - Para qué los usamos (contacto comercial, mejora producto, training)
   - Cuánto los retenemos (indefinidamente, salvo solicitud de supresión)
   - Cómo eliminarlos (endpoint o email a privacidad@trescerbero.com)

4. **Endpoint de derecho de supresión** (`POST /api/crm/demo/erase`) y aviso visible "Borrar mis datos" en cualquier momento del demo.

5. **Registro en RNBD** (Registro Nacional de Bases de Datos de la SIC) cuando superemos 100.000 titulares — obligatorio.

6. **Asesoría legal real** antes del lanzamiento público del demo. No improvisar la política de privacidad. Pendiente: contactar abogado especializado en habeas data Colombia.

## Captura intencional (para qué usamos los datos)

- **Lead scoring de prospects:** cliente que carga 50+ contactos en demo, usa chat 20+ veces, pregunta por integraciones específicas → MQL caliente
- **Intelligence de producto:** qué preguntan al chat = features que vale la pena priorizar
- **Pipeline de ventas Tr3sC3rb3r0:** cada email/empresa cargado por el usuario del demo va a un CRM interno de prospects
- **Training (futuro):** corpus para fine-tunear modelos sobre intención CRM

## Implementación técnica (resumida)

- Sandbox del demo es una **org real** en la DB principal con flag `demo_only=true` (ya está en schema)
- Cookie + browser fingerprint (FingerprintJS open-source) → tabla `demo_sessions` para anti-abuso
- Datos NO se borran al expirar; solo se bloquea el acceso del usuario y se le notifica
- Las queries al chat van a tabla `chat_messages` con `org_id` del demo — analytics agregables

## Lo que sí está prohibido

- Vender la base de datos capturada a terceros (sería ilegal y reputacionalmente fatal)
- Usar datos del demo en demos de venta a OTROS prospects ("mirá lo que cargó este otro cliente")
- Reactivar demos expiradas con los datos previos sin pago

Relacionado: [[project-tiers-crm]], [[user-andres]], [[reference-donweb]] (n8n hará los emails de follow-up al lead).
