/* ═══════════════════════════════════════════════════════════════
   INTRO-FX · la entrada de los 3 lobos como menú vivo (solo portada).
   1 Mirada: las cabezas giran unos grados hacia el mouse (o la inclinación del celular).
   3 Foco: al apuntar un lobo, los otros se apagan y el texto dice qué hay detrás.
   5 Rugido: al elegir, una onda de símbolos sale del lobo y barre la pantalla.
   Las imágenes no se tocan: solo `rotate`/`scale` (propiedades aparte de la animación
   `transform` de entrada y glitch) y opacidad/brillo en cambios puntuales.
   Se apaga con Animaciones=off y prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var intro=document.getElementById('intro');
if(!intro)return;
var d=document.documentElement;
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function off(){return reduce||d.classList.contains('anim-off')||intro.classList.contains('intro-out')||intro.style.display==='none';}
var heads=[intro.querySelector('.intro-head-l'),intro.querySelector('.intro-head-c'),intro.querySelector('.intro-head-r')];
var tabs=[].slice.call(intro.querySelectorAll('.intro-tab'));
var tag=document.getElementById('introTag');
var COL=['#00C8FF','#FFB300','#39FF14'];
var INFO=[
  'SOFTWARE — Chatbot de WhatsApp · CRM con IA · Páginas web · A la medida',
  'TR3SC3RB3R0 — Quiénes somos · Cómo trabajamos · Contacto',
  'EDUCACIÓN — Curso en vivo con IA · Empresas · Cursos grabados'
];

/* ── 1 · Mirada ── */
var tx=0,ty=0,cx=0,cy=0,raf=0;
function step(){
  cx+=(tx-cx)*.12;cy+=(ty-cy)*.12;
  heads.forEach(function(h,i){
    if(!h)return;
    // cada cabeza mira hacia el punto desde SU posición (la izquierda gira más al ir a la izquierda…)
    var pos=h.dataset.pos||['l','c','r'][i],bias=(pos==='l'?-1:pos==='r'?1:0)*.35;
    h.style.rotate='y '+((cx-bias)*9).toFixed(2)+'deg';
    h.style.translate=((cx)*6).toFixed(1)+'px '+((cy)*5).toFixed(1)+'px';
  });
  raf=(Math.abs(tx-cx)>.002||Math.abs(ty-cy)>.002)?requestAnimationFrame(step):0;
}
function aim(x,y){if(off())return;tx=Math.max(-1,Math.min(1,x));ty=Math.max(-1,Math.min(1,y));if(!raf)raf=requestAnimationFrame(step);}
intro.addEventListener('mousemove',function(e){aim(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1);},{passive:true});
intro.addEventListener('mouseleave',function(){aim(0,0);});
// celular: inclinación (Android lo da sin permiso; en iOS se omite para no mostrar un aviso)
addEventListener('deviceorientation',function(e){if(e.gamma==null)return;aim(e.gamma/30,(e.beta-45)/30);},{passive:true});

/* ── 3 · Foco ── */
var focus=null,tagBefore='';
function setFocus(i){
  if(off()||i===focus)return;
  focus=i;window.T3_FOCUS=i;
  intro.dataset.focus=i;
  intro.style.setProperty('--fc',COL[i]);
  if(tag){
    if(typeof stopPhraseRotation==='function')stopPhraseRotation();
    if(!tagBefore)tagBefore=tag.textContent;
    tag.textContent=INFO[i];tag.dataset.fxDec='';
    if(window.t3Decode)window.t3Decode(tag,420);
  }
  // las palabras de los otros lobos se desvanecen; brota una del elegido
  [].forEach.call(intro.querySelectorAll('.iw'),function(w){w.classList.toggle('iw-dim',+w.dataset.g!==i);});
  if(typeof spawnIntroWord==='function')spawnIntroWord();
}
function clearFocus(){
  if(focus===null)return;
  focus=null;window.T3_FOCUS=null;
  delete intro.dataset.focus;
  [].forEach.call(intro.querySelectorAll('.iw-dim'),function(w){w.classList.remove('iw-dim');});
  if(tag&&tagBefore){tag.textContent=tagBefore;tagBefore='';}
  if(typeof startPhraseRotation==='function'&&!intro.classList.contains('intro-out'))startPhraseRotation();
}
heads.forEach(function(h,i){if(!h)return;h.addEventListener('mouseenter',function(){setFocus(i);});h.addEventListener('mouseleave',clearFocus);});
tabs.forEach(function(t){var i=+t.dataset.go;t.addEventListener('mouseenter',function(){setFocus(i);});t.addEventListener('focus',function(){setFocus(i);});t.addEventListener('mouseleave',clearFocus);t.addEventListener('blur',clearFocus);});

/* ── 5 · Rugido de datos al elegir ── */
var GL='⟁⌬∆⋈◢◣⌇⎍⏚⌖⍜⍾⎔⏃⏁⌰⟟⟒⟊▓▒░#%&$@<>/{}[]01';
function roar(i,x,y){
  if(reduce||d.classList.contains('anim-off'))return;
  var r=document.createElement('div');r.className='intro-roar';r.setAttribute('aria-hidden','true');
  var n=Math.ceil(innerWidth*innerHeight/260),s='';
  for(var k=0;k<n;k++)s+=GL[(Math.random()*GL.length)|0];
  r.textContent=s;
  r.style.setProperty('--rc',COL[i]);r.style.setProperty('--rx',x+'px');r.style.setProperty('--ry',y+'px');
  document.body.appendChild(r);
  setTimeout(function(){r.remove();},1100);
}
function center(el){var b=el.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height*.45];}
// fase de captura: corre antes que routeIntro (main.js), sin cambiar su comportamiento
intro.addEventListener('click',function(e){
  if(intro.classList.contains('intro-out'))return;
  var t=e.target.closest('.intro-tab,.intro-head,.iw,#introSkip');if(!t)return;
  if(t.classList.contains('intro-head')&&intro.classList.contains('triad')&&t.dataset.pos!=='c'){
    // no llega directo al routeIntro de main.js: primero termina de girar y luego entra
    e.stopPropagation();e.preventDefault();
    var k=heads.indexOf(t);clearTimeout(hoverT);rotateTo(k);
    setTimeout(function(){var p=center(heads[k]);roar(k,p[0],p[1]);if(typeof routeIntro==='function')routeIntro(k);},740);
    return;
  }
  var i=t.id==='introSkip'?1:t.classList.contains('intro-head')?heads.indexOf(t):+t.dataset.go;
  if(!(i>=0))return;
  var p=heads[i]?center(heads[i]):[e.clientX,e.clientY];
  roar(i,p[0],p[1]);
  // al salir, las cabezas vuelven a mirar al frente para que el morph parta limpio
  tx=ty=cx=cy=0;heads.forEach(function(h){if(h){h.style.rotate='';h.style.translate='';}});
},true);
/* ── Tríada: Cerbero gira como una sola cabeza ──
   Cada imagen es un color fijo (Azul=software, Dorado=inicio, Jade=educación); lo que cambia es
   su posición (data-pos) y su perfil: a la izquierda mira a la izquierda, a la derecha a la derecha
   (hocicos hacia afuera). «izquerda» mira a la derecha y «derecha» a la izquierda en los archivos. */
var BASE=['Azul','Dorado','Jade'];
var PROF={l:['Azul%20derecha','Dorado%20derecha','Jade%20derecho'],r:['Azul%20izquerda','Dorado%20izquerda','Jade%20izquerdo']};
function srcFor(i,pos){var ext=window.T3_WOLF_EXT||'avif';return '/assets/heads/'+(pos==='c'?BASE[i]+'%20centro':PROF[pos][i])+'.'+ext;}
var preloaded=false;
function preload(){if(preloaded)return;preloaded=true;[0,1,2].forEach(function(i){['l','c','r'].forEach(function(p){var im=new Image();im.src=srcFor(i,p);});});}
var turning=false;
function rotateTo(i){
  var h=heads[i];if(!h||turning||h.dataset.pos==='c')return;
  turning=true;preload();
  intro.classList.add('spinning');setTimeout(function(){intro.classList.remove('spinning');},720);   // sin halo durante el giro
  var fromLeft=h.dataset.pos==='l';
  // izquierda→centro: todo gira hacia la derecha (l→c, c→r, r→l); al revés si viene de la derecha
  var next=fromLeft?{l:'c',c:'r',r:'l'}:{r:'c',c:'l',l:'r'};
  heads.forEach(function(x,k){
    if(!x)return;
    var to=next[x.dataset.pos];
    x.classList.add('turning');x.dataset.pos=to;
    // a mitad del giro (cabeza casi invisible) cambia de perfil
    setTimeout(function(){x.src=srcFor(k,to);x.classList.remove('turning');},330);
  });
  setFocus(i);
  setTimeout(function(){turning=false;},720);
}
// tras la entrada, la escena pasa a modo tríada (posiciones por data-pos, sin animación de entrada)
if(!reduce)setTimeout(function(){if(!intro.classList.contains('intro-out'))intro.classList.add('triad');},2300);
else intro.classList.add('triad');
heads.forEach(function(h){if(h)h.addEventListener('mouseenter',preload,{once:true});});
// girar con solo apuntar: un cuarto de segundo quieto sobre una lateral (cruzar la pantalla no la gira)
var hoverT=0;
heads.forEach(function(h,i){
  if(!h)return;
  h.addEventListener('mouseenter',function(){
    if(!intro.classList.contains('triad')||h.dataset.pos==='c')return;
    clearTimeout(hoverT);hoverT=setTimeout(function(){if(!off())rotateTo(i);},250);
  });
  h.addEventListener('mouseleave',function(){clearTimeout(hoverT);});
});
// teclado: ← → giran, Enter entra a la del frente
addEventListener('keydown',function(e){
  if(off()||!intro.classList.contains('triad'))return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
    var want=e.key==='ArrowLeft'?'l':'r',k=heads.findIndex(function(x){return x&&x.dataset.pos===want;});
    if(k>=0){e.preventDefault();rotateTo(k);}
  }else if(e.key==='Enter'&&document.activeElement===document.body){
    var c=heads.findIndex(function(x){return x&&x.dataset.pos==='c';});if(c>=0)heads[c].click();
  }
});

/* ── Silueta de código: cada 8–12 s un lobo se «descifra» medio segundo. Capa encima,
   recortada con la forma exacta del lobo (mask con la misma imagen AVIF: su alfa).
   La imagen no se toca. También una vez al apuntar un lobo (con pausa de 2 s). ── */
var last=[0,0,0];
function codeFlash(i,entry){
  var h=heads[i];
  if(!h||off()||(document.hidden&&!entry))return;
  var now=Date.now();if(now-last[i]<2000)return;last[i]=now;
  var b=h.getBoundingClientRect();if(b.width<20)return;
  var o=document.createElement('div');o.className='wolf-code';o.setAttribute('aria-hidden','true');
  o.style.cssText='left:'+b.left+'px;top:'+b.top+'px;width:'+b.width+'px;height:'+b.height+'px;'+
    '-webkit-mask-image:url("'+h.currentSrc+'");mask-image:url("'+h.currentSrc+'");color:'+COL[i];
  var n=Math.ceil(b.width*b.height/120),t='';
  for(var k=0;k<n;k++)t+=GL[(Math.random()*GL.length)|0];
  o.textContent=t;
  document.body.appendChild(o);
  // los símbolos cambian 4 veces mientras dura (parece código corriendo) y se apaga
  var steps=0,iv=setInterval(function(){
    var u='';for(var k=0;k<n;k++)u+=GL[(Math.random()*GL.length)|0];o.textContent=u;
    if(++steps>=4){clearInterval(iv);}
  },110);
  setTimeout(function(){o.remove();},650);
}
heads.forEach(function(h,i){if(h)h.addEventListener('mouseenter',function(){codeFlash(i);});});
// entrada: cada lobo aparece «escrito» en símbolos con su silueta (centro primero, luego los lados)
if(!reduce)[[1,150],[0,380],[2,560]].forEach(function(p){setTimeout(function(){codeFlash(p[0],true);},p[1]);});
(function loop(){setTimeout(function(){codeFlash((Math.random()*3)|0);if(!intro.classList.contains('intro-out'))loop();},8000+Math.random()*4000);})();
})();
