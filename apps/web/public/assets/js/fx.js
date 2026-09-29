/* ═══════════════════════════════════════════════════════════════
   FX · 6 animaciones compartidas (estilos en main.css, bloque "FX").
   1 borde de luz · 2 botón magnético + onda · 3 foco + inclinación
   4 títulos que se revelan · 5 cifras que cuentan · 6 cascada + progreso
   Reglas: no toca lobos; todo se apaga con prefers-reduced-motion;
   magnético e inclinación solo con mouse (no en táctil).
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine=window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches;
var hasIO='IntersectionObserver' in window;
function animOff(){return document.documentElement.classList.contains('anim-off');}
var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s));};

/* Dispara fn una sola vez cuando el elemento entra en pantalla.
   IntersectionObserver + respaldo por posición en scroll/resize: si el observador
   no llega a disparar, el contenido oculto por una animación nunca queda invisible. */
var pending=[];
function fire(p){if(p.done)return;p.done=true;if(p.io)p.io.disconnect();p.fn(p.el);}
function onView(el,fn,th){
  var p={el:el,fn:fn,done:false};
  if(!hasIO){fire(p);return;}
  p.io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting;}))fire(p);},{threshold:th||.2});
  p.io.observe(el);
  pending.push(p);
}
var checking=false;
function checkPending(){
  checking=false;
  var vh=innerHeight;if(!vh)return;
  pending=pending.filter(function(p){
    if(p.done)return false;
    var r=p.el.getBoundingClientRect();
    if(r.top<vh*.92&&r.bottom>0){fire(p);return false;}
    return true;
  });
}
// setTimeout y no rAF: rAF se pausa en pestañas en segundo plano y el respaldo debe correr siempre
function queueCheck(){if(!checking){checking=true;setTimeout(checkPending,60);}}
addEventListener('scroll',queueCheck,{passive:true});
addEventListener('resize',queueCheck,{passive:true});
addEventListener('load',queueCheck);
setTimeout(checkPending,1200);

/* ── 1 · Borde de luz: primer CTA de cada hero + plan recomendado ── */
if(!reduce){
  $$('.hh .hctas > .bp:first-child, .ss-hero .hctas > .bp:first-child, .plan.featured').forEach(function(el){
    if(el.querySelector('.fx-ring'))return;
    el.classList.add('fx-glow');
    // anillo que recorta + cono que gira por transform (capa de GPU, sin repintar) + tapa del centro
    var r=document.createElement('span');r.className='fx-ring';r.setAttribute('aria-hidden','true');
    r.innerHTML='<span class="fx-rot"></span><span class="fx-cover"></span>';
    el.appendChild(r);
    sizeRing(el);
  });
  addEventListener('resize',function(){[].forEach.call(document.querySelectorAll('.fx-glow'),sizeRing);},{passive:true});
}
// El cono debe cubrir la diagonal del elemento en cualquier ángulo de giro
function sizeRing(el){var w=el.offsetWidth,h=el.offsetHeight;el.style.setProperty('--fx-d',Math.ceil(Math.sqrt(w*w+h*h))+4+'px');}

/* ── 2 · Botón magnético (mouse) + onda de clic (todos) ── */
$$('.bp, .btn-nav').forEach(function(b){
  if(fine&&!reduce){
    // Mientras el mouse está encima la respuesta es casi inmediata (.08s); al salir
    // vuelve con la transición normal. Antes heredaba .25s y el botón llegaba tarde.
    b.addEventListener('mouseenter',function(){b.style.transition='transform .08s linear,box-shadow .3s,background .45s,border-color .45s,color .45s';});
    b.addEventListener('mousemove',function(e){
      if(animOff())return;
      var r=b.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
      b.style.transform='translate('+(x*.1).toFixed(1)+'px,'+(y*.18-2).toFixed(1)+'px)';
    });
    b.addEventListener('mouseleave',function(){b.style.transition='';b.style.transform='';});
  }
  if(!reduce){
    b.addEventListener('click',function(e){
      if(animOff())return;
      var r=b.getBoundingClientRect(),s=Math.max(r.width,r.height),d=document.createElement('span');
      d.className='fx-ripple';d.style.width=d.style.height=s+'px';
      d.style.left=((e.clientX||r.left+r.width/2)-r.left-s/2)+'px';
      d.style.top=((e.clientY||r.top+r.height/2)-r.top-s/2)+'px';
      b.appendChild(d);setTimeout(function(){d.remove();},650);
    });
  }
});

/* ── 3 · Tarjetas con foco de luz + inclinación 3D (solo mouse) ── */
if(fine){
  $$('.plan, .fc, .course-card, .door').forEach(function(c){
    c.classList.add('fx-card');
    var s=document.createElement('span');s.className='fx-spot';s.setAttribute('aria-hidden','true');
    c.appendChild(s);
    c.addEventListener('mousemove',function(e){
      var r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
      c.style.setProperty('--mx',(px*100).toFixed(1)+'%');c.style.setProperty('--my',(py*100).toFixed(1)+'%');
      if(!reduce&&!animOff()){
        c.classList.add('fx-tilting');
        c.style.transform='perspective(900px) rotateX('+((.5-py)*6).toFixed(2)+'deg) rotateY('+((px-.5)*8).toFixed(2)+'deg)';
      }
    });
    c.addEventListener('mouseleave',function(){c.style.transform='';c.classList.remove('fx-tilting');});
  });
}

/* ── 4 · Títulos que se revelan línea por línea (el degradado que fluye es CSS) ── */
if(!reduce&&hasIO){
  $$('.sh2, .ctah').forEach(function(h){
    if(h.dataset.fxRv)return;
    h.dataset.fxRv='1';
    var lines=h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML=lines.map(function(l){return '<span class="fx-ln"><span class="fx-li">'+l.trim()+'</span></span>';}).join('');
    h.classList.add('fx-rv');
    onView(h,function(t){t.classList.add('fx-in');},.3);
  });
}

/* ── 5 · Cifras que cuentan: <b data-count="14" data-suf=" días"> ── */
$$('[data-count]').forEach(function(el){
  var to=+el.dataset.count,suf=el.dataset.suf||'',pre=el.dataset.pre||'';
  if(reduce||animOff()){el.textContent=pre+to+suf;return;}
  el.textContent=pre+'0'+suf;
  onView(el,function(){
    var t0=null,dur=1400;
    function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/dur),k=1-Math.pow(1-p,3);el.textContent=pre+Math.round(to*k)+suf;if(p<1)requestAnimationFrame(step);}
    requestAnimationFrame(step);
  },.5);
});

/* ── 6a · Cascada: grillas de tarjetas (salta las que ya animan con .fu) ── */
if(!reduce&&hasIO){
  var grids=$$('.fg, .course-grid');
  $$('.door').forEach(function(d){if(grids.indexOf(d.parentElement)<0)grids.push(d.parentElement);});
  grids.forEach(function(g){
    var kids=[].slice.call(g.children);
    if(!kids.length||kids.some(function(k){return k.classList.contains('fu');}))return;
    kids.forEach(function(k,i){k.classList.add('fx-st');k.style.setProperty('--i',i);});
    onView(g,function(t){t.classList.add('fx-stg-in');},.12);
  });
}

/* ── Navegación instantánea: precarga Inicio/Software/Educación al pasar el mouse
   (Speculation Rules, prefetch: solo baja el HTML; no ejecuta la página → no infla analytics) ── */
if(HTMLScriptElement.supports&&HTMLScriptElement.supports('speculationrules')){
  var sr=document.createElement('script');sr.type='speculationrules';
  sr.textContent=JSON.stringify({prefetch:[{source:'list',urls:['/','/software','/educacion'].filter(function(u){return u!==location.pathname;}),eagerness:'moderate'}]});
  document.head.appendChild(sr);
}

/* ── 6b · Barra de progreso de lectura (3 colores) ── */
var bar=document.createElement('div');bar.id='fx-prog';bar.setAttribute('aria-hidden','true');
document.body.appendChild(bar);
var ticking=false;
function prog(){
  ticking=false;
  var h=document.documentElement.scrollHeight-innerHeight;
  bar.style.transform='scaleX('+(h>0?Math.min(1,scrollY/h):0).toFixed(4)+')';
}
addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(prog);}},{passive:true});
addEventListener('resize',prog,{passive:true});
prog();
})();
