/* ═══════════════════════════════════════════════════════════════════════
   ANALÍTICA + CONSENTIMIENTO — módulo compartido por TODAS las páginas
   públicas. Antes esto vivía dentro de main.js, que solo carga index.html:
   /software, /educacion y /gracias no medían absolutamente nada.

   ▸ PARA ACTIVARLO hay que pegar dos identificadores acá abajo. Mientras
     digan 'PENDIENTE' el módulo no carga nada de terceros: no rompe, pero
     tampoco mide. Es el único paso manual que queda.

       GA4_ID      → analytics.google.com → Administrar → Flujos de datos
                     → "ID de medición" (formato G-XXXXXXXXXX)
       CLARITY_ID  → clarity.microsoft.com → nuevo proyecto → "Project ID"
                     (grabaciones de sesión y mapas de calor, gratis)

   ▸ Los eventos se encolan aunque no haya IDs, así que el día que se
     peguen empiezan a reportar sin tocar nada más.
═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var GA4_ID = 'PENDIENTE';
  var CLARITY_ID = 'PENDIENTE';
  var PLAUSIBLE_DOMAIN = 'trescerbero.com'; // sin cookies: no requiere consentimiento

  var CONSENT_KEY = 'tr3s_cookies';
  var cargado = false;
  var cola = [];

  function configurado(v) { return v && v !== 'PENDIENTE'; }
  function consintio() { try { return localStorage.getItem(CONSENT_KEY) === 'accept'; } catch (e) { return false; } }

  /* ── Carga de proveedores ───────────────────────────────────────── */
  function cargarPlausible() {
    if (!PLAUSIBLE_DOMAIN) return;
    var s = document.createElement('script');
    s.defer = true; s.dataset.domain = PLAUSIBLE_DOMAIN;
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }

  function cargarConConsentimiento() {
    if (cargado) return;
    cargado = true;
    if (configurado(CLARITY_ID)) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY_ID);
    }
    if (configurado(GA4_ID)) {
      var s = document.createElement('script');
      s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID, { anonymize_ip: true });
    }
    vaciarCola();
  }

  /* ── Emisión de eventos ─────────────────────────────────────────── */
  function emitir(nombre, props) {
    if (window.plausible) { try { window.plausible(nombre, { props: props || {} }); } catch (e) {} }
    if (window.gtag) { try { window.gtag('event', nombre, props || {}); } catch (e) {} }
    if (window.clarity) { try { window.clarity('event', nombre); } catch (e) {} }
  }
  function vaciarCola() {
    while (cola.length) { var e = cola.shift(); emitir(e[0], e[1]); }
  }
  function track(nombre, props) {
    if (window.plausible || window.gtag || window.clarity) { vaciarCola(); emitir(nombre, props); }
    else { cola.push([nombre, props]); if (cola.length > 50) cola.shift(); }
  }
  window.tr3sTrack = track;

  /* ── Banner de consentimiento (se inyecta donde no exista) ──────── */
  function banner() {
    var b = document.getElementById('cookieBanner');
    if (!b) {
      b = document.createElement('div');
      b.className = 'cookie-banner';
      b.id = 'cookieBanner';
      b.hidden = true;
      b.innerHTML =
        '<div class="cookie-inner">' +
        '<p class="cookie-text"><strong>🍪 Cookies y datos.</strong> Usamos cookies para analítica y experiencia. ' +
        'Al continuar acepta nuestra <a href="/legal/privacidad.html">política de privacidad</a> y el tratamiento ' +
        'de datos según la Ley 1581/2012 (Colombia).</p>' +
        '<div class="cookie-actions">' +
        '<button class="cookie-rej" id="cookieRej">Rechazar</button>' +
        '<button class="cookie-acc" id="cookieAcc">Aceptar</button>' +
        '</div></div>';
      document.body.appendChild(b);
    }
    var decidido = null;
    try { decidido = localStorage.getItem(CONSENT_KEY); } catch (e) {}
    if (!decidido) setTimeout(function () { b.hidden = false; }, 1500);
    var acc = document.getElementById('cookieAcc'), rej = document.getElementById('cookieRej');
    if (acc) acc.addEventListener('click', function () {
      try { localStorage.setItem(CONSENT_KEY, 'accept'); } catch (e) {}
      b.hidden = true; cargarConConsentimiento(); track('consentimiento', { valor: 'acepta' });
    });
    if (rej) rej.addEventListener('click', function () {
      try { localStorage.setItem(CONSENT_KEY, 'reject'); } catch (e) {}
      b.hidden = true;
    });
  }

  /* ── Instrumentación automática de lo que importa medir ─────────── */
  function espacio() {
    var p = location.pathname;
    if (p.indexOf('software') > -1) return 'software';
    if (p.indexOf('educacion') > -1) return 'educacion';
    if (p.indexOf('bundles') > -1) return 'bundles';
    if (p.indexOf('gracias') > -1) return 'gracias';
    return 'inicio';
  }

  function instrumentar() {
    var esp = espacio();
    track('pagina_vista', { espacio: esp });

    document.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a,button') : null;
      if (!a) return;
      var href = a.getAttribute && a.getAttribute('href');
      var texto = (a.textContent || '').trim().slice(0, 60);

      if (href && href.indexOf('wa.me') > -1) { track('clic_whatsapp', { espacio: esp, origen: a.className || '' }); return; }
      if (a.classList && a.classList.contains('plan-cta')) {
        var card = a.closest('[data-plan-name],.plan,.bundle');
        track('clic_plan', { espacio: esp, plan: (card && (card.getAttribute('data-plan-name') || (card.querySelector('.plan-name') || {}).textContent)) || texto });
        return;
      }
      if (a.hasAttribute && a.hasAttribute('data-modal')) { track('abre_contacto', { espacio: esp, contexto: a.getAttribute('data-modal') }); return; }
      if (a.classList && (a.classList.contains('bp') || a.classList.contains('bg'))) { track('clic_cta', { espacio: esp, texto: texto }); return; }
      if (a.classList && a.classList.contains('ci')) { track('cambia_espacio', { desde: esp, hacia: texto }); return; }
      if (a.classList && a.classList.contains('door')) { track('clic_puerta', { destino: href || texto }); return; }
    }, true);

    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      var tipo = f.id === 'freeForm' ? 'curso_gratis' : (f.id === 'moForm' ? 'contacto' : (f.id || 'formulario'));
      track('envia_formulario', { espacio: esp, tipo: tipo });
    }, true);

    // Profundidad de lectura: ¿llegan a los precios?
    var visto = {};
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = e.target.id;
          if (id && !visto[id]) { visto[id] = 1; track('ve_seccion', { espacio: esp, seccion: id }); }
        });
      }, { threshold: 0.4 });
      ['precios', 'crm', 'chat', 'digital', 'cohorte', 'clases', 'empresas', 'cursos'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
  }

  /* ── Origen del tráfico: se guarda en la sesión y viaja con el lead ── */
  function guardarOrigen() {
    try {
      if (sessionStorage.getItem('tr3s_origen')) return;
      var q = new URLSearchParams(location.search);
      var datos = {
        utm_source: q.get('utm_source') || '', utm_medium: q.get('utm_medium') || '',
        utm_campaign: q.get('utm_campaign') || '', gclid: q.get('gclid') || '',
        referrer: document.referrer || '', entrada: location.pathname
      };
      sessionStorage.setItem('tr3s_origen', JSON.stringify(datos));
    } catch (e) {}
  }
  window.tr3sOrigen = function () {
    try { return sessionStorage.getItem('tr3s_origen') || ''; } catch (e) { return ''; }
  };

  /* ── Arranque ───────────────────────────────────────────────────── */
  function init() {
    guardarOrigen();
    cargarPlausible();               // sin cookies → no necesita consentimiento
    if (consintio()) cargarConConsentimiento();
    banner();
    instrumentar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
