# Auditoría 360° de Tr3sC3rb3r0 — agosto 2026

**Alcance:** trescerbero.com (sitio público, dashboard, backend Hono/Drizzle, oferta comercial, legal, adquisición).
**Método:** 20 auditorías especializadas + una pasada de verificación adversarial que confirmó, corrigió o descartó cada hallazgo grave. En este informe manda `severidad_final`; lo descartado no aparece.
**Fecha de las mediciones:** 29 de agosto de 2026.
**Solo lectura:** no se modificó ningún archivo, ni el servidor, ni la base de datos.

---

## 1. Veredicto en una página

El sitio no vende porque **hoy es materialmente imposible comprar**. No es una hipótesis: `app.trescerbero.com` y `api.trescerbero.com` no existen en DNS (NXDOMAIN verificado contra 8.8.8.8 y 1.1.1.1), y ahí apuntan los 7 CTA del producto estrella; `cal.com/tr3sc3rb3r0` devuelve 404, incluida la cuenta raíz, así que los tres botones "Reservá 30 min" y el cierre del quiz de calificación mueren en una página de error; y en todo el backend no hay una sola línea de integración de pagos (`grep` de wompi|stripe|payu|mercadopago|checkout sobre `apps/api/src` → un único comentario, `middleware/org-context.ts:72`). El espacio de Educación, la mitad del negocio nuevo, está publicado con **12 placeholders `[PRECIO]` literales** y una cohorte que dice "inscripciones abiertas · Fecha: por anunciar" en la misma pantalla.

Encima, nadie lo detectó porque **no hay medición**: `GA4_ID='YOUR_GA4_ID'` y `CLARITY_ID='YOUR_CLARITY_ID'` siguen en el JS servido en producción (`main.js:1342-1343`), y las páginas que venden (`/software`, `/educacion`, `/bundles`) ni siquiera cargan el bloque de analítica. Los CTA llevan semanas rotos porque no existe forma de enterarse.

A eso se suman tres afirmaciones publicadas que un prospecto desmiente en menos de un minuto: el **NIT 900.000.000-0** en los tres footers y en las dos páginas legales (que además dicen literalmente `[reemplazar]`), la promesa de **"datos hosteados en Colombia"** cuando el hosting resuelve a Hostinger fuera del país, y métricas de resultado (**78% de consultas auto-resueltas, 3.2× leads, "el paquete más vendido"**) de un negocio sin un solo cliente. Y el sitio se contradice consigo mismo en el precio: el mismo Chat Pro vale COP 760.000 en `/software` y COP 299.000 en `/bundles`.

Nada de esto es un problema de calidad técnica. El código está bien estructurado, el diseño es bueno, el copy tiene voz propia y hay un CRM multi-tenant real de ~7.800 líneas construido. **El problema es de terminación y de foco**: cinco frentes abiertos por una persona sola, ninguno cerrado hasta el punto de cobrar, y un repositorio sin un commit desde el 25 de julio mientras librosmedellin.com sigue avanzando. La buena noticia: **la mayoría de lo que impide vender se arregla en un día**, no en un trimestre.

---

## 2. Tablero de salud

| # | Área | Nota | Estado |
|---|------|------|--------|
| 1 | Analítica | 1/10 | IDs placeholder en producción; las páginas de venta no cargan nada. Decisiones a ciegas. |
| 2 | Estrategia | 2/10 | Cinco frentes, ninguno cobrable; 5 semanas sin commits en el repo. |
| 3 | Adquisición | 2/10 | Cero contenido indexable, cero redes, cero backlinks desde el activo propio con tráfico. |
| 4 | Performance | 2/10 | 9,83 MB en la home móvil; 99% son "SVG" que son JPEG en base64. |
| 5 | Móvil | 3/10 | Nav de la home descuadrado (409 px en 375), FAB de WhatsApp tapado por cookies. |
| 6 | UX / conversión | 3/10 | 11+ CTA muertos; quiz y calculadora ROI no capturan un solo dato. |
| 7 | Código backend | 3/10 | Bien estructurado pero sin desplegar; bug que rompe el chat tras cualquier tool-call. |
| 8 | Legal | 3/10 | NIT falso, legales autodeclaradas "plantilla", promesa de datos en Colombia falsa. |
| 9 | Infra | 3/10 | API nunca compilada ni desplegada; deploy por scp sobre un checkout divergido; cero backups. |
| 10 | Consistencia | 3/10 | Dos capas superpuestas: bundles.html vende el modelo viejo con precios contradictorios. |
| 11 | Demo CRM | 3/10 | Producto mejor de lo que el embudo deja ver, pero inalcanzable y sin captura de email. |
| 12 | SEO técnico | 4/10 | Base impecable (canonicals, schema, llms.txt) sobre cero contenido y 3 URLs muertas en el sitemap. |
| 13 | Accesibilidad | 4/10 | Buenas intenciones en CSS, nada en JS: foco, ARIA y errores de formulario ausentes. |
| 14 | Copy | 4/10 | Bien escrito; falla en veracidad (métricas y residencia de datos). |
| 15 | Código frontend | 4/10 | main.js de 99 KB con 60 KB muertos; TRM en vivo que hace saltar el precio −16%. |
| 16 | Pricing | 4/10 | Arquitectura razonable, ejecución incoherente: dos precios para el mismo producto. |
| 17 | Educación (oferta) | 4/10 | Posicionamiento correcto, producto sobredimensionado y sin precio ni fecha. |
| 18 | Diseño | 5/10 | Sistema real en escritorio/oscuro; roto en móvil y con texto a 1.45:1 de contraste. |
| 19 | Seguridad API | 5/10 | Mejor de lo esperado (Argon2id, AES-GCM, zod), con defaults inseguros peligrosos. |
| 20 | Multi-tenancy | 5/10 | Aislamiento mayormente correcto, con un IDOR real en deals y un demo que agrupa por IP+UA. |

**Promedio: 3,4/10.** La dispersión es informativa: las notas altas están en *construcción* (diseño, seguridad, arquitectura) y las bajas en *terminación y distribución* (analítica, adquisición, estrategia). Se construyó bien algo que nadie puede comprar ni encontrar.

---

## 3. Los 10 problemas que de verdad importan

Priorizados por impacto comercial dividido por esfuerzo, fusionando hallazgos que llegaron por varias áreas.

### P1. Los CTA del producto estrella apuntan a un dominio que no existe
*Detectado por 8 auditores (seo-tecnico, ux-conversion, seguridad-api, multitenancy, codigo-backend, infra, demo-crm, estrategia).*

**Qué pasa:** `nslookup app.trescerbero.com 8.8.8.8` y `1.1.1.1` → "Non-existent domain"; lo mismo `api.trescerbero.com`. `curl https://app.trescerbero.com/crm/demo` → código 000, no resuelve.

**Evidencia:** 7 enlaces clicables vivos — `apps/web/public/index.html:296` y `software.html:83, 215, 216, 260, 280, 299` — más 4 `Offer.url` dentro del JSON-LD (`index.html:142-145`) y 3 URLs en `sitemap.xml`. El dashboard también está apuntado al host muerto: `apps/web/public/app/assets/app.js:6-9` fija `API_BASE='https://api.trescerbero.com'`.

**Hallazgo clave de la verificación:** *el dashboard SÍ está desplegado bajo el dominio principal* — `https://trescerbero.com/app/login.html` y `/app/crm.html` devuelven 200. Lo único roto es el hostname de los enlaces. **Es un buscar-y-reemplazar, no una funcionalidad faltante.** Salvedad: `https://trescerbero.com/crm/demo` da 404, así que la ruta corta del demo hay que crearla o apuntar a `/app/crm/demo.html`.

**Qué cuesta:** el 100% de la conversión del producto de mayor margen y recurrencia. Un prospecto que hace clic recibe la pantalla gris de Chrome, que se lee como "esta empresa no existe".

**Qué hacer (30 minutos):** reemplazar `https://app.trescerbero.com` → `https://trescerbero.com/app` en los 7 enlaces y en `app.js:6-9` (o crear los registros DNS A de `app` y `api`); corregir `software.html:216`, que además duplica la ruta (`/app/login.html` sobre el subdominio `app.`); sacar las 3 URLs de `app.trescerbero.com` del `sitemap.xml`; y arreglar los 4 `Offer.url` del JSON-LD.

---

### P2. "Reservá 30 min" cae en 404: la cuenta de Cal.com nunca se creó
*Detectado por 4 auditores (ux-conversion, codigo-frontend, estrategia, consistencia).*

**Qué pasa:** `curl -L https://cal.com/tr3sc3rb3r0/30min` → 404, y `https://cal.com/tr3sc3rb3r0` (la raíz) también → 404. La cuenta no existe.

**Evidencia:** `main.js:929-930` define `CAL_USER='tr3sc3rb3r0'` y `CAL_EVENT='30min'`. Lo consumen `main.js:1106` (los tres botones `.hero-cal` de `index.html:299, 419, 532`), `main.js:1125` (el CTA final del quiz de calificación) y `gracias.html` (la única acción de la página post-conversión). El fallback del `catch` (`main.js:951`) reabre la misma URL 404: no hay ruta de escape.

**Qué cuesta:** se pierde el lead más caro del embudo. Quien completa el quiz ya declaró problema, urgencia y presupuesto; quien llega a `/gracias.html` ya dejó sus datos. A ambos se les responde con una página de error.

**Qué hacer (15 minutos):** crear la cuenta cal.com con ese username y el evento de 30 min, **o** apuntar `openCal()` al modal de contacto / WhatsApp y renombrar los botones a "Hablemos". Incoherencia extra a corregir: el botón de nav de la home dice "Reservá 30 min" pero su handler es `openModal` (`main.js:461`) — abre un formulario, no un calendario.

---

### P3. El negocio vuela a ciegas: analítica sin configurar
*Detectado por 6 auditores (analitica, ux-conversion, codigo-frontend, adquisicion, educacion-oferta, estrategia).*

**Qué pasa:** en el JS servido en vivo, `main.js:1342-1343` → `const CLARITY_ID='YOUR_CLARITY_ID';` y `const GA4_ID='YOUR_GA4_ID';`. Los guardas de las líneas 1353 y 1357 comparan contra esos mismos strings: los scripts nunca se inyectan.

**Evidencia adicional:** `main.js` solo se carga en `index.html` y `bundles.html`. `/software`, `/educacion`, `/bot-demo` y `/404` no tienen ni analítica ni banner de cookies (`site-shell.js` no contiene una sola referencia a plausible/gtag/clarity). `gracias.html` no carga ninguna librería, así que sus eventos `generate_lead`, `clarity()` y `fbq()` (líneas 102-121) están guardados por `typeof X === 'function'` y **nunca se ejecutan**. Plausible sí tiene dominio real (`main.js:1344`) pero solo se inyecta tras aceptar cookies, y solo en la home.

**Qué cuesta:** es el multiplicador de todos los demás problemas. No se puede responder la única pregunta que importa —¿no llega tráfico, o llega y no convierte?— y por eso P1 y P2 llevan semanas rotos sin detectarse.

**Qué hacer (30 minutos):** crear propiedad GA4 + proyecto Clarity (gratis), poner los IDs reales, mover el cargador a `assets/js/analytics.js` e incluirlo en las 8 páginas públicas más `gracias.html`, y sacar Plausible (cookieless) de detrás del banner. Prioridad a Clarity: en 20 visitas las grabaciones muestran dónde se traba la gente sin definir un solo evento.

---

### P4. NIT falso y páginas legales que se autodeclaran borrador
*Detectado por 4 auditores (copy, legal, educacion-oferta, consistencia).*

**Qué pasa:** `Tr3sC3rb3r0 SAS · NIT 900.000.000-0` en los tres footers de `index.html` (líneas 387, 500, 580) y en `legal/privacidad.html:55` y `legal/terminos.html:54`, estas dos con el marcador **`[reemplazar]` visible al público**. Verificado en vivo: `curl https://trescerbero.com/` devuelve 3 ocurrencias. Ambas páginas legales llevan además el cartel "⚠ Plantilla orientativa. Debe ser revisado y firmado por un abogado antes de operar comercialmente" (`privacidad.html:50`, `terminos.html:50`).

**Qué cuesta:** cualquier comprador B2B que verifique NIT en RUES antes de firmar un anticipo de COP 1.8M–12M descarta el proveedor en el acto. Y quien abra los términos antes de firmar lee un contrato que se declara a sí mismo no vigente. Es la señal más cara del sitio y la más barata de quitar.

**Qué hacer (10 minutos):** si la SAS existe, poner el NIT real en los 5 sitios; si no, quitar "SAS" y publicar persona natural con RUT. Borrar los dos banners de plantilla. Ajustar la promesa de "factura electrónica DIAN" (`software.html:421`, FAQ de educación) a lo que hoy se puede emitir.

---

### P5. La home pesa 9,83 MB porque los lobos son JPEG disfrazados de SVG
*Detectado por 2 auditores (performance, movil), ambos con medición independiente.*

**Qué pasa:** en viewport 375×812 y visita nueva, la home transfiere **9.831.780 bytes**; 5 archivos de `assets/heads/` suman 9.737.882 (99,0%). Los `.svg` contienen `<image xlink:href="data:image/jpeg;base64,...">` — son rásters de 800×1000 en base64 (+33% de overhead) envueltos en un `<svg>` con `feColorMatrix`. Por eso brotli casi no los reduce (verificación independiente con `gzip -9`: 3.250.646 → 2.446.518 B, solo −25%). En disco los 9 archivos suman 19,2 MB.

**Consecuencias medidas:** el LCP es un lobo decorativo (`Jade derecho.svg`, 1,64 MB, `startTime` 12.172 ms en visita nueva sobre conexión de escritorio rápida). Llegar directo a `/software` desde un anuncio cuesta 4,87 MB. Y en `index.html:463-464` la propia página presume "90+ Lighthouse mobile" y "<2s Time to Interactive": cualquiera lo desmiente con PageSpeed en 30 segundos, en el sitio de una empresa que vende desarrollo web.

**Qué hacer (unas horas):** convertir los 9 lobos a WebP/AVIF a tamaño de despliegue real (máx ~900 px de alto) — un ráster bien comprimido pesa 50–120 KB, la home bajaría de 9,8 MB a menos de 500 KB. Borrar los tres `<link rel=preload fetchpriority=high>` de `index.html:37-39` mientras tanto. Y borrar los dos contadores falsos hasta que sean ciertos.

---

### P6. Educación está publicada sin poder vender: 12 `[PRECIO]` y una cohorte sin fecha
*Detectado por 7 auditores (seo-tecnico, ux-conversion, copy, pricing, educacion-oferta, legal, adquisicion, consistencia).*

**Qué pasa:** `curl https://trescerbero.com/educacion | grep -c '\[PRECIO\]'` → **12**, en producción. Cubren la cohorte (`educacion.html:144`), las 4 modalidades de clases 1-a-1 y grupales (`:163-166`), el diagnóstico para empresas (`:186`) y los 6 cursos grabados (`:219, 226, 233, 240, 247, 254`). `/software` tiene un 13º en el pack "Web con IA" (`software.html:402`), presentado como "el combo que nadie más empaqueta".

**Peor:** `educacion.html:104` muestra el badge "Cohorte #1 · cupo limitado · **inscripciones abiertas**" y cinco líneas más abajo, `:109`, dice "📅 Fecha: **por anunciar**". El CTA es "Reservar mi cupo".

**Qué cuesta:** el espacio nuevo no puede convertir a nadie, y `[PRECIO]` no se lee como "precio a consultar" sino como sitio sin terminar — contamina también las páginas que sí tienen precio.

**Qué hacer (horas):** poner precio real a la **clase 1-a-1**, que es lo único que se puede entregar mañana sin producir nada. Para la cohorte, fecha condicionada ("arranca el [fecha] si se completan 6 cupos; si no, devolvemos el 100%"). Cambiar el badge a "lista de espera" mientras no haya fecha. En los 6 cursos grabados, reemplazar `[PRECIO]` por "precio al lanzar" — el CTA ya es lista de espera.

---

### P7. El mismo producto tiene dos precios según la página
*Detectado por 4 auditores (copy, pricing, consistencia, codigo-frontend).*

**Qué pasa:** `software.html:184` vende Chat Pro a **COP 760.000/mes**; `bundles.html:85` lo vende a **COP 299.000/mes**. La calculadora de `bundles.html:135-139` ofrece el CRM a "Start Básico USD $50" y "Pro con IA USD $80" cuando `/software` publica COP 69.000 y 199.000. Y el quiz de la home (`main.js:1061-1062`) recomienda Chat a **USD $50 y $150** cuando los reales son $80 y $200.

**Contexto adicional:** `bundles.html` es un fósil del posicionamiento de agencia — vende "Digital Estructura · 3.200.000 COP/mes", "Digital Edificio · 8.500.000", SEO, redes sociales y "10% de comisión sobre el spend de pauta", servicios que hoy no se prestan; e incluye "L-IA Chat Max · 899.000 (futuro)" dentro de un bundle comprable. Su JSON-LD publica a Google ofertas de 2.919.000 y 7.498.500 COP. Está enlazada desde `index.html:345` y `software.html:93, 413`, y en el sitemap con priority 0.8.

**Verificación destacada:** la incoherencia no es solo entre páginas — las *tarjetas* de bundles ya están actualizadas a COP 199.000 y la *calculadora*, 60 líneas más abajo en el mismo archivo, dice USD $80. La página se actualizó a medias. Además la lógica de TRM de bundles es **código muerto**: `updatePrices()` busca `.bundle[data-usd-m]` y eso matchea 0 elementos.

**Qué hacer (20 minutos ahora, horas después):** quitar los enlaces a `/bundles.html` de `index.html:345` y `software.html:413` y sacarla del sitemap y de `llms.txt` HOY. Después: reescribirla solo con los 3 productos vigentes y precios calcados de `/software`, o 301 a `/software#bundles`. Corregir los precios del quiz en `main.js:1061-1062` en el mismo commit.

---

### P8. La TRM en vivo hace saltar el precio −16% frente al visitante
*Detectado por 2 auditores (pricing, codigo-frontend), con aritmética verificada.*

**Qué pasa:** `software.html:161` muestra el badge "**Tasa en vivo** · 1 USD = $3,800 COP" con los COP precalculados a mano en el HTML (`:167` → 304.000 = 80×3.800). Pero `main.js:511` define `TRM=3800` solo como *fallback* y `fetchTRM()` lo pisa con la tasa real: hoy la API devuelve **3.205,52** COP/USD, así que la tarjeta se repinta a **256.480**. Mientras tanto la calculadora de ROI (`software.html:465`) tiene `PLAN_COP=760000, SETUP_COP=5700000, TRM=3800` cableados y no consume la tasa en vivo.

**Qué cuesta:** el visitante ve un precio y medio segundo después otro un 16% menor, en la misma pantalla donde hay un setup de 5.700.000 y un ROI calculado con otra tasa. En la página cuyo argumento central es "precios en COP, sin sorpresas en dólares", eso es autosabotaje.

**Ironía asociada:** la tabla comparativa (`software.html:229-235`) también usa TRM 3.800, así que sobreestima ~18% los precios de la competencia. Y la fila "CRM LATAM por usuario (USD $25/mes)" corresponde al tier *Advanced* de Kommo; su plan de entrada es **USD 15**, es decir más barato que el Básico de COP 69.000 — bajo una columna titulada "plan de entrada, por usuario/mes". El error es autoinfligido.

**Qué hacer (horas):** publicar precios COP fijos y redondos escritos en el HTML, con el USD solo como referencia informativa, y generar TODO (setups, tabla comparativa, ROI) desde una sola constante. Y borrar de `index.html:366` la frase "menos de la mitad de lo que cuesta el CRM en dólares más barato del mercado": es falsa y verificable.

---

### P9. El nav de la home se rompe en móvil y el banner de cookies tapa WhatsApp
*Detectado por 2 auditores (movil, diseno), con medición idéntica.*

**Qué pasa:** en 375×812, `#ctrl` mide **scrollWidth 433 px** dentro de 375. Las tres pastillas van de x=-17 a x=392 (cortadas a ambos lados), el logo queda tapado (`elementFromPoint(100,30)` devuelve `ci` — en la captura solo se lee un fragmento del nombre), y las dos flechas quedan en x=-57 y x=416, fuera de pantalla.

**Causa raíz:** `main.css:50` pone `backdrop-filter:blur(20px)` en `#nav`, lo que convierte al nav en bloque contenedor de su hijo `position:fixed` `#ctrl` (`main.css:112`); así `bottom:0` significa "fondo del nav de 71 px", no del viewport. Y `main.css:140` fija `.ci{flex:0 0 130px}` (3×130 + gaps = 409 px) sin reducirlo nunca en móvil; el media query de `:956` solo oculta la etiqueta, dejando tres puntos anónimos.

**Además:** con localStorage limpio, `.cookie-banner` (z-index 9100) se superpone al FAB de WhatsApp (z-index 1500) y `elementFromPoint` sobre el centro del FAB devuelve `BUTTON.cookie-acc` — el tap en WhatsApp acepta cookies sin querer (feo bajo Ley 1581). Y áreas táctiles de 21–30 px donde el mínimo es 44.

**Qué cuesta:** el primer pantallazo en el dispositivo del ~80% del tráfico colombiano muestra una barra descuadrada con el nombre de la empresa tapado, en la web de alguien que vende desarrollo web. Es credibilidad, no funcionalidad: las pastillas siguen siendo pulsables y el swipe funciona.

**Qué hacer (horas):** sacar `#ctrl` de dentro de `<nav>` o quitarle el `backdrop-filter` en ≤640 px; en móvil `.ci{flex:1 1 0;min-width:0;font-size:.58rem}` sin ocultar `.ci-name`; subir el z-index del FAB por encima de 9100 y desplazarlo mientras el banner esté visible; `min-height:44px` en `.ci`, `.ca`, `.bg-sec` y los botones de cookies; `.sz{display:none}` bajo 900 px.

---

### P10. El quiz, la calculadora ROI y el lead magnet no capturan nada (o prometen lo que no envían)
*Detectado por 4 auditores (ux-conversion, educacion-oferta, adquisicion, analitica).*

**Qué pasa:** el quiz tiene 3 pasos y lógica de recomendación completa (`main.js:1042-1103`) y su única salida es `#qRecCta` → `openCal()` → el 404 de P2. No hay campo de email ni enlace al plan recomendado. La calculadora ROI (`software.html:122-153`) muestra "recuperás el setup en X meses" y después del `</div>` del `.roi-output` sigue directamente `<div class="plans-sec">`: **cero CTA**.

**Peor, el lead magnet:** `educacion.html:337` muestra al enviar "✓ ¡Listo! Revisá tu correo — **la primera lección llega en minutos**". El submit solo hace POST a Web3Forms, que reenvía un correo al buzón del dueño. `grep -rniE 'mailchimp|brevo|convertkit|mailerlite|resend|sendgrid|nodemailer|smtp'` sobre `apps` → **0 resultados**; no hay ni una lección escrita en el repo. La persona da su email, no recibe nada, y aprende en el primer contacto que la marca promete y no cumple.

**Y ningún formulario captura origen:** `grep utm_|referrer|gclid|fbclid` en `apps/web/public` → 0 resultados reales. Cuando llegue el primer lead, no habrá forma de saber de dónde vino.

**Qué hacer:**
- Hoy: cambiar el mensaje del mini-curso a algo cumplible ("Anotado. Te escribimos con la primera lección esta semana") y enviarlas a mano mientras el volumen sea bajo.
- Esta semana: un CTA bajo la calculadora ROI ("Te mando este cálculo por WhatsApp") con `wa.me` y las cifras precargadas — una línea de JS, cero backend. Y en el quiz, un campo de email más un botón "Ver este plan →" al ancla correspondiente.
- Guardar `utm_*` + `document.referrer` en `sessionStorage` al primer pageview y añadirlos como campo `origen` a los 4 formularios de Web3Forms. Funciona aunque rechacen cookies.

---

## 4. Quick wins de esta semana

Todo esto son minutos u horas. Ejecutable el lunes, en este orden.

| # | Acción | Archivo / ruta | Tiempo |
|---|--------|----------------|--------|
| 1 | Reemplazar `https://app.trescerbero.com` → `https://trescerbero.com/app` (o crear el DNS) | `index.html:296`; `software.html:83, 215, 216, 260, 280, 299`; `app/assets/app.js:6-9` | 30 min |
| 2 | Sacar las 3 URLs de `app.trescerbero.com` del sitemap y arreglar los 4 `Offer.url` | `sitemap.xml`; `index.html:142-145` | 15 min |
| 3 | Crear la cuenta cal.com `tr3sc3rb3r0` con evento `30min`, o apuntar `openCal()` al modal | `main.js:929-930, 951` | 15 min |
| 4 | Poner GA4_ID y CLARITY_ID reales | `main.js:1342-1343` | 20 min |
| 5 | Incluir el cargador de analítica en `gracias.html`, `/software`, `/educacion`, `/bundles` | extraer a `assets/js/analytics.js` | 1 h |
| 6 | Borrar el NIT `900.000.000-0` y los `[reemplazar]` | `index.html:387, 500, 580`; `legal/privacidad.html:55`; `legal/terminos.html:54` | 10 min |
| 7 | Borrar el cartel "⚠ Plantilla orientativa" | `legal/privacidad.html:50`; `legal/terminos.html:50` | 5 min |
| 8 | Quitar la FAQ de "datos en Colombia" y sus 3 réplicas | `software.html:426, 229`; `index.html:57, 137, 328` | 15 min |
| 9 | Borrar "78%", "3.2× leads" y "El paquete más vendido" | `software.html:100, 103, 105`; `index.html:313`; `bundles.html:97` | 20 min |
| 10 | Borrar "90+ Lighthouse mobile" y "<2s TTI" | `index.html:463-464` | 5 min |
| 11 | Corregir el precio del quiz ($50→$80, $150→$200) y "Falsa IA" → "IA por reglas" | `main.js:1061-1062, 1067` | 10 min |
| 12 | Quitar los enlaces a `/bundles.html` y sacarla del sitemap y `llms.txt` | `index.html:345`; `software.html:93, 413` | 15 min |
| 13 | Borrar los 3 `<link rel=preload fetchpriority=high>` (libera 4,75 MB de prioridad alta) | `index.html:37-39` | 2 min |
| 14 | Cambiar el mensaje del mini-curso a algo cumplible | `educacion.html:337` | 5 min |
| 15 | Cambiar el badge de la cohorte a "lista de espera" | `educacion.html:104` | 5 min |
| 16 | Corregir el selector del foco del modal (`input` → `input[name="name"]`) | `main.js:432` (copiar de `site-shell.js:97`) | 5 min |
| 17 | Subir el z-index del FAB de WhatsApp por encima de 9100 | `main.css:811` y regla del `.wa-float` | 15 min |
| 18 | Subir `--dimmer` a `.42` / `.62` (arregla contraste 1.45:1 de la letra de planes) | `main.css:4, 21` | 10 min |
| 19 | Añadir `id="precios"` a la sección de planes | `software.html` (repara el CTA de `index.html:372`) | 2 min |
| 20 | Quitar `ArrowUp/ArrowDown` del atajo de teclado y añadir `if(e.target!==document.body)return` | `main.js:344-349` | 5 min |
| 21 | Envolver el cursor custom y su bucle rAF en `matchMedia('(pointer:fine)')` | `main.js:400-401` | 5 min |
| 22 | Portar la validación de email de `main.js:466-476` a `site-shell.js:104-120` | `site-shell.js` | 15 min |
| 23 | Corregir `waUrl()`: `['Chat IA','L-IA CRM','Desarrollo']` → `['Software','Inicio','Educación']` | `main.js:916` | 3 min |
| 24 | Reemplazar `'ER_DUP_ENTRY'` por `'23505'` (cierra un 500 real en POST /crm/notes) | `note-parser.ts:76, 110`; `engine/actions.ts:92`; `chat/tools.ts:1038` | 15 min |
| 25 | Configurar allowed-domains + honeypot en el panel de Web3Forms | (panel externo) | 10 min |
| 26 | Dar de alta `https://trescerbero.com/health` en UptimeRobot | (panel externo) | 15 min |
| 27 | Verificar el dominio en Google Search Console y enviar el sitemap | (panel externo) | 10 min |
| 28 | Bumpear `main.js?v=1.3.1` → `1.3.6` (sin esto, los arreglos de JS no llegan a quien ya visitó) | `index.html:647` | 2 min |

**Nota crítica sobre el punto 28:** el cache es `max-age=31536000, immutable`. Si se editan estos archivos sin subir el `?v=`, los navegadores sirven la versión vieja **durante un año**. Ese paso no es opcional.

---

## 5. Riesgos serios (no negociables)

### 5.1 Legales / regulatorios

| Riesgo | Evidencia | Exposición |
|--------|-----------|------------|
| **NIT inventado publicado** | `900.000.000-0` con marcador `[reemplazar]` en 5 archivos, verificado en vivo | Ley 1480/2011 art. 50 lit. a (identificación del proveedor en comercio electrónico). Descalificador inmediato en due diligence. |
| **"Datos hosteados en Colombia"** falso | `software.html:426`, `index.html:57, 137, 328`. Los A records resuelven a Hostinger fuera de Colombia; `legal/privacidad.html:99` admite lo contrario en la misma web | Publicidad engañosa (Ley 1480 arts. 29-30). Es el diferencial con el que se compite contra HubSpot/Kommo. |
| **Métricas de resultado sin respaldo** | "78% de consultas auto-resueltas", "3.2× leads/mes" (`software.html:100-105`), "El paquete más vendido" (`bundles.html:97`) | Afirmaciones objetivas no comprobables; además exigibles contractualmente por el cliente. |
| **Captura de datos sin autorización expresa** | `educacion.html:199-204` e `index.html:621-640` sin checkbox de consentimiento ni prueba del texto consentido | Ley 1581/2012 art. 9 + Decreto 1377 art. 5. El propio proyecto ya lo hace bien en `app/crm/demo.html:118` y persiste `consentedAt`+`consentText`: solo hay que replicarlo. |
| **Sin retracto ni reversión del pago** | 0 ocurrencias de "retracto"/"reversión" en todo `apps/web/public`; tres promesas de reembolso incompatibles entre `educacion.html:114/281`, `bundles.html:180` y `terminos.html:89/102` | Ley 1480 arts. 47 y 51 (irrenunciables en venta a distancia a consumidores). **Hoy prospectivo** — no hay checkout; se vuelve grave el día que se publique el primer link de pago. |
| **Términos B2B aplicados a consumidores** | Aceptación tácita a 5 días (`terminos.html:86`), penalidad de permanencia (`:102`) cubriendo también cursos a personas naturales | Cláusulas abusivas, ineficaces de pleno derecho (Ley 1480 arts. 42-43). |
| **Canal de Habeas Data inconsistente** | `privacidad.html:111` dice `hola@`; `app/crm/demo.html:83` dice `ceo@` | Plazos de Ley 1581 arts. 14-15 corren igual si la solicitud llega a un buzón no monitoreado. |

### 5.2 Seguridad y datos de clientes

Todo lo siguiente es **riesgo latente**: el API no está desplegado, así que nada es explotable hoy. Pero es el código que va a producción.

1. **IDOR en deals (crítico).** `deals.ts` POST (~150) y PATCH (~203) aceptan `contactId`/`companyId`/`assignedTo` sin validar la org, y los lectores hacen `leftJoin` sin filtro (`deals.ts:82-84`, `ai/routes.ts:91-93`, `generators.ts:79-80, 123`). Cadena completa: registrarse en 20 s → crear un deal con el `contactId` de otra org → `GET /api/ai/export/deal/:id.md` devuelve nombre, email y teléfono del contacto ajeno. El propio autor sabía del bug: `contacts.ts:112` tiene el comentario *"Validar que la company es de la org (sin esto, fuga cross-tenant)"*. No se replicó en deals.

2. **`ENCRYPTION_KEY` opcional con fallback público.** `config/env.ts:41` la declara `.optional().default('')` y `lib/crypto.ts:10` cae a `'dev-only-CAMBIAR-EN-PROD-32-chars'` — literal presente en el repo. Con esa llave se cifran las API keys BYOK de los clientes del plan Max. **Fix de una línea**, obligatorio antes del primer cliente Max.

3. **Demo agrupado por `sha256(ip|user-agent)`** (`demo/routes.ts:64`): dos visitantes tras el mismo NAT con el mismo navegador entran a la **misma organización** con rol `admin_org` y pueden ver y borrar los datos del otro. Contradice de frente el aviso de privacidad del propio formulario. Si las cabeceras de proxy no llegan, el fallback es `'0.0.0.0'` y *todos* comparten demo.

4. **`POST /api/chat` sin cuota ni rate limit**, con fallback a `env.ANTHROPIC_API_KEY` del dueño (`chat/routes.ts:93`, `key-resolver.ts:27-29`). `checkQuota` existe y solo se llama dentro de 3 tools. Gasto sin techo ni alerta.

5. **`POST /api/demo/erase` sin auth ni rate limit** (`demo/routes.ts:176`): borra la org demo de cualquiera conociendo su email. Soft-delete, reversible, y limitado a demos que dejaron email — pero es un endpoint destructivo abierto que además incumple el art. 8 de la Ley 1581 que pretende cumplir (no acredita identidad del titular).

6. **Rate limiting falsificable:** `middleware/rate-limit.ts:14-21` confía en `cf-connecting-ip`/`x-forwarded-for` sin lista blanca de proxies, y el estado vive en un `Map` en memoria. Enviar una IP aleatoria anula los tres límites que existen. Además ese mismo hash de IP alimenta el `ipHash` de la constancia de Habeas Data, lo que debilita su valor probatorio.

7. **Cookie de sesión con `Secure=false` por defecto** (`config/env.ts:26`) y TTL de 30 días con renovación indefinida sin tope absoluto (`lib/sessions.ts:80-84`). Compensado por `DEPLOY.md:122`, pero el default debería derivarse de `isProd`.

8. **CSP decorativa:** la política de 8 directivas de `apps/web/server/index.js:64-75` no llega al navegador — Hostinger la sustituye por `upgrade-insecure-requests`. Hoy el sitio no tiene CSP efectiva.

### 5.3 Continuidad

- **Cero backups de trescerbero.** Los 4 cron jobs de la cuenta son de otros proyectos; `~/lm-backups/` solo tiene librosmedellin. Hoy no hay datos que perder (el API no está desplegado), pero esto tiene que existir **antes** del primer cliente, no después.
- **La API nunca se compiló:** no existe `apps/api/dist/`, y con el `.env` actual (que trae `DB_HOST`/`DB_USER` de MySQL en vez de `DATABASE_URL`) el proceso sale con `exit 1`. Cuatro documentos (`DEPLOY.md`, `.env.example`, `CLAUDE.md`, `.claude/memory/feedback_no_supabase.md`) describen MySQL mientras el código migró a Postgres/Supabase en el commit `2d43bb3` — **y esa memoria registra que Supabase era una decisión cerrada en contra**. Hay que decidir, no solo documentar.
- **Deploy por scp sobre un checkout git divergido:** el servidor está en `2d43bb3` con 12 archivos sin commitear. Verificación tranquilizadora: los md5 de los 5 archivos clave coinciden byte a byte con el repo local en `fea1794`, así que sí se sabe qué corre. Pero el git del servidor miente y no hay CI ni script de deploy.
- **Bug que envenena el chat:** `chat/routes.ts:129-146` reconstruye el historial mapeando `role:'tool'` a `'user'` con un objeto plano en vez de un array con bloques `tool_result`. En cuanto la IA usa una tool, el mensaje siguiente falla con 400 → 500 genérico (no hay `catch` en el archivo), y como el mensaje del usuario ya se persistió, **la sesión queda rota para siempre**. Desplegar el CRM sin arreglar esto es peor que no desplegarlo. Bonus: `orderBy(asc(createdAt)).limit(40)` carga los 40 mensajes *más viejos*, no los recientes.

---

## 6. La conversación difícil

**El dato más duro de toda la auditoría no está en el código: el repo no tiene un commit desde el 25 de julio** (`fea1794`, 34 commits totales, working tree limpio), mientras la memoria del proyecto documenta actividad de agosto en librosmedellin.com. Cinco semanas sin commits no prueban abandono, pero sí prueban dónde está la atención. Los hechos ya eligieron.

Hoy hay cinco frentes abiertos por una persona: **CRM SaaS multi-tenant, chatbots, agencia web/software, escuela con 6 cursos + cohorte de 12 sesiones en vivo, y un e-commerce propio**. Ninguno llegó al punto de cobrar. Eso no es mala ejecución: es aritmética. Un CRM SaaS compite contra Kommo, Clientify y HubSpot, que tienen equipos de decenas de ingenieros y soporte 24/7; sostener uno solo exige dedicación completa y una operación de cobro recurrente, soporte, backups y cumplimiento que no existe.

### Qué sostener

**1. Desarrollo web y software a la medida (COP 1.8M–12M por proyecto).** Es el frente con mejor relación esfuerzo/probabilidad: ticket alto, cobrable hoy por transferencia sin construir infraestructura, un caso real en producción (librosmedellin.com) y competencia local con precios publicados que dejan margen. El problema no es el precio de 1,8M —es defendible contra el mercado— sino que sea el **escalón más bajo**. Falta una puerta de entrada: la auditoría de performance + SEO de COP 650.000 que ya está enterrada en `software.html:378-384` merece bloque propio y CTA, o una landing de una página en ~900.000 con entrega en 5 días. Objetivo explícito: 3 clientes pequeños este trimestre para generar los testimonios que sostienen los precios altos.

**2. Chatbots / automatización como proyecto, no como SaaS.** Se venden con setup + mantenimiento, no exigen billing recurrente ni multi-tenancy, y el bot demo ya existe. Requiere dos arreglos de 10 minutos: quitar "Fake IA" y "SIN SERVIDOR NI IA" de la interfaz visible de `bot-demo.html` (líneas 6 y 44) —se vende IA real y la demo declara lo contrario—, y añadirle un CTA de salida, porque hoy `document.querySelectorAll('a').length === 0`: es un callejón sin salida literal.

### Qué congelar

**El CRM como suscripción SaaS.** No como producto: como *modelo de cobro*. Está bien construido y es la mejor pieza de portafolio y el mejor material de la cohorte. Pero sin billing, sin backups, sin verificación de email, sin recuperación de contraseña, sin logs de auditoría de admin y con un IDOR abierto, cobrar COP 69k/usuario/mes por él implica asumir soporte, cumplimiento Habeas Data y responsabilidad sobre datos de clientes con cero holgura. **Propuesta:** venderlo como *implementación* (pago único + mantenimiento facturado a mano) para 2-3 clientes conocidos, y dejar la suscripción para cuando haya demanda que la justifique. Antes de eso hay que arreglar el bug del chat, el IDOR y la `ENCRYPTION_KEY`, que son tres tardes.

**El catálogo de 6 cursos grabados.** Producir 6 cursos + 12 sesiones en vivo compite directamente con el tiempo facturable, en el segmento más saturado y con más oferta gratuita que existe: el mercado ya vende "Certificación Claude Code Dev" en 6 horas (Coding Latam, cohorte 3, 176+ devs), hay cursos completos gratis en español, y Talento Tech (MinTIC) da bootcamps de IA **gratis en Medellín** con meta de 14.480 cupos en Antioquia. Además `educacion.html:218` afirma "Lo que Udemy no enseña y las plataformas grandes aún no tienen", y eso es falso y verificable en 30 segundos por el lector técnico al que apunta.

### Qué mantener vivo en Educación

Solo lo que se puede entregar mañana sin producir nada: **clases 1-a-1 con precio publicado**, y una versión recortada de la cohorte (taller de 2-3 semanas, 4-6 sesiones, cupo 6-8) centrada en lo que ni Talento Tech ni Udemy dan: acompañamiento sobre *tu* código, agentes en codebase real y seguridad del código generado por IA. Ese último ángulo es el único genuinamente escaso.

### El camino más corto a los primeros 10 clientes pagos

No pasa por el sitio. Pasa por:

1. **Arreglar los CTA rotos y medir** (día 1) — sin esto ningún esfuerzo posterior es evaluable.
2. **Dos clientes ancla a precio de costo** a cambio del permiso para publicar el caso **con cifras** ("pasó de responder en 6 h a 2 min, +N cotizaciones/mes"). Priorizar comercios ya conocidos vía librosmedellin: proveedores, editoriales, librerías. Un caso con números destraba anuncios, contenido y referidos a la vez.
3. **Existir en algún lado.** Hoy el sitio tiene exactamente **2 enlaces externos, ambos al mismo LinkedIn personal**, y buscar la marca no devuelve un solo resultado sobre la empresa. Para servicios de millones de pesos, el prospecto verifica antes de escribir. Dos canales sostenidos, no cinco: LinkedIn del founder (2 posts/semana mostrando construcción real) y Google Business Profile de Medellín (gratis, 30 min, y el schema `LocalBusiness` ya está escrito en `index.html:47`).
4. **Un enlace desde librosmedellin.com** — hoy el flujo es unidireccional hacia el lado equivocado: trescerbero menciona librosmedellin 7 veces y librosmedellin no lo menciona ni una.
5. **Contenido, después.** 5-8 páginas atacando las consultas que la competencia ya rankea ("¿Cuánto cuesta un chatbot de WhatsApp en Colombia?", "¿Cuánto cuesta una página web en Medellín?"), con la ventaja diferencial de publicar precios reales. Retorno a 3-6 meses: es el canal correcto, pero no el primer paso.

---

## 7. Plan de 30 / 60 / 90 días

Dimensionado para **una persona sola**, asumiendo que trescerbero recibe una fracción de la semana y librosmedellin sigue operando.

### Días 1–30 — "Que se pueda comprar y que se pueda medir"

**Semana 1 (un día de trabajo concentrado):**
- Ejecutar los 28 quick wins de la sección 4, en orden. Empezar por los CTA (P1, P2), seguir por analítica (P3) y legal (P4).
- Bumpear `?v=` en el mismo commit. Verificar con `curl ... | grep G-` que el ID real llegó al archivo servido.
- Verificar Search Console y enviar el sitemap corregido.

**Semana 2:**
- Convertir los 9 lobos a WebP y montar `<picture>` (P5). Meta verificable: home móvil por debajo de 500 KB, medido con PageSpeed. Recién entonces se puede reponer un número real de Lighthouse en la home, con fecha.
- Arreglar el nav móvil y el z-index del FAB (P9). Verificar con `document.documentElement.scrollWidth === innerWidth` en 320/375/414.

**Semana 3:**
- Precios: unificar todo desde una sola constante, quitar "Tasa en vivo", corregir la tabla comparativa (Kommo entra en USD 15), poner precio a la clase 1-a-1 y fecha condicionada a la cohorte (P6, P7, P8).
- Despublicar o reescribir `bundles.html`.

**Semana 4:**
- CTA en la calculadora ROI y captura de email en el quiz (P10). Captura de `utm_*` + referrer en los 4 formularios.
- Empezar la conversación con 2 clientes ancla.

**Resultado esperado a día 30:** cero CTA rotos, analítica funcionando con al menos 2 semanas de datos, home móvil ~20× más liviana, cero afirmaciones falsas publicadas, precios coherentes en todo el sitio, y el primer dato real sobre si el problema es tráfico o conversión.

### Días 31–60 — "Que exista y que tenga prueba"

- **Cerrar los 2 clientes ancla** y documentar el caso con cifras. Esta es la tarea que más mueve la aguja del bloque.
- **Google Business Profile** de Medellín + primeras 3 reseñas. Perfil de empresa en LinkedIn + `sameAs` poblado en el JSON-LD (`index.html:42`, hoy `[]`).
- **Enlace desde librosmedellin.com** + una página `/hecho-con-ia` contando cómo se construyó la tienda.
- **LinkedIn del founder:** 2 posts/semana mostrando construcción real. Es el canal donde están las pymes de 5-50 empleados.
- **Educación:** publicar precio de la clase 1-a-1 y abrir lista de espera honesta de la cohorte recortada. Escribir las 3-5 lecciones del mini-curso y conectarlas a un ESP gratuito (Brevo/MailerLite), o mantener el envío manual con el copy corregido.
- **Bot demo:** renombrarlo, quitar "Fake IA" de la interfaz y añadirle un CTA de captura al final de la conversación.
- **Backend, solo si se decide sostenerlo:** arreglar el bug del historial de chat, el IDOR de deals, `ENCRYPTION_KEY` y `ER_DUP_ENTRY` → `23505`. Escribir 5 tests: aislamiento entre orgs en contacts/deals/notes, login+sesión, dos turnos de chat con tool call, nota con hashtag repetido, encrypt/decrypt ida y vuelta. Añadir `"test": "tsx --test src/**/*.test.ts"` al `package.json` — hoy los dos tests que existen no se pueden correr con un comando estándar.

**Resultado esperado a día 60:** 2 casos publicados con números, presencia verificable de la marca en al menos 3 índices externos, una oferta educativa comprable, y la decisión sobre el CRM tomada explícitamente (sostener o congelar) en vez de por omisión.

### Días 61–90 — "Que lo encuentren"

- **5-8 artículos** de intención comercial-informacional, uno por semana, con precios reales como diferencial. Entran al sitemap y se enlazan desde `/software` y `/educacion`.
- **Menciones externas:** perfiles en directorios de agencias LATAM, respuestas útiles en r/devsCO y foros de emprendimiento, solicitud de inclusión en los artículos de comparativa que ya rankean. Meta: 10 menciones en 60 días. Sin esto, el `llms.txt` (que está impecable) no va a producir ninguna citación: los LLM ponderan lo que dicen *otros* sobre una entidad.
- **Landing de entrada** de ~900.000 COP (una página, 5 días de entrega) como puerta al proyecto grande.
- **Accesibilidad y deuda de diseño**, en el rato que quede: `inert` en los heads inactivos (elimina 33 focusables fantasma), `aria-label` en los controles del carrusel, `<main>` + skip link, mensajes de error de formulario con `role="alert"`, y poda de las 57 reglas muertas de `main.css` (−6,2 KB) y de los ~60 KB muertos de `main.js`.
- **Si el CRM sigue vivo:** cron de `pg_dump` con rotación de 14 días replicado a un segundo destino, custodia de `ENCRYPTION_KEY` en gestor de contraseñas con copia offline, y `deploy.sh` con rsync en vez de scp suelto.

**Resultado esperado a día 90:** un canal de descubrimiento orgánico funcionando, prueba social real, y datos suficientes para decidir dónde invertir el primer peso de pauta — que hoy sería dinero quemado.

---

## 8. Anexo: hallazgos por área

Detalle completo para consulta. Severidad = `severidad_final` tras verificación adversarial.

### Performance (2/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | Home de 9,83 MB; los "SVG" de lobos son JPEG/PNG en base64 de 800×1000 con `feColorMatrix`. Brotli no ayuda (−25%). 19,2 MB en disco. | `assets/heads/*.svg` |
| Alto | LCP = lobo decorativo multi-MB (`Jade derecho.svg`, 1,64 MB, 12.172 ms en visita nueva). `mix-blend-mode:screen` sobre `fixed` de 65vh + doble `drop-shadow`. | `main.css:304-305`, `index.html:609-611` |
| Alto | Intro a pantalla completa inerte hasta que se ejecute `main.js` (33,8 KB br, compitiendo con 4,75 MB de `fetchpriority=high`). **Corregido:** sí existe salto automático a 24 h vía `localStorage tr3s_intro_seen` (`main.js:1398-1410`). | `index.html:178`, `main.css:620` |
| Medio | Preload de 4,75 MB con `fetchpriority=high` antes del CSS. **Corregido:** esas imágenes sí son el héroe visible (224×280 y 293×367 a 375 px); el daño es de prioridad, no de desperdicio. | `index.html:37-39` |
| Medio | Cada página interior descarga ~4,8 MB. **Corregido:** los tríos se solapan parcialmente (Azul centro y Jade centro compartidos); coste incremental home→software ~2,33 MB, no 4,87. Donde sí cuesta los 4,87 MB completos es la llegada directa desde un anuncio. `/bundles` (60 KB) prueba que el sitio funciona sin lobos. | — |
| Medio | Handler de scroll sin throttle que reescribe estilos de elementos con filtro y blend en cada evento. Long task de 79 ms medida. | `main.js:230-236` |
| Medio | Bucle `requestAnimationFrame` infinito del cursor custom, activo en móvil donde está `display:none`. | `main.js:400-401`, `main.css:956` |
| Medio | "90+ Lighthouse mobile" y "<2s TTI" publicados y falsos. | `index.html:463-464` |
| Bajo | `fetch` a jsDelivr con `@latest` y `cache:'no-store'` en la ruta del precio; el CDN permite 7 días. | `site-shell.js:180` |
| Bajo | 38% de `main.js` es el diccionario i18n, la mitad en inglés que nadie usa. | `main.js:4-188` |

> No se pudo aplicar throttling real de red: las cifras de 4G son aritmética sobre bytes medidos, no medición end-to-end.

### SEO técnico (4/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | `app.` y `api.trescerbero.com` en NXDOMAIN: 7 CTA clicables + 4 `Offer.url` + 3 URLs en sitemap. Ver P1. | `index.html:296, 142-145`; `software.html:83,215,216,260,280,299` |
| Alto | Cero contenido indexable no comercial: 4 URLs útiles, sin blog ni casos. La marca es leetspeak impronunciable. *(La parte de posicionamiento no se pudo verificar: no hay acceso a Google ni a Search Console.)* | `apps/web/public/` |
| Medio | 4 `<h1>` en la home, dos idénticos a los de `/software` y `/educacion`. **Corregido:** el solape real de vocabulario es 25-35%, no duplicación literal; múltiples H1 no son penalización en HTML5. Riesgo acotado a la selección de URL para la consulta exacta del titular. | `index.html:187, 292, 412, 525` |
| Medio | `@id` cruzados: los `Service` de `/software` y el `Course` de `/educacion` referencian un `Organization`/`Person` que solo existe en la home. | `software.html:34,44,53`; `educacion.html:34,42,51` |
| Medio | `Course` sin `price` ni `startDate`: inelegible para el rich result enriquecido de cursos. Causa raíz de negocio, no de marcado. | `educacion.html:38-44` |
| Medio | `sameAs: []` vacío; ninguna señal externa de entidad. Sin Google Business Profile. | `index.html:42` |
| Medio | Meta descriptions de 185-260 caracteres (Google corta en ~155). | las 4 páginas |
| Bajo | `/software` y `/software.html` sirven 200 idénticos; www sin 301. **Corregido:** los canonicals están bien puestos (incluido en www), así que Google consolida. Lo único accionable es la contradicción `sitemap.xml` (`/bundles.html`) vs canonical (`/bundles`). | `server/index.js`, `sitemap.xml` |
| Bajo | FAQ visibles sin `FAQPage` en las dos landings; `/software/` con barra final → 404; `llms.txt` desalineado con los canonicals; `robots.txt` bloquea `/gracias.html` que ya lleva `noindex` (el Disallow impide ver el noindex). | varias |

### Accesibilidad (4/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Alto | El foco del modal apunta al honeypot `display:none`; medido en vivo, `document.activeElement` queda en BODY. Sin `aria-labelledby`, sin trampa de foco, sin devolución del foco al cerrar. Ya está bien resuelto en `site-shell.js:97`. | `main.js:432`, `index.html:622` |
| Alto | 33 focusables fantasma en los dos espacios inactivos: `pointer-events:none` no saca del orden de tabulación ni del árbol de accesibilidad. Cero ocurrencias de `inert` en todo el repo. | `main.css:80-81`, `main.js` (`applyStates`) |
| Alto | ↑/↓ rotan el carrusel y `resetScrolls()` devuelve el scroll a 0; `body{overflow:hidden}` deja el scroller en un div sin tabindex, así que ni Espacio ni AvPág funcionan. | `main.js:344-349, 213`; `main.css:40, 79` |
| Medio | Los tres acentos del modo claro miden 4.05–4.22:1 (AA exige 4.5), y el comentario del CSS afirma falsamente que cumplen. Blanco sobre `#a36e00` = 4.39:1 y sobre `#1c8a00` = 4.48:1 en botones de 12,8 px bold. *(`#007fa8` sobre blanco sí pasa: 4.56:1.)* | `main.css:20, 22, 30-34, 987-989` |
| Medio | `cursor:none` en 30 reglas. **Corregido:** el punto se posiciona sin interpolación (solo el anillo tiene lag) y `body.ss` restaura el cursor en las subpáginas: el problema está acotado a la home. Sigue anulando el cursor de alto contraste del SO. | `main.css:40, 45-46, 70, 956, 960` |
| Medio | Errores de formulario solo con borde rojo que desaparece a los 2,5 s. Cero `aria-live`/`role="alert"` en todo el sitio; formularios con `novalidate`. | `main.js:473` |
| Medio | `pBtn`/`nBtn` sin `aria-label`; `.ci` sin `aria-current`; en móvil las pastillas quedan sin nombre accesible; las `.sz` son divs clicables del 16-22% del ancho sin rol. | `index.html:265-271, 280-281` |
| Medio | Splash sin gestión de foco ni `inert`; el botón "Saltar" a ~3:1 con `animation-delay:2.2s`. | `index.html:178-197`, `main.css:768` |
| Bajo | Sin `<main>`, sin skip link, `h1` duplicados. | `index.html` |

> No se pudo verificar zoom al 200% ni comportamiento real con lector de pantalla.

### Móvil (3/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | ~19 MB de cabezas decodificadas en la sesión; 98% del peso de cada página es decoración. `gzip -9` local confirma −25% de compresión. Ver P5. | `assets/heads/` |
| Alto | Nav de la home descuadrado: `#ctrl` de 433 px en 375; flechas fuera de pantalla; logo tapado. Causa: `backdrop-filter` en `#nav` convierte al padre en bloque contenedor del hijo `fixed`. | `main.css:50, 112, 140, 956`; `index.html:262-273` |
| Medio | Banner de cookies sobre el FAB de WhatsApp (`elementFromPoint` devuelve `cookie-acc`) y sobre las CTA secundarias. **Corregido:** dura hasta el primer tap y el intro ya tapaba el FAB de todos modos; es fricción + consentimiento accidental, no pérdida definitiva. | `main.css:811` |
| Medio | `.sz` capturan 16% del ancho (22% en tablet) sobre el margen del texto. **Corregido:** el swipe SÍ tiene guardas (`|dx|>|dy|` y `>50px` + exclusión del modal): no hay secuestro de gestos. | `main.css:95, 956`; `main.js:389-395` |
| Medio | Áreas táctiles de 21-33 px (pastillas 130×21, flechas 16×38, botones de cookies 29 px) contra el mínimo de 44. | varias |
| Medio | Header fijo + subnav pegajoso = 190 px de 812 (23%) permanentes; tapan filas de la tabla comparativa. | `/educacion`, `/software` |
| Medio | `.plans-grid` con `grid-template-columns` fijo de 296 px en contenedor de 242; colisión de la píldora de precios con el texto; `scrollWidth` 379 vs `innerWidth` 375. | `software.html` sección CRM |
| Medio | Inputs del modal a 14,4 px → zoom automático en iPhone. Sin campo de WhatsApp/teléfono en un país donde se cierra por WhatsApp. | `main.css` `.mo-field` |
| Bajo (refutado) | "Hero ilegible 2-3 s". **Refutado:** el IntersectionObserver sí dispara en móvil; el "60 de 75 `.fu` sin `.vis`" corresponde a las cabezas inactivas y al contenido bajo el pliegue. Queda un problema menor de contraste del párrafo sobre las líneas del lobo, mitigado por `text-shadow`. | — |

### UX / conversión (3/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | CTA primario del espacio Software → NXDOMAIN. Ver P1. | `index.html:296`, `software.html` |
| Crítico | Los "Reservá 30 min" → 404 de Cal.com, incluida la cuenta raíz. Ver P2. | `main.js:929-951, 1106, 1125`; `gracias.html` |
| Alto | Cero analítica efectiva. **Corregido:** no es cero absoluto — Plausible tiene dominio real y carga tras aceptar cookies, solo en la home. Ver P3. | `main.js:1342-1343` |
| Alto | 12 `[PRECIO]` en `/educacion` + 1 en `/software`. Ver P6. | `educacion.html`, `software.html:402` |
| Medio | El bot demo se presenta como "Fake IA" y declara "SIN SERVIDOR NI IA"; `<a>` y `<form>` en 0: callejón sin salida. Promocionado desde `index.html:346` y `software.html:101`. El `noindex` es correcto y deliberado. | `bot-demo.html:6, 44` |
| Medio | Quiz y calculadora ROI sin captura. **Corregido:** el quiz sí muestra plan, precio y razón; el sitio sí tiene captura funcional (`#moForm` → Web3Forms) y WhatsApp persistente. Falta conectar piezas que ya existen. Ver P10. | `index.html:213-256`, `software.html:122-153` |
| Medio | Banner de cookies sobre las tres puertas del intro a 375×667. **Corregido:** RECHAZAR lo oculta y las puertas quedan libres; hay propuesta de valor visible y "SALTAR →" legible. Bloqueo de dos toques, no callejón. | `main.css:811, 798` |
| Medio | Lead magnet promete "primera lección en minutos" sin autoresponder. Ver P10. | `educacion.html:337` |
| Medio | 9 CTA compitiendo en el panel Inicio + 3 interrupciones flotantes; el botón de nav dice "Reservá 30 min" y abre un formulario. | `index.html`, `main.js:461` |

### Copy (4/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | NIT `900.000.000-0` en 5 archivos, con `[reemplazar]` visible en las legales. Ver P4. | `index.html:387,500,580`; `legal/*.html` |
| Alto | "Datos hosteados en Colombia" falso. **Corregido:** la IP citada (185.212.71.135) es un ejemplo de `DEPLOY.md`, no el host real; los A records resuelven a Hostinger (Vilnius/Larnaca según medición), no a Phoenix. La conclusión sobrevive con mejor evidencia. | `software.html:426, 229`; `index.html:57,137,328` |
| Alto | Métricas inventadas. **Corregido:** se sostienen 78%, 3.2× y "el paquete más vendido"; NO se sostienen el "3.0× ROI" (es el default de una calculadora interactiva), el Lighthouse/TTI (atribuidos a librosmedellin, medibles) ni los "14d" (compromiso de plazo). | `software.html:100,103,105`; `bundles.html:97` |
| Alto | `bundles.html` como fósil del posicionamiento anterior, con la incoherencia **dentro de la misma página**: tarjetas en COP 199.000 y calculadora en USD $80. Ver P7. | `bundles.html:85,99,115,117,135-139,161,169` |
| Alto | 13 `[PRECIO]` en vivo + contradicción "inscripciones abiertas" vs "fecha por anunciar". **Corregido:** sí existe lead magnet funcional con captura de email; lo que falta es la ruta de compra. | `educacion.html:104,109` |
| Medio | Prueba social: un solo logo bajo "CONFÍAN EN NOSOTROS · LATAM" y es del mismo dueño. **Corregido:** la divulgación existe y es honesta (`index.html:459-466`, "NUESTRO PROPIO e-commerce"); el problema es de orden, no de ocultamiento. | `index.html:353-358` |
| Medio | Jerga técnica (RAG, tool-calling, BYOK, "Knowledge Graph tipo Obsidian", tokens) en la página dirigida a dueños de pyme. Está en la página equivocada: el público técnico es el de Educación. | `software.html`, `index.html:205` |
| Medio | Mezcla de tuteo y voseo dentro del mismo widget (incluso en una misma frase: "¿Querés aprender IA en serio? Pregúntanos"). El voseo paisa es un activo; la inconsistencia no. | `main.js:68, 179` |
| Medio | `software.html` de 39 KB = seis páginas en una URL; sin `/chat-ia`, `/crm` ni `/desarrollo` para posicionar o mandar pauta. | `software.html` |

### Diseño (5/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Alto | Switcher roto en móvil (ver P9); en `/software` y `/educacion` quedan 3 puntos anónimos y el `.btn-nav` en `display:none`. | `main.css:140, 956, 981` |
| Alto | `--dimmer` usado como color de texto en 22 reglas: 1.45:1 en oscuro y ~2.6:1 en claro. Afecta "lo que NO incluye", el equivalente USD y la letra chica. **Corregido:** "invisible" es exagerado — se lee, muy apagado; sigue siendo incumplimiento AA objetivo. | `main.css:4, 21, 357, 366-369, 833` |
| Alto | El H1 nace con `opacity:0` y depende de un IntersectionObserver dentro de `main.js` (99,5 KB, `defer`). 75 elementos dependen de `.fu` y no hay `<noscript>`: sin JS la página queda en blanco. | `main.css:289-290`, `main.js:377-381` |
| Medio | `gracias.html` usa otra tipografía (Inter, caja baja) y `main.css?v=1.1.7`, con acento verde fijo aunque el lead venga de Software. **Refutado en 404.html:** carga las mismas fuentes; solo deriva en tokens. | `gracias.html:12-22` |
| Medio | `bundles.html` fuera de la reorganización: nav propio, sin `site-shell.js`, 5.472 caracteres de JS inline. **Refutado:** sí tiene 4 enlaces de salida en el pie; y la lógica de TRM es código muerto (`.bundle[data-usd-m]` matchea 0) — los precios están hardcodeados. | `bundles.html:51-57, 199-201, 238` |
| Medio | ~16 KB de `main.css` muertos (testimonios, tabla comparativa, stack builder, pestañas, calculadora) con su JS huérfano ejecutándose. | `main.css` (57 reglas), `main.js:736-910` |
| Medio | Sin escala tipográfica ni de espaciado tokenizada: 3 tamaños de H1 para el mismo nivel y 76 atributos `style=""` inline. | `main.css:156, 972`; `bundles.html:31` |
| Medio | Reglas duplicadas que se anulan: `prefers-reduced-motion` dos veces con valores distintos; `transition` de `.wdeco` y `.wolf-face` redeclarada (se pierde el glow); acentos definidos en 5-6 sitios. | `main.css:67-72, 924-928, 296/322, 304/323` |
| Medio | CTA "Ver precios completos" → `#precios` inexistente. | `index.html:372` |
| Bajo | Modo claro apaga la identidad: lobos al 40-55% sin `mix-blend-mode`, neones convertidos en bronce/petróleo/oliva. | `main.css:32-37, 298, 306, 987-989` |

### Seguridad API (5/10) y Multi-tenancy (5/10)
Consolidado en la sección 5.2. Resumen de severidades finales:

| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | API/CRM inexistente en producción (NXDOMAIN + 504). | — |
| Crítico | IDOR en deals + joins sin filtro de org. | `deals.ts:~150, ~203, 82-84`; `ai/routes.ts:91-93`; `generators.ts:79-80,123` |
| Crítico | `ENCRYPTION_KEY` opcional con fallback público. | `config/env.ts:41`, `lib/crypto.ts:10` |
| Alto | Demo agrupado por `sha256(ip\|ua)` → visitantes distintos en la misma org con rol admin. | `demo/routes.ts:64, 67-82, 130-139` |
| Alto | `POST /api/chat` sin cuota ni rate limit, con la key global del dueño. | `chat/routes.ts:93`, `key-resolver.ts:27-29` |
| Alto | Rate limiting basado en cabeceras falsificables, en memoria; alimenta también el `ipHash` del consentimiento. | `middleware/rate-limit.ts:14-21`, `demo/routes.ts:36-43, 63` |
| Medio | `/api/demo/erase` sin auth ni rate limit; mensajes distintos por rama = oráculo de enumeración. **Corregido:** soft-delete, solo alcanza demos con email declarado, no toca orgs de clientes. | `demo/routes.ts:176-190` |
| Medio | Cookie `Secure=false` por defecto, TTL 30 días con rolling refresh sin tope. **Corregido:** `DEPLOY.md:122` lo pone en true en prod; hay `HttpOnly`+`SameSite=Lax`; `invalidateAllUserSessions()` sí existe. | `config/env.ts:25-26`, `lib/sessions.ts:80-84` |
| Medio | CSP del Express sustituida por Hostinger; además ambas llevan `'unsafe-inline'`. | `server/index.js:54, 64-75` |
| Medio | Access key de Web3Forms sin allowed-domains: el único buzón de leads es spameable, y va al correo personal. | `main.js:483`, `site-shell.js:109`, `educacion.html:327`, `bundles.html:349` |
| Medio | Org activa = "la primera por fecha"; la sesión no guarda `orgId`. Bloquea el caso agencia y la auditoría de pertenencia. | `middleware/org-context.ts:31-42`, `lib/sessions.ts:28-34` |
| Medio | Superadmin como booleano sin auditoría, sin 2FA, auto-promocionable, con acceso a las keys de todas las orgs. | `middleware/auth.ts:45-54`, `admin/routes.ts:15, 89-120, 137-143` |
| Medio | Registro sin verificación de email: tenant válido en 20 s. Es el habilitador del IDOR y del abuso de cuota. | `auth/routes.ts:47-107` |
| Medio | `add_note`, `create_entity_link` y `tasks.assignedTo` escriben sin `assertEntityOwnership`. | `chat/tools.ts:877-887, 1021-1041`; `tasks.ts:110, 150` |
| Bajo | Contraseñas de 8 caracteres ("password1" pasa), sin verify-email ni password-reset, y el registro enumera usuarios con 409 `EMAIL_TAKEN`. | `auth/schemas.ts:5-10`, `auth/routes.ts:51-55` |

### Código backend (3/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | Backend inexistente en producción; 7 CTA + 4 Offers apuntando ahí. Bonus: `index.html:143` describe el plan Básico como "Falsa IA + CRM completo" **dentro del JSON-LD público**. | — |
| Crítico | `/api/chat` sin rate limit ni cuota, con la key del dueño; hasta 12 iteraciones por mensaje en tier max. | `chat/routes.ts:93`, `key-resolver.ts` |
| Crítico | Bug que envenena la conversación tras cualquier tool-call. `content` es `jsonb`, así que no hay serialización que salve el caso. Sin `catch` en el archivo. Y el historial carga los 40 mensajes más viejos. | `chat/routes.ts:129-146, 167-172, 191-197, 133` |
| Alto | Cero foreign keys en 435 líneas de migración y 709 de schema (`.references(` → 0). Riesgo dominante: corrupción de integridad, no fuga (los UUID binarios no se adivinan). | `db/migrations/0000_init_postgres.sql`, `db/schema.ts` |
| Alto | `'ER_DUP_ENTRY'` (MySQL) atrapado sobre Postgres (`23505`) en 4 sitios. Repro concreto: `#hashtag` repetido → nota guardada + 500 al usuario + notas duplicadas al reintentar. Mismo bug con `[[wikilink]]` repetido. | `note-parser.ts:76,110`; `engine/actions.ts:92`; `chat/tools.ts:1038` |
| Alto | Solo 2 `db.transaction` en todo el backend; `logActivity` fuera de transacción y `dispatchActivity` escribiendo (scoring, automatizaciones) con errores tragados en un `console.warn`. | `crm/helpers.ts:20-40`, `engine/trigger.ts:60, 113-119` |
| Alto | 228 líneas de tests (solo del bot demo) sobre 7.818 de backend, y ni siquiera hay script `npm test`. | `apps/api/package.json` |
| Medio | `ENCRYPTION_KEY` opcional; y el `catch` vacío de `key-resolver.ts:22` degrada un descifrado fallido a la key global en silencio. | `config/env.ts:47-50`, `lib/crypto.ts:10` |
| Medio | `chat/tools.ts` (1.325 líneas, 45 handlers) reimplementa el CRM en paralelo a las rutas REST y ya divergió: la IA tiene MENOS validaciones que la UI. 82 usos de `any`. | `chat/tools.ts` |

### Código frontend (4/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | Cal.com 404 (cuenta inexistente). El fallback del `catch` reabre la misma URL. | `main.js:929-953, 1106` |
| Alto | Analítica sin configurar. **Corregido:** las llamadas de `gracias.html` están guardadas por `typeof`, así que no rompen nada — simplemente no registran. | `main.js:1342-1343` |
| Alto | El formulario de `/software` y `/educacion` no valida: submit vacío retorna en silencio, email inválido se envía igual. `novalidate` desactiva también la validación nativa; 0 `aria-invalid` en el JS servido. | `site-shell.js:104-120` |
| Alto | 4 CTA de upgrade → `/#planes`, ancla que no existe en ninguna página, incluido el banner de demo expirada. | `shell.js:145,147`; `dashboard.html:47`; `settings.html:49` |
| Alto | TRM en vivo que hace saltar el precio −16%. **Corregido:** un fallo del CDN NO cambia el precio; es el fetch exitoso el que rompe la coherencia. Lógica triplicada en 3 archivos. | `software.html:167, 161`; `site-shell.js`; `bundles.html` |
| Medio | `dashboard.html` es la única página autenticada sin `shell.js`, con nav a mano que dice "Chat IA próximamente" cuando `/app/crm-chat.html` existe. Tampoco muestra el banner de demo. **Corregido:** sí enlaza a `/app/crm.html`, así que el CRM está a un clic. | `dashboard.html:26-33` |
| Medio | El diccionario `data-k` pisa el HTML en 8 textos. **Corregido:** ninguna clave `r.*`/`w.*` del modelo viejo se usa en HTML publicado, así que hoy no hay sobrescritura dañina; la única viva es cosmética. Es deuda latente. | `main.js:369` |
| Medio | `waUrl()` etiqueta mal los leads: desde "Inicio" el mensaje dice "me interesa L-IA CRM". El formulario, en cambio, manda "Inicio". | `main.js:914-921` |
| Medio | ~60 KB de `main.js` muertos (planes, TRM, service builder, ROI, FAQ: 0 elementos en el DOM). Servido con `?v=1.3.1` mientras el CSS va en 1.3.6, bajo cache `immutable` de 1 año. | `main.js`, `index.html:647` |
| Medio | Las pastillas de la home son `<button>` sin `aria-label`, con `.ci-name` en `display:none` en móvil; en las subpáginas son `<a href>`. Mismo control, dos comportamientos. | `index.html:262-273`, `site-shell.js:24-27` |

### Pricing (4/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | 12 `[PRECIO]` en `/educacion` + 1 en `/software`. Único hallazgo del área sin atenuantes. | `educacion.html`, `software.html:402` |
| Alto | TRM 3.800 cableada vs 3.205 real: tarjeta a ~641.000, ROI restando 760.000, setup de 5.700.000, todo en la misma pantalla. **Matiz:** si la TRM baja, el cliente en USD paga *menos* en COP. | `main.js:511`; `software.html:174,191,235,468` |
| Alto | Chat Pro a 760.000 vs 299.000 según la página; calculadora de bundles con el CRM 2,7× más caro que su propia página de producto. | `software.html:184`, `bundles.html:85, 135` |
| Alto | Ningún precio se puede pagar: `PAYMENT_LINKS` con 7 claves vacías, y **`grep data-pay` sobre los HTML → 0 coincidencias**: la rama de pago es código muerto inalcanzable. Sin cobro ni recurrencia en el backend. | `main.js:587-608` |
| Alto | "Falsa IA" como nombre visible del tier de entrada, **y dentro del JSON-LD de la home** (`index.html:143`, description del Offer de 69.000): dato estructurado indexable por Google. | `software.html:245`, `index.html:143` |
| Medio | Tabla comparativa con la fila de Kommo en el tier equivocado (USD 25 = Advanced; el de entrada es USD 15, más barato que el Básico). Las otras filas son defendibles; toda la tabla sobreestima ~18% por la TRM. | `software.html:229-235` |
| Medio | Ambigüedad en el tier Max: imposible saber si los 599.000 son por usuario o por cuenta. *(El cálculo de "10 usuarios = 5.990.000" del reporte original es extrapolación, no dato del sitio.)* | `software.html:286-287, 241` |
| Medio | Bundles que venden productos inexistentes y "(futuro)" dentro de un precio cobrable hoy; dos reglas de descuento incompatibles en la misma página. | `bundles.html:99,115,117,131,161` |
| Medio | Sin escalón de entrada: el primer "sí" son 1.800.000. El add-on de 650.000 está enterrado en una tabla. | `software.html:329, 378-384` |

### Educación (4/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | 12 `[PRECIO]` publicados; sin ningún link de pago para educación en todo el repo. | `educacion.html` |
| Alto | Mini-curso que promete "la primera lección llega en minutos" sin ESP, sin autoresponder y sin una sola lección escrita. *(No se pudo verificar el panel de Web3Forms, que permite autoresponder fuera del repo; pero no hay contenido que enviar.)* | `educacion.html:337, 318-345` |
| Alto | Cohorte de 12 sesiones en vivo + revisión de proyectos = 100-150 h en 6 semanas, para un founder solo con clientes en paralelo. El mercado ya lo vende en 6 h (Coding Latam, cohorte 3, 176+ devs). | `educacion.html:107-141` |
| Alto | "Inscripciones abiertas" vs "Fecha: por anunciar" en la misma pantalla, con CTA "Reservar mi cupo". | `educacion.html:104, 109, 145` |
| Alto | Promesas contractuales sin infraestructura: acceso "de por vida", actualización mensual de 6 cursos, certificado, reembolsos, factura DIAN — con NIT ficticio publicado. | `educacion.html:112-114, 213, 280-283` |
| Medio | El curso insignia apunta al segmento con más oferta gratuita, y `educacion.html:218` afirma algo falso y verificable ("lo que Udemy no enseña y las plataformas grandes aún no tienen": Udemy y EDteam tienen cursos de Claude Code). *(La recomendación de cambiar de producto es opinión, no evidencia.)* | `educacion.html:216-221` |
| Medio | Cero medición para decidir qué curso producir primero; los votos de lista de espera no se registran. | `main.js:1342-1343` |
| Medio | El argumento frente a Talento Tech (gratis, 14.480 cupos en Antioquia) está en la FAQ #8, al fondo de 348 líneas. | `educacion.html:285` |

### Legal (3/10)
Consolidado en la sección 5.1. Adiciones no cubiertas ahí:

| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Medio | Banner de cookies con texto de consentimiento implícito ("Al continuar aceptás") pese a tener botón Rechazar; sin categorías, sin revocación desde la interfaz (la política pide "limpiar el almacenamiento local"), sin prueba. El gating técnico sí está bien hecho. | `main.js:73, 1314, 1321, 1368`; `legal/privacidad.html:86` |
| — | La política declara Clarity, GA4 y Plausible cuando dos de tres no corren: sobre-declaración, que expone menos que lo contrario. | `legal/privacidad.html:66, 95` |
| — | Precios sin leyenda de impuestos en las 4 páginas, y `terminos.html:71` los declara "orientativos". *(Si la empresa no es responsable de IVA, no hay 19% que informar: verificar con el contador antes de escribir la leyenda.)* | `legal/terminos.html:71` |

### Analítica (1/10)
Consolidado en P3. Detalle adicional:

| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Alto | Cero eventos de interacción: en 1.501 líneas de `main.js`, las únicas apariciones de gtag/clarity/plausible están dentro de `loadAnalytics()`. Ni WhatsApp, ni Cal, ni modal, ni quiz, ni scroll a precios. | `main.js` |
| Alto | Ningún formulario captura UTM, referrer ni landing inicial. *(Web3Forms adjunta IP y Referer del servidor, así que se puede inferir la página de envío, pero no la campaña.)* | `main.js:481-486`, `site-shell.js:109-112` |
| Medio | Analítica tras opt-in duro: incluso Plausible (cookieless, sin datos personales) está detrás del mismo gate. Con tasas típicas de aceptación (30-60%), ninguna cifra sería interpretable. | `main.js:1311-1332, 1368` |
| Medio | Sin evidencia de Search Console verificado (no hay meta `google-site-verification` ni TXT). *(No se puede descartar verificación por archivo HTML.)* | — |
| Bajo | Deriva de versiones: `main.js?v=1.3.1`, `main.css?v=1.3.6`, `gracias.html` en `v1.1.7`. | `index.html:162, 647`; `gracias.html:13` |

### Adquisición (2/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | Cero medición en ninguna página pública. | `main.js:1342-1343` |
| Alto | Cero contenido indexable: 8 HTML, sin blog. La competencia rankea con guías de precios ("Chatbot WhatsApp Colombia: precios reales 2026"). | `apps/web/public/` |
| Alto | Lead magnet que promete lo que no envía. | `educacion.html:337` |
| Alto | Dos enlaces externos en todo el sitio, ambos al mismo LinkedIn personal. Buscar la marca no devuelve un solo resultado sobre la empresa. | `index.html:194, 484` |
| Alto | Cero prueba de cliente + precio de entrada alto. **Matiz:** el "4×" compara SaaS autoservicio contra implementación con API oficial de Meta + RAG; la fricción decisiva es el setup desde USD 800 sin un caso que lo justifique. | `index.html:459-467`, `llms.txt:22` |
| Medio | `llms.txt` impecable pero sin menciones externas: los LLM ponderan lo que dicen terceros, no lo que la entidad dice de sí misma. | `llms.txt`, `robots.txt` |
| Medio | Sin Google Business Profile pese a declarar `LocalBusiness` con geo de Medellín. | `index.html:47, 70-71` |
| Medio | librosmedellin.com no enlaza a trescerbero (0 coincidencias en la home); el flujo es unidireccional hacia el lado equivocado. *(Solo se verificó la home.)* | — |

### Infra (3/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | DNS de `app` y `api` inexistentes. Quitados los 6 enlaces muertos, el único CTA funcional que queda en `/software` es un `wa.me`. | zona DNS |
| Alto | `apps/api/dist/` no existe; una sola app Passenger apuntando al web; `~/repos` inexistente; `.env` local sin `DATABASE_URL` → `exit 1`. | servidor, `config/env.ts:22, 46-50` |
| Medio | Cero backups de trescerbero (4 cron jobs, todos de otros proyectos). **Corregido:** no hay datos que perder aún, `ENCRYPTION_KEY` de producción ni siquiera se ha generado (`DEPLOY.md:29`), y el plan Business trae backups. Deuda a resolver antes del primer cliente. | — |
| Medio | Servidor en `2d43bb3` con 12 archivos divergidos, sin CI. **Corregido:** los md5 de los 5 archivos clave coinciden con el repo local en `fea1794`, así que sí se sabe qué corre y el rollback existe. | servidor |
| Medio | 4 documentos describen MySQL mientras el código usa Postgres/Supabase — y `.claude/memory/feedback_no_supabase.md` registra Supabase como decisión cerrada **en contra**. Hay que decidir, no solo documentar. | `DEPLOY.md:12,114,239`; `.env.example:9-15`; `CLAUDE.md:39` |
| Medio | Sin monitoreo ni logs (`console.log` solo tiene arranques de Passenger; `stderr.log` de 0 bytes). Passenger autocura caídas del proceso; lo peligroso es lo silencioso. | `server/index.js` |
| Medio | Cache-busting manual con `immutable` de 1 año, replicado en 12+ archivos del dashboard. Este patrón ya causó un incidente de días en librosmedellin. | todos los HTML |
| Medio | CSP del Express sustituida por el hosting. | `server/index.js:64-75` |
| Bajo | Cuenta compartida con librosmedellin (551 MB de BD, wp-cron cada 5 min, volumen al 62%); `www` sin 301. | servidor |

### Consistencia (3/10) y Demo CRM (3/10)
| Sev. | Hallazgo | Ruta |
|------|----------|------|
| Crítico | `bundles.html` vivo, enlazado y en el sitemap con el modelo viejo y precios contradictorios. Ver P7. | `bundles.html` |
| Crítico | Demo inalcanzable. **Hallazgo clave:** `/app/crm/demo.html`, `/app/login.html` y `/app/dashboard.html` devuelven 200 en el dominio principal — el fix es un buscar-y-reemplazar. Pero `/crm/demo` da 404: esa ruta corta hay que crearla. | `software.html`, `app/assets/app.js:6-9` |
| Alto | Demo completable sin dejar email (ambos campos "(opcional)"); el único `required` es el consentimiento. El endpoint `/erase` busca por `contactEmail`, así que un demo anónimo no puede ejercer supresión. | `crm/demo.html:90-94`, `demo/routes.ts:32-33, 91` |
| Alto | `dashboard.html` muestra jerga interna al cliente: "Pendiente — Turn 2", "Fase 2/3/4", y marca como "próximamente" funciones que existen. Verificado en producción. | `app/dashboard.html:30-32, 57, 71-73` |
| Alto | Quiz con precios de Chat desalineados (−37,5% y −25%) y "Falsa IA" en el JS servido; `chat.high`/`crm.high` recomiendan el bundle del modelo viejo. | `main.js:1061-1067, 1063, 1070` |
| Alto | Legales con NIT ficticio y aviso de plantilla; cláusula de servicios sin mención de Educación. | `legal/*.html:46, 50, 54, 65` |
| Medio | Cuota demo real de 30 acciones/mes y export Markdown bloqueado (402), contra la promesa "el Demo es Pro completo" y "exportás en MD/CSV cuando quieras". | `ai/quota.ts:13`, `ai/routes.ts:32-37` vs `software.html:240`, `crm/demo.html:72` |
| Medio | Primeros 30 s del demo: KPIs en 0 y "Sin actividad todavía. Creá tu primer contacto" pese a tener 4 contactos sembrados. El seed no escribe en `activities` ni `tasks`. Cero onboarding (`grep onboarding|tour|coachmark` → 0). | `demo/seed.ts`, `app/assets/crm.js:36` |
| Medio | Demo irrecuperable: contraseña aleatoria que nadie conoce, sin recuperación de contraseña en todo el backend, y la página invita a "Iniciar sesión". | `demo/routes.ts:92`, `auth/routes.ts` |
| Medio | "Reservá 30 min" agenda en la home y abre un formulario en las subpáginas: dos caminos bajo la misma etiqueta, y el peor está en las páginas de mayor intención. | `main.js:929-948` vs `site-shell.js:131-132` |
| Medio | Metadatos desincronizados: `lastmod` de todo el sitemap en 2026-07-25; `?v=` divergentes. | `sitemap.xml`, `index.html:647` |
| Medio | "Falsa IA" como nombre de sección del producto en el dashboard. | `app/assets/shell.js:13`, `crm-engine.html:9, 19` |

### Estrategia (2/10)
| Sev. | Hallazgo | Evidencia |
|------|----------|-----------|
| Crítico | Funnel del producto estrella roto (NXDOMAIN). | ver P1 |
| Alto | Sin cobro recurrente ni corte por impago. **Corregido:** cobrar por WhatsApp/transferencia es válido en B2B temprano en Colombia; lo que falta es automatización y escala, no "una forma de cobrar". | `grep` sobre `apps/api/src` |
| Alto | La única propuesta de valor diferencial declarada —el precio— es falsa. Con TRM real de 3.107 COP/USD, COP 69.000 = USD 22,2 contra Kommo Base en USD 15: **~48% más caro**, no "menos de la mitad". Zoho Bigin y Pipedrive Lite también quedan por debajo. | `index.html:366` |
| Alto | Educación sin nada vendible (12 `[PRECIO]`, cohorte sin fecha). | `educacion.html:104, 109, 144` |
| Alto | CTA del lead más calificado → 404 de Cal.com. | `main.js:929-930, 1106, 1125` |
| Alto | Lead magnet que promete una serie de emails sin ningún sistema de correo (ni siquiera para el correo transaccional del CRM, pese a existir las tablas `emailVerifications` y `passwordResets`). | `educacion.html:198`, `grep` sobre `apps` |
| Medio | Dispersión en 5 frentes, 34 commits, 5 semanas sin actividad. **Corregido:** los datos son ciertos pero la conclusión es inferencia, no medición; el sitio está vivo y el working tree limpio. Se trata como observación estratégica, no como defecto verificable. | `git log` |
| Medio | Analítica sin configurar. | `main.js:1342-1343` |

---

## Nota de método: qué no se pudo verificar

Marcado explícitamente para que nadie lo tome por confirmado:

- **Posicionamiento en Google.** No hubo acceso a Google ni a Search Console. "No aparece para X consulta" no está probado; lo probado es la *ausencia de contenido* y de menciones externas.
- **Throttling real de red.** Las cifras de "16 s en 4G" son aritmética sobre bytes medidos, no medición end-to-end.
- **Zoom al 200% y lectores de pantalla reales.** Todos los hallazgos de accesibilidad salen de código verificable y de mediciones en navegador.
- **Región física de la base de datos del CRM.** El valor vive en una variable de entorno del servidor que no se leyó. Lo que sí está probado es que el hosting web no está en Colombia y que `legal/privacidad.html:99` lo admite.
- **Panel de Web3Forms.** Permite configurar un autoresponder fuera del repo; no se pudo inspeccionar y no se envió el formulario para no generar correos reales. Aun así, no hay contenido de lecciones en ninguna parte.
- **Cuenta de Plausible.** Es de pago; no se pudo confirmar si existe una cuenta activa para el dominio, así que "cero datos" es probable pero no demostrado al 100%.
- **`ENCRYPTION_KEY` en producción.** No se pudo comprobar si está seteada en el panel de Hostinger: el API ni siquiera levanta.
- **Constitución de la SAS.** No hay acceso a RUES. Lo probado es que el NIT publicado es un placeholder autoconfeso (`[reemplazar]` en las páginas legales).
- **Estado del repositorio de producción.** Se verificó por md5 que los 5 archivos clave del sitio coinciden con el repo local; no se auditó archivo por archivo.

---

*Informe generado el 29 de agosto de 2026. 20 auditorías especializadas con verificación adversarial. Ninguna afirmación de este documento proviene de una sola fuente sin contraste.*
