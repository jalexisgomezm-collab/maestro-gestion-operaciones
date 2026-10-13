import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cbguxckfkaxytgzxvpxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yx0C0-9u7_Z4FsfkFRPm8g__2FsSEf4';
const OC_APP = 'https://gto-oc-sistema-app.vercel.app';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');

// ---------- utilidades ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fdate = (d) => d ? d.split('T')[0].split('-').reverse().join('/') : '—';
const money = (n, m) => n == null || n === '' ? '—' : (m === 'DOLARES' ? 'US$ ' : 'S/ ') + Number(n).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});
const val = (v) => (v === '' || v === undefined) ? null : v;
const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : null;
const linkOrText = (txt, url) => { const s = safeUrl(url); return txt || s ? (s ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(txt || 'Ver')}</a>` : esc(txt)) : '—'; };
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }

const EST_COM = { EN_EVALUACION:'En evaluación', PENDIENTE_OC:'Pendiente emisión OC', CON_OC:'Con OC cliente', CON_OT:'Sin OC · con OT', DEVUELTO:'Devuelto' };
const EST_OP = { POR_INICIAR:'Por iniciar', EN_PROCESO:'En proceso', TERMINADO:'Terminado', ENTREGADO:'Entregado' };
const EST_COBRO = { PENDIENTE:'Por cobrar', PARCIAL:'Cobro parcial', COBRADO:'Cobrado', ANULADA:'Anulada' };
const TIPOS = ['REPARACION','MANTENIMIENTO','DIAGNOSTICO','FABRICACION','VENTA','OTRO'];
const TIPOS_PI = { MANTENIMIENTO:'Mantenimiento interno', LEVANTAMIENTO:'Levantamiento de información', MEJORA:'Mejora / implementación', SEGURIDAD:'Seguridad / SST', CAPACITACION:'Capacitación', INFRAESTRUCTURA:'Infraestructura / taller', OTRO:'Otro' };
const badge = (cls, txt) => `<span class="badge b-${esc(cls)}">${esc(txt)}</span>`;

// ---------- estado ----------
let session = null;
let filtro = { clase: 'SERVICIO', estado: 'TODOS', q: '', verCerrados: false };

// ---------- modal genérico de formulario ----------
function field(f, data){
  const v = data?.[f.k] ?? f.def ?? '';
  if (f.sec) return `<div class="fsec">${esc(f.sec)}</div>`;
  let inp;
  if (f.t === 'select') inp = `<select name="${f.k}">${f.opts.map(([o,l]) => `<option value="${esc(o)}" ${String(o)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  else if (f.t === 'area') inp = `<textarea name="${f.k}" rows="3">${esc(v)}</textarea>`;
  else inp = `<input name="${f.k}" type="${f.t||'text'}" ${f.t==='number'?'step="any"':''} value="${esc(v)}" ${f.req?'required':''} placeholder="${esc(f.ph||'')}"${f.list?` list="dl-${f.k}" autocomplete="off"`:''}>${f.list?`<datalist id="dl-${f.k}"></datalist>`:''}`;
  return `<label class="f ${f.full?'full':''}"><span>${esc(f.l)}${f.req?' *':''}</span>${inp}</label>`;
}
function formModal({ title, fields, data, onSave, extra = '' }){
  return new Promise(resolve => {
    $modal.innerHTML = `<div class="ov"><form class="modal" novalidate>
      <header><h2>${esc(title)}</h2><button type="button" class="link" data-x>✕</button></header>
      <div class="body"><div class="fgrid">${fields.map(f => field(f, data)).join('')}</div>${extra}<div class="err" hidden></div></div>
      <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Guardar</button></footer>
    </form></div>`;
    const form = $modal.querySelector('form');
    const close = () => { $modal.innerHTML=''; resolve(false); };
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = close);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields) if (f.k) {
        let v = form.elements[f.k].value.trim();
        if (f.req && !v) { showErr(`Completa: ${f.l}`); return; }
        out[f.k] = f.t === 'number' ? (v === '' ? null : Number(v)) : val(v);
      }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Guardando…';
      try { await onSave(out, form); $modal.innerHTML=''; resolve(true); }
      catch(err){ showErr(err.message || String(err)); btn.disabled=false; btn.textContent='Guardar'; }
    };
    function showErr(m){ const e=form.querySelector('.err'); e.hidden=false; e.textContent=m; }
  });
}
function confirmModal(msg){
  return new Promise(resolve => {
    $modal.innerHTML = `<div class="ov"><div class="modal" style="max-width:420px">
      <div class="body">${esc(msg)}</div>
      <footer><button data-n>Cancelar</button><button class="pri" data-y>Confirmar</button></footer></div></div>`;
    $modal.querySelector('[data-n]').onclick = () => { $modal.innerHTML=''; resolve(false); };
    $modal.querySelector('[data-y]').onclick = () => { $modal.innerHTML=''; resolve(true); };
  });
}
const chk = ({ error, data }) => { if (error) throw new Error(error.message); return data; };

// ---------- login ----------
function renderLogin(){
  $app.innerHTML = `<form class="login">
    <h1>Maestro de Gestión</h1><div class="sub">GTO PERU · Operaciones</div>
    <label class="f"><span>Correo</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="f"><span>Contraseña</span><input name="pass" type="password" autocomplete="current-password" required></label>
    <button class="pri" type="submit">Ingresar</button>
    <div class="err" hidden></div>
    <p class="small" style="margin-top:14px">Usa el mismo usuario del sistema de órdenes de compra.</p>
  </form>`;
  const f = $app.querySelector('form');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.pass.value });
    if (error) { const el=f.querySelector('.err'); el.hidden=false; el.textContent='Correo o contraseña incorrectos.'; }
  };
}

function shell(inner){
  return `<header class="top"><a href="#/" class="brand" style="color:#fff">GTO PERU · <span>Maestro de Gestión</span></a>
    <div class="sp"></div>
    <a href="${OC_APP}" target="_blank" rel="noopener" style="color:#cbd5e1;font-size:13px">Sistema OC ↗</a>
    <span class="user">${esc(session?.user?.email)}</span>
    <button class="sm" id="logout">Salir</button></header><main>${inner}</main>`;
}
function bindShell(){ const b=document.getElementById('logout'); if(b) b.onclick = () => sb.auth.signOut(); }

// ---------- lista ----------
async function renderLista(){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  const esPI = filtro.clase === 'INTERNO';
  const [pr, fa, co, gu, oc, so] = await Promise.all([
    sb.from('proyectos').select('*').order('created_at', { ascending:false }),
    sb.from('proyecto_facturas').select('proyecto_id,monto,monto_cobrado,estado_cobro,moneda'),
    sb.from('proyecto_componentes').select('proyecto_id'),
    sb.from('proyecto_guias').select('proyecto_id,tipo'),
    sb.from('ordenes_compra').select('proyecto_id,total,moneda,estado').not('proyecto_id','is',null),
    sb.from('solicitudes_pedido').select('proyecto_id').not('proyecto_id','is',null),
  ]);
  if (pr.error) { $app.querySelector('main').innerHTML = `<div class="err">${esc(pr.error.message)}</div>`; return; }
  const by = (arr) => (arr.data||[]).reduce((m,r)=>{(m[r.proyecto_id] ||= []).push(r); return m;}, {});
  const F=by(fa), C=by(co), G=by(gu), O=by(oc), S=by(so);
  const deClase = pr.data.filter(p => (p.clase || 'SERVICIO') === filtro.clase);
  const nSrv = pr.data.filter(p => (p.clase || 'SERVICIO') === 'SERVICIO' && p.estado === 'activo').length;
  const nPI = pr.data.filter(p => p.clase === 'INTERNO' && p.estado === 'activo').length;
  const activos = deClase.filter(p => p.estado === 'activo');
  const q = filtro.q.toLowerCase();
  const campoEstado = esPI ? 'estado_operativo' : 'estado_comercial';
  const rows = deClase.filter(p =>
    (filtro.verCerrados || p.estado === 'activo') &&
    (filtro.estado === 'TODOS' || p[campoEstado] === filtro.estado) &&
    (!q || [p.nombre,p.cliente,p.responsable,p.numero_oc_cliente,p.numero_orden_trabajo,p.numero_cotizacion,p.numero_informe,p.descripcion].some(x => (x||'').toLowerCase().includes(q))));
  const kpi = (k, n, l) => `<div class="kpi ${filtro.estado===k?'sel':''}" data-k="${k}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const count = (campo, k) => activos.filter(p => p[campo] === k).length;
  const switcher = `<div class="seg"><button data-clase="SERVICIO" class="${!esPI?'on':''}">Servicios a clientes · OT <span class="cnt">${nSrv}</span></button><button data-clase="INTERNO" class="${esPI?'on':''}">Proyectos internos · PI <span class="cnt">${nPI}</span></button></div>`;
  let kpis, thead, filas, estados, sub;

  if (!esPI) {
    let porCobrarS=0, porCobrarD=0;
    (fa.data||[]).forEach(f => { if (f.estado_cobro==='PENDIENTE'||f.estado_cobro==='PARCIAL'){ const s=Number(f.monto||0)-Number(f.monto_cobrado||0); f.moneda==='DOLARES'?porCobrarD+=s:porCobrarS+=s; } });
    const cobro = (id) => {
      const fs = (F[id]||[]).filter(f => f.estado_cobro !== 'ANULADA');
      if (!fs.length) return badge('NOFACT','Sin factura');
      if (fs.every(f => f.estado_cobro==='COBRADO')) return badge('COBRADO','Cobrado');
      if (fs.some(f => f.estado_cobro==='PARCIAL' || f.estado_cobro==='COBRADO')) return badge('PARCIAL','Parcial');
      return badge('PENDIENTE','Por cobrar');
    };
    sub = 'Servicios a clientes: con OC del cliente, en evaluación, pendientes de OC o trabajando con OT.';
    estados = EST_COM;
    kpis = `${kpi('TODOS', activos.length, 'Servicios activos')}
      ${kpi('EN_EVALUACION', count('estado_comercial','EN_EVALUACION'), 'En evaluación')}
      ${kpi('PENDIENTE_OC', count('estado_comercial','PENDIENTE_OC'), 'Pendiente emisión OC')}
      ${kpi('CON_OC', count('estado_comercial','CON_OC'), 'Con OC cliente')}
      ${kpi('CON_OT', count('estado_comercial','CON_OT'), 'Sin OC · con OT')}
      ${kpi('DEVUELTO', count('estado_comercial','DEVUELTO'), 'Devuelto')}
      <div class="kpi" style="cursor:default"><div class="n" style="font-size:16px;line-height:1.5">${money(porCobrarS,'SOLES')}${porCobrarD?`<br>${money(porCobrarD,'DOLARES')}`:''}</div><div class="l">Facturado por cobrar</div></div>`;
    thead = '<th>OT</th><th>Servicio / Cliente</th><th>Estado</th><th>OC cliente</th><th>Cotización</th><th>Informe</th><th>Comp.</th><th>Guías E/S</th><th>Req. / OC</th><th>Cobranza</th>';
    filas = rows.map(p => {
      const g = G[p.id]||[]; const ge=g.filter(x=>x.tipo==='ENTRADA').length, gs=g.filter(x=>x.tipo==='SALIDA').length;
      return `<tr class="click" data-id="${p.id}">
        <td class="mono" style="font-weight:500;white-space:nowrap">${esc(p.numero_orden_trabajo||'—')}</td>
        <td><div style="font-weight:500">${esc(p.nombre)}</div><div class="small">${esc(p.cliente||'Sin cliente')}${p.estado!=='activo'?` · ${esc(p.estado)}`:''}</div></td>
        <td>${badge(p.estado_comercial, EST_COM[p.estado_comercial])}<div style="margin-top:4px">${badge('op', EST_OP[p.estado_operativo])}</div></td>
        <td class="mono">${esc(p.numero_oc_cliente||'—')}</td>
        <td class="mono">${esc(p.numero_cotizacion||'—')}</td>
        <td class="mono">${esc(p.numero_informe||'—')}</td>
        <td class="mono">${(C[p.id]||[]).length}</td>
        <td class="mono">${ge} / ${gs}</td>
        <td class="mono">${(S[p.id]||[]).length} / ${(O[p.id]||[]).length}</td>
        <td>${cobro(p.id)}</td></tr>`; }).join('');
  } else {
    const gastoTot = gastoPorMoneda(activos.flatMap(p => O[p.id]||[]));
    const presTot = activos.reduce((m,p) => { if (p.presupuesto) m[p.moneda||'SOLES'] = (m[p.moneda||'SOLES']||0) + Number(p.presupuesto); return m; }, {});
    sub = 'Proyectos internos de GTO (mantenimiento, levantamiento de información, mejoras…): sin fin comercial, con control de lo invertido.';
    estados = EST_OP;
    kpis = `${kpi('TODOS', activos.length, 'Proyectos activos')}
      ${kpi('POR_INICIAR', count('estado_operativo','POR_INICIAR'), 'Por iniciar')}
      ${kpi('EN_PROCESO', count('estado_operativo','EN_PROCESO'), 'En proceso')}
      ${kpi('TERMINADO', count('estado_operativo','TERMINADO'), 'Terminados')}
      <div class="kpi" style="cursor:default"><div class="n" style="font-size:16px;line-height:1.5">${montos(presTot)}</div><div class="l">Presupuesto (activos)</div></div>
      <div class="kpi" style="cursor:default"><div class="n" style="font-size:16px;line-height:1.5">${montos(gastoTot)}</div><div class="l">Invertido en OC (activos)</div></div>`;
    thead = '<th>PI</th><th>Proyecto / Responsable</th><th>Tipo</th><th>Estado</th><th style="text-align:right">Presupuesto</th><th style="text-align:right">Invertido (OC)</th><th>Avance del gasto</th><th>Req. / OC</th>';
    filas = rows.map(p => {
      const gasto = gastoPorMoneda(O[p.id]||[]), mon = p.moneda || 'SOLES';
      return `<tr class="click" data-id="${p.id}">
        <td class="mono" style="font-weight:500;white-space:nowrap">${esc(p.numero_orden_trabajo||'—')}</td>
        <td><div style="font-weight:500">${esc(p.nombre)}</div><div class="small">${esc(p.responsable||'Sin responsable')}${p.estado!=='activo'?` · ${esc(p.estado)}`:''}</div></td>
        <td>${badge('pi', TIPOS_PI[p.tipo] || p.tipo || '—')}</td>
        <td>${badge('op', EST_OP[p.estado_operativo])}</td>
        <td class="money">${p.presupuesto!=null ? money(p.presupuesto, mon) : '—'}</td>
        <td class="money">${montos(gasto)}</td>
        <td style="min-width:130px">${barraGasto(p.presupuesto, gasto[mon]||0, gasto)}</td>
        <td class="mono">${(S[p.id]||[]).length} / ${(O[p.id]||[]).length}</td></tr>`; }).join('');
  }

  $app.querySelector('main').innerHTML = `
    ${switcher}
    <div class="row" style="justify-content:space-between">
      <div><h1>${esPI ? 'Proyectos internos' : 'Servicios a clientes'}</h1><div class="sub">${sub}</div></div>
      <button class="pri" id="nuevo">${esPI ? '+ Nuevo proyecto interno' : '+ Nuevo servicio'}</button>
    </div>
    <div class="kpis">${kpis}</div>
    <div class="panel">
      <div class="toolbar">
        <input type="search" id="q" placeholder="${esPI ? 'Buscar PI, proyecto, responsable…' : 'Buscar cliente, OC, OT, cotización, informe…'}" value="${esc(filtro.q)}">
        <select id="est"><option value="TODOS">Todos los estados</option>${Object.entries(estados).map(([k,l])=>`<option value="${k}" ${filtro.estado===k?'selected':''}>${l}</option>`).join('')}</select>
        <label class="small row" style="gap:6px"><input type="checkbox" id="cer" style="width:auto" ${filtro.verCerrados?'checked':''}> Ver finalizados / cancelados</label>
        <div style="flex:1"></div><span class="small">${rows.length} registro(s)</span>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr>${thead}</tr></thead>
        <tbody>${filas || `<tr><td colspan="10" class="empty">No hay registros con este filtro. Crea el primero con el botón de arriba; el número (${esPI?'PI':'OT'}) se asigna solo.</td></tr>`}</tbody></table></div>
    </div>`;
  document.getElementById('nuevo').onclick = () => editarServicio(null);
  $app.querySelectorAll('.seg [data-clase]').forEach(b => b.onclick = () => { if (filtro.clase !== b.dataset.clase) { filtro.clase = b.dataset.clase; filtro.estado = 'TODOS'; renderLista(); } });
  document.getElementById('q').oninput = (e) => { filtro.q = e.target.value; clearTimeout(window._qt); window._qt=setTimeout(()=>{ renderLista().then(()=>{ const i=document.getElementById('q'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); }); },250); };
  document.getElementById('est').onchange = (e) => { filtro.estado = e.target.value; renderLista(); };
  document.getElementById('cer').onchange = (e) => { filtro.verCerrados = e.target.checked; renderLista(); };
  $app.querySelectorAll('.kpi[data-k]').forEach(k => k.onclick = () => { filtro.estado = k.dataset.k; renderLista(); });
  $app.querySelectorAll('tr[data-id]').forEach(r => r.onclick = () => location.hash = `#/servicio/${r.dataset.id}`);
}
// Suma de OC (no anuladas) por moneda
function gastoPorMoneda(ocs){ return ocs.filter(o => o.estado !== 'anulada').reduce((m,o) => { const k = o.moneda || 'SOLES'; m[k] = (m[k]||0) + Number(o.total||0); return m; }, {}); }
function montos(m){ const e = Object.entries(m).filter(([,v]) => v); return e.length ? e.map(([k,v]) => money(v,k)).join('<br>') : money(0,'SOLES'); }
function barraGasto(pres, gastado, todo){
  if (!pres) return '<span class="small">Sin presupuesto</span>';
  const pct = Math.round(gastado / Number(pres) * 100), otras = Object.keys(todo).length > 1;
  return `<div class="bar ${pct>100?'over':pct>=80?'warn':''}"><span style="width:${Math.min(pct,100)}%"></span></div><div class="small">${pct}% del presupuesto${otras?' · hay OC en otra moneda':''}</div>`;
}

// ---------- formulario de servicio ----------
const SERV_FIELDS = [
  { sec:'Datos del servicio' },
  { k:'nombre', l:'Nombre del servicio', req:true, full:true, ph:'Ej. Reparación de tarjeta controladora 930E' },
  { k:'cliente', l:'Cliente', list:true, ph:'Escribe o elige de la lista del cotizador' },
  { k:'tipo', l:'Tipo', t:'select', opts: TIPOS.map(t=>[t,t.charAt(0)+t.slice(1).toLowerCase()]), def:'REPARACION' },
  { k:'responsable', l:'Responsable' },
  { k:'estado_operativo', l:'Estado operativo', t:'select', opts:Object.entries(EST_OP), def:'POR_INICIAR' },
  { k:'descripcion', l:'Descripción / alcance', t:'area', full:true },
  { sec:'Situación comercial' },
  { k:'numero_oc_cliente', l:'N° OC del cliente (si ya la tiene)' },
  { k:'estado_comercial', l:'Estado comercial', t:'select', opts:Object.entries(EST_COM), def:'EN_EVALUACION' },
  { k:'fecha_oc_cliente', l:'Fecha OC cliente', t:'date' },
  { k:'moneda', l:'Moneda', t:'select', opts:[['SOLES','Soles'],['DOLARES','Dólares']], def:'SOLES' },
  { k:'monto_servicio', l:'Monto del servicio (sin IGV)', t:'number' },
  { k:'fecha_inicio', l:'Fecha de inicio', t:'date' },
  { k:'fecha_entrega', l:'Fecha de entrega', t:'date' },
  { sec:'Documentos vinculados' },
  { k:'numero_cotizacion', l:'N° Cotización', list:true, ph:'Elige de la lista del cotizador' },
  { k:'enlace_cotizacion', l:'Enlace a la cotización (opcional)', ph:'https://…' },
  { k:'numero_informe', l:'N° Informe técnico' },
  { k:'enlace_informe', l:'Enlace al informe (opcional)', ph:'https://…' },
  { k:'estado', l:'Estado del registro', t:'select', opts:[['activo','Activo'],['finalizado','Finalizado'],['cancelado','Cancelado']], def:'activo' },
  { k:'observaciones', l:'Observaciones', t:'area', full:true },
];
const PI_FIELDS = [
  { sec:'Datos del proyecto interno' },
  { k:'nombre', l:'Nombre del proyecto', req:true, full:true, ph:'Ej. Mantenimiento preventivo de banco de pruebas' },
  { k:'tipo', l:'Tipo', t:'select', opts:Object.entries(TIPOS_PI), def:'MANTENIMIENTO' },
  { k:'responsable', l:'Responsable' },
  { k:'estado_operativo', l:'Estado', t:'select', opts:Object.entries(EST_OP), def:'POR_INICIAR' },
  { k:'estado', l:'Estado del registro', t:'select', opts:[['activo','Activo'],['finalizado','Finalizado'],['cancelado','Cancelado']], def:'activo' },
  { k:'descripcion', l:'Objetivo / alcance', t:'area', full:true, ph:'Qué se busca mejorar o resolver dentro de la empresa' },
  { sec:'Presupuesto y fechas' },
  { k:'moneda', l:'Moneda', t:'select', opts:[['SOLES','Soles'],['DOLARES','Dólares']], def:'SOLES' },
  { k:'presupuesto', l:'Presupuesto estimado (opcional)', t:'number' },
  { k:'fecha_inicio', l:'Fecha de inicio', t:'date' },
  { k:'fecha_entrega', l:'Fecha estimada de término', t:'date' },
  { k:'observaciones', l:'Observaciones', t:'area', full:true },
];
// Listas del cotizador (solo lectura, en vivo): sirven para autocompletar el formulario.
let cacheCot = null;
async function listasCotizador(){
  if (cacheCot && Date.now() - cacheCot.t < 5*60*1000) return cacheCot;
  const [c, q] = await Promise.all([sb.rpc('cotizador_clientes'), sb.rpc('cotizador_cotizaciones')]);
  if (c.error && q.error) throw new Error(c.error.message);
  cacheCot = { t: Date.now(), clientes: c.data || [], cotizaciones: q.data || [] };
  return cacheCot;
}
const monedaCot = (sim) => /US|\$/.test(sim || '') && !/S\//.test(sim || '') ? 'DOLARES' : 'SOLES';
const ESTADO_COT = { generada:'Generada', enviada:'Enviada', aprobada:'Aprobada', aceptada:'Aceptada', rechazada:'Rechazada', anulada:'Anulada', vencida:'Vencida' };
const textoActividades = (q) => (q.actividades || []).map(a => '• ' + String(typeof a === 'string' ? a : (a?.descripcion || a?.nombre || '')).trim()).filter(x => x.length > 2).join('\n');
// Al elegir una cotización: completa cliente, nombre, alcance, moneda, monto y PDF (sin pisar lo que ya escribiste)
function aplicarCotizacion(form, q){
  const f = form.elements, hechos = [];
  const poner = (k, v, siempre = false) => {
    if (v == null || v === '' || !f[k]) return;
    if (siempre || !String(f[k].value || '').trim() || f[k].dataset.auto === '1') { f[k].value = v; f[k].dataset.auto = '1'; hechos.push(k); }
  };
  poner('cliente', q.cliente, true);
  poner('enlace_cotizacion', q.pdf_url, true);
  poner('nombre', q.referencia || (q.actividades?.length ? String(q.actividades[0]).replace(/\.$/, '') : ''));
  poner('descripcion', textoActividades(q));
  poner('moneda', monedaCot(q.moneda), true);
  poner('monto_servicio', q.subtotal != null ? Number(q.subtotal).toFixed(2) : '');
  return hechos;
}
const NOMBRE_CAMPO = { cliente:'cliente', enlace_cotizacion:'PDF', nombre:'nombre', descripcion:'alcance', moneda:'moneda', monto_servicio:'monto' };

async function editarServicio(p){
  if ((p?.clase || filtro.clase) === 'INTERNO') return editarInterno(p);
  const ot = p?.numero_orden_trabajo;
  const extra = `<div class="small" id="cotmsg" style="margin-top:10px">Cargando listas del cotizador…</div><div class="ot-box">${ot ? `Orden de trabajo: <b class="mono">${esc(ot)}</b> <span class="small">(asignada automáticamente, no se modifica)</span>` : `La <b>orden de trabajo</b> se asigna automáticamente al guardar (OT-${new Date().getFullYear()}-XXXX).`}</div>`;
  const pr = formModal({ title: p ? `Editar servicio · ${ot||''}` : 'Nuevo servicio', fields: SERV_FIELDS, data: p, extra,
    onSave: async (d) => {
      if (d.numero_oc_cliente && d.estado_comercial !== 'DEVUELTO') d.estado_comercial = 'CON_OC';
      else if (d.estado_comercial === 'CON_OC') d.estado_comercial = 'PENDIENTE_OC';
      if (p) chk(await sb.from('proyectos').update({ ...d, updated_at: new Date().toISOString() }).eq('id', p.id));
      else { const r = chk(await sb.from('proyectos').insert({ ...d, creado_por: session.user.id }).select('id,numero_orden_trabajo').single()); toast(`Servicio creado con ${r.numero_orden_trabajo}`); location.hash = `#/servicio/${r.id}`; }
    }});
  const form = $modal.querySelector('form'), msg = document.getElementById('cotmsg');
  listasCotizador().then(({ clientes, cotizaciones }) => {
    if (!form.isConnected) return;
    document.getElementById('dl-cliente').innerHTML = clientes.map(c => `<option value="${esc(c.razon_social)}">${c.ruc ? 'RUC ' + esc(c.ruc) : ''}</option>`).join('');
    document.getElementById('dl-numero_cotizacion').innerHTML = cotizaciones.map(q => `<option value="${esc(q.numero)}">${esc([q.cliente, fdate(q.fecha), q.total != null ? `${q.moneda||''} ${Number(q.total).toLocaleString('es-PE',{minimumFractionDigits:2})}` : ''].filter(Boolean).join(' · '))}</option>`).join('');
    msg.textContent = `Listas del cotizador: ${clientes.length} clientes y ${cotizaciones.length} cotizaciones. Al elegir una cotización se completan cliente, nombre, alcance, moneda, monto y PDF.`;
    const inp = form.elements.numero_cotizacion;
    const alElegir = () => {
      const q = cotizaciones.find(x => x.numero === inp.value.trim());
      if (!q) return;
      const hechos = aplicarCotizacion(form, q);
      msg.innerHTML = `Cotización <b>${esc(q.numero)}</b> · ${esc(q.cliente || '')} · ${esc(q.moneda || '')} ${q.total != null ? Number(q.total).toLocaleString('es-PE',{minimumFractionDigits:2}) : ''} c/IGV${hechos.length ? ` — se completó: ${hechos.map(k => NOMBRE_CAMPO[k] || k).join(', ')}. Revisa antes de guardar.` : ''}`;
    };
    inp.addEventListener('change', alElegir);
    inp.addEventListener('input', () => { if (cotizaciones.some(x => x.numero === inp.value.trim())) alElegir(); });
    // si el usuario edita a mano un campo autocompletado, ya no se vuelve a pisar
    ['cliente','nombre','descripcion','monto_servicio','moneda'].forEach(k => form.elements[k]?.addEventListener('input', e => { if (e.isTrusted) delete e.target.dataset.auto; }));
  }).catch(e => { if (form.isConnected) msg.textContent = 'No se pudo cargar la lista del cotizador; puedes escribir los datos a mano. (' + e.message + ')'; });
  const ok = await pr;
  if (ok) { if (p) toast('Servicio guardado'); route(); }
}

async function editarInterno(p){
  const num = p?.numero_orden_trabajo;
  const extra = `<div class="ot-box">${num ? `Proyecto interno: <b class="mono">${esc(num)}</b> <span class="small">(número asignado automáticamente)</span>` : `El número de <b>proyecto interno</b> se asigna automáticamente al guardar (PI-${new Date().getFullYear()}-XXXX). Lo invertido se calcula con las órdenes de compra que se enlacen a este PI.`}</div>`;
  const ok = await formModal({ title: p ? `Editar proyecto interno · ${num||''}` : 'Nuevo proyecto interno', fields: PI_FIELDS, data: p, extra,
    onSave: async (d) => {
      if (p) chk(await sb.from('proyectos').update({ ...d, updated_at: new Date().toISOString() }).eq('id', p.id));
      else { const r = chk(await sb.from('proyectos').insert({ ...d, clase: 'INTERNO', estado_comercial: 'CON_OT', creado_por: session.user.id }).select('id,numero_orden_trabajo').single()); toast(`Proyecto creado con ${r.numero_orden_trabajo}`); location.hash = `#/servicio/${r.id}`; }
    }});
  if (ok) { if (p) toast('Proyecto guardado'); route(); }
}

// Recuadro con la cotización leída en vivo del cotizador
async function panelCotizacion(s){
  const box = document.getElementById('cot-panel');
  if (!box) return;
  try {
    const { cotizaciones } = await listasCotizador();
    if (!box.isConnected) return;
    const q = cotizaciones.find(x => x.numero === String(s.numero_cotizacion).trim());
    if (!q) { box.innerHTML = `<div class="small">La cotización <b class="mono">${esc(s.numero_cotizacion)}</b> no figura en el cotizador.</div>`; return; }
    const mon = monedaCot(q.moneda), c = q.condiciones || {};
    const difMonto = s.monto_servicio != null && q.subtotal != null && Math.abs(Number(s.monto_servicio) - Number(q.subtotal)) > 0.01;
    const fila = (k, v) => v ? `<div><span class="k">${k}</span> ${v}</div>` : '';
    box.innerHTML = `
      <div class="cot-head"><b>Cotización ${esc(q.numero)}</b> ${q.estado ? `<span class="badge">${esc(ESTADO_COT[q.estado] || q.estado)}</span>` : ''}
        <span class="small">emitida ${fdate(q.fecha)}${q.vence ? ` · vence ${fdate(q.vence)}` : ''} · datos en vivo del cotizador</span>
        ${safeUrl(q.pdf_url) ? `<a href="${esc(safeUrl(q.pdf_url))}" target="_blank" rel="noopener" class="cot-pdf">Ver PDF</a>` : ''}</div>
      <div class="cot-grid">
        ${fila('Cliente', esc(q.cliente || '—') + (q.cliente_ruc ? ` <span class="small">RUC ${esc(q.cliente_ruc)}</span>` : ''))}
        ${fila('Subtotal', money(q.subtotal, mon))}
        ${fila('IGV', money(q.igv, mon))}
        ${fila('Total', `<b>${money(q.total, mon)}</b>`)}
        ${fila('Forma de pago', esc(c.forma_pago || ''))}
        ${fila('Plazo', esc(c.plazo_entrega || ''))}
        ${fila('Garantía', esc(c.garantia || ''))}
        ${fila('Validez', esc(c.validez || ''))}
      </div>
      ${q.actividades?.length ? `<div class="k" style="margin-top:6px">Actividades cotizadas</div><ul class="cot-act">${q.actividades.map(a => `<li>${esc(typeof a === 'string' ? a : (a?.descripcion || a?.nombre || ''))}</li>`).join('')}</ul>` : ''}
      ${difMonto ? `<div class="small warn-txt">El monto registrado en esta OT (${money(s.monto_servicio, s.moneda)}) es distinto al subtotal cotizado (${money(q.subtotal, mon)}).</div>` : ''}`;
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<div class="small">No se pudo leer el cotizador en este momento (${esc(e.message)}).</div>`;
  }
}

// ---------- detalle ----------
let tabActual = 'componentes';
async function renderDetalle(id){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  const [p, comp, guias, facts, ocs, sols, arch] = await Promise.all([
    sb.from('proyectos').select('*').eq('id', id).single(),
    sb.from('proyecto_componentes').select('*').eq('proyecto_id', id).order('created_at'),
    sb.from('proyecto_guias').select('*').eq('proyecto_id', id).order('fecha'),
    sb.from('proyecto_facturas').select('*').eq('proyecto_id', id).order('fecha_emision'),
    sb.from('ordenes_compra').select('id,numero,fecha_emision,moneda,total,estado,archivo_pdf_url,proveedores(razon_social)').eq('proyecto_id', id).order('numero'),
    sb.from('solicitudes_pedido').select('id,numero,area,solicitante,fecha_solicitud,estado,prioridad').eq('proyecto_id', id).order('numero'),
    sb.from('proyecto_archivos').select('*').eq('proyecto_id', id).order('created_at'),
  ]);
  if (p.error) { $app.querySelector('main').innerHTML = `<a class="back" href="#/">← Volver</a><div class="err">No se encontró el servicio.</div>`; return; }
  const s = p.data, C = comp.data||[], G = guias.data||[], F = facts.data||[], O = ocs.data||[], S = sols.data||[], A = arch.data||[];
  const urls = await firmarUrls(A);
  const ge = G.filter(g=>g.tipo==='ENTRADA'), gs = G.filter(g=>g.tipo==='SALIDA');
  const INF = A.filter(a => a.categoria === 'INFORME');
  const Fv = F.filter(f=>f.estado_cobro!=='ANULADA');
  const cobrado = Fv.length && Fv.every(f=>f.estado_cobro==='COBRADO');
  const steps = [
    ['Cotización', s.numero_cotizacion, !!s.numero_cotizacion],
    ['OC cliente', s.numero_oc_cliente ? 'OC '+s.numero_oc_cliente : (s.estado_comercial==='CON_OT'?'Sin OC · con OT':''), !!s.numero_oc_cliente || s.estado_comercial==='CON_OT'],
    ...(s.estado_comercial==='DEVUELTO' ? [['Devuelto', 'Equipo devuelto', 'dev']] : []),
    ['Ingreso (guía)', ge.map(g=>g.numero_guia).join(', '), ge.length>0],
    ['Requerimientos / OC', `${S.length} req · ${O.length} OC`, S.length+O.length>0],
    ['Informe', s.numero_informe || (INF.length ? `${INF.length} archivo(s)` : ''), !!s.numero_informe || INF.length > 0],
    ['Salida (guía)', gs.map(g=>g.numero_guia).join(', '), gs.length>0],
    ['Factura', Fv.map(f=>f.numero_factura).join(', '), Fv.length>0],
    ['Cobro', cobrado ? 'Cobrado' : (Fv.length ? 'Pendiente' : ''), cobrado],
  ];
  const info = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const esPI = s.clase === 'INTERNO';
  filtro.clase = esPI ? 'INTERNO' : 'SERVICIO';
  if (esPI && ['guias','facturas'].includes(tabActual)) tabActual = 'componentes';
  const tabs = esPI ? [['componentes','Equipos / componentes',C.length],['requerimientos','Requerimientos',S.length],['ocs','Órdenes de compra',O.length],['informes','Informes',INF.length],['archivos','Fotos y archivos',A.length]] : [['componentes','Componentes',C.length],['guias','Guías de remisión',G.length],['requerimientos','Requerimientos',S.length],['ocs','Órdenes de compra',O.length],['informes','Informes técnicos',INF.length],['facturas','Facturación',F.length],['archivos','Fotos y archivos',A.length]];

  $app.querySelector('main').innerHTML = `
    <a class="back" href="#/">← ${esPI ? 'Proyectos internos' : 'Servicios a clientes'}</a>
    ${esPI ? cabeceraPI(s, O, S, info) : `<div class="detail-head">
      <div><div class="ot-tag mono">${esc(s.numero_orden_trabajo||'')}</div><h1>${esc(s.nombre)}</h1><div class="sub">${esc(s.cliente||'Sin cliente')} · ${esc((s.tipo||'').toLowerCase())} ${s.estado!=='activo'?' · '+esc(s.estado):''}</div>
        <div class="row" style="margin-top:6px">${badge(s.estado_comercial, EST_COM[s.estado_comercial])} ${badge('op', EST_OP[s.estado_operativo])}</div></div>
      <div class="row"><button id="edit">Editar datos</button><button class="danger" id="del">Eliminar</button></div>
    </div>
    <div class="chain">${steps.map((st,i)=>`${i?'<span class="arr">→</span>':''}<div class="step ${st[2]==='dev'?'dev':st[2]?'done':''}"><b>${st[0]}</b>${esc(st[1]||'—')}</div>`).join('')}</div>
    <div class="grid-info">
      ${info('OC del cliente', s.numero_oc_cliente ? `<span class="mono">${esc(s.numero_oc_cliente)}</span> <span class="small">${fdate(s.fecha_oc_cliente)}</span>` : '—')}
      ${info('Cotización', linkOrText(s.numero_cotizacion, s.enlace_cotizacion))}
      ${s.numero_cotizacion ? '<div class="cot-panel" id="cot-panel"><div class="small">Cargando la cotización desde el cotizador…</div></div>' : ''}
      ${info('Informe técnico', linkOrText(s.numero_informe, s.enlace_informe) + (INF.length ? `<div class="small" style="margin-top:2px">${INF.map(a => urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener">${tipoDoc(a)}</a>` : '').join(' · ')} · <a href="#" data-tab-ir="informes">ver informes</a></div>` : ''))}
      ${info('Monto del servicio', money(s.monto_servicio, s.moneda))}
      ${info('Responsable', esc(s.responsable||'—'))}
      ${info('Inicio / entrega', `${fdate(s.fecha_inicio)} → ${fdate(s.fecha_entrega)}`)}
      ${info('Descripción', esc(s.descripcion||'—'))}
      ${s.observaciones ? info('Observaciones', esc(s.observaciones)) : ''}
    </div>`}
    <div class="panel">
      <div class="tabs">${tabs.map(([k,l,n])=>`<button data-t="${k}" class="${tabActual===k?'on':''}">${l}<span class="cnt">${n}</span></button>`).join('')}</div>
      <div id="tab"></div>
    </div>`;
  document.getElementById('edit').onclick = () => editarServicio(s);
  if (!esPI && s.numero_cotizacion) panelCotizacion(s);
  document.getElementById('del').onclick = async () => {
    if (!await confirmModal('¿Eliminar este registro? Se borrarán sus componentes, guías, facturas, fotos y archivos. Las OC y requerimientos vinculados no se borran, solo se desvinculan.')) return;
    if (A.length) await sb.storage.from(BUCKET).remove(A.map(a => a.storage_path));
    await sb.from('ordenes_compra').update({ proyecto_id: null }).eq('proyecto_id', s.id);
    await sb.from('solicitudes_pedido').update({ proyecto_id: null }).eq('proyecto_id', s.id);
    const { error } = await sb.from('proyectos').delete().eq('id', s.id);
    if (error) toast(error.message); else { toast('Servicio eliminado'); location.hash = '#/'; }
  };
  $app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tabActual = b.dataset.t; renderDetalle(id); });
  $app.querySelectorAll('[data-tab-ir]').forEach(a => a.onclick = (e) => { e.preventDefault(); tabActual = a.dataset.tabIr; renderDetalle(id); });

  const T = document.getElementById('tab');
  const reload = () => renderDetalle(id);
  const actions = (i) => `<td style="white-space:nowrap;text-align:right"><button class="link sm" data-e="${i}">Editar</button><button class="link sm danger" data-d="${i}">Quitar</button></td>`;
  const wire = (list, table, fields, title, fixed = {}, adjuntos = null) => {
    T.querySelectorAll('[data-e]').forEach(b => b.onclick = async () => { const r=list[b.dataset.e]; if (await formModal({ title:'Editar '+title, fields, data:r, onSave: async d => chk(await sb.from(table).update(d).eq('id', r.id)) })) reload(); });
    T.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { const r=list[b.dataset.d]; const adj = adjuntos ? adjuntos(r) : []; if (!await confirmModal(adj.length ? `¿Quitar este registro y sus ${adj.length} archivo(s)?` : '¿Quitar este registro?')) return; if (adj.length) { await sb.storage.from(BUCKET).remove(adj.map(a=>a.storage_path)); await sb.from('proyecto_archivos').delete().in('id', adj.map(a=>a.id)); } const {error}=await sb.from(table).delete().eq('id', r.id); error?toast(error.message):reload(); });
    const a = T.querySelector('[data-add]'); if (a) a.onclick = async () => { if (await formModal({ title:'Agregar '+title, fields, data: fixed, onSave: async d => chk(await sb.from(table).insert({ ...fixed, ...d, proyecto_id: id })) })) reload(); };
  };

  if (tabActual === 'componentes') {
    const fields = [
      { k:'descripcion', l:'Componente / descripción', req:true, full:true, ph:'Ej. Tarjeta electrónica de control' },
      { k:'marca', l:'Marca' }, { k:'modelo', l:'Modelo' },
      { k:'numero_parte', l:'N° de parte (N/P)' }, { k:'numero_serie', l:'N° de serie' },
      { k:'cantidad', l:'Cantidad', t:'number', def:1 },
      { k:'datos_tecnicos', l:'Datos técnicos adicionales', t:'area', full:true, ph:'Voltaje, horómetro, falla reportada, etc.' },
      { k:'observacion', l:'Observación', full:true },
    ];
    T.innerHTML = `<div class="sec-head"><div class="small">Equipos o piezas que forman parte de este servicio.</div><button class="pri sm" data-add>+ Agregar componente</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Fotos</th><th>Componente</th><th>Marca / Modelo</th><th>N° parte</th><th>N° serie</th><th>Cant.</th><th>Datos técnicos</th><th></th></tr></thead><tbody>
      ${C.map((c,i)=>`<tr><td>${miniFotos(A.filter(a=>a.componente_id===c.id), urls, c.id)}</td><td>${esc(c.descripcion)}${c.observacion?`<div class="small">${esc(c.observacion)}</div>`:''}</td><td>${esc([c.marca,c.modelo].filter(Boolean).join(' / ')||'—')}</td><td class="mono">${esc(c.numero_parte||'—')}</td><td class="mono">${esc(c.numero_serie||'—')}</td><td class="mono">${esc(c.cantidad)}</td><td class="small" style="max-width:280px">${esc(c.datos_tecnicos||'—')}</td>${actions(i)}</tr>`).join('') || '<tr><td colspan="8" class="empty">Sin componentes registrados.</td></tr>'}
      </tbody></table></div>`;
    wire(C, 'proyecto_componentes', fields, 'componente', {}, (r) => A.filter(a => a.componente_id === r.id));
    bindArchivos(T, A, urls, id, reload);
  }

  if (tabActual === 'guias') {
    const fields = [
      { k:'tipo', l:'Tipo', t:'select', opts:[['ENTRADA','Entrada (ingresa a taller)'],['SALIDA','Salida (se entrega al cliente)']], def:'ENTRADA' },
      { k:'numero_guia', l:'N° de guía de remisión', req:true, ph:'T001-000123' },
      { k:'fecha', l:'Fecha', t:'date', def: new Date().toISOString().slice(0,10) },
      { k:'detalle', l:'Qué componentes / cantidad', full:true },
      { k:'observacion', l:'Observación', full:true },
    ];
    T.innerHTML = `<div class="sec-head"><div class="small">Guías con las que entraron y salieron los componentes.</div><button class="pri sm" data-add>+ Registrar guía</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th>N° guía</th><th>Fecha</th><th>Detalle</th><th>PDF</th><th></th></tr></thead><tbody>
      ${G.map((g,i)=>`<tr><td>${badge(g.tipo, g.tipo==='ENTRADA'?'Entrada':'Salida')}</td><td class="mono">${esc(g.numero_guia)}</td><td>${fdate(g.fecha)}</td><td>${esc(g.detalle||'—')}${g.observacion?`<div class="small">${esc(g.observacion)}</div>`:''}</td><td>${pdfGuia(A.filter(a=>a.guia_id===g.id), urls, g.id)}</td>${actions(i)}</tr>`).join('') || '<tr><td colspan="6" class="empty">Sin guías registradas.</td></tr>'}
      </tbody></table></div>`;
    wire(G, 'proyecto_guias', fields, 'guía', {}, (r) => A.filter(a => a.guia_id === r.id));
    bindArchivos(T, A, urls, id, reload);
  }

  if (tabActual === 'facturas') {
    const fields = [
      { k:'numero_factura', l:'N° de factura', req:true, ph:'F001-00001234' },
      { k:'fecha_emision', l:'Fecha de emisión', t:'date', def: new Date().toISOString().slice(0,10) },
      { k:'moneda', l:'Moneda', t:'select', opts:[['SOLES','Soles'],['DOLARES','Dólares']], def: s.moneda || 'SOLES' },
      { k:'monto', l:'Monto total (con IGV)', t:'number', req:true },
      { k:'fecha_vencimiento', l:'Fecha de vencimiento', t:'date' },
      { k:'estado_cobro', l:'Estado de cobro', t:'select', opts:Object.entries(EST_COBRO), def:'PENDIENTE' },
      { k:'monto_cobrado', l:'Monto cobrado', t:'number', def:0 },
      { k:'fecha_cobro', l:'Fecha de cobro', t:'date' },
      { k:'observacion', l:'Observación', full:true },
    ];
    const hoy = new Date().toISOString().slice(0,10);
    T.innerHTML = `<div class="sec-head"><div class="small">Facturas emitidas al cliente por este servicio y si ya se cobraron.</div><button class="pri sm" data-add>+ Registrar factura</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>N° factura</th><th>Emisión</th><th>Vence</th><th style="text-align:right">Monto</th><th style="text-align:right">Cobrado</th><th>Estado</th><th>Fecha cobro</th><th></th></tr></thead><tbody>
      ${F.map((f,i)=>{ const venc = f.fecha_vencimiento && f.fecha_vencimiento < hoy && (f.estado_cobro==='PENDIENTE'||f.estado_cobro==='PARCIAL');
        return `<tr><td class="mono">${esc(f.numero_factura)}${f.observacion?`<div class="small">${esc(f.observacion)}</div>`:''}</td><td>${fdate(f.fecha_emision)}</td><td>${fdate(f.fecha_vencimiento)}${venc?' <span class="badge b-PENDIENTE">Vencida</span>':''}</td><td class="money">${money(f.monto,f.moneda)}</td><td class="money">${money(f.monto_cobrado,f.moneda)}</td><td>${badge(f.estado_cobro, EST_COBRO[f.estado_cobro])}${f.estado_cobro!=='COBRADO'&&f.estado_cobro!=='ANULADA'?` <button class="link sm" data-c="${i}">Marcar cobrada</button>`:''}</td><td>${fdate(f.fecha_cobro)}</td>${actions(i)}</tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aún no se registra factura para este servicio.</td></tr>'}
      </tbody></table></div>`;
    wire(F, 'proyecto_facturas', fields, 'factura');
    T.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { const f=F[b.dataset.c]; const {error}=await sb.from('proyecto_facturas').update({ estado_cobro:'COBRADO', monto_cobrado:f.monto, fecha_cobro: hoy }).eq('id', f.id); error?toast(error.message):(toast('Factura marcada como cobrada'),reload()); });
  }

  if (tabActual === 'requerimientos') {
    T.innerHTML = `<div class="sec-head"><div class="small">Requerimientos (solicitudes de pedido) del sistema de OC asociados a este servicio.</div>
      <div class="row"><a class="btn sm" href="${OC_APP}" target="_blank" rel="noopener">Crear en sistema OC ↗</a><button class="pri sm" id="vinc">Vincular existente</button></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>N°</th><th>Área</th><th>Solicitante</th><th>Fecha</th><th>Prioridad</th><th>Estado</th><th></th></tr></thead><tbody>
      ${S.map((r,i)=>`<tr><td class="mono">SOL-${String(r.numero).padStart(4,'0')}</td><td>${esc(r.area)}</td><td>${esc(r.solicitante||'—')}</td><td>${fdate(r.fecha_solicitud)}</td><td>${esc(r.prioridad)}</td><td>${esc(r.estado)}</td><td style="text-align:right"><button class="link sm danger" data-u="${i}">Desvincular</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sin requerimientos vinculados.</td></tr>'}
      </tbody></table></div>`;
    T.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => { await sb.from('solicitudes_pedido').update({ proyecto_id:null }).eq('id', S[b.dataset.u].id); reload(); });
    document.getElementById('vinc').onclick = async () => {
      const { data } = await sb.from('solicitudes_pedido').select('id,numero,area,solicitante,fecha_solicitud,estado').is('proyecto_id', null).order('numero', { ascending:false }).limit(200);
      if (await pickModal('Vincular requerimientos', (data||[]).map(r => ({ id:r.id, html:`<b class="mono">SOL-${String(r.numero).padStart(4,'0')}</b> · ${esc(r.area)} · ${esc(r.solicitante||'')} <span class="small">${fdate(r.fecha_solicitud)} · ${esc(r.estado)}</span>` })),
        async ids => chk(await sb.from('solicitudes_pedido').update({ proyecto_id:id }).in('id', ids)))) reload();
    };
  }

  if (tabActual === 'ocs') {
    T.innerHTML = `<div class="sec-head"><div class="small">Órdenes de compra a proveedores emitidas para este servicio.</div>
      <div class="row"><a class="btn sm" href="${OC_APP}" target="_blank" rel="noopener">Emitir OC en sistema ↗</a><button class="pri sm" id="vinc">Vincular OC existente</button></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>N° OC</th><th>Proveedor</th><th>Fecha</th><th style="text-align:right">Total</th><th>Estado</th><th>PDF</th><th></th></tr></thead><tbody>
      ${O.map((o,i)=>`<tr><td class="mono">OC-${String(o.numero).padStart(4,'0')}</td><td>${esc(o.proveedores?.razon_social||'—')}</td><td>${fdate(o.fecha_emision)}</td><td class="money">${money(o.total,o.moneda)}</td><td>${esc(o.estado)}</td><td>${safeUrl(o.archivo_pdf_url)?`<a href="${esc(o.archivo_pdf_url)}" target="_blank" rel="noopener">Ver</a>`:'—'}</td><td style="text-align:right"><button class="link sm danger" data-u="${i}">Desvincular</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sin órdenes de compra vinculadas.</td></tr>'}
      </tbody></table></div>`;
    T.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => { await sb.from('ordenes_compra').update({ proyecto_id:null }).eq('id', O[b.dataset.u].id); reload(); });
    document.getElementById('vinc').onclick = async () => {
      const { data } = await sb.from('ordenes_compra').select('id,numero,fecha_emision,total,moneda,proveedores(razon_social)').is('proyecto_id', null).order('numero', { ascending:false }).limit(200);
      if (await pickModal('Vincular órdenes de compra', (data||[]).map(o => ({ id:o.id, html:`<b class="mono">OC-${String(o.numero).padStart(4,'0')}</b> · ${esc(o.proveedores?.razon_social||'')} <span class="small">${fdate(o.fecha_emision)} · ${money(o.total,o.moneda)}</span>` })),
        async ids => chk(await sb.from('ordenes_compra').update({ proyecto_id:id }).in('id', ids)))) reload();
    };
  }

  if (tabActual === 'informes') {
    T.innerHTML = `<div class="sec-head"><div class="small">Informes técnicos del ${esPI ? 'proyecto' : 'servicio'} en PDF o Word (versiones, informe final, certificado de operatividad…).</div>
      <button class="pri sm" data-up="INFORME" data-accept="${ACEPTA_INFORME}">+ Subir informe (PDF / Word)</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th>Informe</th><th>Archivo</th><th>Subido</th><th>Tamaño</th><th></th></tr></thead><tbody>
      ${INF.map(a => { const u = urls[a.storage_path]; return `<tr><td><span class="doc-tag ${esWord(a)?'w':'p'}">${tipoDoc(a)}</span></td>
        <td>${esc(a.descripcion || '—')}</td><td class="small" style="max-width:280px;word-break:break-all">${esc(a.nombre)}</td>
        <td>${fdate(a.created_at)}</td><td class="small">${a.tamano ? kb(a.tamano) : '—'}</td>
        <td style="white-space:nowrap;text-align:right">${u ? (esWord(a) ? '' : `<a class="link-sm" href="${esc(u)}" target="_blank" rel="noopener">Ver</a> `) + `<a class="link-sm" href="${esc(u)}" download="${esc(a.nombre)}" target="_blank" rel="noopener">Descargar</a>` : ''} <button class="link sm danger" data-rm="${a.id}">Eliminar</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Aún no hay informes. Súbelos en PDF o Word con el botón de arriba.</td></tr>'}
      </tbody></table></div>
      ${s.numero_informe ? '' : '<div class="small" style="padding:8px 12px 12px">Consejo: escribe el N° de informe en la descripción al subirlo; si la OT aún no tiene N° de informe, se registra automáticamente.</div>'}`;
    bindArchivos(T, A, urls, id, reload, s);
  }

  if (tabActual === 'archivos') {
    const grupos = Object.entries(CATS).map(([k,l]) => [k, l, A.filter(a => a.categoria === k)]).filter(g => g[2].length);
    const etiqueta = (a) => { const c = C.find(x=>x.id===a.componente_id); const g = G.find(x=>x.id===a.guia_id); return c ? `Componente: ${c.descripcion}` : g ? `Guía ${g.numero_guia}` : ''; };
    T.innerHTML = `<div class="sec-head"><div class="small">Fotos del equipo, PDF de guías, informes (PDF o Word), OC del cliente y otros documentos del servicio.</div>
      <button class="pri sm" data-up="">+ Subir fotos / archivos</button></div>
      <div style="padding:0 12px 14px">${grupos.map(([k,l,list]) => `<h3 class="cat-h">${esc(l)} <span class="cnt">${list.length}</span></h3>
        <div class="gal">${list.map(a => tarjeta(a, urls, etiqueta(a))).join('')}</div>`).join('') || '<div class="empty">Aún no hay fotos ni archivos. Súbelos con el botón de arriba (desde el celular puedes tomar la foto directamente).</div>'}</div>`;
    bindArchivos(T, A, urls, id, reload);
  }
}

// ---------- archivos (Supabase Storage, bucket privado) ----------
const BUCKET = 'maestro-archivos';
const CATS = { FOTO_EQUIPO:'Fotos del equipo', GUIA:'Guías de remisión', INFORME:'Informes', COTIZACION:'Cotizaciones', OC_CLIENTE:'OC del cliente', FACTURA:'Facturas', OTRO:'Otros' };
const esImg = (a) => (a.mime||'').startsWith('image/');
const esWord = (a) => /msword|wordprocessingml/.test(a.mime || '') || /\.docx?$/i.test(a.nombre || '');
const tipoDoc = (a) => esWord(a) ? 'WORD' : (a.mime || '').includes('pdf') ? 'PDF' : esImg(a) ? 'IMG' : 'ARCH';
const ACEPTA_INFORME = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_EXT = { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/heic' };
const kb = (n) => n > 1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1, Math.round(n/1024))+' KB';
async function firmarUrls(A){
  if (!A.length) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(A.map(a => a.storage_path), 3600);
  const m = {}; (data||[]).forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl; }); return m;
}
function tarjeta(a, urls, sub=''){
  const u = urls[a.storage_path];
  const prev = esImg(a) && u ? `<img src="${esc(u)}" alt="${esc(a.nombre)}" loading="lazy">` : `<div class="doc-ico ${esWord(a)?'w':''}">${tipoDoc(a)}</div>`;
  return `<div class="card-f">
    <a class="prev" ${u?`href="${esc(u)}" target="_blank" rel="noopener"`:''} ${esImg(a)&&u?`data-ver="${a.id}"`:''}>${prev}</a>
    <div class="meta"><div class="nm" title="${esc(a.nombre)}">${esc(a.descripcion||a.nombre)}</div>
    <div class="small">${sub?esc(sub)+' · ':''}${fdate(a.created_at)}${a.tamano?' · '+kb(a.tamano):''}</div>
    <div class="row" style="gap:2px;margin-top:4px">${u?`<a class="link-sm" href="${esc(u)}" download="${esc(a.nombre)}" target="_blank" rel="noopener">Descargar</a>`:''}<button class="link sm danger" data-rm="${a.id}">Eliminar</button></div></div></div>`;
}
function miniFotos(list, urls, compId){
  const imgs = list.filter(esImg);
  return `<div class="thumbs">${imgs.slice(0,3).map(a => urls[a.storage_path] ? `<span class="th"><a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener" data-ver="${a.id}"><img src="${esc(urls[a.storage_path])}" alt="" loading="lazy"></a><button type="button" class="th-del" title="Eliminar esta foto" data-rm="${a.id}">✕</button></span>` : '').join('')}${imgs.length>3?`<span class="more">+${imgs.length-3}</span>`:''}
    <button class="add-f" title="Agregar fotos" data-up="FOTO_EQUIPO" data-comp="${compId}">＋</button></div>`;
}
function pdfGuia(list, urls, guiaId){
  return list.map(a => urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener">${esImg(a)?'Imagen':'PDF'}</a> <button class="link sm danger" data-rm="${a.id}" title="Eliminar archivo">✕</button><br>` : '').join('')
    + `<button class="link sm" data-up="GUIA" data-guia="${guiaId}" data-accept="application/pdf,image/*">${list.length?'+ otro':'Adjuntar PDF'}</button>`;
}
function bindArchivos(T, A, urls, proyectoId, reload, proyecto = null){
  T.querySelectorAll('[data-up]').forEach(b => b.onclick = (e) => { e.stopPropagation(); subirArchivos({ proyectoId, categoria: b.dataset.up || null, componenteId: b.dataset.comp || null, guiaId: b.dataset.guia || null, accept: b.dataset.accept, proyecto }).then(ok => ok && reload()); });
  T.querySelectorAll('[data-rm]').forEach(b => b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation(); const a = A.find(x => x.id === b.dataset.rm); if (!a) return;
    if (!await confirmModal(`¿Eliminar "${a.nombre}"? No se puede recuperar.`)) return;
    const r1 = await sb.storage.from(BUCKET).remove([a.storage_path]); if (r1.error) return toast(r1.error.message);
    const r2 = await sb.from('proyecto_archivos').delete().eq('id', a.id); if (r2.error) return toast(r2.error.message);
    toast('Archivo eliminado'); reload();
  });
  const imgs = A.filter(a => esImg(a) && urls[a.storage_path]);
  const borrar = async (a) => {
    if (!await confirmModal(`¿Eliminar la foto "${a.descripcion || a.nombre}"? No se puede recuperar.`)) return false;
    const r1 = await sb.storage.from(BUCKET).remove([a.storage_path]); if (r1.error) { toast(r1.error.message); return false; }
    const r2 = await sb.from('proyecto_archivos').delete().eq('id', a.id); if (r2.error) { toast(r2.error.message); return false; }
    toast('Foto eliminada'); reload(); return true;
  };
  T.querySelectorAll('[data-ver]').forEach(el => el.onclick = (e) => { e.preventDefault(); visor(imgs, imgs.findIndex(a => a.id === el.dataset.ver), urls, borrar); });
}
function visor(imgs, i, urls, borrar = null){
  if (i < 0) return;
  const draw = () => { const a = imgs[i];
    $modal.innerHTML = `<div class="ov visor"><div class="vbox"><img src="${esc(urls[a.storage_path])}" alt="">
      <div class="vbar"><span>${esc(a.descripcion||a.nombre)} · ${i+1}/${imgs.length}</span><span class="row"><button class="sm" data-p>‹</button><button class="sm" data-n>›</button><a class="btn sm" href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener">Abrir original</a>${borrar ? '<button class="sm danger" data-del>Eliminar foto</button>' : ''}<button class="sm" data-x>Cerrar</button></span></div></div></div>`;
    $modal.querySelector('[data-x]').onclick = () => { $modal.innerHTML=''; document.onkeydown=null; };
    $modal.querySelector('.ov').onclick = (e) => { if (e.target.classList.contains('ov')) { $modal.innerHTML=''; document.onkeydown=null; } };
    $modal.querySelector('[data-p]').onclick = () => { i = (i-1+imgs.length)%imgs.length; draw(); };
    $modal.querySelector('[data-n]').onclick = () => { i = (i+1)%imgs.length; draw(); };
    const del = $modal.querySelector('[data-del]');
    if (del) del.onclick = async () => { const a = imgs[i]; $modal.innerHTML = ''; document.onkeydown = null; await borrar(a); };
  };
  document.onkeydown = (e) => { if (!$modal.innerHTML) return; if (e.key==='Escape'){ $modal.innerHTML=''; document.onkeydown=null; } if (e.key==='ArrowRight'){ i=(i+1)%imgs.length; draw(); } if (e.key==='ArrowLeft'){ i=(i-1+imgs.length)%imgs.length; draw(); } };
  draw();
}
// Reduce fotos grandes (máx. 1920 px, JPEG 85%) para ahorrar espacio; PDFs y otros se suben tal cual.
async function comprimir(file){
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400*1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width*k); cv.height = Math.round(bmp.height*k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}
const limpiarNombre = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-80);
function subirArchivos({ proyectoId, categoria, componenteId, guiaId, accept, proyecto = null }){
  return new Promise(resolve => {
    const cat = categoria || 'FOTO_EQUIPO';
    const esInforme = cat === 'INFORME' && !componenteId && !guiaId;
    $modal.innerHTML = `<div class="ov"><form class="modal" style="max-width:560px">
      <header><h2>${guiaId ? 'Adjuntar guía de remisión' : componenteId ? 'Fotos del componente' : esInforme ? 'Subir informe técnico' : 'Subir fotos / archivos'}</h2><button type="button" class="link" data-x>✕</button></header>
      <div class="body"><div class="fgrid">
        <label class="f full"><span>${esInforme ? 'Archivos del informe (PDF o Word, puedes subir ambos a la vez)' : 'Archivos (fotos, PDF o Word, varios a la vez)'}</span><input type="file" name="f" multiple accept="${esc(accept || 'image/*,' + ACEPTA_INFORME)}" required></label>
        ${componenteId || guiaId || esInforme ? '' : `<label class="f"><span>Tipo</span><select name="cat">${Object.entries(CATS).map(([k,l])=>`<option value="${k}" ${k===cat?'selected':''}>${l}</option>`).join('')}</select></label>`}
        <label class="f ${componenteId || guiaId || esInforme ? 'full' : ''}"><span>${esInforme ? 'N° de informe / descripción' : 'Descripción (opcional)'}</span><input name="desc" placeholder="${esInforme ? 'Ej. IT-2026-015 · Informe final' : 'Ej. Estado de llegada, placa de datos…'}"></label>
      </div><p class="small" style="margin-top:10px">${esInforme ? 'Formatos: PDF, .doc o .docx. Límite: 25 MB por archivo.' : 'Las fotos grandes se reducen automáticamente (máx. 1920 px). Límite: 25 MB por archivo.'}</p>
      <div class="prog small"></div><div class="err" hidden></div></div>
      <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Subir</button></footer></form></div>`;
    const form = $modal.querySelector('form');
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { $modal.innerHTML=''; resolve(false); });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const files = [...form.f.files]; if (!files.length) return;
      const categoriaF = guiaId ? 'GUIA' : (form.cat?.value || cat);
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const prog = form.querySelector('.prog'); const errs = [];
      for (let k = 0; k < files.length; k++) {
        prog.textContent = `Subiendo ${k+1} de ${files.length}…`;
        let f = await comprimir(files[k]);
        if (!f.type) { const ext = (f.name.split('.').pop() || '').toLowerCase(); if (MIME_EXT[ext]) f = new File([f], f.name, { type: MIME_EXT[ext] }); }
        if (categoriaF === 'INFORME' && !/pdf|msword|wordprocessingml/.test(f.type)) { errs.push(`${f.name}: el informe debe ser PDF o Word (.doc / .docx)`); continue; }
        if (f.size > 25*1024*1024) { errs.push(`${f.name}: supera 25 MB`); continue; }
        const path = `${proyectoId}/${categoriaF.toLowerCase()}/${Date.now()}_${k}_${limpiarNombre(f.name)}`;
        const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (up.error) { errs.push(`${f.name}: ${up.error.message}`); continue; }
        const ins = await sb.from('proyecto_archivos').insert({ proyecto_id: proyectoId, componente_id: componenteId, guia_id: guiaId, categoria: categoriaF, storage_path: path, nombre: f.name, mime: f.type, tamano: f.size, descripcion: val(form.desc.value.trim()), subido_por: session.user.id });
        if (ins.error) { await sb.storage.from(BUCKET).remove([path]); errs.push(`${f.name}: ${ins.error.message}`); }
      }
      // si la OT aún no tiene N° de informe, se toma el escrito al subir
      if (categoriaF === 'INFORME' && proyecto && !proyecto.numero_informe && form.desc.value.trim()) {
        await sb.from('proyectos').update({ numero_informe: form.desc.value.trim().split('·')[0].trim(), updated_at: new Date().toISOString() }).eq('id', proyectoId);
      }
      if (errs.length) { const el = form.querySelector('.err'); el.hidden = false; el.innerHTML = errs.map(esc).join('<br>'); prog.textContent=''; btn.disabled=false; btn.textContent='Cerrar'; btn.onclick = (ev) => { ev.preventDefault(); $modal.innerHTML=''; resolve(true); }; return; }
      $modal.innerHTML=''; toast(files.length > 1 ? `${files.length} archivos subidos` : 'Archivo subido'); resolve(true);
    };
  });
}

function cabeceraPI(s, O, S, info){
  const mon = s.moneda || 'SOLES', gasto = gastoPorMoneda(O);
  const saldo = s.presupuesto != null ? Number(s.presupuesto) - (gasto[mon]||0) : null;
  return `<div class="detail-head">
      <div><div class="ot-tag pi mono">${esc(s.numero_orden_trabajo||'')}</div><h1>${esc(s.nombre)}</h1><div class="sub">Proyecto interno · ${esc(TIPOS_PI[s.tipo] || s.tipo || '')}${s.estado!=='activo'?' · '+esc(s.estado):''}</div>
        <div class="row" style="margin-top:6px">${badge('pi', 'Interno')} ${badge('op', EST_OP[s.estado_operativo])}</div></div>
      <div class="row"><button id="edit">Editar datos</button><button class="danger" id="del">Eliminar</button></div>
    </div>
    <div class="kpis" style="margin-top:4px">
      <div class="kpi" style="cursor:default"><div class="n" style="font-size:18px">${s.presupuesto!=null ? money(s.presupuesto, mon) : '—'}</div><div class="l">Presupuesto</div></div>
      <div class="kpi" style="cursor:default"><div class="n" style="font-size:18px;line-height:1.4">${montos(gasto)}</div><div class="l">Invertido (${O.filter(o=>o.estado!=='anulada').length} OC)</div></div>
      <div class="kpi" style="cursor:default"><div class="n" style="font-size:18px;${saldo!=null&&saldo<0?'color:var(--bad)':''}">${saldo!=null ? money(saldo, mon) : '—'}</div><div class="l">Saldo</div></div>
      <div class="kpi" style="cursor:default"><div class="n">${S.length}</div><div class="l">Requerimientos</div></div>
    </div>
    ${s.presupuesto ? `<div style="margin:-6px 0 16px;max-width:520px">${barraGasto(s.presupuesto, gasto[mon]||0, gasto)}</div>` : ''}
    <div class="grid-info">
      ${info('Responsable', esc(s.responsable||'—'))}
      ${info('Inicio / término estimado', `${fdate(s.fecha_inicio)} → ${fdate(s.fecha_entrega)}`)}
      ${info('Objetivo / alcance', esc(s.descripcion||'—'))}
      ${s.observaciones ? info('Observaciones', esc(s.observaciones)) : ''}
    </div>`;
}

function pickModal(title, items, onSave){
  return new Promise(resolve => {
    $modal.innerHTML = `<div class="ov"><div class="modal"><header><h2>${esc(title)}</h2><button class="link" data-x>✕</button></header>
      <div class="body">${items.length ? `<input type="search" placeholder="Filtrar…" id="pf" style="margin-bottom:8px"><div class="pick-list">${items.map(it=>`<label><input type="checkbox" value="${it.id}"><div>${it.html}</div></label>`).join('')}</div>` : '<div class="empty">No hay registros sin vincular.</div>'}<div class="err" hidden></div></div>
      <footer><button data-x>Cancelar</button>${items.length?'<button class="pri" data-ok>Vincular seleccionados</button>':''}</footer></div></div>`;
    const close = () => { $modal.innerHTML=''; resolve(false); };
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = close);
    const pf = document.getElementById('pf');
    if (pf) pf.oninput = () => $modal.querySelectorAll('.pick-list label').forEach(l => l.style.display = l.textContent.toLowerCase().includes(pf.value.toLowerCase()) ? '' : 'none');
    const ok = $modal.querySelector('[data-ok]');
    if (ok) ok.onclick = async () => {
      const ids = [...$modal.querySelectorAll('.pick-list input:checked')].map(i => i.value);
      if (!ids.length) return close();
      try { await onSave(ids); $modal.innerHTML=''; resolve(true); } catch(e){ const er=$modal.querySelector('.err'); er.hidden=false; er.textContent=e.message; }
    };
  });
}

// ---------- router ----------
function route(){
  $modal.innerHTML = ''; document.onkeydown = null;  // cerrar ventanas abiertas al cambiar de página
  if (!session) return renderLogin();
  const m = location.hash.match(/^#\/servicio\/([0-9a-f-]{36})/);
  if (m) return renderDetalle(m[1]);
  return renderLista();
}
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/servicio/')) tabActual = 'componentes'; route(); });
sb.auth.onAuthStateChange((_e, s) => { const changed = !!s !== !!session; session = s; if (changed) route(); });
const { data } = await sb.auth.getSession();
session = data.session;
route();
