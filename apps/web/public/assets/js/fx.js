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

/* 1 · Borde de luz giratorio: quitado (animación infinita sin propósito). */

/* ── 2 · Onda de clic en botones principales (confirma que se pulsó) ── */
$$('.bp, .btn-nav').forEach(function(b){
  // Botón magnético quitado: el botón se movía detrás del mouse. Queda solo la onda del clic (confirma la acción).
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

/* 3 · Foco de luz + inclinación 3D en tarjetas: quitado (repintaba en cada movimiento del mouse).
   El hover de tarjetas ahora es CSS: borde y un leve ascenso. */
$$('.plan, .fc, .course-card, .door').forEach(function(c){c.classList.add('fx-card');});

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
  // prerender (página lista del todo) para páginas internas al pasar el mouse; la portada / solo prefetch
  // porque su intro y su cargador no deben correr ocultos. analytics.js espera a que se abra de verdad.
  var no={not:{selector_matches:'[target],[download],[href*="#"],[href^="/api"]'}};
  sr.textContent=JSON.stringify({
    prerender:[{source:'document',where:{and:[{href_matches:'/:p+'},no]},eagerness:'moderate'}],
    prefetch:[{source:'document',where:{and:[{href_matches:'/'},no]},eagerness:'moderate'}]
  });
  document.head.appendChild(sr);
}

/* ── 7 · Descifrado con símbolos raros: textos cortos se «descifran» al aparecer
   (una vez) y al pasar el mouse. Liviano: solo etiquetas cortas, <0,5 s, recorre solo
   nodos de texto (respeta flechas/enlaces internos), fija el ancho para no mover el
   diseño y no deja nada corriendo. Se apaga con Animaciones=off o reduce-motion. ── */
var GL='⟁⌬∆⋈◢◣⌇⎍⏚⌖⍜⍾⎔⏃⏁⌰⟟⟒⟊▓▒░#%&$@<>/{}[]01';
function decode(el,dur){
  if(reduce||animOff()||!el||el.dataset.fxDec==='1')return;
  var nodes=[],w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),n;
  while((n=w.nextNode()))if(n.nodeValue.trim())nodes.push({n:n,t:n.nodeValue});
  var total=nodes.reduce(function(a,x){return a+x.t.length;},0);
  if(!total||total>60)return;                         // solo textos cortos
  el.dataset.fxDec='1';
  var inline=getComputedStyle(el).display==='inline';
  var prev={w:el.style.width,ws:el.style.whiteSpace,ov:el.style.overflow,d:el.style.display};
  var bw=el.getBoundingClientRect().width;
  if(inline){el.style.display='inline-block';}
  // ancho EXACTO + sin salto de línea: los símbolos son más anchos que las letras y
  // no deben empujar a los botones vecinos (lo que sobra se recorta un instante)
  el.style.width=bw+'px';el.style.whiteSpace='nowrap';el.style.overflow='hidden';
  var steps=Math.max(6,Math.round((dur||450)/32)),k=0;
  (function tick(){
    k++;var reveal=Math.floor(total*k/steps),i=0;
    nodes.forEach(function(x){
      var out='';
      for(var j=0;j<x.t.length;j++,i++){var ch=x.t[j];out+=(i<reveal||ch===' '||ch==='·')?ch:GL[(Math.random()*GL.length)|0];}
      x.n.nodeValue=out;
    });
    if(k<steps)setTimeout(tick,32);
    else{nodes.forEach(function(x){x.n.nodeValue=x.t;});el.style.width=prev.w;el.style.whiteSpace=prev.ws;el.style.overflow=prev.ov;el.style.display=prev.d;el.dataset.fxDec='';}
  })();
}
window.t3Decode=decode;   // lo usan otros scripts (palabras flotantes de la intro)
// Solo al pasar el mouse (microinteracción); ya no se descifra todo al aparecer.
// Al pasar el mouse (solo con mouse; la etiqueta dentro del elemento)
if(fine){
  [['.ci','.ci-name'],['.door','.door-title'],['.plan','.plan-name'],['.ss-index-item','.ss-index-t'],['.course-card','.cc-title']].forEach(function(p){
    $$(p[0]).forEach(function(host){
      var lab=host.querySelector(p[1]);if(!lab)return;
      host.addEventListener('mouseenter',function(){decode(lab,380);});
    });
  });
  // Títulos: se descifran al pasar el mouse (h2 de sección, cierres, pasos, tarjetas y pie)
  $$('.sh2, .ctah, .pt, .ft, .tf-h, .subplans-h, .rel-t').forEach(function(t){t.addEventListener('mouseenter',function(){decode(t,450);});});
  // Más lugares: pestañas de la intro, migas de pan y enlaces del pie con el árbol
  $$('.intro-tab').forEach(function(t){var l=t.querySelector('[data-k]')||t;t.addEventListener('mouseenter',function(){decode(l,380);});});
  $$('.crumbs a, .tf-col a, .tf-contact a').forEach(function(a){a.addEventListener('mouseenter',function(){decode(a,350);});});
}

/* ── 8 · Globo de WhatsApp: el botón flotante (y el cartelito del home) abren un mini
   chat donde el visitante escribe su primer mensaje; «Enviar» abre WhatsApp con ese
   texto listo. El saludo aparece descifrándose. Sin librerías, sin conexiones externas
   hasta que el usuario envía. ── */
(function(){
  var fl=document.querySelector('.wa-float');if(!fl)return;
  var WA='573003000958';
  function defaultMsg(){try{return new URL(fl.href).searchParams.get('text')||'';}catch(_){return '';}}
  var box=null,ta=null,chips=[];
  // Cada sección tiene su saludo, su subtítulo y sus botones rápidos (el color sale de --a,
  // que ya es el acento de la sección/cabeza activa: cyan Software, ámbar centro, verde Educación)
  var CTX={
    software:{tag:'Software · Medellín',hi:'¿Qué quiere automatizar?',sub:'Chatbot, CRM o web: cuéntenos y le respondemos por WhatsApp.',
      chips:[['Chat IA','Hola, me interesa un chatbot de WhatsApp con IA.'],['CRM','Hola, me interesa L-IA CRM para mi equipo.'],['Web','Hola, necesito una página web.'],['Cotización','Hola, quiero una cotización para mi proyecto.']]},
    inicio:{tag:'Tr3sC3rb3r0 · Medellín',hi:'¿En qué le podemos ayudar?',sub:'Escríbanos y le respondemos por WhatsApp.',
      chips:[['Software','Hola, necesito software con IA para mi negocio.'],['Cursos','Hola, me interesan los cursos de IA.'],['Precios','Hola, quisiera conocer precios.'],['Diagnóstico','Hola, quiero agendar un diagnóstico de 30 minutos.']]},
    educacion:{tag:'Educación · Medellín',hi:'¿Qué quiere aprender?',sub:'Cursos, clases 1-a-1 o formación para su empresa.',
      chips:[['Curso en vivo','Hola, quiero reservar cupo en el curso en vivo de desarrollo con IA.'],['Clases 1-a-1','Hola, me interesan las clases 1-a-1.'],['Empresas','Hola, quiero formación en IA para mi empresa.'],['Curso gratis','Hola, quiero el mini-curso gratis.']]}
  };
  function ctxKey(){
    var cfg=window.SITE_SHELL||{};
    if(cfg.active==='software'||cfg.active==='educacion')return cfg.active;
    if(typeof active!=='undefined')return ['software','inicio','educacion'][active]||'inicio';  // cabeza activa del home
    return 'inicio';
  }
  function build(){
    box=document.createElement('div');
    box.className='wab';box.setAttribute('role','dialog');box.setAttribute('aria-label','Escribir por WhatsApp');box.hidden=true;
    box.innerHTML=
      '<div class="wab-head"><span class="wab-av" aria-hidden="true">T3</span>'+
        '<span class="wab-id"><b>Tr3sC3rb3r0</b><small><i class="wab-dot"></i><span class="wab-tag"></span></small></span>'+
        '<button type="button" class="wab-x" aria-label="Cerrar">×</button></div>'+
      '<div class="wab-body">'+
        '<p class="wab-glyph" aria-hidden="true"></p>'+
        '<div class="wab-msg in"><span class="wab-hi"></span><small class="wab-sub"></small></div>'+
        '<div class="wab-chips"></div>'+
      '</div>'+
      '<form class="wab-form">'+
        '<textarea class="wab-ta" rows="2" maxlength="600" placeholder="Escriba su mensaje…" aria-label="Su mensaje"></textarea>'+
        '<button type="submit" class="wab-send" aria-label="Enviar por WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" fill="currentColor"/></svg></button>'+
      '</form>';
    document.body.appendChild(box);
    ta=box.querySelector('.wab-ta');
    box.querySelector('.wab-x').addEventListener('click',close);
    box.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
    box.querySelector('.wab-chips').addEventListener('click',function(e){var b=e.target.closest('.wab-chip');if(!b)return;ta.value=chips[+b.dataset.i][1];ta.focus();});
    ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    box.querySelector('.wab-form').addEventListener('submit',function(e){e.preventDefault();send();});
  }
  function fill(){
    var c=CTX[ctxKey()];chips=c.chips;
    box.dataset.ctx=ctxKey();
    box.querySelector('.wab-tag').textContent='WhatsApp · '+c.tag;
    box.querySelector('.wab-hi').textContent=c.hi;
    box.querySelector('.wab-sub').textContent=c.sub;
    box.querySelector('.wab-chips').innerHTML=c.chips.map(function(x,i){return '<button type="button" class="wab-chip" data-i="'+i+'">'+x[0]+'</button>';}).join('');
  }
  function send(){
    var msg=(ta.value||'').trim()||defaultMsg()||'Hola Tr3sC3rb3r0, vi su sitio web.';
    window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(msg),'_blank','noopener');
    ta.value='';close();
  }
  var tick=null;
  function glyphs(on){
    var g=box.querySelector('.wab-glyph');if(tick){clearInterval(tick);tick=null;}
    if(!on||reduce||animOff()){g.textContent='⟁⌬∆ 0x7A3F ◢◣';return;}
    var L='⟁⌬∆⋈◢◣⌇⎍⏚⌖⍜⍾⎔⏃⏁⌰⟟⟒⟊▓▒░#%&$@01';
    tick=setInterval(function(){var s='';for(var i=0;i<14;i++)s+=L[(Math.random()*L.length)|0];g.textContent='// canal cifrado '+s;},90);
  }
  function open(){
    if(!box)build();
    fill();
    box.hidden=false;fl.setAttribute('aria-expanded','true');document.body.classList.add('wab-open');
    var tip=document.getElementById('waTip');if(tip)tip.classList.remove('show');
    decode(box.querySelector('.wab-hi'),600);      // saludo que se descifra
    glyphs(true);
    setTimeout(function(){ta.focus();},60);
  }
  function close(){if(!box)return;box.hidden=true;glyphs(false);fl.setAttribute('aria-expanded','false');document.body.classList.remove('wab-open');fl.focus();}
  // Captura antes que otros manejadores (el cartelito del home abría WhatsApp directo)
  document.addEventListener('click',function(e){
    var t=e.target.closest&&e.target.closest('.wa-float, #waTip');
    if(!t||e.target.closest('#waTipX'))return;
    e.preventDefault();e.stopPropagation();
    if(box&&!box.hidden)close();else open();
  },true);
  fl.setAttribute('aria-haspopup','dialog');fl.setAttribute('aria-expanded','false');
})();
// Botones de WhatsApp y de agendar/pedir (todo lo que abre el formulario): su texto se
// descifra al pasar el mouse
if(fine){
  $$('a[href*="wa.me/"]:not(.wa-float), [data-modal], .hero-cal, .plan-cta, #nCta').forEach(function(a){a.addEventListener('mouseenter',function(){decode(a,380);});});
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

/* ── Accesibilidad: cada <label> suelto queda asociado a su campo (lectores de pantalla
   anuncian "Email, obligatorio" y tocar la etiqueta enfoca el campo). ── */
(function(){
  var n=0;
  [].forEach.call(document.querySelectorAll('label:not([for])'),function(l){
    if(l.querySelector('input,select,textarea'))return;
    var c=l.nextElementSibling;
    if(!c||!/^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName))return;
    if(!c.id)c.id='t3f-'+(++n);
    l.htmlFor=c.id;
  });
})();

/* ── Logo vivo: cada 7–12 s se «descifra» con símbolos y cae en una de sus dos
   escrituras (Tr3sC3rb3r0 / TresCerbero). Mismo ancho, sin mover el menú.
   Se pausa con la pestaña oculta y se apaga con Animaciones=off o reduce-motion. ── */
(function(){
  var logos=[].slice.call(document.querySelectorAll('.nlogo'));
  if(!logos.length||reduce)return;
  var FORMS=[['Tr3s','C3rb3r0'],['Tres','Cerbero']];
  function scramble(el,to){
    var a=el.querySelector('.nlogo-a');if(!a)return;
    var b=a.nextSibling;if(!b||b.nodeType!==3)return;
    var from=[a.textContent,b.nodeValue],w=el.getBoundingClientRect().width;
    el.style.display='inline-block';el.style.width=w+'px';el.style.whiteSpace='nowrap';el.style.overflow='hidden';
    var steps=16,k=0;
    (function tick(){
      k++;
      [a.firstChild,b].forEach(function(n,i){
        var t=to[i],out='';
        for(var j=0;j<t.length;j++){
          var cut=Math.floor(t.length*k/steps);
          out+=j<cut?t[j]:GL[(Math.random()*GL.length)|0];
        }
        n.nodeValue=out;
      });
      if(k<steps)setTimeout(tick,34);
      else{el.style.width='';el.style.overflow='';}
    })();
  }
  var idx=0;
  (function loop(){
    setTimeout(function(){
      if(!document.hidden&&!animOff()){
        // la mayoría de las veces vuelve a la forma de marca; a veces muestra «TresCerbero»
        idx=idx===0?(Math.random()<.5?1:0):0;
        logos.forEach(function(l){scramble(l,FORMS[idx]);});
      }
      loop();
    },7000+Math.random()*5000);
  })();
})();

})();
