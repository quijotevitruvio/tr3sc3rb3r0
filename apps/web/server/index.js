// Tr3sC3rb3r0 — Express static server.
// Sirve apps/web/public/ con security headers, compression y cache control.
// Multi-host: trescerbero.com → landing, app.trescerbero.com → dashboard (/public/app/*).
// El API (api.trescerbero.com) corre como deploy aparte en apps/api (Hono).
// Hostinger Node.js inyecta process.env.PORT en producción.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const ONE_YEAR = 60 * 60 * 24 * 365;
// Proxy /api/* a la API Hono (dev local). En prod cada app corre en su propio dominio
// (api.trescerbero.com vs app.trescerbero.com) y este proxy no se usa.
const API_TARGET = process.env.API_TARGET || 'http://localhost:3001';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());

// Proxy ANTES de cualquier rewrite o static — /api/* viaja transparente a la API.
// Mountando en una ruta-regex en vez de en '/api' Express NO strippea el prefix,
// entonces no hace falta pathRewrite. Browser y API comparten origen → cookie sin drama.
app.use(createProxyMiddleware({
  pathFilter: (path) => path.startsWith('/api'),
  target: API_TARGET,
  changeOrigin: true,
}));

// Detecta si el request llega por app.trescerbero.com (o app.localhost en dev).
function isAppHost(req) {
  const host = (req.headers.host || '').toLowerCase();
  return host.startsWith('app.');
}

// Security headers globales + CSP variable según host (landing vs app).
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'interest-cohort=(), camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (isAppHost(req)) {
    // Dashboard CSP: connect-src abierto a api.trescerbero.com + localhost:3001 (dev).
    // jsdelivr habilitado para librerías ad-hoc del CRM (vis-network del knowledge graph).
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.trescerbero.com http://localhost:3001 http://api.localhost:3001",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
  } else {
    // Landing CSP: terceros para analytics, fuentes, cal.com, currency-api.
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://plausible.io https://www.clarity.ms https://cdn.jsdelivr.net https://www.googletagmanager.com https://app.cal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://fonts.googleapis.com https://plausible.io https://www.clarity.ms https://cdn.jsdelivr.net https://latest.currency-api.pages.dev https://www.cloudflare.com https://ipapi.co https://api.web3forms.com https://www.google-analytics.com https://www.googletagmanager.com https://app.cal.com https://api.trescerbero.com",
      "frame-src 'self' https://app.cal.com https://cal.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://api.web3forms.com mailto:",
    ].join('; '));
  }
  next();
});

// Rewrite para app.* — '/' va a login, todo lo demás se prefija con /app/ si no lo está.
app.use((req, res, next) => {
  if (!isAppHost(req)) return next();
  if (req.url === '/health' || req.url.startsWith('/app/')) return next();
  if (req.url === '/' || req.url === '/index.html') {
    req.url = '/app/login.html';
  } else if (!req.url.startsWith('/assets/')) {
    // Permitir que /app/dashboard.html, /app/login.html, etc. funcionen sin prefix extra.
    req.url = '/app' + req.url;
  }
  next();
});

// ═══ MEGALANDING: solo 3 páginas (+ / con la intro de los lobos) ════════════════════════
// /software, /inicio y /educacion sirven index.html (las 3 cabezas del carrusel) con SU título,
// descripción y canonical, y con su cabeza ya activa en el HTML: Google indexa 3 páginas
// distintas y el visitante no ve un giro al entrar. Todo lo demás de la landing redirige (301)
// a su sección: /software/crm -> /software#crm. Legal y bot-demo siguen como archivos aparte.
const SITE = 'https://trescerbero.com';
const PAGES = {
  '/': { head: 1, title: 'Software con IA y Cursos para Pymes en Colombia | Tr3sC3rb3r0',
    desc: 'Estudio de software con IA en Medellín: chatbot de WhatsApp, CRM en español y web a la medida para pymes, y cursos de IA. Precios en pesos.' },
  '/software': { head: 0, title: 'Chatbot de WhatsApp, CRM con IA y Páginas Web para Pymes | Tr3sC3rb3r0',
    desc: 'Chatbot de WhatsApp con IA desde USD $80/mes, L-IA CRM en español desde $69.000, páginas web desde $1.800.000 y software a la medida. Precios en pesos, sin permanencia.' },
  '/inicio': { head: 1, title: 'Tr3sC3rb3r0: Estudio de Software con IA en Medellín',
    desc: 'Quiénes somos, cómo trabajamos y cómo contactarnos. Software con IA a su nombre y formación en desarrollo con IA para pymes en Colombia.' },
  '/educacion': { head: 2, title: 'Curso de Desarrollo con IA en Vivo y Formación para Empresas | Tr3sC3rb3r0',
    desc: 'Curso en vivo de desarrollo con IA ($390.000, máximo 8 personas), formación para empresas desde $990.000 y cursos grabados. En español, Medellín u online.' },
};
const HEAD_CLS = ['s-active', 's-next', 's-prev'];   // posición relativa a la cabeza activa
const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
let indexSrc = null;
function renderPage(p) {
  if (!indexSrc || process.env.NODE_ENV !== 'production') indexSrc = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  const cfg = PAGES[p], url = SITE + (p === '/' ? '/' : p);
  return indexSrc
    .replace(/<title>[^<]*<\/title>/, `<title>${cfg.title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(cfg.desc)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(cfg.title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(cfg.desc)}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(cfg.title)}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(cfg.desc)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/<div class="head s-(?:prev|active|next)" data-h="(\d)"/g,
      (_, i) => `<div class="head ${HEAD_CLS[(Number(i) - cfg.head + 3) % 3]}" data-h="${i}"`);
}
app.get(Object.keys(PAGES), (req, res, next) => {
  if (isAppHost(req)) return next();
  // Express no es estricto con la barra final: /software/ también cae aquí -> una sola URL
  if (!PAGES[req.path]) return res.redirect(301, req.path.replace(/\/+$/, '') + (req.url.slice(req.path.length) || ''));
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.type('html').send(renderPage(req.path));
});
app.get('/index.html', (req, res, next) => (isAppHost(req) ? next() : res.redirect(301, '/')));

// Direcciones viejas -> su sección. Clases tendrá su espacio propio más adelante: por ahora a precios.
const OLD = {
  '/precios': '/software#precios', '/nosotros': '/inicio#nosotros', '/contacto': '/inicio#contacto',
  '/bundles': '/software', '/educacion/clases': '/educacion#precios-educacion',
};
app.get(/^\/[a-z0-9/-]+?(?:\.html)?\/?$/, (req, res, next) => {
  if (isAppHost(req)) return next();
  const p = req.path.replace(/\/$/, '').replace(/\.html$/, '') || '/';
  let to = OLD[p];
  const m = p.match(/^\/(software|educacion)\/([a-z0-9-]+)$/);
  if (!to && m) to = `/${m[1]}#${m[2]}`;
  if (!to && p !== req.path && PAGES[p]) to = p;            // /software/ o /software.html -> /software
  return to ? res.redirect(301, to) : next();
});
// Cache largo e inmutable para assets versionables (landing).
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
  maxAge: ONE_YEAR * 1000,
  immutable: true,
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
    // El mime de express no conoce .avif (lo manda como octet-stream); con nosniff,
    // Safari/Firefox pueden negarse a mostrar la imagen. Tipo explícito para los lobos.
    if (filePath.endsWith('.avif')) res.setHeader('Content-Type', 'image/avif');
  },
}));

// HTML siempre fresco; XML/TXT con TTL corto.
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (filePath.endsWith('.xml') || filePath.endsWith('.txt')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
  index: 'index.html',
}));

app.get('/health', (_req, res) => res.status(200).send('ok'));

// 404 fallback: app subdomain manda a login, landing a 404 público.
app.use((req, res) => {
  if (isAppHost(req)) {
    return res.status(302).redirect('/app/login.html');
  }
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.listen(PORT, () => {
  console.log(`[web] Tr3sC3rb3r0 listening on :${PORT}`);
});
