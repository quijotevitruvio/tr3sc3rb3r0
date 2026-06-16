# Deploy a Hostinger Business — guía paso a paso

> Esta guía es ejecutable. Comandos exactos, en orden, copy-paste.
> Cualquier paso que falle: no inventes, pegame el error y lo arreglamos.

## Arquitectura prod

```
trescerbero.com           → apps/web (Node.js #1) — landing + dashboard estático
app.trescerbero.com       → apps/web (mismo proceso) — proxy a /api/* + sirve /app/*
api.trescerbero.com       → apps/api (Node.js #2) — Hono backend
srv647.hstgr.io           → MariaDB (ya configurada)
```

## Fase 1 — Preparación local (15-20 min)

### 1.1 Rotar password DB Hostinger
1. hPanel → Bases de datos → ⋮ junto a `u917564276_trescerbero_db` → Cambiar contraseña
2. Generar una nueva fuerte (botón "Generar")
3. Copiala en algún lado seguro (NO la pegues en chat)
4. Editá `apps/api/.env` localmente: cambiá `DB_PASSWORD=<nueva>`
5. Verificá que aún conecta:
   ```powershell
   cd C:\Users\Rocka\Documents\666999\0.Programador\tr3sc3rb3r0\apps\api
   npm run db:migrate
   ```
   Si dice `[migrate] done.` → password OK localmente.

### 1.2 Generar ENCRYPTION_KEY de producción
Esta key cifra las API keys del panel admin. Si la perdés, perdés las keys.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Anotala segura. **Esta es la que va a ir en el ENV de PROD, NO en local.**

### 1.3 Crear `og.png` 1200×630
Imagen de preview cuando alguien comparte trescerbero.com en redes/WhatsApp/Slack.

Opciones rápidas:
- **Canva**: template "Facebook Cover" 1200×630, dark theme con amber `#FFB300` + logo Tr3sC3rb3r0 + tagline "L-IA CRM, Chat IA y Digital"
- **Figma free**: lo mismo

Guardalo como `apps/web/public/og.png`.

### 1.4 Commit local de password rotada (no rompe nada porque .env está gitignored)
El `.env` está en `.gitignore`. Pero el `.env.example` no — verificá que no quede password vieja ahí:
```powershell
cd C:\Users\Rocka\Documents\666999\0.Programador\tr3sc3rb3r0
git diff
```
Si solo cambió `.env` (que es ignored), no hay nada para commitear. Si `.env.example` o cualquier otro archivo cambió, revisá.

### 1.5 Verificar acceso SSH a Hostinger
hPanel → Advanced → SSH access. Si no está activo: activalo.

Después en PowerShell:
```powershell
ssh u917564276@srv647.hstgr.io
```
Te pide password (la del hosting, no la de DB).

Cuando entres exitosamente, ejecutá:
```bash
node -v        # debe ser ≥20, mejor 22
npm -v
git --version
pwd            # te muestra tu home dir
ls             # ver qué hay
```

**Cerrá la sesión SSH** por ahora (`exit`). Volvemos en Fase 2.

---

## Fase 2 — Subir código + build (30-45 min)

### 2.1 Clonar el repo en Hostinger
Por SSH:
```bash
mkdir -p ~/repos && cd ~/repos
git clone https://github.com/<tu-usuario>/tr3sc3rb3r0.git
cd tr3sc3rb3r0
```

Si tu repo es privado: configurá deploy key SSH en GitHub primero (`ssh-keygen -t ed25519 -f ~/.ssh/github_deploy` y agregás la pública en GitHub → Settings → Deploy keys del repo).

### 2.2 Instalar dependencias (workspaces)
```bash
cd ~/repos/tr3sc3rb3r0
npm install
```
Esto instala TODO el monorepo (apps/api + apps/web + packages/shared). ~2-5 min.

### 2.3 Build de la API (TypeScript → JS)
```bash
cd ~/repos/tr3sc3rb3r0/apps/api
npm run build
ls dist/    # debe existir y tener server.js + estructura módulos
```

### 2.4 Crear `.env` de producción para la API
**NO subir el `.env` local** — Hostinger inyecta vars via panel. Pero como ayuda inicial podés crear `apps/api/.env` solo para correr la migración:

```bash
nano ~/repos/tr3sc3rb3r0/apps/api/.env
```
Pegá (con tus valores reales):
```env
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGINS=https://trescerbero.com,https://app.trescerbero.com
DB_HOST=srv647.hstgr.io
DB_PORT=3306
DB_USER=u917564276_tresc
DB_PASSWORD=<la nueva password rotada>
DB_NAME=u917564276_trescerbero_db
DB_CONNECTION_LIMIT=10
SESSION_COOKIE_NAME=tc_session
SESSION_TTL_SECONDS=2592000
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=.trescerbero.com
ENCRYPTION_KEY=<la generada en 1.2>
ANTHROPIC_API_KEY=
N8N_BASE_URL=
N8N_HMAC_SECRET=
ARGON_MEMORY_KIB=19456
ARGON_ITERATIONS=2
ARGON_PARALLELISM=1
```
Guardá (Ctrl+O, Enter, Ctrl+X).

### 2.5 Aplicar migraciones a la DB
```bash
cd ~/repos/tr3sc3rb3r0/apps/api
npm run db:migrate
```
Debe decir `[migrate] done.` (las que ya estaban aplicadas, las salta — es idempotente).

---

## Fase 3 — Crear las Node.js apps en hPanel (20 min)

### 3.1 App #1 — API
hPanel → Avanzado → **Node.js** → "Crear aplicación":

| Campo | Valor |
|---|---|
| Versión Node | 22.x |
| Modo aplicación | Production |
| Application URL | `api.trescerbero.com` |
| Application root | `repos/tr3sc3rb3r0` (path relativo a tu home) |
| Application startup file | `apps/api/dist/server.js` |
| Application URL path | (vacío, raíz) |

Click "Crear". Hostinger te asigna un puerto interno. **Anótalo** — algo tipo `30000` o `30050`.

Luego en la misma pantalla, sección **Environment variables**: copiá las mismas que pusiste en el `.env` de 2.4. **No incluyas PORT** — Hostinger lo inyecta.

Click "Save" → "Start app". Si todo bien, dirá "Running".

### 3.2 App #2 — Web
Mismo proceso, otra aplicación:

| Campo | Valor |
|---|---|
| Versión Node | 22.x |
| Modo aplicación | Production |
| Application URL | `trescerbero.com` |
| Application root | `repos/tr3sc3rb3r0` |
| Application startup file | `apps/web/server/index.js` |
| Application URL path | (vacío) |

Environment variables:
```
NODE_ENV=production
API_TARGET=http://localhost:<puerto interno de la app API que apareció en 3.1>
```

Click "Save" → "Start app".

### 3.3 Linkear `app.trescerbero.com` al mismo proceso web
En hPanel → Subdominios → crear `app.trescerbero.com` apuntando al mismo Application root (`repos/tr3sc3rb3r0`).

El server Express ya detecta `app.localhost` / `app.trescerbero.com` y sirve `/app/*` (rewrite en `apps/web/server/index.js`). No requiere segunda app.

---

## Fase 4 — DNS + SSL (15 min + propagación)

### 4.1 DNS
En tu registrar de dominio:
```
A     @                  185.212.71.135
A     app                185.212.71.135
A     api                185.212.71.135
CNAME www                trescerbero.com
```
(reemplazá `185.212.71.135` con la IP real que te dio Hostinger en el panel del dominio principal)

Propagación: 1-24h. Verificá con `nslookup api.trescerbero.com`.

### 4.2 SSL automático
Una vez que el DNS resuelve, hPanel detecta los subdominios. Para cada uno (trescerbero.com, app.trescerbero.com, api.trescerbero.com):
- hPanel → SSL → "Issue SSL certificate" → Let's Encrypt
- Esperá 1-2 min hasta "Active"

---

## Fase 5 — Smoke test producción (15 min)

### 5.1 Healthcheck API
```bash
curl https://api.trescerbero.com/health
```
Debe responder `{"ok":true,"ts":...}`.

```bash
curl https://api.trescerbero.com/ready
```
Debe responder `{"ok":true}` (significa que la API puede hablar con la DB).

### 5.2 Landing
Browser → `https://trescerbero.com` → debe ver la landing sin errores en consola (F12).

### 5.3 App login
Browser → `https://app.trescerbero.com` → debe redirect a `/app/login.html`.

### 5.4 Registrar un user real
Crear tu cuenta CEO desde la UI:
- Email: `ceo@trescerbero.com`
- Password: una fuerte
- Org name: "Tr3sC3rb3r0"

Después en SSH, hacéte superadmin:
```bash
ssh u917564276@srv647.hstgr.io
mysql -h srv647.hstgr.io -u u917564276_tresc -p u917564276_trescerbero_db
# pegás la password
UPDATE users SET is_superadmin = 1 WHERE email = 'ceo@trescerbero.com';
exit
```

Refrescá el browser → sidebar muestra "🛠 Admin".

### 5.5 Probar el demo público
Browser nueva ventana incógnito → `https://app.trescerbero.com/crm/demo` → completá el form → debería crear una org demo y redirigir al CRM.

---

## Fase 6 — Actualizar password real una vez todo funciona

Como cambiaste la DB password (Fase 1.1), todo apunta a la nueva. ✓

**Borrá el `.env` del server** porque las env vars reales viven en el panel:
```bash
rm ~/repos/tr3sc3rb3r0/apps/api/.env
```
Restart las dos Node.js apps en hPanel.

---

## Updates posteriores (deploy continuo)

Para subir nuevos cambios:
```bash
ssh u917564276@srv647.hstgr.io
cd ~/repos/tr3sc3rb3r0
git pull
npm install                                # solo si cambió package-lock
cd apps/api && npm run build && npm run db:migrate
# en hPanel: Restart en ambas apps
```

---

## Troubleshooting

### "Cannot find module" en API startup
- ¿Corriste `npm run build` en `apps/api`?
- ¿El startup file es `apps/api/dist/server.js`?
- En hPanel → app API → logs

### "ER_HOST_NOT_PRIVILEGED" en migraciones
- La IP del server no está whitelist en MySQL remoto
- hPanel → Bases de datos → MySQL remoto → agregar `127.0.0.1` o la IP interna del server

### Login no setea cookie en prod
- ¿`SESSION_COOKIE_SECURE=true` y estás en HTTPS? — sí: ✓
- ¿`SESSION_COOKIE_DOMAIN=.trescerbero.com` (con punto al inicio)? — sí: ✓
- F12 → Application → Cookies → ¿aparece `tc_session` para `.trescerbero.com`?

### CORS rejection en `/api/*`
- ¿`CORS_ORIGINS` incluye `https://trescerbero.com,https://app.trescerbero.com` (sin trailing slash)? — sí: ✓
- ¿API restart después de cambiar env? — restart la app API en hPanel

### El proxy no encuentra la API
- ¿`API_TARGET=http://localhost:<puerto>` en env de la app Web?
- ¿El puerto coincide con el que asignó Hostinger a la app API?
- Cambiá si difiere, restart la app Web

### Demo público devuelve 503 NO_API_KEY al usar chat
- Esperado: hasta que el admin configure una key Anthropic en /app/admin
- O setear `ANTHROPIC_API_KEY=sk-ant-...` como env var de la app API (fallback global)
