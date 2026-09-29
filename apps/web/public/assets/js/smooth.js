/* ═══════════════════════════════════════════════════════════════
   SMOOTH · desplazamiento suave (Lenis) + entradas con GSAP ScrollTrigger.
   Solo páginas internas (body.ss): la portada usa su propio carrusel con scroll interno.
   Se apaga con Animaciones=off y con prefers-reduced-motion. No toca lobos.
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var d=document.documentElement;
if(!document.body.classList.contains('ss'))return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches||d.classList.contains('anim-off'))return;
if(!window.Lenis)return;

var lenis=new Lenis({lerp:.11,smoothWheel:true,anchors:{offset:-90}});
window.t3Lenis=lenis;
var G=window.gsap,ST=window.ScrollTrigger;
if(G&&ST){
  G.registerPlugin(ST);
  lenis.on('scroll',ST.update);
  G.ticker.add(function(t){lenis.raf(t*1000);});
  G.ticker.lagSmoothing(0);

  // Parallax leve del héroe: el contenido sube un poco más lento y se desvanece al bajar
  var hero=document.querySelector('.ss-hero');
  if(hero)G.to(hero.children,{yPercent:-12,opacity:.35,ease:'none',
    scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:true}});

  // Grupos de tarjetas entran en cascada (sin tocar las que ya anima fx.js: solo y/opacidad del grupo)
  var groups=[];
  document.querySelectorAll('.door,.plan,.course-card,.fc').forEach(function(c){var g=c.parentElement;if(g&&groups.indexOf(g)<0)groups.push(g);});
  groups.forEach(function(g){
    var kids=[].slice.call(g.children);if(kids.length<2)return;
    // Nada se oculta de antemano: si el disparador nunca llega, las tarjetas siguen visibles
    ST.create({trigger:g,start:'top 92%',once:true,onEnter:function(){
      G.fromTo(kids,{y:28,opacity:0},{y:0,opacity:1,duration:.6,ease:'power3.out',stagger:.07,clearProps:'transform,opacity'});
      // Respaldo: si los cuadros de animación se congelan (pestaña oculta), a los 2 s quedan visibles
      setTimeout(function(){G.killTweensOf(kids);G.set(kids,{clearProps:'transform,opacity'});},2000);}});
  });
  addEventListener('load',function(){ST.refresh();});
}else{
  (function raf(t){lenis.raf(t);requestAnimationFrame(raf);})(performance.now());
}

// Si el usuario apaga animaciones desde el panel, se detiene el scroll suave
new MutationObserver(function(){if(d.classList.contains('anim-off')){lenis.destroy();if(ST)ST.getAll().forEach(function(s){s.kill();});}})
  .observe(d,{attributes:true,attributeFilter:['class']});
// Modales abiertos: pausa el scroll suave para que la rueda mueva el modal
// y los paneles con scroll propio (modal, globo de WhatsApp) no pasan su rueda a Lenis
var mo=document.getElementById('modal');
if(mo){mo.setAttribute('data-lenis-prevent','');
  new MutationObserver(function(){mo.hidden?lenis.start():lenis.stop();}).observe(mo,{attributes:true,attributeFilter:['hidden']});}
document.addEventListener('click',function(){var w=document.querySelector('.wab');if(w)w.setAttribute('data-lenis-prevent','');},true);
})();
