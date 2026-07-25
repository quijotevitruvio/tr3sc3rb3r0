/* ═══════════════════════════════════════════════════════════════
   SITE SHELL — nav + footer + modal + tema + TRM compartidos
   para páginas standalone (software.html, educacion.html, bundles.html).
   Patrón espejo de app/assets/shell.js: inyecta en [data-site="nav"] /
   [data-site="footer"] / [data-site="modal"].
   Config por página vía window.SITE_SHELL={active:'software'|'educacion'|'',
   modalService:'...', waText:'...'}.
═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var CFG=window.SITE_SHELL||{};
var W3F_KEY='01e52190-ec4a-4e66-8af9-875f2e23a6c9';
var WA_NUM='573003000958';

/* ── NAV ── */
var NAV_LINKS=[
  {href:'/software',key:'software',label:'Software'},
  {href:'/',key:'inicio',label:'Inicio'},
  {href:'/educacion',key:'educacion',label:'Educación'}
];
var navMount=document.querySelector('[data-site="nav"]');
if(navMount){
  var links=NAV_LINKS.map(function(l){
    var on=CFG.active===l.key?' class="ss-link on"':' class="ss-link"';
    return '<a href="'+l.href+'"'+on+'>'+l.label+'</a>';
  }).join('');
  navMount.innerHTML=
    '<nav class="ss-nav">'+
      '<a href="/" class="nlogo" style="text-decoration:none"><span class="nlogo-a">Tr3s</span>C3rb3r0</a>'+
      '<div class="ss-links">'+links+'</div>'+
      '<div class="ss-right">'+
        '<button class="theme-btn" id="themeToggle" type="button" aria-label="Cambiar tema claro/oscuro" title="Cambiar tema"><span class="ti ti-sun" aria-hidden="true">☀</span><span class="ti ti-moon" aria-hidden="true">☾</span></button>'+
        '<button class="btn-nav" id="nCta">Agenda una sesión</button>'+
      '</div>'+
    '</nav>';
}

/* ── FOOTER ── */
var footMount=document.querySelector('[data-site="footer"]');
if(footMount){
  footMount.innerHTML=
    '<div class="hf" style="margin-top:3rem">'+
      '<div class="hf-brand">'+
        '<span class="fl"><span>Tr3s</span>C3rb3r0</span>'+
        '<span class="hf-meta">Tr3sC3rb3r0 SAS · Medellín, Antioquia · Colombia</span>'+
      '</div>'+
      '<div class="hf-contact">'+
        '<a href="mailto:hola@trescerbero.com">hola@trescerbero.com</a>'+
        '<a href="tel:+573003000958">+57 300 300 0958</a>'+
      '</div>'+
      '<div class="fla">'+
        '<a href="/software">Software</a>'+
        '<a href="/educacion">Educación</a>'+
        '<a href="/legal/privacidad.html">Privacidad</a>'+
        '<a href="/legal/terminos.html">Términos</a>'+
        '<a href="https://wa.me/'+WA_NUM+'" target="_blank" rel="noopener">WhatsApp</a>'+
      '</div>'+
      '<span class="fc2">© '+(new Date().getFullYear())+' Tr3sC3rb3r0</span>'+
    '</div>';
}

/* ── MODAL DE CONTACTO ── */
var modalMount=document.querySelector('[data-site="modal"]');
if(modalMount){
  modalMount.innerHTML=
    '<div id="modal" role="dialog" aria-modal="true" hidden>'+
      '<div class="mo-backdrop" id="moBackdrop"></div>'+
      '<div class="mo-box" id="moBox">'+
        '<button class="mo-close" id="moClose" aria-label="Cerrar">✕</button>'+
        '<div class="mo-service"><span class="mo-dot"></span><span id="moServiceName">'+(CFG.modalService||'Tr3sC3rb3r0')+'</span></div>'+
        '<h2 class="mo-title">HABLEMOS.</h2>'+
        '<p class="mo-sub">Contanos qué necesitás y te respondemos en menos de 24h hábiles.</p>'+
        '<form class="mo-form" id="moForm" novalidate>'+
          '<input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off">'+
          '<div class="mo-row">'+
            '<div class="mo-field"><label>Nombre *</label><input type="text" name="name" autocomplete="name" required placeholder="Tu nombre"></div>'+
            '<div class="mo-field"><label>Email *</label><input type="email" name="email" autocomplete="email" required placeholder="tu@empresa.com"></div>'+
          '</div>'+
          '<div class="mo-field"><label>En 1-2 frases: ¿qué necesitás?</label><textarea name="message" rows="4" placeholder="'+(CFG.modalPlaceholder||'Contanos tu caso...')+'"></textarea></div>'+
          '<button type="submit" class="bp" id="moSubmit">Enviar mensaje →</button>'+
        '</form>'+
        '<div class="mo-success" id="moSuccess" hidden>'+
          '<div class="mo-check">✓</div><h3>¡Recibido!</h3><p>Te escribimos en menos de 24h hábiles.</p>'+
        '</div>'+
      '</div>'+
    '</div>';
}

var modal=document.getElementById('modal');
var modalContext='';
window.ssOpenModal=function(ctx){
  if(!modal)return;
  modalContext=ctx||'';
  if(ctx){var n=document.getElementById('moServiceName');if(n)n.textContent=ctx;}
  modal.hidden=false;
  setTimeout(function(){var i=document.querySelector('#moForm input[name="name"]');if(i)i.focus();},100);
};
function closeModal(){if(modal)modal.hidden=true;}
if(modal){
  document.getElementById('moClose').addEventListener('click',closeModal);
  document.getElementById('moBackdrop').addEventListener('click',closeModal);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
  document.getElementById('moForm').addEventListener('submit',function(e){
    e.preventDefault();
    var form=e.target;
    var fd=new FormData(form);
    if(!fd.get('name')||!fd.get('email'))return;
    fd.append('access_key',W3F_KEY);
    fd.append('subject','[Tr3sC3rb3r0 '+(CFG.modalService||'Web')+'] '+fd.get('name')+(modalContext?' · '+modalContext:''));
    fd.append('from_name','Tr3sC3rb3r0 '+(CFG.modalService||'Web'));
    if(modalContext)fd.append('contexto',modalContext);
    fetch('https://api.web3forms.com/submit',{method:'POST',body:fd,headers:{'Accept':'application/json'}})
      .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
      .then(function(res){
        if(res.ok&&res.j.success){location.href='/gracias.html?from='+encodeURIComponent(CFG.active||'web')+'&service='+encodeURIComponent(modalContext||CFG.modalService||'Web');}
        else{alert('Error al enviar. Intentá por WhatsApp.');}
      })
      .catch(function(){alert('Error de red. Intentá por WhatsApp.');});
  });
}
/* Cualquier .plan-cta o [data-modal] abre el modal con contexto */
document.querySelectorAll('.plan-cta,[data-modal]').forEach(function(b){
  b.addEventListener('click',function(e){
    if(b.tagName==='A'&&b.getAttribute('href')&&b.getAttribute('href').charAt(0)!=='#'&&!b.hasAttribute('data-modal'))return;
    e.preventDefault();
    var ctx=b.getAttribute('data-modal')||b.closest('[data-plan-name]')&&b.closest('[data-plan-name]').getAttribute('data-plan-name')||'';
    window.ssOpenModal(ctx);
  });
});
var nCta=document.getElementById('nCta');
if(nCta)nCta.addEventListener('click',function(){window.ssOpenModal('');});

/* ── LOBOS: fade y deslizamiento al hacer scroll (espejo del carrusel) ── */
(function(){
  var wolves=document.querySelectorAll('.wolf-face.wa,.wdeco.wa');
  if(!wolves.length)return;
  window.addEventListener('scroll',function(){
    var y=window.scrollY||0;
    var fade=Math.max(.22,1-Math.max(0,y-120)/500);
    var shift=Math.min(10,y/60)+'vw';
    wolves.forEach(function(w){
      w.style.setProperty('--wf-fade',fade);
      if(w.classList.contains('wdeco'))w.style.setProperty('--wd-shift',shift);
    });
  },{passive:true});
})();

/* ── THEME TOGGLE ── */
(function(){
  var btn=document.getElementById('themeToggle');
  if(!btn)return;
  btn.addEventListener('click',function(){
    var r=document.documentElement;
    var n=r.getAttribute('data-theme')==='light'?'dark':'light';
    r.setAttribute('data-theme',n);
    try{localStorage.setItem('t3-theme',n);}catch(e){}
  });
})();

/* ── TRM + precios USD→COP (planes con data-usd-m/data-usd-y) ── */
var TRM=3800,billMode='m';
function updatePlanPrices(){
  document.querySelectorAll('[data-usd-m]').forEach(function(p){
    var usd=parseFloat(billMode==='m'?p.dataset.usdM:p.dataset.usdY)||0;
    var cop=Math.round(usd*TRM);
    var v=p.querySelector('.plan-price-val'),c=p.querySelector('.plan-cop-val'),s=p.querySelector('.plan-price-suf');
    if(v)v.textContent=usd.toLocaleString('en-US');
    if(c)c.textContent=cop.toLocaleString('es-CO');
    if(s)s.textContent=billMode==='m'?'/mes':'/año';
  });
}
document.querySelectorAll('.bt[data-bill]').forEach(function(btn){
  btn.addEventListener('click',function(){
    billMode=btn.dataset.bill;
    document.querySelectorAll('.bt[data-bill]').forEach(function(b){b.classList.toggle('active',b.dataset.bill===billMode);});
    updatePlanPrices();
  });
});
fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',{cache:'no-store'})
  .then(function(r){return r.ok?r.json():null;})
  .then(function(j){
    var cop=j&&j.usd&&j.usd.cop;
    if(typeof cop==='number'&&cop>1000){
      TRM=Math.round(cop);
      document.querySelectorAll('.trm-rate').forEach(function(el){el.textContent='1 USD = $'+TRM.toLocaleString('es-CO')+' COP · '+(j.date||'hoy');});
      updatePlanPrices();
    }
  }).catch(function(){});
updatePlanPrices();
})();
