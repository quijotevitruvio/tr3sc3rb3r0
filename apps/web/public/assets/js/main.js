/* ═══════════════════════════════════════════════
   COPY — voz: USTED (estándar B2B Colombia)
   Solo las claves vivas en index.html (único HTML que carga este archivo).
   Las páginas standalone (/software, /educacion) traen su texto en el HTML.
═══════════════════════════════════════════════ */
const C={
  es:{
    /* Navegación e interfaz */
    'i0':'Software','i1':'Inicio','i2':'Educación','nav':'Hablemos','scroll':'Explorar',
    'cta.note':'<strong>Cupos limitados</strong> · tomamos 3–4 clientes nuevos por mes · sin compromiso',
    'trust.label':'DÓNDE PROBAMOS LO QUE VENDEMOS',
    'mcta.reserve':'📅 Agendar 30 min',
    /* Intro */
    'intro.skip':'Saltar →','intro.b1':'Software','intro.b2':'Tr3sC3rb3r0','intro.b3':'Educación',
    /* Cookies (Ley 1581/2012) */
    'cookie.text':'<strong>🍪 Cookies y datos.</strong> Usamos cookies para analítica y experiencia. Al continuar acepta nuestra <a href="/legal/privacidad.html">política de privacidad</a> y el tratamiento de datos según la Ley 1581/2012 (Colombia).',
    'cookie.rej':'Rechazar','cookie.acc':'Aceptar',
    /* Modal de contacto */
    'mo.title':'HABLEMOS.','mo.sub':'Cuéntenos qué necesita y le respondemos en menos de 24 horas hábiles.',
    'mo.fn':'Nombre *','mo.fe':'Email *','mo.fm':'En 1-2 frases: ¿qué necesita?','mo.send':'Enviar mensaje →',
    'mo.ok':'Recibido.','mo.okd':'Le escribimos en menos de 24 horas hábiles.',
    /* Quiz orientador */
    'quiz.launcher':'No sé qué necesito',
    'quiz.q1':'¿Cuál es su mayor cuello de botella hoy?',
    'quiz.q1a':'Mis clientes preguntan lo mismo todo el día',
    'quiz.q1b':'Mi equipo de ventas pierde oportunidades por desorden',
    'quiz.q1c':'No tengo página web, o la que tengo no convierte',
    'quiz.q1e':'Quiero aprender a construir esto yo mismo',
    'quiz.q2':'¿De qué tamaño es su equipo?',
    'quiz.q2a':'Solo yo o freelance (1-2 personas)','quiz.q2b':'Pyme (3-15 personas)','quiz.q2c':'Empresa mediana (16-100)','quiz.q2d':'Empresa grande (más de 100)',
    'quiz.q3':'¿Qué presupuesto mensual tiene disponible?',
    'quiz.q3a':'Hasta COP $500.000','quiz.q3b':'Entre COP $500.000 y $2.000.000','quiz.q3c':'Entre COP $2.000.000 y $5.000.000','quiz.q3d':'Más de COP $5.000.000',
    'quiz.rh':'SU RECOMENDACIÓN','quiz.rs':'Según lo que nos contó:','quiz.cta':'Hablemos 30 minutos',
    /* Burbuja flotante de WhatsApp (una por espacio) */
    'wa.tip':'Hable con nosotros por WhatsApp',
    'wa.b0':'¿Su negocio necesita <em>software con IA</em>? Escríbanos.',
    'wa.b1':'¿No sabe por dónde empezar? <em>Hablemos.</em>',
    'wa.b2':'¿Quiere <em>aprender IA</em> en serio? Pregúntenos.',
    /* Etiquetas de las zonas laterales del carrusel */
    sl:['Software','Inicio','Educación'],
    /* Marquesinas por espacio */
    mq0:['Chat IA 24/7','CRM en español','Web a su nombre','Precios en pesos','Sin permanencia','Operando en 14 días'],
    mq1:['Hecho en Medellín','Precios en pesos','Todo a su nombre','Sin permanencia','Probado en producción','IA donde aporta'],
    mq2:['Curso en vivo con IA','Clases 1-a-1','Ciberseguridad','Formación para empresas','En español','Certificado'],
    /* Tiras de integraciones por espacio */
    il0:['WhatsApp','Instagram','Anthropic Claude','OpenAI GPT-4','Google Gemini','n8n','Make','Astro','Next.js','Supabase','Twilio'],
    il1:['Astro','Next.js','Hono','Drizzle','Supabase','WordPress','n8n','Cloudflare','Anthropic Claude','OpenAI GPT-4'],
    il2:['Claude Code','GitHub Copilot','Cursor','Python','JavaScript','Kali Linux','Burp Suite','OWASP','n8n','Git'],
  },
};

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
/* Megalanding: 3 direcciones, 3 cabezas. /software=0 · /inicio=1 · /educacion=2 (y / = intro).
   El servidor ya entrega la cabeza correcta activa; aquí solo se sincroniza el estado. */
const PATHS=['/software','/inicio','/educacion'];
const curPath=()=>location.pathname.replace(/\/$/,'')||'/';
const pathIdx=PATHS.indexOf(curPath());
let active=pathIdx<0?1:pathIdx, spinning=false, lang='es';
// Al girar el carrusel la barra de direcciones muestra la página real (no en «/», donde manda la intro)
// mismos títulos que entrega el servidor (apps/web/server/index.js · PAGES)
const TITLES=['Chatbot de WhatsApp, CRM con IA y Páginas Web para Pymes | Tr3sC3rb3r0','Tr3sC3rb3r0: Estudio de Software con IA en Medellín','Curso de Desarrollo con IA en Vivo y Formación para Empresas | Tr3sC3rb3r0'];
// ícono de la pestaña: lobo del color de la cabeza (en «/» con la intro, el de los tres colores)
function setIcon(i){const l=document.querySelector('link[rel="icon"]');if(l)l.href='/assets/icons/lobo-'+['azul','dorado','jade'][i]+'-32.png?v=2.1.0';}
function syncPath(hash){
  if(curPath()==='/'&&document.getElementById('intro')?.style.display!=='none')return;
  document.title=TITLES[active];
  setIcon(active);
  const url=PATHS[active]+location.search+(hash||'');
  if(location.pathname+location.search+location.hash!==url)history.replaceState(null,'',url);
}
const total=3;
const heads=document.querySelectorAll('.head');
const cis=document.querySelectorAll('.ci');
const colors=['#00C8FF','#FFB300','#39FF14'];
const colorsBg=colors;   // bordes: color pleno de marca (sin transparencia)
const bgTints=['rgba(0,200,255,.018)','rgba(255,179,0,.018)','rgba(57,255,20,.018)'];
const ACCENT_BASE={col:colors,bg:colorsBg,tint:bgTints,glow:bgTints.map(t=>t.replace('.018','.18'))};
// En claro los acentos se oscurecen para contraste AA (espejo de main.css :root[data-theme="light"] .head[data-h]).
const ACCENT={dark:ACCENT_BASE,light:{
  col:['#006e92','#8c5e00','#187500'],
  bg:['#006e92','#8c5e00','#187500'],
  tint:['rgba(0,110,146,.018)','rgba(140,94,0,.018)','rgba(24,117,0,.018)'],
  glow:['rgba(0,110,146,.18)','rgba(140,94,0,.18)','rgba(24,117,0,.18)']
}};
const isLightTheme=()=>document.documentElement.getAttribute('data-theme')==='light';
const accent=()=>ACCENT[isLightTheme()?'light':'dark'];

function state(i,a){return((i-a)+total)%total}

function go(dir){
  if(spinning)return;
  spinning=true;
  active=(active+dir+total)%total;
  resetScrolls();
  applyStates(dir);
  updateUI();
  syncPath();
  setTimeout(()=>spinning=false,1050);
}

function resetScrolls(){
  // con scroll suave (smooth.js) hay que avisarle a Lenis; si no, devuelve el panel a donde estaba
  heads.forEach(h=>h.t3Lenis?h.t3Lenis.scrollTo(0,{immediate:true,force:true}):h.scrollTo(0,0));
  document.querySelectorAll('.wolf-face').forEach(w=>w.style.setProperty('--wf-fade',1));
  document.querySelectorAll('.wdeco').forEach(w=>{w.style.setProperty('--wd-shift','0px');w.style.setProperty('--wf-fade',1);});
}
/* Fade wolf-face Y laterales + slide side wolves inward on internal scroll.
   Así los lobos se ven fuertes en el héroe y se desvanecen al entrar al contenido (no estorban el texto). */
heads.forEach(h=>h.addEventListener('scroll',()=>{
  // Piso .22 → los lobos NO desaparecen al escrollear, solo se aclaran (quedan de fondo tenue).
  const fade=Math.max(.22,1-Math.max(0,h.scrollTop-120)/500);
  document.querySelectorAll('.wolf-face.wa').forEach(w=>w.style.setProperty('--wf-fade',fade));
  const shift=Math.min(10,h.scrollTop/60)+'vw';
  document.querySelectorAll('.wdeco.wa').forEach(w=>{w.style.setProperty('--wd-shift',shift);w.style.setProperty('--wf-fade',fade);});
},{passive:true}));

function applyStates(dir){
  heads.forEach((h,i)=>{
    h.classList.remove('s-active','s-prev','s-next','spin-r','spin-l');
    if(i===active){
      const cls=dir>0?'spin-r':'spin-l';
      h.classList.add(cls);
      h.style.zIndex=25;
      h.addEventListener('animationend',()=>{
        h.classList.remove(cls);
        h.classList.add('s-active');
        h.style.zIndex='';
        setupObs(h);
      },{once:true});
    } else {
      const s=state(i,active);
      h.classList.add(s===0?'s-active':s===1?'s-next':'s-prev');
    }
  });
  cis.forEach((c,i)=>c.classList.toggle('on',i===active));
}

function updateUI(){
  const A=accent();
  const col=A.col[active];
  const colBg=A.bg[active];
  const tint=A.tint[active];
  const pi=(active-1+total)%total, ni=(active+1)%total;
  // Floating buttons (WhatsApp, quiz) heredan el color del landing activo
  document.body.style.setProperty('--a',col);
  document.body.style.setProperty('--ab',colBg);
  document.body.style.setProperty('--ag',A.glow[active]);
  document.body.style.setProperty('--at',tint);
  document.body.dataset.active=String(active);
  document.querySelector('.nlogo-a').style.color=col;
  document.getElementById('nCta').style.setProperty('--a',col);
  // Side zone labels heredan color del body --a (definido arriba) vía CSS.
  // Base de fondo = token de tema (var(--bg)), NO un dark hardcodeado.
  document.body.style.background=`linear-gradient(${tint},${tint}),var(--bg)`;
  const sl=C[lang].sl;
  document.getElementById('ph').textContent=`← ${sl[pi]}`;
  document.getElementById('nh').textContent=`${sl[ni]} →`;
  /* Wolf visibility — show only wolves for active head */
  document.querySelectorAll('.wdeco,.wolf-face').forEach(w=>w.classList.remove('wa'));
  document.querySelectorAll('.wh'+active).forEach(w=>w.classList.add('wa'));
  /* WhatsApp bubble — texto temático según landing */
  const wtxt=document.getElementById('waTipTxt');
  if(wtxt){
    const key='wa.b'+active;
    wtxt.innerHTML=(C[lang]&&C[lang][key])||C.es[key]||'';
  }
}

/* WhatsApp bubble — auto-show + dismiss persistente por sesión */
(function(){
  const tip=document.getElementById('waTip');
  if(!tip) return;
  const dismissed=()=>sessionStorage.getItem('waTipX')==='1';
  function show(){if(!dismissed())tip.classList.add('show');}
  function hide(){tip.classList.remove('show');}
  // Aparece tras 4s la primera vez
  setTimeout(show,4000);
  // Reaparece brevemente al cambiar landing
  let lastA=-1;
  setInterval(()=>{
    if(typeof active==='undefined')return;
    if(active!==lastA){
      lastA=active;
      if(lastA!==-1&&!dismissed()){hide();setTimeout(show,400);}
    }
  },300);
  document.getElementById('waTipX')?.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    hide();
    sessionStorage.setItem('waTipX','1');
  });
  // Click en el globo abre WA en nueva pestaña con contexto
  tip.addEventListener('click',e=>{
    if(e.target.id==='waTipX')return;
    const a=document.getElementById('waFloat');
    if(!a)return;
    if(typeof waUrl==='function')a.setAttribute('href',waUrl());
    window.open(a.getAttribute('href'),'_blank','noopener');
  });
})();

/* Indicator clicks — shortest-path direction */
cis.forEach((c,i)=>{
  c.addEventListener('click',()=>{
    if(i===active||spinning)return;
    const diff=((i-active)+total)%total;
    const dir=diff<=total/2?1:-1;
    active=i; spinning=true;
    resetScrolls(); applyStates(dir); updateUI(); syncPath();
    setTimeout(()=>spinning=false,1050);
  });
});

/* Side zone + button clicks */
document.getElementById('sz-p').addEventListener('click',()=>go(-1));
document.getElementById('sz-n').addEventListener('click',()=>go(1));
document.getElementById('pBtn').addEventListener('click',()=>go(-1));
document.getElementById('nBtn').addEventListener('click',()=>go(1));

/* Keyboard */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();return;}
  if(document.getElementById('modal').hidden===false)return;
  if(e.key==='ArrowRight'||e.key==='ArrowDown')go(1);
  if(e.key==='ArrowLeft'||e.key==='ArrowUp')go(-1);
});

/* MARQUEE */
function buildMQ(id,items){
  const el=document.getElementById(id); if(!el)return; let h='';
  for(let i=0;i<2;i++)items.forEach(x=>{h+=`<div class="mi">${x}<span class="d"></span></div>`;});
  el.innerHTML=h;
}

/* INTEGRATIONS */
function buildIntLogos(id,items){
  const el=document.getElementById(id); if(!el)return;
  el.innerHTML=items.map(x=>`<span class="int-logo">${x}</span>`).join('');
}

/* LANG — ES único (i18n EN eliminado). Mantenemos applyLang() para inicializar textos vía data-k. */
function applyLang(l){
  lang=l;
  const d=C[l];
  if(!d) return;
  document.querySelectorAll('[data-k]').forEach(el=>{if(d[el.dataset.k]!==undefined)el.innerHTML=d[el.dataset.k];});
  document.documentElement.lang=l;
  buildMQ('mq0',d.mq0); buildMQ('mq1',d.mq1); buildMQ('mq2',d.mq2);
  buildIntLogos('il0',d.il0); buildIntLogos('il1',d.il1); buildIntLogos('il2',d.il2);
  updateUI();
}

/* SCROLL REVEAL */
function setupObs(head){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');obs.unobserve(e.target);}});
  },{threshold:.1,root:head});
  head.querySelectorAll('.fu:not(.vis)').forEach(el=>obs.observe(el));
}

/* TOUCH SWIPE */
let touchX=0, touchY=0;
document.addEventListener('touchstart',e=>{
  touchX=e.touches[0].clientX;
  touchY=e.touches[0].clientY;
},{passive:true});
document.addEventListener('touchend',e=>{
  if(document.getElementById('modal').hidden===false)return;
  const dx=e.changedTouches[0].clientX-touchX;
  const dy=e.changedTouches[0].clientY-touchY;
  if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>50){go(dx<0?1:-1);}
},{passive:true});

/* Cursor: se usa el del sistema (el círculo que lo seguía se quitó: se sentía lento). */

/* ═══════════════════════════════════════════════
   CONTACT MODAL
═══════════════════════════════════════════════ */
const modal=document.getElementById('modal');
const moBox=document.getElementById('moBox');
const moForm=document.getElementById('moForm');
const moSuccess=document.getElementById('moSuccess');
const moClose=document.getElementById('moClose');
const moServiceName=document.getElementById('moServiceName');
const moBackdrop=document.getElementById('moBackdrop');

function openModal(){
  modal.hidden=false;
  // Apply active head accent (consciente del tema)
  const A=accent();
  moBox.style.setProperty('--a',A.col[active]);
  moBox.style.setProperty('--ab',A.bg[active]);
  moBox.style.borderColor=A.bg[active];
  document.querySelector('.mo-service .mo-dot').style.background=A.col[active];
  document.querySelector('.mo-service').style.color=A.col[active];
  moServiceName.textContent=lastContext||C[lang].sl[active];
  moForm.hidden=false;
  moSuccess.hidden=true;
  moForm.reset();
  // Focus first field
  setTimeout(()=>{const f=moForm.querySelector('input[name="name"]');if(f)f.focus();},100);
}

function closeModal(){
  modal.hidden=true;
}

moClose.addEventListener('click',closeModal);
/* Backdrop: prevenir cierre accidental por scroll/tap en móvil */
let _bdDown=null;
moBackdrop.addEventListener('pointerdown',e=>{_bdDown={x:e.clientX,y:e.clientY,t:Date.now()};});
moBackdrop.addEventListener('pointerup',e=>{
  if(!_bdDown)return;
  const dx=Math.abs(e.clientX-_bdDown.x), dy=Math.abs(e.clientY-_bdDown.y);
  const dt=Date.now()-_bdDown.t;
  if(dx<8 && dy<8 && dt<400) closeModal();
  _bdDown=null;
});

// Cualquier elemento con data-modal abre el formulario con ese contexto
// (mismo contrato que site-shell.js usa en /software y /educacion).
document.querySelectorAll('[data-modal]').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.preventDefault();
    setContext(btn.getAttribute('data-modal')||'');
    openModal();
  });
});
// Attach modal a los .bp genéricos (los .plan-cta se manejan aparte: pago manual → WhatsApp).
// Los <a class="bp"> con href real (/software, /educacion…) NAVEGAN, no abren modal.
document.querySelectorAll('.bp:not(.plan-cta):not(#moSubmit):not([data-modal])').forEach(btn=>{
  const href=btn.getAttribute&&btn.getAttribute('href');
  if(href)return;
  btn.addEventListener('click',e=>{
    e.preventDefault();
    setContext('');
    openModal();
  });
});
// Also nav CTA
document.getElementById('nCta').addEventListener('click',()=>{setContext('');openModal();});

// Handler ÚNICO de envío: valida → Web3Forms → redirige a /gracias (tracking) · fallback mailto.
moForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const data=new FormData(moForm);
  const name=data.get('name')?.trim();
  const email=data.get('email')?.trim();
  const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const nameField=moForm.querySelector('[name="name"]');
  const emailField=moForm.querySelector('[name="email"]');
  const flag=(f)=>{f.setAttribute('aria-invalid','true');f.style.borderColor='#ff4444';setTimeout(()=>{f.style.borderColor='';f.removeAttribute('aria-invalid');},2500);};
  let ok=true;
  if(!name){flag(nameField);ok=false;}
  if(!email||!emailRe.test(email)){flag(emailField);ok=false;}
  if(!ok)return;
  const service=C[lang].sl?.[active]||'General';
  const submitBtn=document.getElementById('moSubmit');
  const origText=submitBtn.textContent;
  submitBtn.disabled=true;submitBtn.textContent='Enviando…';
  // Web3Forms API (misma key que bundles.html)
  data.append('access_key','01e52190-ec4a-4e66-8af9-875f2e23a6c9');
  data.append('subject',`[Tr3sC3rb3r0] ${service} — ${name}`);
  data.append('from_name','Tr3sC3rb3r0 Landing');
  data.append('servicio',service);
  data.append('contexto',lastContext||'—');
  try{
    const r=await fetch('https://api.web3forms.com/submit',{method:'POST',body:data,headers:{'Accept':'application/json'}});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.success){
      // Redirige a /gracias con contexto → habilita tracking GA4/Clarity/Meta
      const planFromCtx=(lastContext||'').split(' · ')[0]||'';
      location.href=`/gracias.html?${new URLSearchParams({from:'form',service,plan:planFromCtx}).toString()}`;
      return;
    }
    throw new Error('API error');
  }catch(_){
    // Fallback: mailto si Web3Forms falla
    const message=data.get('message')||'—';
    const subject=`[Tr3sC3rb3r0] ${service} — ${name}`;
    const body=`Nombre: ${name}\nEmail: ${email}\nServicio: ${service}\n\nMensaje:\n${message}`;
    try{window.open(`mailto:hola@trescerbero.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);}catch(e2){}
    moForm.hidden=true;moSuccess.hidden=false;
  }finally{submitBtn.disabled=false;submitBtn.textContent=origText;}
});

/* ═══════════════════════════════════════════════
   PLANS — billing toggle + COP calc (TRM en vivo)
═══════════════════════════════════════════════ */
let TRM=3800; // fallback
let TRM_DATE='—';
let billMode='m';
let TRM_ESTIMATED=false;
async function fetchTRM(){
  const urls=[
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.json'
  ];
  for(const u of urls){
    try{
      const r=await fetch(u,{cache:'no-store'});
      if(!r.ok)continue;
      const j=await r.json();
      const cop=j?.usd?.cop;
      if(typeof cop==='number' && cop>1000){
        TRM=Math.round(cop);
        TRM_DATE=j.date||'hoy';
        TRM_ESTIMATED=false;
        updatePlanPrices();
        updateTRMBadge();
        return;
      }
    }catch(e){}
  }
  // Si ambas fallan, marcamos como estimado para indicar al usuario
  TRM_ESTIMATED=true;
  updateTRMBadge();
}
function updateTRMBadge(){
  document.querySelectorAll('.trm-rate').forEach(el=>{
    let txt='1 USD = $'+TRM.toLocaleString('es-CO')+' COP · '+TRM_DATE;
    if(TRM_ESTIMATED) txt+=' *';
    el.textContent=txt;
    el.title=TRM_ESTIMATED?'TRM estimado — verificar tasa actual antes de cobrar':'TRM en vivo';
  });
  if(typeof window.__roiCalc==='function') window.__roiCalc();
}
function updatePlanPrices(){
  document.querySelectorAll('.plan[data-usd-m], .bundle[data-usd-m], .preset-card[data-usd-m]').forEach(p=>{
    const usdM=parseFloat(p.dataset.usdM)||0;
    const usdY=parseFloat(p.dataset.usdY)||0;
    const usd=billMode==='m'?usdM:usdY;
    const cop=Math.round(usd*TRM);
    const suf=billMode==='m'?'/mes':'/año';
    const v=p.querySelector('.plan-price-val');
    const s=p.querySelector('.plan-price-suf');
    const c=p.querySelector('.plan-cop-val');
    if(v) v.textContent=usd.toLocaleString('en-US');
    if(s) s.textContent=suf;
    if(c) c.textContent=cop.toLocaleString('es-CO');
    // Bundle "old" prices (struck-through)
    const oldM=parseFloat(p.dataset.oldM)||0;
    const oldY=parseFloat(p.dataset.oldY)||0;
    if(oldM){
      const old=billMode==='m'?oldM:oldY;
      const oldCop=Math.round(old*TRM);
      const ou=p.querySelector('.bundle-old-usd');
      const oc=p.querySelector('.bundle-old-cop');
      if(ou) ou.textContent=old.toLocaleString('en-US');
      if(oc) oc.textContent=oldCop.toLocaleString('es-CO');
      // Preset cards
      const pv=p.querySelector('.preset-price-val');
      const pov=p.querySelector('.preset-old-val');
      if(pv) pv.textContent=usd.toLocaleString('en-US');
      if(pov) pov.textContent=old.toLocaleString('en-US');
    }
  });
}
document.querySelectorAll('.bt[data-bill]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    billMode=btn.dataset.bill;
    document.querySelectorAll('.bt[data-bill]').forEach(b=>b.classList.toggle('active',b.dataset.bill===billMode));
    updatePlanPrices();
  });
});
/* Stripe Payment Links — self-service para Start tiers (placeholders) */
const PAYMENT_LINKS={
  /* Vacíos a propósito: todavía no hay pasarela conectada, así que todo CTA de plan
     abre el formulario de contacto. Al conectar Wompi/Stripe, pegar aquí el link. */
};
/* Attach plan CTAs to modal (o pago directo si hay payment link) */
document.querySelectorAll('.plan-cta').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.preventDefault();
    const card=btn.closest('.plan,.bundle,.preset-card');
    const payKey=card?.dataset?.pay;
    if(payKey && PAYMENT_LINKS[payKey]){
      window.open(PAYMENT_LINKS[payKey],'_blank');
      return;
    }
    setContext(card?.dataset?.planName||'');   // el modal lleva el plan de ESTA tarjeta (antes mostraba el último usado)
    openModal();
  });
});

/* ═══════════════════════════════════════════════
   CONVERSION ENHANCEMENTS
═══════════════════════════════════════════════ */

/* Reduced motion preference + clase global para desactivar animaciones CSS */
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reducedMotion) document.documentElement.classList.add('no-motion');

/* Año dinámico en footers */
document.querySelectorAll('.hf-year').forEach(el=>el.textContent=new Date().getFullYear());

/* WhatsApp number — fuente única de verdad. Refactoriza href de todos los enlaces .wa-float al cargar */
const WA_NUMBER='573003000958';
function waLink(text){return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text||'Hola Tr3sC3rb3r0, vi su sitio web.')}`;}
document.querySelectorAll('.wa-float').forEach(el=>el.setAttribute('href',waLink()));

/* Service tabs (Software landing) */
document.querySelectorAll('.ptab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const tab=btn.dataset.tab;
    const parent=btn.closest('.plans-sec');
    if(!parent) return;
    parent.querySelectorAll('.ptab').forEach(b=>b.classList.toggle('active',b===btn));
    parent.querySelectorAll('.ptab-content').forEach(c=>c.classList.toggle('active',c.dataset.tab===tab));
    // Reveal fade-up elements within newly shown tab
    parent.querySelectorAll('.ptab-content.active .fu:not(.vis)').forEach(el=>el.classList.add('vis'));
    // Re-trigger counter animations if any new .sn appeared
    parent.querySelectorAll('.ptab-content.active .sn').forEach(el=>{ if(!el.dataset.animated){el.dataset.animated='1';animateCounter(el);} });
  });
});

/* Context-aware WhatsApp + modal pre-fill */
let lastContext='';
function setContext(name){lastContext=name;}
function waUrl(){
  const base='https://wa.me/573003000958';
  const services=['Software','Tr3sC3rb3r0','Educación'];
  const svc=services[active]||'Tr3sC3rb3r0';
  const ctx=lastContext?` · ${lastContext}`:'';
  const txt=encodeURIComponent(`Hola Tr3sC3rb3r0, vi su sitio web y quiero información sobre: ${svc}${ctx}`);
  return `${base}?text=${txt}`;
}
document.getElementById('waFloat')?.addEventListener('click',function(){
  this.setAttribute('href',waUrl());
});

/* ═════ Agendar sesión ═════
   La cuenta de Cal.com todavía no existe (cal.com/tr3sc3rb3r0 → 404), así que los
   botones de "agendar" abren el formulario de contacto con el contexto pre-cargado.
   Para volver al calendario: crear la cuenta y restaurar el popup de cal.com. */
function openCal(note){
  setContext(note ? `Sesión 30 min · ${note}` : 'Sesión 30 min');
  openModal();
}


/* Plan/bundle CTA — pago manual:
   • Plan precio fijo (Start/Pro/Growth) → WhatsApp directo con mensaje pre-armado.
   • Plan "Cotizar" (data-k="plan.ccustom") → modal con contexto, sirve para custom/MVP. */
document.querySelectorAll('.plan, .bundle').forEach(card=>{
  const cta=card.querySelector('.plan-cta');
  if(!cta) return;
  const isCustom=cta.dataset.k==='plan.ccustom'||card.dataset.pay==='dev-software';
  cta.addEventListener('click',e=>{
    e.preventDefault();
    const name=card.querySelector('.plan-name, .bundle-name')?.textContent?.trim()||'';
    const price=card.querySelector('.plan-price, .bundle-price')?.textContent?.trim()||'';
    // Si el plan está en un tab (Software/Web), incluir nombre del tab para más contexto
    const tab=card.closest('.ptab-content')?.querySelector?.bind(card.closest('.ptab-content'));
    let svc=C[lang].sl[active]||'Tr3sC3rb3r0';
    const tabBtn=tab?document.querySelector(`.plans-sec .ptab.active`):null;
    if(tabBtn) svc=`${svc} · ${tabBtn.textContent.trim()}`;
    setContext(`${name} · ${price}`);
    if(isCustom){
      // Custom → modal con contexto pre-llenado
      openModal();
      setTimeout(()=>{
        const msg=document.querySelector('#moForm textarea[name="message"]');
        if(msg && !msg.value) msg.value=`Plan: ${name}\nPrecio: ${price}\nServicio: ${svc}\n\nMi necesidad: `;
      },150);
      return;
    }
    // Precio fijo → WhatsApp directo en pestaña nueva
    const txt=lang==='en'
      ? `Hi Tr3sC3rb3r0, I want the ${name} plan for ${svc} (${price}). How do I proceed with payment?`
      : `Hola Tr3sC3rb3r0, quiero el plan ${name} de ${svc} (${price}). ¿Cómo procedo con el pago?`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(txt)}`,'_blank','noopener');
  });
});

/* Stat counter animation */
function animateCounter(el){
  const txt=el.textContent.trim();
  const match=txt.match(/([+−-]?)(\d+\.?\d*)(.*)/);
  if(!match) return;
  const prefix=match[1];
  const target=parseFloat(match[2]);
  const suffix=match[3];
  if(isNaN(target)||reducedMotion){return;}
  const dur=1200;
  const t0=performance.now();
  function step(t){
    const p=Math.min(1,(t-t0)/dur);
    const eased=1-Math.pow(1-p,3);
    const val=target*eased;
    const shown=target%1===0?Math.round(val):val.toFixed(1);
    el.textContent=prefix+shown+suffix;
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
const counterObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){animateCounter(e.target);counterObs.unobserve(e.target);}
  });
},{threshold:.4});
document.querySelectorAll('.sn').forEach(el=>counterObs.observe(el));

/* Stagger index for plan/bundle cards */
document.querySelectorAll('.plans-grid').forEach(g=>{
  [...g.children].forEach((c,i)=>c.style.setProperty('--idx',i));
});

/* Hero h1 word cascade — delay incremental por palabra (no por offset de char) */
document.querySelectorAll('.hh h1').forEach(h=>{
  if(h.dataset.wrapped) return;
  h.dataset.wrapped='1';
  const html=h.innerHTML;
  let wi=0;
  const wrapped=html.replace(/(<em>|<\/em>|<br>|<br\/>|<br \/>)|([^\s<]+)/g,(m,tag,word)=>{
    if(tag) return tag;
    if(word) return `<span class="w" style="animation-delay:${(wi++*0.08).toFixed(2)}s">${word}</span> `;
    return m;
  });
  h.innerHTML=wrapped;
});

/* Degradado de los 3 lobos en el <em> del hero (v3). background-clip:text sobre el <em>
   no atraviesa los .w animados (inline-block con transform), así que cada palabra lleva
   el degradado, dimensionado al ancho de la frase y corrido a su posición: se ve como un
   solo degradado continuo y la cascada de palabras sigue intacta. Medidas en layout
   (offsetLeft), no en rects, para no heredar el scale/transform del carrusel. */
function alignHeroGradient(){
  document.querySelectorAll('.hh h1 em').forEach(em=>{
    const ws=[...em.querySelectorAll('.w')];
    if(!ws.length) return;
    let l=Infinity,r=-Infinity;
    ws.forEach(w=>{l=Math.min(l,w.offsetLeft);r=Math.max(r,w.offsetLeft+w.offsetWidth);});
    if(!(r>l)) return; // cabeza oculta (sin layout): se recalcula al activarse
    ws.forEach(w=>{
      w.style.setProperty('--gw',(r-l)+'px');
      w.style.setProperty('--gx',(w.offsetLeft-l)+'px');
    });
  });
}
alignHeroGradient();
window.addEventListener('load',alignHeroGradient);
window.addEventListener('resize',()=>requestAnimationFrame(alignHeroGradient),{passive:true});
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(alignHeroGradient); // Bebas cambia el ancho
// Solo las 3 cabezas (cambian s-active/s-prev/s-next); el body no: cambia de clase con el cursor.
const gradMO=new MutationObserver(()=>requestAnimationFrame(alignHeroGradient));
document.querySelectorAll('.head').forEach(hd=>gradMO.observe(hd,{attributes:true,attributeFilter:['class']}));

/* (Envío del formulario unificado más arriba — un solo handler con validación + redirect a /gracias.) */

/* ═══════════════════════════════════════════════
   QUIZ — 3 preguntas → recomendación
═══════════════════════════════════════════════ */
const quiz={el:document.getElementById('quiz'),answers:{step:1,a1:null,a2:null,a3:null}};
function openQuiz(){quiz.answers={step:1,a1:null,a2:null,a3:null};showQuizStep(1);quiz.el.hidden=false;}
function closeQuiz(){quiz.el.hidden=true;}
function showQuizStep(n){
  document.querySelectorAll('.quiz-step').forEach(s=>s.classList.remove('active'));
  if(n==='result'){
    document.querySelector('.quiz-step[data-step="result"]').classList.add('active');
    renderQuizResult();
  } else {
    document.querySelector(`.quiz-step[data-step="${n}"]`).classList.add('active');
  }
  ['qp1','qp2','qp3'].forEach((id,i)=>{
    document.getElementById(id).classList.toggle('done',i<n||n==='result');
  });
}
function renderQuizResult(){
  const {a1,a2,a3}=quiz.answers;
  const recs={
    chat:{
      low:{name:'Chat IA · Start',price:'COP $304.000/mes · setup desde $3.000.000',reason:'Un canal (WhatsApp o web) atendido 24/7 con IA. Para menos de 500 consultas al mes.'},
      mid:{name:'Chat IA · Pro',price:'COP $760.000/mes · setup desde $5.700.000',reason:'Tres canales, modelo premium y RAG sobre su base de conocimiento. Operando en 14 días.'},
      high:{name:'Chat IA · Pro + L-IA CRM',price:'Chat Pro + CRM Pro · con descuento por combinar',reason:'El chatbot atiende al cliente final y el CRM organiza al equipo comercial.'},
      ent:{name:'Chat IA · A la medida',price:'Desde COP $1.520.000/mes · cotización por alcance',reason:'Volumen alto, agentes con acciones e integraciones con sus sistemas.'}
    },
    crm:{
      low:{name:'L-IA CRM · Básico',price:'COP $69.000 por usuario/mes',reason:'CRM completo en español, con chat de comandos y grafo de conocimiento. Para 1-3 vendedores.'},
      mid:{name:'L-IA CRM · Pro',price:'COP $199.000 por usuario/mes',reason:'Suma IA generativa: borradores de correo, resúmenes y siguiente mejor acción. Para 3-15 vendedores.'},
      high:{name:'L-IA CRM · Pro + Chat IA',price:'CRM Pro + Chat Pro · con descuento por combinar',reason:'El chat captura y califica, el CRM gestiona el pipeline. Todo conectado.'},
      ent:{name:'L-IA CRM · Max',price:'COP $599.000 por usuario/mes + su propia API key',reason:'Modelo avanzado, agentes con acciones y RAG sobre su histórico. Sin sobrecosto de IA.'}
    },
    digital:{
      low:{name:'Web',price:'Desde COP $1.800.000 por proyecto',reason:'Sitio profesional, rápido y a su nombre. Entrega en 1-2 semanas.'},
      mid:{name:'Web Pro / E-commerce',price:'Desde COP $5.000.000 por proyecto',reason:'Sitio a medida o tienda con pasarelas de pago y facturación. Entrega en 3-5 semanas.'},
      high:{name:'Software a la medida',price:'Desde COP $12.000.000 por proyecto',reason:'Aplicación o herramienta interna que resuelve su proceso, con el código a su nombre.'},
      ent:{name:'Software a la medida',price:'Desde COP $12.000.000 · cotización por alcance',reason:'Integraciones con sistemas existentes, automatizaciones y arquitectura escalable.'}
    },
    edu:{
      low:{name:'Educación · Clases 1-a-1',price:'Por hora o por paquete de sesiones',reason:'Aprenda desarrollo con IA o ciberseguridad a su ritmo, con acompañamiento directo.'},
      mid:{name:'Educación · Taller en vivo',price:'Cupo limitado · en vivo · queda grabado',reason:'Ingeniería con IA sobre código real: Claude Code, agentes y seguridad de lo generado.'},
      high:{name:'Educación · Asesoría para su empresa',price:'Diagnóstico + propuesta a la medida',reason:'Adopción de IA para pymes: capacitamos a su equipo con los procesos reales del negocio.'},
      ent:{name:'Educación · Formación corporativa',price:'Programa interno a la medida',reason:'Taller privado para su equipo: desarrollo con IA y ciberseguridad, con sus casos de uso.'}
    }
  };

  const map=recs[a1]||recs.digital;
  // Combinar presupuesto (a3) con tamaño de equipo (a2) para no recomendar el mismo tier
  // a un freelance y a una empresa de 100 personas.
  // Empresa grande + presupuesto medio → bump al tier alto (más volumen, más necesidad)
  // Solo/freelance + presupuesto alto → mantener mid (no overspend para un equipo chico)
  let budgetTier=a3;
  if(a2==='ent' && a3!=='ent') budgetTier='high';
  else if(a2==='solo' && a3==='high') budgetTier='mid';
  else if(a2==='solo' && a3==='ent') budgetTier='high';
  const rec=map[budgetTier]||map.mid;
  document.getElementById('qRecName').textContent=rec.name;
  document.getElementById('qRecPrice').textContent=rec.price;
  document.getElementById('qRecReason').textContent=rec.reason;
}
/* Hero inline CTAs — Reserva 30 min + No sé qué necesito (en cada landing) */
document.querySelectorAll('.hero-cal').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();openCal();}));
document.querySelectorAll('.hero-quiz').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();openQuiz();}));
document.getElementById('quizClose')?.addEventListener('click',closeQuiz);
document.getElementById('quizBg')?.addEventListener('click',closeQuiz);
document.querySelectorAll('.quiz-opt').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const step=btn.closest('.quiz-step').dataset.step;
    const v=btn.dataset.v;
    quiz.answers['a'+step]=v;
    if(step==='1') showQuizStep(2);
    else if(step==='2') showQuizStep(3);
    else if(step==='3') showQuizStep('result');
  });
});
document.getElementById('qRecCta')?.addEventListener('click',()=>{
  const rec=document.getElementById('qRecName')?.textContent||'';
  closeQuiz();
  setContext(rec);
  // Quiz ya calificó al lead → directo a Cal.com con nota pre-llenada
  openCal(`Quiz recomendó: ${rec}`);
});

/* ═══════════════════════════════════════════════
   INTRO SPLASH — selector inicial de landing
═══════════════════════════════════════════════ */
const introOriginalHTML=document.getElementById('intro')?.innerHTML||'';
/* Árbol de direcciones: / = intro de los 3 lobos (siempre) · /inicio = presentación
   (misma página sin intro) · /software · /educacion. Cada lobo lleva a su dirección. */
function routeIntro(idx){
  // Cada lobo entra a su cabeza (mismo morph, sin recargar) y la dirección pasa a /software, /inicio o /educacion
  dismissIntro(idx);
  history.replaceState(null,'',PATHS[idx]+location.search);
  document.title=TITLES[idx];
  setIcon(idx);
}
function bindIntroListeners(){
  document.querySelectorAll('.intro-tab').forEach(btn=>{
    btn.addEventListener('click',()=>routeIntro(parseInt(btn.dataset.go,10)));
  });
  document.getElementById('introSkip')?.addEventListener('click',()=>routeIntro(1));
  document.querySelector('.intro-head-l')?.addEventListener('click',()=>routeIntro(0));
  document.querySelector('.intro-head-c')?.addEventListener('click',()=>routeIntro(1));
  document.querySelector('.intro-head-r')?.addEventListener('click',()=>routeIntro(2));
}
function dismissIntro(targetIdx){
  const intro=document.getElementById('intro');
  if(!intro || intro.classList.contains('intro-out')) return;
  const idx=(typeof targetIdx==='number' && targetIdx>=0 && targetIdx<total)?targetIdx:active;
  if(idx!==active){
    const diff=((idx-active)+total)%total;
    const dir=diff<=total/2?1:-1;
    active=idx;
    applyStates(dir);
    updateUI();
  }
  intro.dataset.target=idx;
  intro.style.setProperty('--flash',colors[idx]);

  // MORPH: medir la posición del wolf-face del landing y mover la cabeza elegida hacia ahí
  const headSel=idx===0?'.intro-head-l':idx===1?'.intro-head-c':'.intro-head-r';
  const headEl=document.querySelector(headSel);
  const targetWolf=document.querySelector(`.head[data-h="${idx}"] .wolf-face`);
  if(headEl && targetWolf){
    // Swap a la versión "centro" para continuidad visual con el wolf-face del landing
    const wx=window.T3_WOLF_EXT||'avif';  // avif pre-renderizado; tv.js cambia a 'svg' si el navegador no soporta AVIF
    const centroSrcs=['Azul','Dorado','Jade'].map(n=>`/assets/heads/${n}%20centro.${wx}?v=2.1.0`);
    if(!headEl.src.includes('centro')) headEl.src=centroSrcs[idx];   // tríada: puede venir de perfil
    requestAnimationFrame(()=>{
      const hr=headEl.getBoundingClientRect();
      const wr=targetWolf.getBoundingClientRect();
      const dx=(wr.left+wr.width/2)-(hr.left+hr.width/2);
      const dy=(wr.top+wr.height/2)-(hr.top+hr.height/2);
      const scale=wr.height/hr.height;
      headEl.style.setProperty('--morph-x',dx.toFixed(1)+'px');
      headEl.style.setProperty('--morph-y',dy.toFixed(1)+'px');
      headEl.style.setProperty('--morph-scale',scale.toFixed(3));
      headEl.classList.add('intro-morph');
    });
  }

  intro.classList.add('intro-out');
  if(typeof stopIntroWords==='function') stopIntroWords();
  if(typeof stopPhraseRotation==='function') stopPhraseRotation();
  // Trigger landing entrance animation
  const targetHead=document.querySelector(`.head[data-h="${idx}"]`);
  if(targetHead){
    targetHead.classList.add('landing-enter');
    setTimeout(()=>targetHead.classList.remove('landing-enter'),1500);
  }
  setTimeout(()=>{intro.style.display='none';},1250);
}
function showIntro(){
  const intro=document.getElementById('intro');
  if(!intro) return;
  if(location.pathname!=='/')history.replaceState(null,'','/'+location.search);
  // Restaurar HTML para reiniciar animaciones
  intro.innerHTML=introOriginalHTML;
  intro.classList.remove('intro-out');
  intro.removeAttribute('data-target');
  intro.style.removeProperty('--flash');
  intro.style.display='';
  // Re-aplicar i18n al nuevo contenido
  if(typeof C!=='undefined' && C[lang]){
    intro.querySelectorAll('[data-k]').forEach(el=>{
      const v=C[lang][el.dataset.k];
      if(v!==undefined) el.innerHTML=v;
    });
  }
  bindIntroListeners();
  if(typeof startIntroWords==='function') startIntroWords();
  if(typeof startPhraseRotation==='function'){phraseIdx=0;startPhraseRotation();}
  // Re-aplicar WhatsApp href en floating button del intro (después de innerHTML reset)
  if(typeof waLink==='function') document.querySelectorAll('.wa-float').forEach(el=>el.setAttribute('href',waLink()));
}
document.querySelector('.nlogo')?.addEventListener('click',showIntro);
document.querySelector('.nlogo')?.addEventListener('mouseenter',()=>document.body.classList.add('ch'));
document.querySelector('.nlogo')?.addEventListener('mouseleave',()=>document.body.classList.remove('ch'));
bindIntroListeners();

/* Floating tech words orbitando las cabezas */
/* Palabras de la intro: cada lobo tiene las suyas, en su color, y aparecen de su lado.
   Al apuntar a un lobo (intro-fx.js pone window.T3_FOCUS) solo brotan las de ese lobo. */
const INTRO_WORDS={
  software:{c:'#00C8FF',landing:0,w:['WhatsApp','CRM','API','Chatbot','RAG','n8n','Next.js','Supabase','Automatización','Integraciones','Tiendas','Pagos','Factura DIAN','Webhooks','LLM','Multicanal']},
  inicio:{c:'#FFB300',landing:1,w:['Medellín','A su nombre','En pesos','Sin permanencia','Código suyo','14 días','Habeas Data','Precio cerrado','Pymes','Hecho en Colombia']},
  educacion:{c:'#39FF14',landing:2,w:['Claude Code','Agentes','Cursor','Python','Git','MCP','Prompting','Ciberseguridad','Copilot','Proyecto real','En vivo','Máx. 8 personas']}
};
let wordSpawner=null;
/* Máquina de escribir: cada letra aparece una a una; mientras se «teclea», el cursor es un símbolo raro.
   Al terminar queda la palabra completa. Funciona igual en horizontal y en vertical. */
const TYPE_GLYPHS='⟁⌬∆⋈◢◣⌇⎍⏚⌖⍜⍾⎔⏃⏁⌰⟟⟒⟊▓▒░#%&$@<>/{}[]01';
function typeWord(el,word){
  const rg=()=>TYPE_GLYPHS[Math.floor(Math.random()*TYPE_GLYPHS.length)];
  let k=0;
  el.textContent=rg();
  const iv=setInterval(()=>{
    if(!el.isConnected){clearInterval(iv);return;}
    k++;
    if(k>=word.length){el.textContent=word;clearInterval(iv);return;}
    el.textContent=word.slice(0,k)+rg()+(Math.random()<.5?rg():'');   // letras escritas + 1–2 símbolos al frente
  },55);
}
function spawnIntroWord(){
  const intro=document.getElementById('intro');
  const ctx=document.getElementById('introWords');
  if(!intro || !ctx || intro.classList.contains('intro-out') || intro.style.display==='none') return;
  if(reducedMotion) return;
  if(ctx.children.length>=6) return;   // tope: nunca más de 6 palabras vivas
  const groups=Object.keys(INTRO_WORDS);
  const f=window.T3_FOCUS;
  const g=typeof f==='number'?groups[f]:groups[Math.floor(Math.random()*groups.length)];
  const cfg=INTRO_WORDS[g];
  const word=cfg.w[Math.floor(Math.random()*cfg.w.length)];
  const el=document.createElement('button');
  el.className='iw';
  el.type='button';
  el.textContent=word;
  el.style.color=cfg.c;
  el.dataset.go=cfg.landing;
  el.dataset.g=cfg.landing;
  el.setAttribute('aria-label',`Ir a ${word}`);
  // Posición: zonas a los lados y arriba (evitar zona central baja del brand)
  const small=innerWidth<=640;
  if(small&&(Math.random()<.5||ctx.children.length>=4))return;   // celular: pocas palabras (máx. 4 a la vez)
  if(small){
    // celular: solo en la franja de arriba, chicas, sin pasar por encima de los lobos
    el.style.left=(Math.random()*44+4)+'%';     // lejos de «Saltar» (arriba a la derecha)
    el.style.top=(Math.random()*7+2)+'%';
    el.style.fontSize=(10+Math.random()*4)+'px';
  }else{
    // cada palabra brota del lado de su lobo (izq. software · centro inicio · der. educación)
    const L=cfg.landing,fs=12+Math.random()*13;
    el.style.fontSize=fs+'px';
    // 4 de cada 10 van en vertical (de arriba abajo): la columna debe caber en pantalla
    const vertical=Math.random()<.4;
    if(vertical){
      el.classList.add('iw-v');
      const lenPct=(word.length*fs*1.05)/innerHeight*100,maxTop=Math.max(6,92-lenPct);
      el.style.top=(Math.random()*(maxTop-4)+4)+'%';
      el.style.left=(L===0?(Math.random()*20+2):L===1?(Math.random()*24+38):(Math.random()*18+78))+'%';
    }else{
      // horizontal: el borde derecho deja sitio a la palabra completa
      const w=(word.length*fs*.8)/innerWidth*100,maxLeft=Math.max(4,96-w);
      const left=L===0?(Math.random()*22+2):L===1?(Math.random()*26+37):(Math.random()*20+70);
      el.style.left=Math.min(left,maxLeft)+'%';
      el.style.top=(Math.random()*55+5)+'%';
    }
  }
  el.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    routeIntro(cfg.landing);
  });
  // Cursor hover effect (reusa el sistema existente)
  el.addEventListener('mouseenter',()=>document.body.classList.add('ch'));
  el.addEventListener('mouseleave',()=>document.body.classList.remove('ch'));
  ctx.appendChild(el);
  typeWord(el,word);   // entra como máquina de escribir, con símbolos raros en la letra que se escribe
  setTimeout(()=>el.remove(),5800);
}
function startIntroWords(){
  if(wordSpawner) clearInterval(wordSpawner);
  // Menos palabras y más espaciadas (antes 8 de golpe + una cada 0,38 s): la intro respira y pesa menos
  for(let i=0;i<3;i++) setTimeout(spawnIntroWord,i*400+300);
  wordSpawner=setInterval(spawnIntroWord,1200);
}
function stopIntroWords(){
  if(wordSpawner) clearInterval(wordSpawner);
  wordSpawner=null;
}
startIntroWords();

/* Rotación de frases en el tagline del intro */
const INTRO_PHRASES=[
  "Software · Quiénes somos · Educación — tecnología hecha y enseñada en Medellín.",
  "Construimos tu software con IA — o te enseñamos a construirlo vos.",
  "Atendemos a tus clientes 24/7 con inteligencia artificial real.",
  "Organizamos tu equipo de ventas para que no pierdan deals en el Excel.",
  "Te enseñamos a desarrollar software con IA: Claude Code, agentes y más.",
  "Ciberseguridad en español: aprenda a construir con IA y a asegurar lo construido.",
  "Diseñamos webs rápidas en WordPress, Astro o código a la medida.",
  "Clases 1-a-1, cohortes en vivo y asesorías de IA para tu empresa.",
  "Hacemos que Google te encuentre cuando tus clientes te buscan."
];
let phraseIdx=0;
let phraseTimer=null;
function cycleIntroPhrase(){
  const tag=document.getElementById('introTag');
  const intro=document.getElementById('intro');
  if(!tag || !intro || intro.style.display==='none' || intro.classList.contains('intro-out')){
    if(phraseTimer){clearInterval(phraseTimer);phraseTimer=null;}
    return;
  }
  tag.style.opacity='0';
  tag.style.transform='translateY(-6px)';
  setTimeout(()=>{
    phraseIdx=(phraseIdx+1)%INTRO_PHRASES.length;
    tag.textContent=INTRO_PHRASES[phraseIdx];
    tag.style.opacity='';
    tag.style.transform='';
  },450);
}
function startPhraseRotation(){
  if(phraseTimer) clearInterval(phraseTimer);
  phraseTimer=setInterval(cycleIntroPhrase,4500);
}
function stopPhraseRotation(){
  if(phraseTimer){clearInterval(phraseTimer);phraseTimer=null;}
}
startPhraseRotation();

/* Cookies y analítica viven ahora en assets/js/analytics.js (lo cargan las 6 páginas públicas). */

/* IP-based currency hint — cache localStorage 7 días + cloudflare fallback (ilimitado) */
(function(){
  const KEY='tr3s_geo',TTL=7*24*60*60*1000;
  function applyGeo(country){
    document.body.dataset.geo=country;
    const latam=['CO','MX','AR','CL','PE','EC','UY','VE','BO','PY','CR','PA','DO','GT','SV','HN','NI'];
    document.body.dataset.region=latam.includes(country)?'latam':'intl';
  }
  try{
    const cached=JSON.parse(localStorage.getItem(KEY)||'null');
    if(cached && cached.country && Date.now()-cached.ts<TTL){applyGeo(cached.country);return;}
  }catch(_){}
  // Cloudflare trace: gratis, sin límite, retorna texto plano con loc=XX
  fetch('https://www.cloudflare.com/cdn-cgi/trace').then(r=>r.text()).then(txt=>{
    const m=txt.match(/loc=([A-Z]{2})/);
    const country=m?m[1]:'US';
    localStorage.setItem(KEY,JSON.stringify({country,ts:Date.now()}));
    applyGeo(country);
  }).catch(()=>{
    // Fallback: ipapi.co (1000/día free tier)
    fetch('https://ipapi.co/json/').then(r=>r.json()).then(d=>{
      const country=d?.country_code||'US';
      localStorage.setItem(KEY,JSON.stringify({country,ts:Date.now()}));
      applyGeo(country);
    }).catch(()=>{});
  });
})();

/* Intro: siempre en / (portada de los 3 lobos); en /inicio se entra directo a la presentación */
(function(){
  const intro=document.getElementById('intro');
  if(!intro) return;
  if(PATHS.includes(curPath())){
    intro.style.display='none';
    stopIntroWords();
  }
})();

/* Anclas entre cabezas: /inicio#software · #educacion · #inicio y cualquier id de sección (#precios,
   #faq-educacion…). Cambia a la cabeza que contiene el id (mismo giro que los botones laterales) y
   baja a la sección. Sustituye a las antiguas páginas /software, /educacion, /precios, /nosotros, /contacto. */
const HASH_HEAD={software:0,inicio:1,educacion:2};
function openHash(firstLoad){
  let id='';
  try{id=decodeURIComponent(location.hash.slice(1));}catch(e){return;}
  if(!id)return;
  const el=document.getElementById(id);
  // un servicio/curso (desplegable) se abre al llegar por su enlace: /software#crm
  if(el&&el.tagName==='DETAILS')el.open=true;
  else if(el&&el.closest('details.svc'))el.closest('details.svc').open=true;
  const head=el&&el.closest('.head');
  const idx=id in HASH_HEAD?HASH_HEAD[id]:(head?Number(head.dataset.h):-1);
  if(idx<0)return;
  const intro=document.getElementById('intro');
  // en «/» manda la intro; el hash solo actúa cuando ya no hay intro (p. ej. /inicio#educacion)
  if(intro&&intro.style.display!=='none'&&!intro.classList.contains('intro-out'))return;
  const scroll=()=>{
    const h=document.querySelector(`.head[data-h="${idx}"]`);
    if(!h)return;
    if(head&&el!==head){
      const top=el.getBoundingClientRect().top-h.getBoundingClientRect().top+h.scrollTop-90;
      h.t3Lenis?h.t3Lenis.scrollTo(top,{immediate:true,force:true}):h.scrollTo({top,behavior:'smooth'});
    }
  };
  if(idx!==active&&!spinning){
    const diff=((idx-active)+total)%total;
    const dir=diff<=total/2?1:-1;
    active=idx;spinning=true;
    resetScrolls();applyStates(dir);updateUI();syncPath(head&&el!==head?'#'+id:'');
    setTimeout(()=>{spinning=false;scroll();},firstLoad?60:1050);
  }else scroll();
}
window.addEventListener('hashchange',()=>openHash(false));
/* Enlaces a /software, /inicio y /educacion dentro de las cabezas: giran el carrusel en el mismo
   lugar (como las flechas laterales) en vez de recargar la página. Con Ctrl/⌘/Mayús o clic medio
   se abren como siempre. */
document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest&&e.target.closest('.head a[href]');if(!a||a.target==='_blank')return;
  let u;try{u=new URL(a.href,location.href);}catch(_){return;}
  if(u.origin!==location.origin)return;
  const idx=PATHS.indexOf(u.pathname.replace(/\/$/,''));
  if(idx<0)return;
  e.preventDefault();
  if(u.hash){location.hash=u.hash;if(idx===active)return;}
  if(idx===active){const h=document.querySelector(`.head[data-h="${idx}"]`);h&&(h.t3Lenis?h.t3Lenis.scrollTo(0,{immediate:true,force:true}):h.scrollTo({top:0,behavior:'smooth'}));return;}
  if(spinning)return;
  const diff=((idx-active)+total)%total,dir=diff<=total/2?1:-1;
  active=idx;spinning=true;resetScrolls();applyStates(dir);updateUI();syncPath();
  setTimeout(()=>spinning=false,1050);
});
if(PATHS.includes(curPath())&&location.hash)window.addEventListener('load',()=>setTimeout(()=>openHash(true),50));

/* Hint de carrusel (side zones) la primera vez */
(function(){
  if(localStorage.getItem('tr3s_carousel_hint')==='1') return;
  setTimeout(()=>{
    document.querySelectorAll('.sz').forEach(z=>z.classList.add('sz-hint'));
    setTimeout(()=>document.querySelectorAll('.sz').forEach(z=>z.classList.remove('sz-hint')),5000);
    localStorage.setItem('tr3s_carousel_hint','1');
  },2500);
})();

/* Pausar animaciones cuando el .head no está activo (perf en móvil) */
(function(){
  if(!('IntersectionObserver' in window)) return;
  const visObs=new IntersectionObserver(entries=>{
    entries.forEach(e=>e.target.style.animationPlayState=e.isIntersecting?'running':'paused');
  },{threshold:.15});
  document.querySelectorAll('.mt,.wdeco,.wolf-face').forEach(el=>visObs.observe(el));
})();

/* ═══════════════════════════════════════════════
   ROI CALCULATOR — Chat IA (Pro plan baseline)
═══════════════════════════════════════════════ */
(function roiCalc(){
  const root=document.getElementById('roiCalc');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const conv=$('roiConv'),cost=$('roiCost'),pct=$('roiPct');
  const PLAN_USD_M=200,SETUP_USD=1500; // Pro Chat IA
  const fmt=n=>Math.round(n).toLocaleString('es-CO');
  function calc(){
    const c=+conv.value,h=+cost.value,p=+pct.value;
    $('roiConvOut').textContent=fmt(c);
    $('roiCostOut').textContent='$'+fmt(h);
    $('roiPctOut').textContent=p+'%';
    const planM=PLAN_USD_M*TRM,setup=SETUP_USD*TRM;
    const saved=h*(p/100),netM=saved-planM;
    if(netM<=0){
      $('roiSavings').textContent='—';$('roiSavingsUsd').textContent='—';
      $('roiPayback').textContent='∞';$('roiYearly').textContent='—';
      root.classList.add('roi-neg');return;
    }
    root.classList.remove('roi-neg');
    $('roiSavings').textContent=fmt(netM);
    $('roiSavingsUsd').textContent=fmt(netM/TRM);
    $('roiPayback').textContent=(setup/netM).toFixed(1);
    $('roiYearly').textContent=((saved*12)/(planM*12+setup)).toFixed(1)+'×';
  }
  [conv,cost,pct].forEach(el=>el.addEventListener('input',calc));
  window.__roiCalc=calc;
  calc();
})();

/* ═══════════════════════════════════════════════
   THEME TOGGLE (claro/oscuro)
   El tema inicial ya lo fija el script anti-FOUC del <head>.
   Aquí solo: click manual (persiste) + seguir el SO si el user no eligió.
═══════════════════════════════════════════════ */
(function themeToggle(){
  const root=document.documentElement;
  const btn=document.getElementById('themeToggle');
  const KEY='t3-theme';
  const set=(t,persist)=>{
    root.setAttribute('data-theme',t==='light'?'light':'dark');
    if(persist){try{localStorage.setItem(KEY,t);}catch(e){}}
    if(btn)btn.setAttribute('aria-pressed',t==='light');
    // Re-aplica acentos/fondo inline del body con la paleta del nuevo tema.
    if(typeof updateUI==='function')updateUI();
  };
  if(btn)btn.addEventListener('click',()=>{
    const next=root.getAttribute('data-theme')==='light'?'dark':'light';
    set(next,true);
  });
  // Si el user nunca eligió, seguir cambios del sistema en vivo.
  const mq=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)');
  if(mq&&mq.addEventListener)mq.addEventListener('change',e=>{
    let saved;try{saved=localStorage.getItem(KEY);}catch(_){}
    if(saved!=='light'&&saved!=='dark')set(e.matches?'light':'dark',false);
  });
})();

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
applyLang('es');
setupObs(heads[1]);
updatePlanPrices();
fetchTRM();
