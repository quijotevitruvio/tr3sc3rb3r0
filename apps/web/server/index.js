// Tr3sC3rb3r0 — Express static server.
// Sirve apps/web/public/ con security headers, compression y cache control.
// Hostinger Node.js inyecta process.env.PORT en producción.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const ONE_YEAR = 60 * 60 * 24 * 365;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());

// Security headers globales
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'interest-cohort=(), camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://plausible.io https://www.clarity.ms https://cdn.jsdelivr.net https://www.googletagmanager.com https://app.cal.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://plausible.io https://www.clarity.ms https://cdn.jsdelivr.net https://latest.currency-api.pages.dev https://www.cloudflare.com https://ipapi.co https://api.web3forms.com https://www.google-analytics.com https://www.googletagmanager.com https://app.cal.com",
    "frame-src https://app.cal.com https://cal.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self' https://api.web3forms.com mailto:",
  ].join('; '));
  next();
});

// Cache largo e inmutable para assets versionables
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
  maxAge: ONE_YEAR * 1000,
  immutable: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
  },
}));

// HTML siempre fresco; XML/TXT con TTL corto
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

// 404 fallback con HTML propio
app.use((_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.listen(PORT, () => {
  console.log(`[web] Tr3sC3rb3r0 listening on :${PORT}`);
});
