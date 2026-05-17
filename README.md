# Tr3sC3rb3r0 🐺

[**Español**](#-español) | [**English**](#-english)

---

## 🇪🇸 Español

Ecosistema web interactivo y de alto rendimiento que sirve como portal principal para **Tr3sC3rb3r0** (servicios B2B de desarrollo de agentes IA, CRM y software a la medida). Este repositorio contiene una landing page avanzada y bilingüe (ES/EN) con animaciones 3D, un constructor de presupuestos inteligente (*Stack Builder*), geolocalización de precios, un CRM/dashboard autónomo y un servidor Express optimizado para producción en **Hostinger Node.js Hosting**.

---

### 🚀 Características Clave

1. **Landing Page Interactiva y Premium:**
   - **Efecto Morphing 3D:** Animaciones sofisticadas con transiciones CSS fluidas a partir del centro geométrico (`getBoundingClientRect()`) del logotipo y las cabezas del lobo (Azul, Dorado y Jade) representando las tres ramas de servicio.
   - **Sistema i18n Nativo:** Soporte bilingüe completo (Español/Inglés) implementado mediante atributos `data-k` y diccionarios JavaScript.
   - **Banner de Urgencia Dinámico:** Mensaje persuasivo con el mes actual generado dinámicamente (`toLocaleString('es-CO')`).

2. **Stack Builder (Calculadora de Presupuestos):**
   - Panel interactivo unificado (`SB_SERVICES`, `SB_PRESETS`, `SB_SUGGESTIONS`) que permite al usuario seleccionar componentes, ver cotizaciones en tiempo real y recibir sugerencias inteligentes.
   - Evita loops de modal y previene errores de interacción móvil a través de un sistema anti-cierres accidentales (threshold de scroll de 8px y 400ms).

3. **Geolocalización de Precios (Geo-IP):**
   - Detección inteligente del país del usuario mediante **Cloudflare Trace** con fallback transparente a `ipapi.co`.
   - Conversión de precios a moneda local con tasa TRM en tiempo real o fallback estimado (`TRM_ESTIMATED`) en caso de caída de las APIs de cambio.
   - Caché optimizado en `localStorage` con un tiempo de vida (TTL) de 7 días para evitar consultas excesivas a las APIs.

4. **Captura Segura de Leads (Web3Forms API):**
   - Formularios de la landing y de la sección de bundles integrados mediante peticiones `POST` a **Web3Forms API**.
   - Sistema de retroalimentación visual ("Enviando...", "¡Recibido!") y fallback robusto `mailto:` en caso de fallos de red del cliente.
   - Redirección automatizada a una página dedicada de confirmación (`/gracias.html`) con tags de analítica configurados.

5. **Servidor Express de Producción:**
   - **Políticas CSP Robustas:** Cabeceras de seguridad configuradas para permitir conexiones seguras a Web3Forms, Google Tag Manager (GA4), Clarity y servicios de divisas.
   - **Caching Avanzado:** Caché agresivo e inmutable de 1 año (`max-age=31536000, immutable`) en `/assets/*` y control de no-caché inmediato para páginas HTML estáticas.
   - **Compresión Gzip:** Integración del middleware `compression` para optimizar los tiempos de transferencia.

6. **Dashboard / CRM Autónomo:**
   - Panel completo de productividad interno ubicado en `public/dashboard.html` para la gestión de tareas, notas y métricas.

---

### 📂 Estructura del Proyecto

```text
/
├─ public/                 # Archivos estáticos servidos directamente por Express
│  ├─ index.html           # Landing principal animada (3 cabezas)
│  ├─ gracias.html         # Página de éxito para conversiones y analítica
│  ├─ bundles.html         # Selector y cotizador de paquetes preestablecidos
│  ├─ dashboard.html       # CRM / Herramienta de productividad interna
│  ├─ robots.txt           # Configuración de rastreo e indexación
│  ├─ sitemap.xml          # Mapa de sitio canonicalizado para SEO
│  ├─ legal/               # Documentos de cumplimiento legal (Ley 1581)
│  │  ├─ terminos.html     # Términos y condiciones con fecha fija real
│  │  └─ privacidad.html   # Política de tratamiento de datos personales
│  └─ assets/              # Recursos multimedia
│     └─ heads/            # Imágenes de cabezas optimizadas para web
├─ src/                    # Recursos de desarrollo no expuestos
│  └─ heads/               # Archivos SVG vectoriales originales de alta calidad
├─ server/                 # Código del backend
│  └─ index.js             # Servidor Express, cabeceras de seguridad CSP y rutas
├─ .claude/                # Contexto y memorias de IA (CLAUDE.md)
├─ package.json            # Scripts de Node.js, dependencias y configuración
└─ .gitignore              # Reglas de exclusión de Git
```

---

### 🛠️ Configuración y Desarrollo Local

#### Requisitos
- Node.js >= 18.x
- npm

#### Pasos para iniciar:
1. Clonar el repositorio.
2. Instalar las dependencias de desarrollo y producción:
   ```bash
   npm install
   ```
3. Ejecutar el servidor en modo de desarrollo (con recarga automática mediante `nodemon`):
   ```bash
   npm run dev
   ```
4. El proyecto estará disponible en `http://localhost:3000`.

---

### ⚡ Optimización de Activos

Las cabezas vectoriales originales del héroe (SVGs) contienen incrustaciones rasterizadas base64 y pesan entre 1.5MB y 4MB cada una.
Para mejorar radicalmente el performance en móviles y las métricas de Lighthouse:
- Se utiliza `svgo` para optimizar y limpiar los metadatos de los SVGs.
- Los activos de producción se sirven como WebP altamente optimizados en `public/assets/heads/`, logrando una reducción del **85% en el peso de carga total** (de 21MB a ~2.9MB).

Ejecutar optimización de metadatos de SVG:
```bash
npm run optimize:svg
```

---

### 🚀 Despliegue en Hostinger (Node.js Hosting)

El servidor Express está completamente optimizado para las características y limitaciones del entorno Node.js de Hostinger.

1. **Crear la aplicación en hPanel:**
   - Navega a **hPanel** → tu plan → **Avanzado → Node.js**.
   - Haz clic en **Create Application**:
     - **Node.js version:** `18.x` o superior.
     - **Application mode:** `Production`.
     - **Application root:** `tr3sc3rb3r0` (o el nombre de tu directorio).
     - **Application URL:** Tu dominio principal (`trescerbero.com`).
     - **Application startup file:** `server/index.js`.
2. **Subir tu código:**
   - **Opción A (Recomendada):** Vincula tu cuenta de GitHub en la pestaña de Git en Hostinger y haz deploy de la rama `main`.
   - **Opción B:** Sube los archivos mediante FTP/Administrador de archivos excluyendo `node_modules/`, `src/` y `.claude/`. Ejecuta `npm install --production` a través de la terminal SSH en el directorio de la aplicación.
3. **Iniciar el Servidor:**
   - Hostinger inyectará la variable de entorno `PORT` de manera automática. El servidor Express está programado para escucharla.
   - En hPanel, haz clic en **Restart Application** para levantar los servicios.

---

### 📋 Backlog y Tareas Pendientes

- [ ] **Bug #20:** Decidir si las rutas indefinidas en el backend deben redirigir a `/` (301) o servir una página 404 estática limpia.
- [ ] Generar imagen OG unificada (1200×630px) y ubicarla en `/assets/img/og.png`.
- [ ] Implementar `<link rel="alternate" hreflang="en">` en el HTML una vez que se lance la versión internacional.

---
---

## 🇬🇧 English

A high-performance, interactive B2B web platform serving as the primary landing page and infrastructure for **Tr3sC3rb3r0** (B2B AI agents, CRM integration, and custom software development). This repository houses an advanced, bilingual (ES/EN) animated landing page, an interactive pricing calculator (*Stack Builder*), local currency geolocalization, a standalone CRM panel, and a production-grade Express server optimized for **Hostinger Node.js Hosting**.

---

### 🚀 Core Features

1. **Bilingual Premium Landing Page:**
   - **3D Morphing Transitions:** Sophisticated geometric-center translations (`getBoundingClientRect()`) targeting the custom wolf head illustrations (Blue, Gold, and Jade) for fluid animations across desktop and mobile viewports.
   - **Bilingual i18n Engine:** Integrated English and Spanish translations driven by custom `data-k` HTML tags and client-side JavaScript dictionaries.
   - **Dynamic Urgency Banner:** Dynamic, local-month generation inside the urgency alert banner utilizing `toLocaleString('es-CO')`.

2. **Stack Builder (Ecosystem Budget Calculator):**
   - An interactive, client-side pricing builder (`SB_SERVICES`, `SB_PRESETS`, `SB_SUGGESTIONS`) enabling users to craft custom technology blueprints with instant estimates and logical upgrades.
   - Features custom touch and gesture thresholds (8px drag limit, 400ms time cap) to avoid accidental backdrop modal dismissals on mobile browsers.

3. **Smart Local Currency Geolocalization:**
   - Automatic country detection using **Cloudflare Trace** with an API fallback to `ipapi.co`.
   - Dynamic conversion rates (TRM) for local currencies with a clean indicator asterisk (`TRM_ESTIMATED`) if external financial services fail.
   - Cached locally inside `localStorage` with a 7-day TTL (Time To Live) to drastically reduce third-party API payload calls.

4. **Secure Lead Capture (Web3Forms API):**
   - Forms configured to submit data via safe async `POST` requests to **Web3Forms API**.
   - Includes user feedback states ("Sending...", "Received!") and fallback standard `mailto:` actions if network firewalls block the API endpoint.
   - Seamless redirections to `/gracias.html` with third-party tracking pixels pre-configured.

5. **Production-Ready Server Infrastructure:**
   - **Robust CSP Policies:** Custom Content Security Policy headers allowing safe connections to Web3Forms, Google Tag Manager (GA4), Clarity, and conversion tracking scripts.
   - **Aggressive Caching System:** Immutable 1-year cache headers (`max-age=31536000, immutable`) for static assets `/assets/*`, paired with instant invalidation (`must-revalidate`) for main page templates.
   - **Gzip Compression:** Out-of-the-box asset transfer optimization using Node `compression` middleware.

6. **Standalone CRM / Dashboard:**
   - A fully functional productivity dashboard inside `public/dashboard.html` for offline tasks, notes, and metrics management.

---

### 📂 Directory Structure

```text
/
├─ public/                 # Static web root served by the Express application
│  ├─ index.html           # Main animated multi-language landing page
│  ├─ gracias.html         # Conversion thank-you & analytical landing page
│  ├─ bundles.html         # Preset packages and billing builder
│  ├─ dashboard.html       # Standalone internal CRM tool
│  ├─ robots.txt           # Crawler instructions
│  ├─ sitemap.xml          # Canonical sitemap for indexing
│  └─ legal/               # Privacy policies & law regulations
│     ├─ terminos.html     # Real fixed-date Terms & Conditions
│     └─ privacidad.html   # Privacy policies (Habeas Data compliance)
├─ src/                    # Source files excluded from web root
│  └─ heads/               # Original high-resolution vector SVGs
├─ server/                 # Express backend code
│  └─ index.js             # Server startup, security headers, and fallbacks
├─ .claude/                # AI Agent workspace context files (CLAUDE.md)
├─ package.json            # Scripts, dependencies, and packages configuration
└─ .gitignore              # Git ignore rules file
```

---

### 🛠️ Setting Up & Local Development

#### Prerequisites
- Node.js >= 18.x
- npm

#### Get Started:
1. Clone this repository.
2. Install the necessary development and production modules:
   ```bash
   npm install
   ```
3. Run the development server (configured with `nodemon` watches):
   ```bash
   npm run dev
   ```
4. Access your local application server at `http://localhost:3000`.

---

### ⚡ Asset Optimization

Original high-res hero vector files (SVGs) containing base64 raster assets can weigh up to 4MB each.
To guarantee flawless loading speeds on 3G/4G connections and elevate Lighthouse metrics:
- SVG metadata and redundancy are stripped using `svgo`.
- Production instances serve WebP compressions located inside `public/assets/heads/`, yielding an **85% reduction in total bundle weight** (down from 21MB to ~2.9MB).

Run SVG optimization scripts:
```bash
npm run optimize:svg
```

---

### 🚀 Production Deployment (Hostinger Node.js Hosting)

The Express codebase is engineered to match the requirements of Hostinger's Node.js container environment out of the box.

1. **Set up the hPanel Application:**
   - Go to **hPanel** → your plan → **Advanced → Node.js**.
   - Create a new application:
     - **Node.js version:** `18.x` or superior.
     - **Application mode:** `Production`.
     - **Application root:** `tr3sc3rb3r0` (relative to your `/home` path).
     - **Application URL:** Your target domain (`trescerbero.com`).
     - **Application startup file:** `server/index.js`.
2. **Uploading Code:**
   - **Option A (Recommended):** Connect your GitHub account under Hostinger's Git tab and deploy from `main`.
   - **Option B:** Upload files through hPanel File Manager, excluding `node_modules/`, `src/`, and `.claude/`. SSH into your container and execute `npm install --production`.
3. **Restart and Validate:**
   - Hostinger handles ports dynamically. The application automatically reads the `PORT` env variable.
   - Click **Restart Application** in the dashboard to spin up the server.

---

### 📋 Backlog & Pending Tasks

- [ ] **Bug #20:** Decide whether undefined server routes should redirect with a `301` to `/` or return a static `404.html` error page.
- [ ] Render a unified OG preview image (1200×630px) and save it in `/assets/img/og.png`.
- [ ] Add `<link rel="alternate" hreflang="en">` once international translation redirects are active in production.
