# Tr3sC3rb3r0

Landing animada (3 cabezas: Chat IA · CRM · Software) + dashboard CRM standalone. Servidor Node.js (Express) listo para **Hostinger Node.js Hosting**.

## Estructura

```text
/
├─ public/                 Estáticos servidos (raíz web)
│  ├─ index.html           Landing (3 cabezas, animación 3D, i18n ES/EN)
│  ├─ dashboard.html       CRM standalone
│  ├─ robots.txt
│  ├─ sitemap.xml
│  └─ assets/heads/        9 WebP (Azul/Dorado/Jade × izquerdo/derecho/centro)
├─ src/                    Fuentes no servidas
│  └─ heads/               9 SVG originales (Azul/Dorado/Verde × izquerda/derecha/frente)
├─ server/
│  └─ index.js             Express + compression + cache headers (Hostinger entry)
├─ scripts/
│  └─ svg-to-webp.mjs      Rasteriza src/heads → public/assets/heads
├─ docs/
│  ├─ TASKS.md
│  └─ memory/
├─ .claude/  CLAUDE.md     Config del agente
├─ package.json  package-lock.json
└─ .gitignore  README.md
```

## Optimización aplicada

- **SVG → WebP**: los SVG originales contienen rasters base64 (1–4 MB c/u). Rasterizado a WebP @ tamaño de render (caras 480px, laterales 1200px).
- **Total assets**: 20.75 MB → **2.97 MB** (-85.7%)
- Laterales `wdeco`: ~440 KB c/u (ocultos en móvil)
- Caras `wolf-face`: ~130 KB c/u

Re-ejecutar:

```bash
npm run optimize         # SVGO + WebP
npm run optimize:webp    # solo WebP
```

## Deploy a Hostinger (Node.js Hosting)

### 1. Crear la aplicación Node.js en hPanel

- Login → **hPanel** → tu plan → **Advanced → Node.js**
- **Create Application**:
  - Node.js version: **18.x o superior**
  - Application mode: **Production**
  - Application root: ej. `tr3sc3rb3r0` (relativo a `/home/usuario/`)
  - Application URL: tu dominio (ej. `trescerbero.com`)
  - Application startup file: `server/index.js`

### 2. Subir el código

Opciones (la 1ª es la más simple):

#### A. Vía Git (recomendado)

- En hPanel → Node.js app → **Git** → vincular el repo y rama
- Hostinger hará `npm install` automáticamente

#### B. Vía File Manager / FTP

- Subir TODO menos: `node_modules/`, `src/`, `docs/`, `.claude/`
- Conectar por SSH al server y dentro del app root:

  ```bash
  npm install --production
  ```

### 3. Variables de entorno

Hostinger inyecta `PORT` automáticamente. El servidor ya escucha en `process.env.PORT`.

### 4. Iniciar

hPanel → Node.js app → **Restart**.
Hostinger ejecuta `npm start` (que corre `node server.js`).

### 5. Verificar

- `https://tudominio.com/` → landing
- `https://tudominio.com/health` → `ok`
- `https://tudominio.com/dashboard.html` → CRM

### Tips

- Las cabeceras `Cache-Control: max-age=31536000, immutable` están en `/assets/*`. Cuando reemplaces un asset, renómbralo o vacía caché en hPanel.
- `compression` (gzip) ya activado vía middleware.
- Hostinger Node.js Hosting está detrás de un proxy: `trust proxy` ya activado.

## Dev local

```powershell
npm install
npm start              # http://localhost:3000
```

## Pendientes

- [ ] Generar `og.png` (1200×630) → `/assets/img/og.png`
- [ ] `<link rel="alternate" hreflang>` cuando se publique EN
- [ ] Service Worker para offline (opcional)
- [ ] Considerar AVIF para -25% adicional vs WebP (encode lento)
