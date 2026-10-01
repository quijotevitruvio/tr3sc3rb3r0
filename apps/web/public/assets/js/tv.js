/* ═══════════════════════════════════════════════════════════════
   MODO TV + PRECARGA (estilos en main.css, bloques "MODO TV" y "PRECARGA").
   · Controles fijos arriba a la derecha: animaciones, TV y glitch, tema (sistema/oscuro/claro).
     html.tv-on/tv-off, tv-boot y tv-ch-in los pone el snippet del <head>
     antes de pintar, para que el encendido no parpadee.
   · Modo TV: encendido al entrar, cambio de canal al navegar, pantalla con
     líneas/estática en los héroes y glitch en el título. No toca los lobos.
   · Precarga real (siempre, con o sin TV): lobos, fuentes, CSS/JS y las 3
     páginas con sus imágenes, con barra "hacker" en la intro del home o en
     la esquina superior derecha de las demás páginas.
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var d=document.documentElement;
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function tvOn(){return d.classList.contains('tv-on');}
function store(k,v){try{localStorage.setItem(k,v);}catch(e){}}

/* ── Lobos en AVIF (pre-renderizados, sin filtros SVG en vivo = mucho más fluido).
   Red de seguridad: si el navegador no soporta AVIF (<5 %), vuelve a los SVG originales. ── */
(function(){
  var probe=new Image();
  probe.onerror=function(){
    window.T3_WOLF_EXT='svg';
    [].forEach.call(document.querySelectorAll('img[src*="/heads/"][src$=".avif"]'),function(i){i.src=i.src.replace(/\.avif$/,'.svg');});
  };
  probe.src='data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
})();

/* ── Salidas del encendido / cambio de canal (el CSS ya se está mostrando) ── */
if(d.classList.contains('tv-boot'))setTimeout(function(){d.classList.remove('tv-boot');},1100);
if(d.classList.contains('tv-ch-in'))setTimeout(function(){d.classList.remove('tv-ch-in');},400);

function setTV(on){
  d.classList.toggle('tv-on',on);d.classList.toggle('tv-off',!on);
  store('t3-tv',on?'on':'off');
  if(on)glitchNow();
  paintSwitches();
}

/* Pantalla TV ambiente en los héroes: quitada (ruido animado permanente, sin propósito). */

/* ── Glitch del título principal: una sola vez al entrar (antes se repetía cada 9–16 s) ── */
function heroTitle(){return document.querySelector('.ss-hero h1')||document.querySelector('.head.s-active .hh h1');}
function glitchNow(){
  if(reduce||!tvOn())return;
  var t=heroTitle();if(!t)return;
  t.classList.remove('tv-glitch');void t.offsetWidth;t.classList.add('tv-glitch');
  setTimeout(function(){t.classList.remove('tv-glitch');},450);
}
if(!reduce){
  setTimeout(glitchNow,900);
}

/* Cambio de canal al navegar: quitado. Retrasaba cada clic 240 ms y anulaba la precarga;
   la transición entre páginas ahora es el fundido nativo (View Transitions). */

var intro=document.getElementById('intro');

/* ═══════════════ CONTROLES SIEMPRE VISIBLES (esquina superior derecha) ═══════════════
   Mismo panel en todas las páginas, también sobre la intro de los lobos:
   ANIMACIONES on/off · TV y glitch on/off · TEMA sistema/oscuro/claro (por defecto: sistema).
   Guarda t3-anim, t3-tv, t3-theme ('system'|'dark'|'light'). */
var mqLight=window.matchMedia&&matchMedia('(prefers-color-scheme: light)');
function themeMode(){var t;try{t=localStorage.getItem('t3-theme');}catch(_){}return (t==='dark'||t==='light')?t:'system';}
function applyTheme(){
  var m=themeMode(),t=m==='system'?(mqLight&&mqLight.matches?'light':'dark'):m;
  if(d.getAttribute('data-theme')!==t){
    d.setAttribute('data-theme',t);
    if(typeof updateUI==='function')updateUI();   // home: recalcula acentos del carrusel con la paleta nueva
  }
}
function setThemeMode(m){store('t3-theme',m);applyTheme();paintSwitches();}
if(mqLight&&mqLight.addEventListener)mqLight.addEventListener('change',function(){if(themeMode()==='system')applyTheme();});
function setAnim(on){d.classList.toggle('anim-off',!on);store('t3-anim',on?'on':'off');paintSwitches();}

var sw=document.createElement('div');
sw.className='t3sw';sw.setAttribute('role','group');sw.setAttribute('aria-label','Cómo ver el sitio');
sw.innerHTML='<button type="button" class="t3sw-gear" aria-expanded="false" aria-label="Cómo ver el sitio: animaciones, TV y tema">⚙</button>'+
  '<span class="t3sw-p" aria-hidden="true">$</span>'+
  '<button type="button" class="t3sw-b" data-k="anim"><span class="t3sw-l">ANIM</span><b></b></button>'+
  '<button type="button" class="t3sw-b" data-k="tv"><span class="t3sw-l">TV·GLITCH</span><b></b></button>'+
  '<button type="button" class="t3sw-b" data-k="theme"><span class="t3sw-l">TEMA</span><b></b></button>'+
  '<div class="t3sw-load"></div>';
document.body.appendChild(sw);
var MODES=['system','dark','light'],MODE_TXT={system:'SIS',dark:'OSC',light:'CLA'},MODE_LONG={system:'sistema',dark:'oscuro',light:'claro'};
function lab(el,t){el.title=t;el.setAttribute('aria-label',t);}
function paintSwitches(){
  if(!sw)return;
  var anim=!d.classList.contains('anim-off'),tv=tvOn(),m=themeMode();
  var bA=sw.querySelector('[data-k="anim"]'),bT=sw.querySelector('[data-k="tv"]'),bM=sw.querySelector('[data-k="theme"]');
  bA.setAttribute('aria-pressed',String(anim));bA.querySelector('b').textContent=anim?'ON':'OFF';
  lab(bA,(anim?'Apagar':'Prender')+' animaciones');
  bT.setAttribute('aria-pressed',String(tv));bT.querySelector('b').textContent=tv?'ON':'OFF';
  lab(bT,(tv?'Apagar':'Prender')+' efecto TV y glitch');
  bM.querySelector('b').textContent=MODE_TXT[m];
  lab(bM,'Tema: '+MODE_LONG[m]+' (tocar para cambiar)');
}
sw.addEventListener('click',function(e){
  // Celular: el panel vive plegado en un ⚙ y se abre al tocarlo
  var g=e.target.closest('.t3sw-gear');
  if(g){var open=!sw.classList.contains('open');sw.classList.toggle('open',open);g.setAttribute('aria-expanded',String(open));return;}
  var b=e.target.closest('.t3sw-b');if(!b)return;
  var k=b.dataset.k;
  if(k==='anim')setAnim(d.classList.contains('anim-off'));
  else if(k==='tv')setTV(!tvOn());
  else setThemeMode(MODES[(MODES.indexOf(themeMode())+1)%3]);
});
paintSwitches();
document.addEventListener('click',function(e){if(!e.target.closest('.t3sw')&&sw.classList.contains('open')){sw.classList.remove('open');sw.querySelector('.t3sw-gear').setAttribute('aria-expanded','false');}});

/* ═══════════════ PRECARGA con barra hacker ═══════════════ */
// Solo los 3 lobos de la intro (los demás del carrusel cargan cuando hacen falta): ~1 MB menos
var HEADS=['Azul derecha','Dorado centro','Jade izquerdo']
  .map(function(n){return '/assets/heads/'+encodeURIComponent(n)+'.'+(window.T3_WOLF_EXT||'avif');});
var PAGES=['/','/inicio'];
var GLYPHS='⟁⌬∆⋈◢◣⌇⎍⏚⌖⍜⍾⎔⏃⏁⌰⟟⟒⟊▓▒░#%&$@<>/\\{}[]01ABCDEF';
var tasks=[],done=0,label='iniciando';
var ui=null;

function scramble(n){var s='';for(var i=0;i<n;i++)s+=GLYPHS[Math.floor(Math.random()*GLYPHS.length)];return s;}
function hex(){return '0x'+Math.floor(Math.random()*65535).toString(16).toUpperCase().padStart(4,'0');}

function buildUI(){
  var inIntro=intro&&intro.style.display!=='none'&&!intro.classList.contains('intro-out');
  var box=document.createElement('div');
  box.className='pl '+(inIntro?'pl-intro':'pl-corner');
  box.setAttribute('role','progressbar');box.setAttribute('aria-label','Cargando el sitio');
  box.setAttribute('aria-valuemin','0');box.setAttribute('aria-valuemax','100');
  box.innerHTML='<div class="pl-top"><span class="pl-bar"><span class="pl-fill"></span></span><span class="pl-pct">0%</span></div><div class="pl-line"><span class="pl-g1"></span> <span class="pl-lbl"></span> <span class="pl-g2"></span></div>';
  if(inIntro){
    var brand=intro.querySelector('.intro-brand');
    (brand||intro).insertAdjacentElement(brand?'afterend':'beforeend',box);
    intro.classList.add('intro-loading');   // pestañas atenuadas hasta el 100 % (Saltar siempre activo)
  }else{
    box.className='pl pl-inbox';sw.querySelector('.t3sw-load').appendChild(box);   // misma terminal: controles + carga juntos
  }
  return {box:box,fill:box.querySelector('.pl-fill'),pct:box.querySelector('.pl-pct'),g1:box.querySelector('.pl-g1'),g2:box.querySelector('.pl-g2'),lbl:box.querySelector('.pl-lbl'),intro:inIntro};
}

function render(){
  if(!ui)return;
  var p=tasks.length?Math.round(done/tasks.length*100):0;
  ui.fill.style.transform='scaleX('+(p/100)+')';
  ui.pct.textContent=p+'%';
  ui.box.setAttribute('aria-valuenow',String(p));
  ui.lbl.textContent=p>=100?'sistema listo':'cargando '+label+'…';
}

function track(kind,promise){
  tasks.push(kind);
  return Promise.resolve(promise).catch(function(){}).then(function(){done++;label=kind;render();});
}
function img(src){return new Promise(function(res){var i=new Image();i.decoding='async';i.onload=i.onerror=function(){(i.decode?i.decode().catch(function(){}):Promise.resolve()).then(res);};i.src=src;});}
function get(url){return fetch(url,{credentials:'same-origin'}).then(function(r){return r.ok?r.text():'';});}

function run(){
  ui=buildUI();
  var tick=null;
  if(!reduce){tick=setInterval(function(){ui.g1.textContent=scramble(4)+' '+hex();ui.g2.textContent=scramble(3);},70);}
  else{ui.g1.textContent='⟁⌬∆ 0x3F';ui.g2.textContent='◢◣';}

  var jobs=[];
  // Precarga completa UNA vez por visita: en las páginas siguientes todo ya está en caché y
  // repetir ~20 descargas por página puede activar la protección anti-bots de la CDN (pantalla lenta).
  var full=true;try{full=!sessionStorage.getItem('t3-pl');sessionStorage.setItem('t3-pl','1');}catch(_){}  // se marca al empezar: lo pedido ya queda en caché aunque cambie de página
  // 1 · lobos (las 9 cabezas) + imágenes de esta página
  var seen={};
  (full?HEADS:[]).concat([].slice.call(document.images).map(function(i){return i.currentSrc||i.src;}))
    .forEach(function(u){if(u&&!seen[u]){seen[u]=1;jobs.push(track('lobos',img(u)));}});
  // 2 · fuentes
  if(document.fonts&&document.fonts.ready)jobs.push(track('fuentes',document.fonts.ready));
  // 3 · animaciones: CSS y JS del sitio (ya en caché por 1 año → casi instantáneo)
  (full?[].slice.call(document.querySelectorAll('link[rel="stylesheet"][href^="/"],link[rel="stylesheet"][href^="assets"],script[src]')):[])
    .map(function(n){return n.href||n.src;}).filter(function(u){return u.indexOf(location.origin)===0;})
    .forEach(function(u){jobs.push(track('animaciones',fetch(u)));});
  // 4 · las otras páginas y sus imágenes (así navegar es instantáneo)
  (full?PAGES:[]).filter(function(p){return p!==location.pathname;}).forEach(function(p){
    jobs.push(track('páginas',get(p).then(function(html){
      var srcs=(html.match(/<img[^>]+src="([^"]+)"/g)||[]).map(function(t){return t.match(/src="([^"]+)"/)[1];});
      return Promise.all(srcs.filter(function(s){return !seen[s];}).map(function(s){seen[s]=1;return img(s);}));
    })));
  });
  render();

  var finished=false;
  function finish(){
    if(finished)return;finished=true;
    done=tasks.length;label='';render();
    if(tick)clearInterval(tick);
    ui.g1.textContent='⟁ ACCESO';ui.g2.textContent='✓';
    ui.box.classList.add('pl-done');
    if(ui.intro)intro.classList.remove('intro-loading');
    setTimeout(function(){ui.box.classList.add('pl-out');},ui.intro?1400:900);
    setTimeout(function(){ui.box.remove();},ui.intro?2100:1600);
  }
  Promise.all(jobs).then(finish);
  // Tope: la intro nunca espera más de 4 s; lo que falte sigue cargando por detrás
  setTimeout(function(){if(ui.intro)intro.classList.remove('intro-loading');},4000);
  setTimeout(finish,9000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
