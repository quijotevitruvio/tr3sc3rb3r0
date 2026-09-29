/* ═══════════════════════════════════════════════════════════════
   MODO TV + PRECARGA (estilos en main.css, bloques "MODO TV" y "PRECARGA").
   · Botón 📺 junto al de tema: prende/apaga el modo TV (localStorage t3-tv).
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

/* ── Salidas del encendido / cambio de canal (el CSS ya se está mostrando) ── */
if(d.classList.contains('tv-boot'))setTimeout(function(){d.classList.remove('tv-boot');},1100);
if(d.classList.contains('tv-ch-in'))setTimeout(function(){d.classList.remove('tv-ch-in');},400);

/* ── Botón de modo TV, al lado del de tema (home y páginas internas) ── */
var ICON='<svg class="tv-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/><path d="M7 11h.01M7 14h.01M7 17h.01" stroke-width="2.4"/></svg>';
function paintBtn(b){
  var on=tvOn();
  b.setAttribute('aria-pressed',String(on));
  b.title=on?'Apagar modo TV':'Prender modo TV';
  b.setAttribute('aria-label',b.title);
}
var theme=document.getElementById('themeToggle');
var tvBtn=null;
if(theme&&!document.getElementById('tvToggle')){
  tvBtn=document.createElement('button');
  tvBtn.type='button';tvBtn.id='tvToggle';tvBtn.className='theme-btn tv-btn';tvBtn.innerHTML=ICON;
  theme.insertAdjacentElement('afterend',tvBtn);
  paintBtn(tvBtn);
  tvBtn.addEventListener('click',function(){
    var on=!tvOn();
    d.classList.toggle('tv-on',on);d.classList.toggle('tv-off',!on);
    store('t3-tv',on?'on':'off');
    paintBtn(tvBtn);
    if(on)glitchNow();
  });
}

/* ── Pantalla TV ambiente en los héroes ── */
[].slice.call(document.querySelectorAll('.ss-hero, .head')).forEach(function(h){
  if(h.querySelector(':scope > .tv-screen'))return;
  var s=document.createElement('div');s.className='tv-screen';s.setAttribute('aria-hidden','true');
  h.appendChild(s);
});

/* ── Glitch del título principal: al entrar y cada 9–16 s ── */
function heroTitle(){return document.querySelector('.ss-hero h1')||document.querySelector('.head.s-active .hh h1');}
function glitchNow(){
  if(reduce||!tvOn())return;
  var t=heroTitle();if(!t)return;
  t.classList.remove('tv-glitch');void t.offsetWidth;t.classList.add('tv-glitch');
  setTimeout(function(){t.classList.remove('tv-glitch');},450);
}
if(!reduce){
  setTimeout(glitchNow,900);
  (function loop(){setTimeout(function(){if(!document.hidden)glitchNow();loop();},9000+Math.random()*7000);})();
}

/* ── Cambio de canal al ir a otra página del sitio ── */
var ch=document.createElement('div');ch.id='tv-ch';ch.setAttribute('aria-hidden','true');
document.body.appendChild(ch);
document.addEventListener('click',function(e){
  if(e.defaultPrevented||!tvOn()||reduce||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  var a=e.target.closest&&e.target.closest('a[href]');
  if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
  var u;try{u=new URL(a.href,location.href);}catch(_){return;}
  if(u.origin!==location.origin)return;
  if(u.pathname===location.pathname)return;              // anclas de la misma página: sin efecto
  if(/\.(pdf|png|jpe?g|svg|webp|zip)$/i.test(u.pathname))return;
  e.preventDefault();
  try{sessionStorage.setItem('tv-ch','1');}catch(_){}
  ch.classList.add('go');
  setTimeout(function(){location.href=u.href;},240);
});
// Volver con el botón "atrás" desde la caché del navegador: limpiar la estática
addEventListener('pageshow',function(e){if(e.persisted)ch.classList.remove('go');});

/* ── Modo TV apagado: la intro del home no se muestra ── */
var intro=document.getElementById('intro');
if(intro&&!tvOn()&&intro.style.display!=='none'){
  var sk=document.getElementById('introSkip');if(sk)sk.click();
}

/* ═══════════════ PRECARGA con barra hacker ═══════════════ */
var HEADS=['Azul centro','Azul derecha','Azul izquerda','Dorado centro','Dorado derecha','Dorado izquerda','Jade centro','Jade derecho','Jade izquerdo']
  .map(function(n){return '/assets/heads/'+encodeURIComponent(n)+'.svg';});
var PAGES=['/','/software','/educacion'];
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
  }else document.body.appendChild(box);
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
  // 1 · lobos (las 9 cabezas) + imágenes de esta página
  var seen={};
  HEADS.concat([].slice.call(document.images).map(function(i){return i.currentSrc||i.src;}))
    .forEach(function(u){if(u&&!seen[u]){seen[u]=1;jobs.push(track('lobos',img(u)));}});
  // 2 · fuentes
  if(document.fonts&&document.fonts.ready)jobs.push(track('fuentes',document.fonts.ready));
  // 3 · animaciones: CSS y JS del sitio (ya en caché por 1 año → casi instantáneo)
  [].slice.call(document.querySelectorAll('link[rel="stylesheet"][href^="/"],link[rel="stylesheet"][href^="assets"],script[src]'))
    .map(function(n){return n.href||n.src;}).filter(function(u){return u.indexOf(location.origin)===0;})
    .forEach(function(u){jobs.push(track('animaciones',fetch(u)));});
  // 4 · las otras páginas y sus imágenes (así navegar es instantáneo)
  PAGES.filter(function(p){return p!==location.pathname;}).forEach(function(p){
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
