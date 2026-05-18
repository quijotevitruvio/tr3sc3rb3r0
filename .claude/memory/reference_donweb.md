---
name: DonWeb (n8n)
description: Donde corre n8n para automatizaciones y orquestación de IA
type: reference
---

**Servicio:** DonWeb (plan ya pagado).

**Qué corre:** n8n self-hosted.

**Rol en la arquitectura:**
- Recibe webhooks desde la API Hono (futuros) con eventos: `lead.created`, `deal.won`, `conversation.escalated`.
- Recibe webhooks de Web3Forms (mientras dure el flujo de formularios públicos).
- Dispara workflows: enviar email vía Resend, postear en Slack/Discord, enriquecer leads (Clearbit/Hunter), generar contenido en bulk con LLM, programar publicación a redes sociales.
- Devuelve resultados a la API Hono vía webhooks con `N8N_SECRET` (HMAC).

**Autenticación entre Hono ↔ n8n:** secret token compartido + validación con `crypto.timingSafeEqual`.

**Por qué DonWeb y no Hostinger:** n8n ya estaba corriendo ahí cuando empezó el proyecto Tr3sC3rb3r0. No mover sin razón concreta.
