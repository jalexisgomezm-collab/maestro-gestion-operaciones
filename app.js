import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { fichaOT, reporteGlobalPDF, reporteGlobalExcel } from '/reportes.js';

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
let MODO = null;  // 'total' (Maestro) | 'laboratorio' (vista técnica) | 'ninguno'
const LAB = () => MODO === 'laboratorio';
let VE_GUIAS = false;  // vista técnica: Planeamiento ve guías de remisión, Laboratorio no
let filtro = { clase: 'SERVICIO', estado: 'TODOS', q: '', verCerrados: false };

// ---------- modal genérico de formulario ----------
function field(f, data){
  let v = data?.[f.k] ?? f.def ?? '';
  if (f.nullAs !== undefined && data && f.k in data && data[f.k] == null) v = f.nullAs;
  if (f.t === 'select' && typeof v === 'number') v = String(Number(v));
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
    ${LAB() ? `<span class="badge b-pi" style="margin-right:4px">${VE_GUIAS ? 'Vista técnica' : 'Laboratorio'}</span>`+'<a href="#/" style="color:#fff;font-size:13px;font-weight:500">Servicios</a>' : ''}
    <a href="#/informes" style="color:#fff;font-size:13px;font-weight:500">Informes técnicos</a>
    ${!LAB() || VE_GUIAS ? '<a href="#/guias" style="color:#fff;font-size:13px;font-weight:500">Guías de remisión</a>' : ''}
    ${LAB() ? '' : '<a href="#/factoring" style="color:#fff;font-size:13px;font-weight:500">Factoring</a>'}
    <a href="${OC_APP}" target="_blank" rel="noopener" style="color:#cbd5e1;font-size:13px">Sistema OC ↗</a>
    <span class="user">${esc(session?.user?.email)}</span>
    <button class="sm" id="logout">Salir</button></header><main>${inner}</main>`;
}
function bindShell(){ const b=document.getElementById('logout'); if(b) b.onclick = () => sb.auth.signOut(); }

// ---------- informes técnicos (correlativos: iniciales ITI-AAAA-NNNN · finales ITF-AAAA-NNNN · garantía GAR-AAAA-NNNN) ----------
const TIPOS_INF = { INICIAL:'Inicial', FINAL:'Final', GARANTIA:'Garantía' };
const SERIE_INF = { INICIAL:'ITI', FINAL:'ITF', GARANTIA:'GAR' };
const ACEPTA_INF = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*';
const archivosInf = (i) => [...(i.informe_archivos || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
function enlacesInforme(i, urls){
  const l = archivosInf(i);
  if (!l.length) return '<span class="small">Sin archivo</span>';
  return l.map(a => urls[a.storage_path] ? `<a class="link-sm" href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener" title="${esc(a.nombre)}"${esWord(a) ? ` download="${esc(a.nombre)}"` : ''}><span class="doc-tag ${esWord(a)?'w':'p'}">${tipoDoc(a)}</span></a>` : '').join(' ');
}
function filaInforme(i, urls, { conOT = true, enOT = false } = {}){
  return `<tr>
    <td class="mono" style="font-weight:500;white-space:nowrap">${esc(i.numero || '—')}</td>
    <td>${badge(i.tipo === 'GARANTIA' ? 'PENDIENTE_OC' : i.tipo === 'INICIAL' ? 'EN_EVALUACION' : 'CON_OC', TIPOS_INF[i.tipo] || i.tipo)}</td>
    <td><div style="font-weight:500">${esc(i.titulo)}</div>${i.observaciones ? `<div class="small">${esc(i.observaciones)}</div>` : ''}</td>
    <td style="white-space:nowrap">${fdate(i.fecha)}</td>
    ${conOT ? `<td>${i.proyectos ? `<a href="#/servicio/${i.proyecto_id}" class="mono">${esc(i.proyectos.numero_orden_trabajo || '')}</a><div class="small">${esc(i.cliente || '')}</div>` : `<span class="small">Sin OT</span>${i.cliente ? `<div class="small">${esc(i.cliente)}</div>` : ''}`}</td>` : ''}
    ${LAB() ? '' : `<td class="mono">${esc(i.numero_cotizacion || '—')}</td>`}
    <td style="white-space:nowrap">${enlacesInforme(i, urls)}</td>
    <td style="white-space:nowrap;text-align:right"><button class="link sm" data-inf-e="${i.id}">Editar</button>${LAB() ? '' : enOT ? `<button class="link sm" data-inf-q="${i.id}" title="Desvincular de esta OT (el informe no se borra)">Quitar de la OT</button>` : `<button class="link sm danger" data-inf-d="${i.id}">Eliminar</button>`}</td></tr>`;
}
async function listaProyectosSimple(){
  if (LAB()) { const { data } = await sb.rpc('lab_servicios').select('id,numero_orden_trabajo,nombre,cliente,clase,estado').order('numero_orden_trabajo', { ascending:false }); return data || []; }
  const { data } = await sb.from('proyectos_maestro').select('id,numero_orden_trabajo,nombre,cliente,numero_cotizacion,clase,estado').order('numero_orden_trabajo', { ascending:false });
  return data || [];
}
async function subirArchivosInforme(informeId, files, prog){
  const errs = [];
  for (let k = 0; k < files.length; k++) {
    if (prog) prog.textContent = `Subiendo archivo ${k+1} de ${files.length}…`;
    let f = files[k];
    if (!f.type) { const ext = (f.name.split('.').pop() || '').toLowerCase(); if (MIME_EXT[ext]) f = new File([f], f.name, { type: MIME_EXT[ext] }); }
    if (!/pdf|msword|wordprocessingml|^image\//.test(f.type)) { errs.push(`${f.name}: debe ser PDF, Word o imagen`); continue; }
    if (f.size > 25*1024*1024) { errs.push(`${f.name}: supera 25 MB`); continue; }
    const path = `informes/${informeId}/${Date.now()}_${k}_${limpiarNombre(f.name)}`;
    const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (up.error) { errs.push(`${f.name}: ${up.error.message}`); continue; }
    const ins = await sb.from('informe_archivos').insert({ informe_id: informeId, storage_path: path, nombre: f.name, mime: f.type, tamano: f.size });
    if (ins.error) { await sb.storage.from(BUCKET).remove([path]); errs.push(`${f.name}: ${ins.error.message}`); }
  }
  return errs;
}
async function quitarArchivoInforme(a){
  await sb.storage.from(BUCKET).remove([a.storage_path]);
  await sb.from('proyecto_archivos').delete().eq('storage_path', a.storage_path); // copia antigua (informes subidos antes del módulo)
  return chk(await sb.from('informe_archivos').delete().eq('id', a.id));
}
async function eliminarInforme(i){
  if (!await confirmModal(`¿Eliminar el informe ${i.numero} y sus ${archivosInf(i).length} archivo(s)? No se puede recuperar. (El número no se reutiliza.)`)) return false;
  const l = archivosInf(i);
  if (l.length) { await sb.storage.from(BUCKET).remove(l.map(a => a.storage_path)); await sb.from('proyecto_archivos').delete().in('storage_path', l.map(a => a.storage_path)); }
  const { error } = await sb.from('informes_tecnicos').delete().eq('id', i.id);
  if (error) { toast(error.message); return false; }
  toast(`Informe ${i.numero} eliminado`); return true;
}
// Registrar / editar un informe. opts.proyectoId: OT preseleccionada.
function editarInforme(inf = null, opts = {}){
  return new Promise(async resolve => {
    const proys = await listaProyectosSimple();
    const ot = inf?.proyecto_id || opts.proyectoId || '';
    const hoy = new Date().toISOString().slice(0,10);
    const urls = inf ? await firmarUrls(archivosInf(inf)) : {};
    $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:720px">
      <header><h2>${inf ? `Editar informe <span class="mono">${esc(inf.numero)}</span>` : 'Nuevo informe técnico'}</h2><button type="button" class="link" data-x>✕</button></header>
      <div class="body"><div class="fgrid">
        <label class="f"><span>Tipo de informe</span><select name="tipo">${Object.entries(TIPOS_INF).map(([k,l]) => `<option value="${k}" ${(inf?.tipo || 'FINAL') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f"><span>Fecha del informe</span><input type="date" name="fecha" value="${esc(inf?.fecha || hoy)}"></label>
        <label class="f full"><span>Título *</span><input name="titulo" required value="${esc(inf?.titulo || '')}" placeholder="Ej. Informe técnico final – reparación de variador ACS800"></label>
        <label class="f full"><span>Orden de trabajo (OT / PI)</span><select name="proyecto_id"><option value="">— Sin OT por ahora —</option>${proys.map(p => `<option value="${p.id}" ${p.id === ot ? 'selected' : ''}>${esc(p.numero_orden_trabajo || '')} · ${esc(p.nombre || '')}${p.cliente ? ' · ' + esc(p.cliente) : ''}${p.estado !== 'activo' ? ` (${esc(p.estado)})` : ''}</option>`).join('')}</select></label>
        <label class="f" ${LAB() ? 'style="display:none"' : ''}><span>N° de cotización</span><input name="numero_cotizacion" list="dl-inf-cot" autocomplete="off" value="${esc(inf?.numero_cotizacion || '')}" placeholder="Se toma de la OT o elige del cotizador"><datalist id="dl-inf-cot"></datalist></label>
        <label class="f"><span>Cliente</span><input name="cliente" list="dl-inf-cli" autocomplete="off" value="${esc(inf?.cliente || '')}"><datalist id="dl-inf-cli"></datalist></label>
        <label class="f"><span>Responsable / elaborado por</span><input name="responsable" value="${esc(inf?.responsable || '')}"></label>
        <label class="f"><span>${inf ? 'Agregar archivos' : 'Archivos del informe'} (PDF, Word o imagen)</span><input type="file" name="f" multiple accept="${ACEPTA_INF}"></label>
        <label class="f full"><span>Observaciones</span><textarea name="observaciones" rows="2">${esc(inf?.observaciones || '')}</textarea></label>
      </div>
      ${inf && archivosInf(inf).length ? `<div class="small" style="margin-top:6px"><b>Archivos actuales:</b> ${archivosInf(inf).map(a => `<span style="white-space:nowrap">${urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener">${esc(a.nombre)}</a>` : esc(a.nombre)} <button type="button" class="link sm danger" data-rmf="${a.id}" title="Quitar este archivo">✕</button></span>`).join(' · ')}</div>` : ''}
      <p class="small" style="margin-top:8px">${inf ? 'El número no cambia; solo si cambias el <b>tipo</b> recibe el siguiente número de la nueva serie.' : 'El <b>número</b> se asigna solo al guardar según el tipo: iniciales <b>ITI-AAAA-NNNN</b>, finales <b>ITF-AAAA-NNNN</b> y garantía <b>GAR-AAAA-NNNN</b>, continuando la numeración usada.'}</p>
      <div class="prog small"></div><div class="err" hidden></div></div>
      <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">${inf ? 'Guardar cambios' : 'Registrar informe'}</button></footer></form></div>`;
    const form = $modal.querySelector('form');
    const fin = (v) => { $modal.innerHTML = ''; resolve(v); };
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = () => fin(false));
    const showErr = (m) => { const e = form.querySelector('.err'); e.hidden = false; e.innerHTML = esc(m).replace(/\n/g, '<br>'); };
    // al elegir la OT se completan cotización y cliente (si están vacíos)
    form.proyecto_id.onchange = () => {
      const p = proys.find(x => x.id === form.proyecto_id.value); if (!p) return;
      if (!form.numero_cotizacion.value.trim() && p.numero_cotizacion) form.numero_cotizacion.value = p.numero_cotizacion;
      if (!form.cliente.value.trim() && p.cliente) form.cliente.value = p.cliente;
    };
    if (!inf && ot) form.proyecto_id.onchange();
    if (!LAB()) listasCotizador().then(({ clientes, cotizaciones }) => {
      if (!form.isConnected) return;
      document.getElementById('dl-inf-cot').innerHTML = cotizaciones.map(q => `<option value="${esc(q.numero)}">${esc([q.cliente, q.referencia].filter(Boolean).join(' · '))}</option>`).join('');
      document.getElementById('dl-inf-cli').innerHTML = clientes.map(c => `<option value="${esc(c.razon_social)}"></option>`).join('');
      form.numero_cotizacion.addEventListener('change', () => { const q = cotizaciones.find(x => x.numero === form.numero_cotizacion.value.trim()); if (q && !form.cliente.value.trim()) form.cliente.value = q.cliente || ''; });
    }).catch(() => {});
    $modal.querySelectorAll('[data-rmf]').forEach(b => b.onclick = async () => {
      const a = archivosInf(inf).find(x => x.id === b.dataset.rmf); if (!a) return;
      if (!confirm(`¿Quitar el archivo "${a.nombre}"? No se puede recuperar.`)) return;
      try { await quitarArchivoInforme(a); inf.informe_archivos = inf.informe_archivos.filter(x => x.id !== a.id); b.parentElement.remove(); toast('Archivo quitado'); } catch (e) { showErr(e.message); }
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = { tipo: form.tipo.value, fecha: form.fecha.value || hoy, titulo: form.titulo.value.trim(), proyecto_id: form.proyecto_id.value || null,
        numero_cotizacion: val(form.numero_cotizacion.value.trim()), cliente: val(form.cliente.value.trim()), responsable: val(form.responsable.value.trim()), observaciones: val(form.observaciones.value.trim()) };
      if (!d.titulo) return showErr('Escribe el título del informe');
      const files = [...form.f.files];
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const r = inf ? chk(await sb.from('informes_tecnicos').update(d).eq('id', inf.id).select('id,numero').single())
                      : chk(await sb.from('informes_tecnicos').insert(d).select('id,numero').single());
        const errs = files.length ? await subirArchivosInforme(r.id, files, form.querySelector('.prog')) : [];
        if (errs.length) { showErr(`Informe ${r.numero} guardado, pero hubo problemas con algunos archivos:\n${errs.join('\n')}`); btn.textContent = 'Cerrar'; btn.disabled = false; btn.onclick = (ev) => { ev.preventDefault(); fin(true); }; return; }
        toast(inf ? `Informe ${r.numero} actualizado` : `Informe ${r.numero} registrado`); fin(true);
      } catch (err) { showErr(err.message); btn.disabled = false; }
    };
  });
}
async function cargarInformes(filtro = {}){
  let q = sb.from('informes_tecnicos').select('*, informe_archivos(*), proyectos(numero_orden_trabajo,nombre,clase)').order('numero', { ascending:false });
  if (filtro.proyectoId) q = q.eq('proyecto_id', filtro.proyectoId);
  if (filtro.sinOT) q = q.is('proyecto_id', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
function bindFilasInforme(cont, lista, reload, proyectoId = null){
  cont.querySelectorAll('[data-inf-e]').forEach(b => b.onclick = async () => { const i = lista.find(x => x.id === b.dataset.infE); if (i && await editarInforme(i)) reload(); });
  cont.querySelectorAll('[data-inf-d]').forEach(b => b.onclick = async () => { const i = lista.find(x => x.id === b.dataset.infD); if (i && await eliminarInforme(i)) reload(); });
  cont.querySelectorAll('[data-inf-q]').forEach(b => b.onclick = async () => {
    const i = lista.find(x => x.id === b.dataset.infQ); if (!i) return;
    if (!await confirmModal(`¿Quitar el informe ${i.numero} de esta OT? El informe sigue registrado en el módulo de informes.`)) return;
    const { error } = await sb.from('informes_tecnicos').update({ proyecto_id: null }).eq('id', i.id); error ? toast(error.message) : reload();
  });
}
let filtroInf = { q: '', tipo: 'TODOS' };
async function renderInformes(){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  let lista;
  try { lista = await cargarInformes(); } catch (e) { $app.querySelector('main').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const urls = await firmarUrls(lista.flatMap(archivosInf));
  const q = filtroInf.q.toLowerCase();
  const rows = lista.filter(i => (filtroInf.tipo === 'TODOS' || i.tipo === filtroInf.tipo) &&
    (!q || [i.numero, i.titulo, i.cliente, i.numero_cotizacion, i.responsable, i.proyectos?.numero_orden_trabajo, i.proyectos?.nombre].some(x => (x || '').toLowerCase().includes(q))));
  const anio = new Date().getFullYear();
  const kpi = (n, l) => `<div class="kpi" style="cursor:default"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  $app.querySelector('main').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h1>Informes técnicos</h1><div class="sub">Registro de todos los informes con su número correlativo${LAB() ? ', vinculados a cada OT.' : ', vinculados a la OT y a la cotización.'}</div></div>
      <button class="pri" id="inf-nuevo">+ Nuevo informe</button>
    </div>
    <div class="kpis">${kpi(lista.length, 'Informes registrados')}${kpi(lista.filter(i => i.tipo === 'INICIAL').length, 'Iniciales (ITI)')}${kpi(lista.filter(i => i.tipo === 'FINAL').length, 'Finales (ITF)')}${kpi(lista.filter(i => i.tipo === 'GARANTIA').length, 'Garantía (GAR)')}${kpi(lista.filter(i => !i.proyecto_id).length, 'Sin OT vinculada')}</div>
    <div class="panel">
      <div class="toolbar">
        <input type="search" id="inf-q" placeholder="Buscar N°, título, cliente, OT o cotización…" value="${esc(filtroInf.q)}">
        <select id="inf-tipo"><option value="TODOS">Todos los tipos</option>${Object.entries(TIPOS_INF).map(([k,l]) => `<option value="${k}" ${filtroInf.tipo===k?'selected':''}>${l}</option>`).join('')}</select>
        <div style="flex:1"></div><span class="small">${rows.length} informe(s)</span>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>N° informe</th><th>Tipo</th><th>Título</th><th>Fecha</th><th>OT / cliente</th>${LAB() ? '' : '<th>Cotización</th>'}<th>Archivos</th><th></th></tr></thead>
      <tbody>${rows.map(i => filaInforme(i, urls)).join('') || '<tr><td colspan="${LAB() ? 7 : 8}" class="empty">No hay informes con este filtro.</td></tr>'}</tbody></table></div>
    </div>`;
  document.getElementById('inf-nuevo').onclick = async () => { if (await editarInforme()) renderInformes(); };
  document.getElementById('inf-q').oninput = (e) => { filtroInf.q = e.target.value; clearTimeout(window._iq); window._iq = setTimeout(() => renderInformes().then(() => { const i = document.getElementById('inf-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
  document.getElementById('inf-tipo').onchange = (e) => { filtroInf.tipo = e.target.value; renderInformes(); };
  bindFilasInforme($app, lista, renderInformes);
}

// ---------- reportes ----------
const ETIQUETAS = { EST_COM, EST_OP, EST_COBRO, TIPOS_PI };
const FONDO = () => location.origin + '/membrete-gto.jpg';
async function datosReporte(){
  const [pr, fa, co, gu, oc, so, inf] = await Promise.all([
    sb.from('proyectos_maestro').select('*').order('numero_orden_trabajo', { ascending:true }),
    sb.from('proyecto_facturas').select('proyecto_id,numero_factura,fecha_emision,fecha_vencimiento,monto,detraccion_pct,detraccion_monto,detraccion_estado,detraccion_fecha,monto_cobrado,estado_cobro,moneda,fecha_cobro'),
    sb.from('proyecto_componentes').select('proyecto_id'),
    sb.from('proyecto_guias').select('proyecto_id,tipo,numero_guia,fecha'),
    sb.from('ordenes_compra').select('proyecto_id,numero,total,moneda,estado').not('proyecto_id','is',null),
    sb.from('solicitudes_pedido').select('proyecto_id').not('proyecto_id','is',null),
    sb.from('informes_tecnicos').select('proyecto_id,numero,titulo').not('proyecto_id','is',null).order('numero'),
  ]);
  if (pr.error) throw new Error(pr.error.message);
  return { P: pr.data || [], F: fa.data || [], C: co.data || [], G: gu.data || [], O: oc.data || [], S: so.data || [], I: inf.data || [], etiquetas: ETIQUETAS, fondo: FONDO(), logo: location.origin + '/logo-gto.png' };
}

// ---------- lista ----------
async function renderLista(){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  const esPI = filtro.clase === 'INTERNO';
  const [pr, fa, co, gu, oc, so, inf] = await Promise.all([
    sb.from('proyectos_maestro').select('*').order('created_at', { ascending:false }),
    sb.from('proyecto_facturas').select('proyecto_id,monto,detraccion_monto,monto_cobrado,estado_cobro,moneda'),
    sb.from('proyecto_componentes').select('proyecto_id'),
    sb.from('proyecto_guias').select('proyecto_id,tipo'),
    sb.from('ordenes_compra').select('proyecto_id,total,moneda,estado').not('proyecto_id','is',null),
    sb.from('solicitudes_pedido').select('proyecto_id').not('proyecto_id','is',null),
    sb.from('informes_tecnicos').select('proyecto_id,numero').not('proyecto_id','is',null).order('numero'),
  ]);
  if (pr.error) { $app.querySelector('main').innerHTML = `<div class="err">${esc(pr.error.message)}</div>`; return; }
  const by = (arr) => (arr.data||[]).reduce((m,r)=>{(m[r.proyecto_id] ||= []).push(r); return m;}, {});
  const F=by(fa), C=by(co), G=by(gu), O=by(oc), S=by(so), IN=by(inf);
  const numInf = (p) => (IN[p.id]||[]).map(i => i.numero).join(', ') || p.numero_informe || '';
  const deClase = pr.data.filter(p => (p.clase || 'SERVICIO') === filtro.clase);
  const nSrv = pr.data.filter(p => (p.clase || 'SERVICIO') === 'SERVICIO' && p.estado === 'activo').length;
  const nPI = pr.data.filter(p => p.clase === 'INTERNO' && p.estado === 'activo').length;
  const activos = deClase.filter(p => p.estado === 'activo');
  const q = filtro.q.toLowerCase();
  const campoEstado = esPI ? 'estado_operativo' : 'estado_comercial';
  const rows = deClase.filter(p =>
    (filtro.verCerrados || p.estado === 'activo') &&
    (filtro.estado === 'TODOS' || p[campoEstado] === filtro.estado) &&
    (!q || [p.nombre,p.cliente,p.responsable,p.numero_oc_cliente,p.numero_orden_trabajo,p.numero_cotizacion,numInf(p),p.descripcion].some(x => (x||'').toLowerCase().includes(q))));
  const kpi = (k, n, l) => `<div class="kpi ${filtro.estado===k?'sel':''}" data-k="${k}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const count = (campo, k) => activos.filter(p => p[campo] === k).length;
  const switcher = `<div class="seg"><button data-clase="SERVICIO" class="${!esPI?'on':''}">Servicios a clientes · OT <span class="cnt">${nSrv}</span></button><button data-clase="INTERNO" class="${esPI?'on':''}">Proyectos internos · PI <span class="cnt">${nPI}</span></button></div>`;
  let kpis, thead, filas, estados, sub;

  if (!esPI) {
    let porCobrarS=0, porCobrarD=0;
    (fa.data||[]).forEach(f => { if (f.estado_cobro==='PENDIENTE'||f.estado_cobro==='PARCIAL'){ const s=Number(f.monto||0)-Number(f.detraccion_monto||0)-Number(f.monto_cobrado||0); f.moneda==='DOLARES'?porCobrarD+=s:porCobrarS+=s; } });
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
        <td class="mono" style="white-space:nowrap">${(IN[p.id]||[]).map(i => esc(i.numero)).join('<br>') || esc(p.numero_informe||'—')}</td>
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
        <button class="sm" id="rep-pdf" title="Reporte global imprimible (PDF) con los registros del filtro actual">🖨 Reporte PDF</button>
        <button class="sm" id="rep-xls" title="Reporte global en Excel: todos los servicios y proyectos, con facturas">⬇ Excel</button>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr>${thead}</tr></thead>
        <tbody>${filas || `<tr><td colspan="10" class="empty">No hay registros con este filtro. Crea el primero con el botón de arriba; el número (${esPI?'PI':'OT'}) se asigna solo.</td></tr>`}</tbody></table></div>
    </div>`;
  document.getElementById('nuevo').onclick = () => editarServicio(null);
  document.getElementById('rep-pdf').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { const d = await datosReporte(); const ids = new Set(rows.map(r => r.id));
      reporteGlobalPDF({ ...d, P: d.P.filter(p => ids.has(p.id)), clase: filtro.clase,
        filtroTexto: [filtro.estado !== 'TODOS' ? `Estado: ${(estados[filtro.estado] || filtro.estado)}` : 'Todos los estados', filtro.verCerrados ? 'incluye finalizados/cancelados' : 'solo activos', filtro.q ? `búsqueda “${filtro.q}”` : ''].filter(Boolean).join(' · ') });
    } catch (err) { toast(err.message); } finally { b.disabled = false; }
  };
  document.getElementById('rep-xls').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; const t = b.textContent; b.textContent = 'Generando…';
    try { await reporteGlobalExcel(await datosReporte()); } catch (err) { toast(err.message); } finally { b.disabled = false; b.textContent = t; }
  };
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
  if (cacheCot && Date.now() - cacheCot.t < 60*1000) return cacheCot;
  const [c, q, todas] = await Promise.all([sb.rpc('cotizador_clientes'), sb.rpc('cotizador_cotizaciones'), cotizacionesDirecto()]);
  if (c.error && q.error && !todas) throw new Error(c.error.message);
  // La función de la base solo recibe las 50 últimas modificadas; la API del cotizador entrega todas con ?limit.
  // Se unen ambas (por N°) y se ordenan por N° (la más reciente primero).
  const porNum = new Map((q.data || []).map(x => [x.numero, x]));
  (todas || []).forEach(x => porNum.set(x.numero, { ...(porNum.get(x.numero) || {}), ...x }));
  const cotizaciones = [...porNum.values()].sort((a, b) => String(b.numero || '').localeCompare(String(a.numero || ''), 'es', { numeric: true }));
  const clientes = [...(c.data || [])].sort((a, b) => String(a.razon_social || '').localeCompare(String(b.razon_social || ''), 'es'));
  cacheCot = { t: Date.now(), clientes, cotizaciones };
  return cacheCot;
}
// Lista completa directo de la API del cotizador (solo lectura), con el mismo formato que la función cotizador_cotizaciones()
const API_COTIZADOR = 'https://backend-v2-production-dcbc.up.railway.app/api/cotizaciones?limit=1000';
async function cotizacionesDirecto(){
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(API_COTIZADOR, { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json(); const l = Array.isArray(d) ? d : (d.data || []);
    return l.filter(x => x && x.numero).map(x => ({
      numero: x.numero, fecha: x.fecha_emision || null, vence: x.fecha_vencimiento || null, estado: x.estado || null,
      referencia: x.referencia || null, cliente: x.clientes?.razon_social || null, cliente_ruc: x.clientes?.ruc || null,
      moneda: x.moneda_simbolo || null, subtotal: x.subtotal ?? x.operacion_gravada ?? null, igv: x.igv ?? null, total: x.total ?? null,
      actividades: (x.activities || []).map(a => typeof a === 'string' ? a : (a?.descripcion || a?.nombre || a?.texto || '')).filter(Boolean),
      condiciones: x.condiciones || null, pdf_url: x.pdf_url || null,
    }));
  } catch { return null; }
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
// Actividades de la cotización: resumen corto (títulos de cada bloque) + detalle completo plegable con deslizador
function actividadesCot(lista){
  const acts = (lista || []).map(a => String(typeof a === 'string' ? a : (a?.descripcion || a?.nombre || '')).trim()).filter(Boolean);
  if (!acts.length) return '';
  const esTitulo = (t) => /:\s*$/.test(t) && t === t.toUpperCase();
  const titulos = acts.filter(esTitulo).map(t => t.replace(/:\s*$/, ''));
  const n = acts.filter(t => !esTitulo(t)).length;
  const resumen = titulos.length
    ? titulos.map(t => `<span class="cot-chip">${esc(t)}</span>`).join('')
    : acts.slice(0, 3).map(t => `<span class="cot-chip">${esc(t.length > 70 ? t.slice(0, 68) + '…' : t)}</span>`).join('') + (acts.length > 3 ? `<span class="small">+${acts.length - 3} más</span>` : '');
  return `<div class="cot-acts">
      <div class="k" style="margin-top:6px">Actividades cotizadas <span class="small">(${n} actividad${n === 1 ? '' : 'es'}${titulos.length ? ` en ${titulos.length} bloques` : ''})</span></div>
      <div class="cot-resumen">${resumen}</div>
      <details class="cot-det"><summary>Ver detalle completo</summary>
        <ul class="cot-act">${acts.map(t => esTitulo(t) ? `<li class="tit">${esc(t)}</li>` : `<li>${esc(t)}</li>`).join('')}</ul>
      </details>
    </div>`;
}

async function panelCotizacion(s){
  const box = document.getElementById('cot-panel');
  if (!box) return;
  try {
    const { cotizaciones } = await listasCotizador();
    if (!box.isConnected) return;
    const q = cotizaciones.find(x => x.numero === String(s.numero_cotizacion).trim());
    if (!q) { const rb = document.getElementById('ref-cot'); if (rb) rb.textContent = '—'; box.innerHTML = `<div class="small">La cotización <b class="mono">${esc(s.numero_cotizacion)}</b> no figura en el cotizador.</div>`; return; }
    const refBox = document.getElementById('ref-cot');
    if (refBox) refBox.innerHTML = q.referencia ? `${esc(q.referencia)} <span class="small">(del cotizador)</span>` : '<span class="small">Sin referencia en la cotización</span>';
    const mon = monedaCot(q.moneda), c = q.condiciones || {};
    const difMonto = s.monto_servicio != null && q.subtotal != null && Math.abs(Number(s.monto_servicio) - Number(q.subtotal)) > 0.01;
    const fila = (k, v) => v ? `<div><span class="k">${k}</span> ${v}</div>` : '';
    let abierto = false; try { abierto = localStorage.getItem('maestro-cot-abierto') === '1'; } catch {}
    box.classList.toggle('cerrado', !abierto);
    box.innerHTML = `
      <div class="cot-head"><button type="button" class="cot-tog" aria-expanded="${abierto}" title="Mostrar u ocultar los datos de la cotización"><span class="cot-ar">▸</span> <b>Cotización ${esc(q.numero)}</b></button> ${q.estado ? `<span class="badge">${esc(ESTADO_COT[q.estado] || q.estado)}</span>` : ''}
        <span class="small">emitida ${fdate(q.fecha)}${q.vence ? ` · vence ${fdate(q.vence)}` : ''} · datos en vivo del cotizador</span>
        <span class="cot-mini small">Total <b>${money(q.total, mon)}</b>${c.forma_pago ? ` · ${esc(c.forma_pago)}` : ''}</span>
        <span class="cot-acc">${safeUrl(q.pdf_url) ? `<a href="${esc(safeUrl(q.pdf_url))}" target="_blank" rel="noopener" class="cot-pdf">Ver PDF</a>` : '<span class="small" title="Cotización importada: no tiene archivo en el cotizador">Sin PDF</span>'}
        <button type="button" class="link sm cot-tog2">${abierto ? 'Ocultar ▴' : 'Ver detalle ▾'}</button></span></div>
      <div class="cot-body">
      <div class="cot-grid">
        ${fila('Cliente', esc(q.cliente || '—') + (q.cliente_ruc ? ` <span class="small">RUC ${esc(q.cliente_ruc)}</span>` : ''))}
        ${fila('Subtotal', money(q.subtotal, mon))}
        ${fila('IGV', money(q.igv, mon))}
        ${fila('Total', `<b>${money(q.total, mon)}</b>`)}
        ${fila('Forma de pago', esc(c.forma_pago || ''))}
        ${fila('Plazo', esc(c.plazo_entrega || ''))}
        ${fila('Garantía', esc(c.garantia || ''))}
        ${fila('Validez', esc(c.validez || ''))}
        ${fila('Referencia', esc(q.referencia || ''))}
      </div>
      ${actividadesCot(q.actividades)}
      </div>
      ${difMonto ? `<div class="small warn-txt">El monto registrado en esta OT (${money(s.monto_servicio, s.moneda)}) es distinto al subtotal cotizado (${money(q.subtotal, mon)}).</div>` : ''}`;
    const tog = () => {
      const ab = box.classList.toggle('cerrado') === false;
      try { localStorage.setItem('maestro-cot-abierto', ab ? '1' : '0'); } catch {}
      box.querySelector('.cot-tog').setAttribute('aria-expanded', ab);
      box.querySelector('.cot-tog2').textContent = ab ? 'Ocultar ▴' : 'Ver detalle ▾';
    };
    box.querySelector('.cot-tog').onclick = tog; box.querySelector('.cot-tog2').onclick = tog;
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<div class="small">No se pudo leer el cotizador en este momento (${esc(e.message)}).</div>`;
  }
}

// texto largo que se pliega (descripción, alcance, observaciones)
const plegable = (txt) => {
  const t = String(txt || '').trim();
  if (!t) return '—';
  if (t.length <= 180 && t.split('\n').length <= 4) return `<div style="white-space:pre-line">${esc(t)}</div>`;
  return `<div class="plg"><div class="plg-t">${esc(t)}</div><button type="button" class="link sm plg-b">Ver más ▾</button></div>`;
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('.plg-b'); if (!b) return;
  const p = b.closest('.plg'); const ab = p.classList.toggle('abierto');
  b.textContent = ab ? 'Ver menos ▴' : 'Ver más ▾';
});

// ---------- detalle ----------
let tabActual = 'componentes';
async function renderDetalle(id){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  const [p, comp, guias, facts, ocs, sols, arch, infs, cesiones] = await Promise.all([
    sb.from('proyectos_maestro').select('*').eq('id', id).single(),
    sb.from('proyecto_componentes').select('*').eq('proyecto_id', id).order('created_at'),
    sb.from('proyecto_guias').select('*').eq('proyecto_id', id).order('fecha'),
    sb.from('proyecto_facturas').select('*').eq('proyecto_id', id).order('fecha_emision'),
    sb.from('ordenes_compra').select('id,numero,fecha_emision,moneda,total,estado,archivo_pdf_url,proveedores(razon_social)').eq('proyecto_id', id).order('numero'),
    sb.from('solicitudes_pedido').select('id,numero,area,solicitante,fecha_solicitud,estado,prioridad').eq('proyecto_id', id).order('numero'),
    sb.from('proyecto_archivos').select('*').eq('proyecto_id', id).order('created_at'),
    sb.from('informes_tecnicos').select('*, informe_archivos(*)').eq('proyecto_id', id).order('numero'),
    sb.from('factoring_cartas').select('id,factura_id,numero,anio,sigla,estado,entidad_nombre').eq('proyecto_id', id).neq('estado', 'ANULADA'),
  ]);
  if (p.error) { $app.querySelector('main').innerHTML = `<a class="back" href="#/">← Volver</a><div class="err">No se encontró el servicio.</div>`; return; }
  const s = p.data, C = comp.data||[], G = guias.data||[], F = facts.data||[], O = ocs.data||[], S = sols.data||[];
  // los informes viven en el módulo de informes técnicos (las filas antiguas de categoría INFORME quedan solo como respaldo)
  const A = (arch.data||[]).filter(a => a.categoria !== 'INFORME');
  const INF = infs.data || [];
  const urls = await firmarUrls([...A, ...INF.flatMap(archivosInf)]);
  const ge = G.filter(g=>g.tipo==='ENTRADA'), gs = G.filter(g=>g.tipo==='SALIDA');
  // fechas tomadas de las guías: primer ingreso y última salida
  const porFecha = (l) => [...l].filter(g => g.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const gIng = porFecha(ge)[0] || null, gSal = porFecha(gs).slice(-1)[0] || null;
  const diasEntre = (a, b) => Math.max(0, Math.round((new Date((b || new Date().toISOString().slice(0,10)) + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000));
  const diasTaller = gIng ? diasEntre(String(gIng.fecha).slice(0,10), gSal ? String(gSal.fecha).slice(0,10) : null) : null;
  const OCC = A.filter(a => a.categoria === 'OC_CLIENTE');
  const REF = A.filter(esReferencia);
  const Fv = F.filter(f=>f.estado_cobro!=='ANULADA');
  const cobrado = Fv.length && Fv.every(f=>f.estado_cobro==='COBRADO');
  const steps = [
    ['Cotización', s.numero_cotizacion, !!s.numero_cotizacion],
    ['OC cliente', s.numero_oc_cliente ? 'OC '+s.numero_oc_cliente+(OCC.length?' 📎':'') : (OCC.length ? 'OC adjunta' : (s.estado_comercial==='CON_OT'?'Sin OC · con OT':'')), !!s.numero_oc_cliente || OCC.length>0 || s.estado_comercial==='CON_OT'],
    ...(s.estado_comercial==='DEVUELTO' ? [['Devuelto', 'Equipo devuelto', 'dev']] : []),
    ['Ingreso (guía)', ge.map(g=>g.numero_guia).join(', ') + (gIng ? ` · ${fdate(gIng.fecha)}` : ''), ge.length>0],
    ['Requerimientos / OC', `${S.length} req · ${O.length} OC`, S.length+O.length>0],
    ['Informe', INF.map(i => i.numero).join(', ') || s.numero_informe || '', INF.length > 0 || !!s.numero_informe],
    ['Salida (guía)', gs.map(g=>g.numero_guia).join(', ') + (gSal ? ` · ${fdate(gSal.fecha)}` : ''), gs.length>0],
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
      <div class="row"><button id="rotulo" title="Rótulo de despacho para el empaque (uno por bulto)">🏷 Rótulo</button><button id="ficha" title="Ficha de la OT para imprimir o guardar como PDF">🖨 Ficha PDF</button><button id="dividir" title="Pasar uno o más componentes a una OT nueva (por ejemplo, cuando el cliente emite OC por separado)">✂ Dividir OT</button><button id="edit">Editar datos</button><button class="danger" id="del">Eliminar</button></div>
    </div>
    <div class="chain">${steps.map((st,i)=>`${i?'<span class="arr">→</span>':''}<div class="step ${st[2]==='dev'?'dev':st[2]?'done':''}"><b>${st[0]}</b>${esc(st[1]||'—')}</div>`).join('')}</div>
    <div class="grid-info">
      ${info('OC del cliente', (s.numero_oc_cliente ? `<span class="mono">${esc(s.numero_oc_cliente)}</span> <span class="small">${fdate(s.fecha_oc_cliente)}</span>` : '—') + `<div class="small occ" style="margin-top:2px">${OCC.map(a => urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener" title="${esc(a.nombre)}">${tipoDoc(a)}</a><button type="button" class="link sm danger" data-rm="${a.id}" title="Quitar este archivo">✕</button>` : '').join(' · ')}${OCC.length ? ' · ' : ''}<button type="button" class="link sm" data-up="OC_CLIENTE" data-accept="${ACEPTA_OC}">${OCC.length ? '+ otro archivo' : '📎 Adjuntar OC'}</button></div>`)}
      ${info('Cotización', linkOrText(s.numero_cotizacion, s.enlace_cotizacion))}
      ${info('Referencia del cliente', `<span id="ref-cot">${s.numero_cotizacion ? '<span class="small">leyendo del cotizador…</span>' : '—'}</span>` + `<div class="small occ" style="margin-top:2px">${REF.map(a => urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener" title="${esc(a.nombre)}">${tipoDoc(a)}</a><button type="button" class="link sm danger" data-rm="${a.id}" title="Quitar este archivo">✕</button>` : '').join(' · ')}${REF.length ? ' · ' : ''}<button type="button" class="link sm" data-up="REFERENCIA" data-accept="application/pdf,.pdf,image/*">${REF.length ? '+ otro documento' : '📎 Adjuntar documento'}</button></div>`)}
      ${s.numero_cotizacion ? '<div class="cot-panel" id="cot-panel"><div class="small">Cargando la cotización desde el cotizador…</div></div>' : ''}
      ${info('Informe técnico', (INF.length ? INF.map(i => `<div style="margin-bottom:2px"><a href="#" data-tab-ir="informes" class="mono">${esc(i.numero)}</a> · ${esc(i.titulo)} ${enlacesInforme(i, urls)}</div>`).join('') : linkOrText(s.numero_informe, s.enlace_informe)) + `<div class="small" style="margin-top:2px"><button type="button" class="link sm" id="inf-add-top">+ Registrar informe</button></div>`)}
      ${info('Monto del servicio', money(s.monto_servicio, s.moneda))}
      ${info('Responsable', esc(s.responsable||'—'))}
      ${info('Ingreso de componentes', gIng
        ? `${fdate(gIng.fecha)} <div class="small">Guía ${esc(gIng.numero_guia)}${ge.length > 1 ? ` (+${ge.length - 1} guía${ge.length > 2 ? 's' : ''} más)` : ''} · ${gSal ? `salió el ${fdate(gSal.fecha)} (guía ${esc(gSal.numero_guia)}) · ${diasTaller} día${diasTaller === 1 ? '' : 's'} en taller` : `${diasTaller} día${diasTaller === 1 ? '' : 's'} en taller`}</div>`
        : '<span class="small">Sin guía de entrada registrada</span>')}
      ${info('Inicio / entrega', `${fdate(s.fecha_inicio)} → ${fdate(s.fecha_entrega)}`)}
      ${info('Descripción', plegable(s.descripcion))}
      ${s.observaciones ? info('Observaciones', plegable(s.observaciones)) : ''}
    </div>`}
    <div class="panel">
      <div class="tabs">${tabs.map(([k,l,n])=>`<button data-t="${k}" class="${tabActual===k?'on':''}">${l}<span class="cnt">${n}</span></button>`).join('')}</div>
      <div id="tab"></div>
    </div>`;
  document.getElementById('edit').onclick = () => editarServicio(s);
  const btnDiv = document.getElementById('dividir'); if (btnDiv) btnDiv.onclick = () => dividirOT({ s, C, G, A });
  const btnRot = document.getElementById('rotulo'); if (btnRot) btnRot.onclick = async () => { btnRot.disabled = true; try { await abrirRotulo({ s, C, G, F }); } finally { btnRot.disabled = false; } };
  document.getElementById('ficha').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      let cot = null;
      if (!esPI && s.numero_cotizacion) { try { const { cotizaciones } = await listasCotizador(); cot = cotizaciones.find(x => x.numero === String(s.numero_cotizacion).trim()) || null; } catch {} }
      fichaOT({ s, C, G, F, O, S, INF, cot, etiquetas: ETIQUETAS, fondo: FONDO() });
    } finally { b.disabled = false; }
  };
  if (!esPI && s.numero_cotizacion) panelCotizacion(s);
  const infTop = document.getElementById('inf-add-top'); if (infTop) infTop.onclick = async () => { if (await editarInforme(null, { proyectoId: id })) renderDetalle(id); };
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
  const gi = $app.querySelector('.grid-info'); if (gi && !esPI) bindArchivos(gi, [...OCC, ...REF], urls, id, reload, s);
  const actions = (i) => `<td style="white-space:nowrap;text-align:right"><button class="link sm" data-e="${i}">Editar</button><button class="link sm danger" data-d="${i}">Quitar</button></td>`;
  const wire = (list, table, fields, title, fixed = {}, adjuntos = null, prep = (d) => d) => {
    T.querySelectorAll('[data-e]').forEach(b => b.onclick = async () => { const r=list[b.dataset.e]; if (await formModal({ title:'Editar '+title, fields, data:r, onSave: async d => chk(await sb.from(table).update(prep(d, r)).eq('id', r.id)) })) reload(); });
    T.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { const r=list[b.dataset.d]; const adj = adjuntos ? adjuntos(r) : []; if (!await confirmModal(adj.length ? `¿Quitar este registro y sus ${adj.length} archivo(s)?` : '¿Quitar este registro?')) return; if (adj.length) { await sb.storage.from(BUCKET).remove(adj.map(a=>a.storage_path)); await sb.from('proyecto_archivos').delete().in('id', adj.map(a=>a.id)); } const {error}=await sb.from(table).delete().eq('id', r.id); error?toast(error.message):reload(); });
    const a = T.querySelector('[data-add]'); if (a) a.onclick = async () => { if (await formModal({ title:'Agregar '+title, fields, data: fixed, onSave: async d => chk(await sb.from(table).insert({ ...fixed, ...prep(d, null), proyecto_id: id })) })) reload(); };
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
      <div class="tbl-wrap"><table><thead><tr><th>Fotos</th><th>Componente</th><th>Marca / Modelo</th><th>N° parte</th><th>N° serie</th><th>Cant.</th><th>Ingreso</th><th>Datos técnicos</th><th></th></tr></thead><tbody>
      ${C.map((c,i)=>`<tr><td>${miniFotos(A.filter(a=>a.componente_id===c.id), urls, c.id)}</td><td>${esc(c.descripcion)}${c.observacion?`<div class="small">${esc(c.observacion)}</div>`:''}</td><td>${esc([c.marca,c.modelo].filter(Boolean).join(' / ')||'—')}</td><td class="mono">${esc(c.numero_parte||'—')}</td><td class="mono">${esc(c.numero_serie||'—')}</td><td class="mono">${esc(c.cantidad)}</td><td class="small" style="white-space:nowrap">${gIng ? `${fdate(gIng.fecha)}<div>${esc(gIng.numero_guia)}</div>` : '—'}</td><td class="small" style="max-width:280px">${esc(c.datos_tecnicos||'—')}</td>${actions(i)}</tr>`).join('') || '<tr><td colspan="9" class="empty">Sin componentes registrados.</td></tr>'}
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
      { sec:'Detracción (SPOT)' },
      { k:'detraccion_pct', l:'% de detracción', t:'select', opts:[['12','12 % · servicios'],['10','10 %'],['4','4 %'],['NA','No aplica']], def:'12', nullAs:'NA' },
      { k:'detraccion_monto', l:'Monto de detracción (vacío = automático, redondeado)', t:'number', ph:'Automático' },
      { sec:'Cobranza (lo que paga el cliente, sin la detracción)' },
      { k:'estado_cobro', l:'Estado de cobro', t:'select', opts:Object.entries(EST_COBRO), def:'PENDIENTE' },
      { k:'monto_cobrado', l:'Monto cobrado (neto)', t:'number', def:0 },
      { k:'fecha_cobro', l:'Fecha de cobro', t:'date' },
      { k:'observacion', l:'Observación', full:true },
    ];
    // detracción: si no se escribe el monto, 12 % (u otro %) del total redondeado a entero, como lo calcula SUNAT
    const prepFactura = (d, r) => {
      const pct = d.detraccion_pct == null || d.detraccion_pct === '' || d.detraccion_pct === 'NA' ? null : Number(d.detraccion_pct);
      d.detraccion_pct = pct;
      if (pct == null) { d.detraccion_monto = null; d.detraccion_estado = null; }
      else {
        if (d.detraccion_monto == null || (r && d.detraccion_monto === r.detraccion_monto && (d.monto !== r.monto || pct !== Number(r.detraccion_pct)))) d.detraccion_monto = Math.round(Number(d.monto || 0) * pct / 100);
        if (!r || !r.detraccion_estado) d.detraccion_estado = 'PENDIENTE';
      }
      const neto = Number(d.monto || 0) - Number(d.detraccion_monto || 0);
      if (d.estado_cobro === 'COBRADO' && !Number(d.monto_cobrado)) d.monto_cobrado = neto;
      return d;
    };
    const hoy = new Date().toISOString().slice(0,10);
    const netoF = (f) => Number(f.monto || 0) - Number(f.detraccion_monto || 0);
    const celdaDet = (f, i) => {
      if (f.detraccion_pct == null) return '<span class="small">No aplica</span>';
      const arch = A.filter(a => a.factura_id === f.id && a.categoria === 'DETRACCION');
      const dep = f.detraccion_estado === 'DEPOSITADA';
      return `${badge(dep ? 'COBRADO' : 'PENDIENTE', dep ? 'Depositada' : 'Por depositar')}
        <div class="small">${money(f.detraccion_monto, f.moneda)} · ${Number(f.detraccion_pct)} %${f.detraccion_soles ? ` · S/ ${Number(f.detraccion_soles).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}</div>
        ${dep ? `<div class="small">${fdate(f.detraccion_fecha)}${f.detraccion_constancia ? ` · Const. ${esc(f.detraccion_constancia)}` : ''}</div>` : ''}
        <div class="small" style="white-space:nowrap">${arch.map(a => urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener" title="${esc(a.nombre)}">${tipoDoc(a)}</a><button type="button" class="link sm danger" data-rm="${a.id}" title="Quitar">✕</button>` : '').join(' ')}
        <button type="button" class="link sm" data-det="${i}">${dep ? 'Editar' : 'Registrar depósito'}</button></div>`;
    };
    T.innerHTML = `<div class="sec-head"><div class="small">Facturas emitidas al cliente. En servicios el cliente descuenta la <b>detracción</b> (la deposita en tu cuenta del Banco de la Nación), por eso el <b>neto a cobrar</b> es menor que el total. Para ceder una factura al factoring usa <a href="#/factoring">Factoring</a>.</div><button class="pri sm" data-add>+ Registrar factura</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>N° factura</th><th>Emisión / vence</th><th style="text-align:right">Total</th><th style="text-align:right">Neto a cobrar</th><th style="text-align:right">Cobrado</th><th>Estado</th><th>Detracción</th><th>PDF / XML</th><th></th></tr></thead><tbody>
      ${F.map((f,i)=>{ const venc = f.fecha_vencimiento && f.fecha_vencimiento < hoy && (f.estado_cobro==='PENDIENTE'||f.estado_cobro==='PARCIAL');
        const ces = (cesiones.data||[]).filter(x => x.factura_id === f.id);
        return `<tr><td class="mono">${esc(f.numero_factura)}${ces.map(x => ` <a href="#/factoring" class="badge b-PARCIAL" title="Cedida a ${esc(x.entidad_nombre)}">Factoring · carta ${esc(codigoCorto(x))}</a>`).join('')}${f.observacion?`<div class="small">${esc(f.observacion)}</div>`:''}</td>
          <td style="white-space:nowrap">${fdate(f.fecha_emision)}<div class="small">vence ${fdate(f.fecha_vencimiento)}${venc?' <span class="badge b-PENDIENTE">Vencida</span>':''}</div></td>
          <td class="money">${money(f.monto,f.moneda)}${f.detraccion_monto ? `<div class="small">− detr. ${money(f.detraccion_monto, f.moneda)}</div>` : ''}</td>
          <td class="money"><b>${money(netoF(f),f.moneda)}</b></td>
          <td class="money">${money(f.monto_cobrado,f.moneda)}${f.fecha_cobro ? `<div class="small">${fdate(f.fecha_cobro)}</div>` : ''}</td>
          <td>${badge(f.estado_cobro, EST_COBRO[f.estado_cobro])}${f.estado_cobro!=='COBRADO'&&f.estado_cobro!=='ANULADA'?`<div><button class="link sm" data-c="${i}">Marcar cobrada</button></div>`:''}</td>
          <td style="min-width:150px">${celdaDet(f, i)}</td>
          <td class="small" style="white-space:nowrap">${archFactura(A.filter(a=>a.factura_id===f.id && a.categoria!=='DETRACCION'), urls, f.id)}</td>${actions(i)}</tr>`; }).join('') || '<tr><td colspan="9" class="empty">Aún no se registra factura para este servicio.</td></tr>'}
      </tbody></table></div>`;
    wire(F, 'proyecto_facturas', fields, 'factura', {}, (r) => A.filter(a => a.factura_id === r.id), prepFactura);
    bindArchivos(T, A, urls, id, reload);
    T.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { const f=F[b.dataset.c]; const {error}=await sb.from('proyecto_facturas').update({ estado_cobro:'COBRADO', monto_cobrado:netoF(f), fecha_cobro: hoy }).eq('id', f.id); error?toast(error.message):(toast('Factura marcada como cobrada (neto)'),reload()); });
    T.querySelectorAll('[data-det]').forEach(b => b.onclick = () => registrarDetraccion(F[b.dataset.det], id, reload));
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
    T.innerHTML = `<div class="sec-head"><div class="small">Informes técnicos de ${esPI ? 'este proyecto' : 'esta OT'} con su número correlativo (iniciales ITI · finales ITF · garantía GAR). También los ves todos en <a href="#/informes">Informes técnicos</a>.</div>
      <div class="row"><button class="sm" id="inf-vinc">Vincular informe existente</button><button class="pri sm" id="inf-add">+ Nuevo informe</button></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>N° informe</th><th>Tipo</th><th>Título</th><th>Fecha</th><th>Cotización</th><th>Archivos</th><th></th></tr></thead><tbody>
      ${INF.map(i => filaInforme(i, urls, { conOT:false, enOT:true })).join('') || '<tr><td colspan="7" class="empty">Aún no hay informes vinculados. Registra uno con «+ Nuevo informe» (el número se asigna solo).</td></tr>'}
      </tbody></table></div>`;
    bindFilasInforme(T, INF, reload);
    document.getElementById('inf-add').onclick = async () => { if (await editarInforme(null, { proyectoId: id })) reload(); };
    document.getElementById('inf-vinc').onclick = async () => {
      let libres; try { libres = await cargarInformes({ sinOT: true }); } catch (e) { return toast(e.message); }
      if (!libres.length) return toast('No hay informes sin OT para vincular');
      const ok = await formModal({ title: 'Vincular informe a esta OT', fields: [{ k:'inf', l:'Informe sin OT', t:'select', full:true, opts: libres.map(i => [i.id, `${i.numero} · ${i.titulo}${i.cliente ? ' · ' + i.cliente : ''}`]) }], data: { inf: libres[0].id },
        onSave: async d => chk(await sb.from('informes_tecnicos').update({ proyecto_id: id }).eq('id', d.inf)) });
      if (ok) reload();
    };
  }

  if (tabActual === 'archivos') {
    const grupos = Object.entries(CATS).map(([k,l]) => [k, l, A.filter(a => a.categoria === k)]).filter(g => g[2].length);
    const etiqueta = (a) => { const c = C.find(x=>x.id===a.componente_id); const g = G.find(x=>x.id===a.guia_id); const fc = F.find(x=>x.id===a.factura_id); return c ? `Componente: ${c.descripcion}` : g ? `Guía ${g.numero_guia}` : fc ? `Factura ${fc.numero_factura}` : esReferencia(a) ? 'Referencia del cliente' : ''; };
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
const esReferencia = (a) => a.categoria === 'OTRO' && /\/referencia\//.test(a.storage_path || '');
const esImg = (a) => (a.mime||'').startsWith('image/');
const esWord = (a) => /msword|wordprocessingml/.test(a.mime || '') || /\.docx?$/i.test(a.nombre || '');
const esXml = (a) => /xml/.test(a.mime || '') || /\.xml$/i.test(a.nombre || '');
const esZip = (a) => /zip/.test(a.mime || '') || /\.zip$/i.test(a.nombre || '');
const tipoDoc = (a) => esWord(a) ? 'WORD' : (a.mime || '').includes('pdf') ? 'PDF' : esXml(a) ? 'XML' : esZip(a) ? (/^r-|cdr/i.test(a.nombre||'') ? 'CDR' : 'ZIP') : esImg(a) ? 'IMG' : /excel|spreadsheet/.test(a.mime || '') ? 'XLS' : 'ARCH';
const ACEPTA_FACTURA = '.pdf,.xml,.zip,application/pdf,application/xml,text/xml,application/zip,application/x-zip-compressed';
const ACEPTA_OC = 'application/pdf,.pdf,image/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ACEPTA_INFORME = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_EXT = { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xml:'application/xml', zip:'application/zip', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/heic', xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
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
function archFactura(list, urls, facturaId){
  const orden = { PDF:0, XML:1, CDR:2 };
  const l = [...list].sort((a,b) => (orden[tipoDoc(a)] ?? 9) - (orden[tipoDoc(b)] ?? 9));
  const tiene = (t) => l.some(a => tipoDoc(a) === t);
  const falta = !tiene('PDF') ? (!tiene('XML') ? 'PDF + XML' : 'PDF') : (!tiene('XML') ? 'XML' : '');
  return l.map(a => urls[a.storage_path] ? `<a href="${esc(urls[a.storage_path])}" ${tipoDoc(a)==='PDF' ? 'target="_blank" rel="noopener"' : `download="${esc(a.nombre)}"`} title="${esc(a.nombre)}">${tipoDoc(a)}</a><button type="button" class="link sm danger" data-rm="${a.id}" title="Quitar ${esc(a.nombre)}">✕</button>` : '').join(' ')
    + ` <button type="button" class="link sm" data-up="FACTURA" data-fact="${facturaId}" data-accept="${ACEPTA_FACTURA}">${falta ? '📎 Adjuntar ' + falta : '+ otro'}</button>`;
}
function bindArchivos(T, A, urls, proyectoId, reload, proyecto = null){
  T.querySelectorAll('[data-up]').forEach(b => b.onclick = (e) => { e.stopPropagation(); subirArchivos({ proyectoId, categoria: b.dataset.up || null, componenteId: b.dataset.comp || null, guiaId: b.dataset.guia || null, facturaId: b.dataset.fact || null, accept: b.dataset.accept, proyecto }).then(ok => ok && reload()); });
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
function subirArchivos({ proyectoId, categoria, componenteId, guiaId, facturaId = null, accept, proyecto = null }){
  return new Promise(resolve => {
    const cat = categoria || 'FOTO_EQUIPO';
    const esInforme = cat === 'INFORME' && !componenteId && !guiaId;
    const esOC = cat === 'OC_CLIENTE' && !componenteId && !guiaId;
    const esRef = cat === 'REFERENCIA' && !componenteId && !guiaId;
    const fijo = LAB() || componenteId || guiaId || esInforme || esOC || facturaId || esRef;
    $modal.innerHTML = `<div class="ov"><form class="modal" style="max-width:560px">
      <header><h2>${facturaId ? 'Adjuntar factura (PDF y XML)' : guiaId ? 'Adjuntar guía de remisión' : componenteId ? 'Fotos del componente' : esInforme ? 'Subir informe técnico' : esOC ? 'Adjuntar OC del cliente' : esRef ? 'Documento de referencia del cliente' : 'Subir fotos / archivos'}</h2><button type="button" class="link" data-x>✕</button></header>
      <div class="body"><div class="fgrid">
        <label class="f full"><span>${facturaId ? 'Archivos de la factura: PDF y XML (selecciona ambos a la vez; también el CDR .zip si lo tienes)' : esInforme ? 'Archivos del informe (PDF o Word, puedes subir ambos a la vez)' : esOC ? 'Archivo de la OC (PDF, foto o Word)' : esRef ? 'Licitación, SOLPED u otro documento del cliente (PDF o imagen)' : 'Archivos (fotos, PDF o Word, varios a la vez)'}</span><input type="file" name="f" multiple accept="${esc(accept || 'image/*,' + ACEPTA_INFORME)}" required></label>
        ${fijo ? '' : `<label class="f"><span>Tipo</span><select name="cat">${Object.entries(CATS).filter(([k]) => k !== 'INFORME').map(([k,l])=>`<option value="${k}" ${k===cat?'selected':''}>${l}</option>`).join('')}</select></label>`}
        <label class="f ${fijo ? 'full' : ''}"><span>${facturaId ? 'Descripción (opcional)' : esInforme ? 'N° de informe / descripción' : esOC ? 'N° de OC del cliente' : 'Descripción (opcional)'}</span><input name="desc" value="${esOC ? esc(proyecto?.numero_oc_cliente || '') : ''}" placeholder="${facturaId ? 'Ej. Factura electrónica y XML enviados al cliente' : esInforme ? 'Ej. IT-2026-015 · Informe final' : esOC ? 'Ej. 4520004034' : esRef ? 'Ej. SOLPED 30001345 · Bases de licitación' : 'Ej. Estado de llegada, placa de datos…'}"></label>
        ${esOC && !proyecto?.fecha_oc_cliente ? '<label class="f"><span>Fecha de la OC (opcional)</span><input type="date" name="focc"></label>' : ''}
      </div><p class="small" style="margin-top:10px">${facturaId ? 'Formatos: PDF, XML y ZIP (CDR de SUNAT). Límite: 25 MB por archivo.' : esInforme ? 'Formatos: PDF, .doc o .docx. Límite: 25 MB por archivo.' : esOC ? (proyecto?.numero_oc_cliente ? 'Formatos: PDF, foto o Word. Límite: 25 MB.' : 'Si escribes el N° de OC, se registra en la OT y queda como "Con OC cliente". Límite: 25 MB.') : 'Las fotos grandes se reducen automáticamente (máx. 1920 px). Límite: 25 MB por archivo.'}</p>
      <div class="prog small"></div><div class="err" hidden></div></div>
      <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Subir</button></footer></form></div>`;
    const form = $modal.querySelector('form');
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { $modal.innerHTML=''; resolve(false); });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const files = [...form.f.files]; if (!files.length) return;
      const categoriaF = guiaId ? 'GUIA' : facturaId ? 'FACTURA' : esRef ? 'OTRO' : (form.cat?.value || cat);
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const prog = form.querySelector('.prog'); const errs = [];
      for (let k = 0; k < files.length; k++) {
        prog.textContent = `Subiendo ${k+1} de ${files.length}…`;
        let f = await comprimir(files[k]);
        if (!f.type) { const ext = (f.name.split('.').pop() || '').toLowerCase(); if (MIME_EXT[ext]) f = new File([f], f.name, { type: MIME_EXT[ext] }); }
        if (f.type === 'text/xml') f = new File([f], f.name, { type: 'application/xml' });
        if (facturaId && !/pdf|xml|zip/.test(f.type)) { errs.push(`${f.name}: la factura debe ser PDF, XML o ZIP (CDR)`); continue; }
        if (categoriaF === 'INFORME' && !/pdf|msword|wordprocessingml/.test(f.type)) { errs.push(`${f.name}: el informe debe ser PDF o Word (.doc / .docx)`); continue; }
        if (f.size > 25*1024*1024) { errs.push(`${f.name}: supera 25 MB`); continue; }
        if (esRef && !/pdf|^image\//.test(f.type)) { errs.push(`${f.name}: el documento debe ser PDF o imagen`); continue; }
        const path = `${proyectoId}/${esRef ? 'referencia' : categoriaF.toLowerCase()}/${Date.now()}_${k}_${limpiarNombre(f.name)}`;
        const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (up.error) { errs.push(`${f.name}: ${up.error.message}`); continue; }
        const ins = await sb.from('proyecto_archivos').insert({ proyecto_id: proyectoId, componente_id: componenteId, guia_id: guiaId, factura_id: facturaId, categoria: categoriaF, storage_path: path, nombre: f.name, mime: f.type, tamano: f.size, descripcion: val(form.desc.value.trim()), subido_por: session.user.id });
        if (ins.error) { await sb.storage.from(BUCKET).remove([path]); errs.push(`${f.name}: ${ins.error.message}`); }
      }
      // si la OT aún no tiene N° de informe, se toma el escrito al subir
      // OC del cliente: si la OT no tiene N° de OC, se registra el escrito (y la fecha) y pasa a "Con OC cliente"
      if (categoriaF === 'OC_CLIENTE' && proyecto && !proyecto.numero_oc_cliente && form.desc.value.trim()) {
        const upd = { numero_oc_cliente: form.desc.value.trim(), updated_at: new Date().toISOString() };
        if (proyecto.estado_comercial !== 'DEVUELTO') upd.estado_comercial = 'CON_OC';
        if (form.focc?.value) upd.fecha_oc_cliente = form.focc.value;
        await sb.from('proyectos').update(upd).eq('id', proyectoId);
      } else if (categoriaF === 'OC_CLIENTE' && proyecto && !proyecto.fecha_oc_cliente && form.focc?.value) {
        await sb.from('proyectos').update({ fecha_oc_cliente: form.focc.value, updated_at: new Date().toISOString() }).eq('id', proyectoId);
      }
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
      <div class="row"><button id="ficha" title="Ficha de la OT para imprimir o guardar como PDF">🖨 Ficha PDF</button><button id="edit">Editar datos</button><button class="danger" id="del">Eliminar</button></div>
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
      ${info('Objetivo / alcance', plegable(s.descripcion))}
      ${s.observaciones ? info('Observaciones', plegable(s.observaciones)) : ''}
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

// ---------- vista LABORATORIO (solo datos técnicos: sin montos, facturación, cotización ni estado comercial) ----------
let filtroLab = { q: '', clase: 'SERVICIO', verCerrados: false };
let tabLab = 'componentes';
const diasEntreLab = (a, b) => a ? Math.max(0, Math.round((new Date(String(b || new Date().toISOString().slice(0,10)).slice(0,10) + 'T00:00:00') - new Date(String(a).slice(0,10) + 'T00:00:00')) / 86400000)) : null;
async function renderLabLista(){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  const { data, error } = await sb.rpc('lab_servicios');
  if (error) { $app.querySelector('main').innerHTML = `<div class="err">${esc(error.message)}</div>`; return; }
  const todos = data || [];
  const deClase = todos.filter(p => (p.clase || 'SERVICIO') === filtroLab.clase);
  const q = filtroLab.q.toLowerCase();
  const rows = deClase.filter(p => (filtroLab.verCerrados || p.estado === 'activo') &&
    (!q || [p.numero_orden_trabajo, p.nombre, p.cliente, p.numero_oc_cliente, p.series, p.informes, p.guia_ingreso, p.responsable].some(x => (x || '').toLowerCase().includes(q))));
  const act = deClase.filter(p => p.estado === 'activo');
  const kpi = (n, l) => `<div class="kpi" style="cursor:default"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  $app.querySelector('main').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h1>${filtroLab.clase === 'INTERNO' ? 'Proyectos internos' : 'Servicios'} · vista técnica</h1><div class="sub">Datos técnicos de cada OT: N° de OC del cliente, ingreso del equipo, componentes con N° de serie e informes técnicos.</div></div>
      <div class="row"><button class="${filtroLab.clase === 'SERVICIO' ? 'pri' : ''}" data-clase="SERVICIO">Servicios</button><button class="${filtroLab.clase === 'INTERNO' ? 'pri' : ''}" data-clase="INTERNO">Proyectos internos</button></div>
    </div>
    <div class="kpis">${kpi(act.length, 'Activos')}${kpi(act.filter(p => p.estado_operativo === 'EN_PROCESO').length, 'En proceso')}${kpi(act.filter(p => p.fecha_ingreso && !p.fecha_salida).length, 'Equipos en taller')}${kpi(act.filter(p => !p.informes).length, 'Sin informe')}</div>
    <div class="panel">
      <div class="toolbar">
        <input type="search" id="lab-q" placeholder="Buscar OT, cliente, N° OC, N° de serie, informe…" value="${esc(filtroLab.q)}">
        <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="lab-cerr" ${filtroLab.verCerrados ? 'checked' : ''} style="width:auto"> Ver finalizados</label>
        <div style="flex:1"></div><span class="small">${rows.length} registro(s)</span>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>OT</th><th>Servicio / Cliente</th><th>Estado</th><th>N° OC cliente</th><th>Fecha de ingreso</th><th>N° de serie</th><th>Comp.</th><th>Informes</th></tr></thead>
      <tbody>${rows.map(p => `<tr class="click" data-id="${p.id}">
        <td class="mono" style="font-weight:500;white-space:nowrap">${esc(p.numero_orden_trabajo || '—')}</td>
        <td><div style="font-weight:500">${esc(p.nombre)}</div><div class="small">${esc(p.cliente || 'Sin cliente')}${p.estado !== 'activo' ? ` · ${esc(p.estado)}` : ''}</div></td>
        <td>${badge('op', EST_OP[p.estado_operativo] || p.estado_operativo || '—')}</td>
        <td class="mono">${esc(p.numero_oc_cliente || '—')}${p.fecha_oc_cliente ? `<div class="small">${fdate(p.fecha_oc_cliente)}</div>` : ''}</td>
        <td style="white-space:nowrap">${p.fecha_ingreso ? `${fdate(p.fecha_ingreso)}<div class="small">${esc(p.guia_ingreso || '')}</div>` : '<span class="small">Sin guía</span>'}</td>
        <td class="mono small" style="max-width:200px">${esc(p.series || '—')}</td>
        <td class="mono">${p.n_componentes || 0}</td>
        <td class="mono small" style="white-space:nowrap">${(p.informes || '—').split(', ').map(esc).join('<br>')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No hay registros con este filtro.</td></tr>'}</tbody></table></div>
    </div>`;
  $app.querySelectorAll('[data-clase]').forEach(b => b.onclick = () => { filtroLab.clase = b.dataset.clase; renderLabLista(); });
  $app.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { location.hash = `#/servicio/${tr.dataset.id}`; });
  document.getElementById('lab-cerr').onchange = (e) => { filtroLab.verCerrados = e.target.checked; renderLabLista(); };
  document.getElementById('lab-q').oninput = (e) => { filtroLab.q = e.target.value; clearTimeout(window._lq); window._lq = setTimeout(() => renderLabLista().then(() => { const i = document.getElementById('lab-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
}

async function renderLabDetalle(id){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  const [p, comp, guias, arch, infs] = await Promise.all([
    sb.rpc('lab_servicios').eq('id', id).maybeSingle(),
    sb.from('proyecto_componentes').select('*').eq('proyecto_id', id).order('created_at'),
    sb.from('proyecto_guias').select('*').eq('proyecto_id', id).order('fecha'),
    sb.from('proyecto_archivos').select('*').eq('proyecto_id', id).order('created_at'),
    sb.from('informes_tecnicos').select('*, informe_archivos(*)').eq('proyecto_id', id).order('numero'),
  ]);
  if (p.error || !p.data) { $app.querySelector('main').innerHTML = `<a class="back" href="#/">← Volver</a><div class="err">No se encontró el servicio.</div>`; return; }
  const s = p.data, C = comp.data || [], G = guias.data || [], A = arch.data || [], INF = infs.data || [];
  const urls = await firmarUrls([...A, ...INF.flatMap(archivosInf)]);
  const ge = G.filter(g => g.tipo === 'ENTRADA'), gs = G.filter(g => g.tipo === 'SALIDA');
  const dias = diasEntreLab(s.fecha_ingreso, s.fecha_salida);
  const esPI = s.clase === 'INTERNO';
  const info = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const fotos = A.filter(a => a.categoria === 'FOTO_EQUIPO');
  if (!VE_GUIAS && tabLab === 'guias') tabLab = 'componentes';
  const tabs = [['componentes','Componentes',C.length], ...(VE_GUIAS ? [['guias','Guías de remisión',G.length]] : []), ['informes','Informes técnicos',INF.length],['fotos','Fotos',fotos.length]];
  $app.querySelector('main').innerHTML = `
    <a class="back" href="#/">← ${esPI ? 'Proyectos internos' : 'Servicios'}</a>
    <div class="detail-head">
      <div><div class="ot-tag ${esPI ? 'pi ' : ''}mono">${esc(s.numero_orden_trabajo || '')}</div><h1>${esc(s.nombre)}</h1><div class="sub">${esc(s.cliente || (esPI ? 'Proyecto interno' : 'Sin cliente'))} · ${esc((s.tipo || '').toLowerCase())}${s.estado !== 'activo' ? ' · ' + esc(s.estado) : ''}</div>
        <div class="row" style="margin-top:6px">${badge('op', EST_OP[s.estado_operativo] || s.estado_operativo || '—')} ${badge('pi', VE_GUIAS ? 'Vista técnica · Planeamiento' : 'Vista técnica · Laboratorio')}</div></div>
    </div>
    <div class="grid-info">
      ${info('N° OC del cliente', s.numero_oc_cliente ? `<span class="mono">${esc(s.numero_oc_cliente)}</span> <span class="small">${fdate(s.fecha_oc_cliente)}</span>` : '—')}
      ${info('Fecha de ingreso', s.fecha_ingreso ? `${fdate(s.fecha_ingreso)} <div class="small">${s.guia_ingreso ? `Guía ${esc(s.guia_ingreso)}${ge.length > 1 ? ` (+${ge.length - 1} guía${ge.length > 2 ? 's' : ''} más)` : ''} · ` : ''}${dias} día${dias === 1 ? '' : 's'} en taller${s.fecha_salida ? ` · salió el ${fdate(s.fecha_salida)}` : ''}</div>` : '<span class="small">Sin guía de entrada registrada</span>')}
      ${info('N° de serie', s.series ? `<span class="mono">${esc(s.series)}</span>` : '—')}
      ${info('Informe técnico', (INF.length ? INF.map(i => `<div style="margin-bottom:2px"><a href="#" data-tab-ir="informes" class="mono">${esc(i.numero)}</a> · ${esc(i.titulo)} ${enlacesInforme(i, urls)}</div>`).join('') : '—') + `<div class="small" style="margin-top:2px"><button type="button" class="link sm" id="inf-add-top">+ Registrar informe</button></div>`)}
      ${info('Responsable', esc(s.responsable || '—'))}
      ${info('Inicio / entrega', `${fdate(s.fecha_inicio)} → ${fdate(s.fecha_entrega)}`)}
      ${info('Alcance / descripción', plegable(s.descripcion))}
    </div>
    <div class="panel">
      <div class="tabs">${tabs.map(([k,l,n]) => `<button data-t="${k}" class="${tabLab === k ? 'on' : ''}">${l}<span class="cnt">${n}</span></button>`).join('')}</div>
      <div id="tab"></div>
    </div>`;
  const reload = () => renderLabDetalle(id);
  $app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tabLab = b.dataset.t; reload(); });
  $app.querySelectorAll('[data-tab-ir]').forEach(a => a.onclick = (e) => { e.preventDefault(); tabLab = a.dataset.tabIr; reload(); });
  document.getElementById('inf-add-top').onclick = async () => { if (await editarInforme(null, { proyectoId: id })) reload(); };
  const T = document.getElementById('tab');
  // solo se pueden borrar las fotos que subió el propio usuario
  const soloPropios = () => T.querySelectorAll('[data-rm]').forEach(b => { const a = A.find(x => x.id === b.dataset.rm); if (!a || a.subido_por !== session.user.id) b.remove(); });

  if (tabLab === 'componentes') {
    const fields = [
      { k:'descripcion', l:'Componente / descripción', req:true, full:true, ph:'Ej. Tarjeta electrónica de control' },
      { k:'marca', l:'Marca' }, { k:'modelo', l:'Modelo' },
      { k:'numero_parte', l:'N° de parte (N/P)' }, { k:'numero_serie', l:'N° de serie' },
      { k:'cantidad', l:'Cantidad', t:'number', def:1 },
      { k:'datos_tecnicos', l:'Datos técnicos adicionales', t:'area', full:true, ph:'Voltaje, horómetro, falla reportada, etc.' },
      { k:'observacion', l:'Observación', full:true },
    ];
    T.innerHTML = `<div class="sec-head"><div class="small">Equipos o piezas del servicio. Puedes agregar componentes, completar el N° de serie y los datos técnicos, y subir fotos.</div><button class="pri sm" id="comp-add">+ Agregar componente</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Fotos</th><th>Componente</th><th>Marca / Modelo</th><th>N° parte</th><th>N° serie</th><th>Cant.</th><th>Ingreso</th><th>Datos técnicos</th><th></th></tr></thead><tbody>
      ${C.map((c, i) => `<tr><td>${miniFotos(fotos.filter(a => a.componente_id === c.id), urls, c.id)}</td><td>${esc(c.descripcion)}${c.observacion ? `<div class="small">${esc(c.observacion)}</div>` : ''}</td><td>${esc([c.marca, c.modelo].filter(Boolean).join(' / ') || '—')}</td><td class="mono">${esc(c.numero_parte || '—')}</td><td class="mono">${esc(c.numero_serie || '—')}</td><td class="mono">${esc(c.cantidad)}</td><td class="small" style="white-space:nowrap">${s.fecha_ingreso ? `${fdate(s.fecha_ingreso)}<div>${esc(s.guia_ingreso || '')}</div>` : '—'}</td><td class="small" style="max-width:280px;white-space:pre-line">${esc(c.datos_tecnicos || '—')}</td><td style="text-align:right"><button class="link sm" data-ce="${i}">Editar</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Sin componentes registrados.</td></tr>'}
      </tbody></table></div>`;
    T.querySelectorAll('[data-ce]').forEach(b => b.onclick = async () => { const r = C[b.dataset.ce]; if (await formModal({ title: 'Editar componente', fields, data: r, onSave: async d => chk(await sb.from('proyecto_componentes').update(d).eq('id', r.id)) })) reload(); });
    document.getElementById('comp-add').onclick = async () => { if (await formModal({ title: 'Agregar componente', fields, data: {}, onSave: async d => chk(await sb.from('proyecto_componentes').insert({ ...d, proyecto_id: id })) })) reload(); };
    bindArchivos(T, fotos, urls, id, reload); soloPropios();
  }

  if (tabLab === 'guias' && VE_GUIAS) {
    const pdfs = (gid) => A.filter(a => a.guia_id === gid && urls[a.storage_path]).map(a => `<a href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener">${esImg(a) ? 'Imagen' : 'PDF'}</a>`).join(' · ');
    T.innerHTML = `<div class="sec-head"><div class="small">Guías de remisión de entrada (ingreso a taller) y salida. Las registra Administración.</div></div>
      <div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th>N° guía</th><th>Fecha</th><th>Detalle</th><th>Archivo</th></tr></thead><tbody>
      ${G.map(g => `<tr><td>${badge(g.tipo === 'ENTRADA' ? 'CON_OC' : 'op', g.tipo === 'ENTRADA' ? 'Entrada' : 'Salida')}</td><td class="mono">${esc(g.numero_guia)}</td><td style="white-space:nowrap">${fdate(g.fecha)}</td><td class="small">${esc(g.detalle || '—')}${g.observacion ? `<div>${esc(g.observacion)}</div>` : ''}</td><td class="small">${pdfs(g.id) || '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin guías registradas.</td></tr>'}
      </tbody></table></div>`;
  }

  if (tabLab === 'informes') {
    T.innerHTML = `<div class="sec-head"><div class="small">Informes técnicos de esta OT (iniciales ITI · finales ITF · garantía GAR). El número se asigna solo al registrarlo.</div>
      <button class="pri sm" id="inf-add">+ Nuevo informe</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>N° informe</th><th>Tipo</th><th>Título</th><th>Fecha</th><th>Archivos</th><th></th></tr></thead><tbody>
      ${INF.map(i => filaInforme(i, urls, { conOT:false, enOT:true })).join('') || '<tr><td colspan="6" class="empty">Aún no hay informes. Regístralo con «+ Nuevo informe».</td></tr>'}
      </tbody></table></div>`;
    bindFilasInforme(T, INF, reload);
    document.getElementById('inf-add').onclick = async () => { if (await editarInforme(null, { proyectoId: id })) reload(); };
  }

  if (tabLab === 'fotos') {
    const etiqueta = (a) => { const c = C.find(x => x.id === a.componente_id); return c ? `Componente: ${c.descripcion}` : ''; };
    T.innerHTML = `<div class="sec-head"><div class="small">Fotos del equipo (estado de llegada, placa de datos, avance de la reparación…).</div>
      <button class="pri sm" data-up="FOTO_EQUIPO" data-accept="image/*">+ Subir fotos</button></div>
      <div style="padding:0 12px 14px">${fotos.length ? `<div class="gal">${fotos.map(a => tarjeta(a, urls, etiqueta(a))).join('')}</div>` : '<div class="empty">Aún no hay fotos. Súbelas con el botón de arriba (desde el celular puedes tomar la foto directamente).</div>'}</div>`;
    bindArchivos(T, fotos, urls, id, reload); soloPropios();
  }
}

// ---------- rótulo de despacho (plantilla /rotulo.html; un rótulo por bulto) ----------
const ROTULO_PROVEEDOR = { nombre: 'GTO PERÚ S.A.C.', direccion: 'Variante de Uchumayo km 5.5', ciudad: 'Sachaca · Arequipa' };
const ROTULO_CONTACTO = { area: 'GERENCIA COMERCIAL', nombres: 'IGOR FERNÁNDEZ', telefonos: '+51 937 339 957  /  +51 914 493 884', correo: 'ifernandez@gtoperu.com', direccion: 'Cal. German Schreiber N.º 276 Int. T301, Urb. Santa Ana · San Isidro, Lima' };
const TIPOS_REF = ['SOLPED', 'PR', 'REQUERIMIENTO', 'PEDIDO', 'LICITACION', 'LICITACIÓN', 'OC', 'OS', 'CONTRATO'];
const fechaDMY = (d) => { const x = String(d || '').slice(0, 10).split('-'); return x.length === 3 ? `${x[2]}/${x[1]}/${x[0]}` : ''; };
const b64url = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const urlRotulo = (datos) => `/rotulo.html?data=${b64url(datos)}`;
function separarReferencia(ref){
  const t = String(ref || '').trim(); if (!t) return { tipo: '', numero: '' };
  const m = t.match(/^([A-Za-zÁÉÍÓÚáéíóú.]+)\s*[:#Nº°.\-]*\s*(.+)$/);
  if (m && TIPOS_REF.includes(m[1].toUpperCase().replace(/\./g, ''))) return { tipo: m[1].toUpperCase().replace(/\./g, ''), numero: m[2].trim() };
  return { tipo: 'REFERENCIA', numero: t };
}
async function abrirRotulo({ s, C, G, F }){
  const prev = (await sb.from('proyecto_rotulos').select('*').eq('proyecto_id', s.id).order('created_at', { ascending: false })).data || [];
  const ult = prev[0]?.datos || null;
  // datos del cotizador: dirección del cliente y referencia (SOLPED / licitación) de la cotización
  let cli = null, ref = { tipo: '', numero: '' };
  try {
    const { clientes, cotizaciones } = await listasCotizador();
    const norm = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    cli = clientes.find(c => norm(c.razon_social) === norm(s.cliente)) || null;
    const q = s.numero_cotizacion ? cotizaciones.find(x => x.numero === String(s.numero_cotizacion).trim()) : null;
    if (q?.referencia) ref = separarReferencia(q.referencia);
  } catch {}
  const gsal = [...G].filter(g => g.tipo === 'SALIDA').sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))[0] || null;
  const facts = F.filter(f => f.estado_cobro !== 'ANULADA').map(f => f.numero_factura).filter(Boolean).join(', ');
  const base = {
    tamano: ult?.tamano || 'A4',
    cliente: { nombre: s.cliente || ult?.cliente?.nombre || '', direccion: ult?.cliente?.direccion || '', ciudad: ult?.cliente?.ciudad || '' },  // lugar de entrega que indica el cliente (no la dirección fiscal)
    destinoFinal: ult?.destinoFinal || '',
    referencia: { tipo: ult?.referencia?.tipo || ref.tipo, numero: ult?.referencia?.numero || ref.numero, detalle: ult?.referencia?.detalle || (ref.numero ? 'Pedido / requerimiento del cliente' : '') },
    ordenCompra: s.numero_oc_cliente || ult?.ordenCompra || '',
    factura: facts || ult?.factura || '',
    guia: gsal?.numero_guia || ult?.guia || '',
    fecha: gsal?.fecha ? fechaDMY(gsal.fecha) : fechaDMY(new Date().toISOString()),
    bulto: { actual: ult ? String(Math.min((+ult.bulto?.actual || 0) + 1, +ult.bulto?.total || 99)).padStart(2, '0') : '01', total: ult?.bulto?.total || '01', tipo: ult?.bulto?.tipo || 'Cajas' },
    peso: '', dimensiones: ult?.dimensiones || '', preparadoPor: ult?.preparadoPor || 'Almacén GTO',
    contacto: { ...ROTULO_CONTACTO, ...(ult?.contacto || {}) },
  };
  const yaEnBultos = new Set(prev.flatMap(r => (r.datos?.items || []).map(i => i._cid)).filter(Boolean));
  const inp = (n, v, ph = '', extra = '') => `<input name="${n}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" ${extra}>`;
  const lab = (t, html, full = false) => `<label class="f ${full ? 'full' : ''}"><span>${t}</span>${html}</label>`;
  $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:860px">
    <header><h2>Rótulo de despacho · <span class="mono">${esc(s.numero_orden_trabajo || '')}</span></h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body">
      ${prev.length ? `<div class="small" style="margin-bottom:10px"><b>Rótulos generados:</b> ${prev.map(r => `<span style="white-space:nowrap">Bulto ${esc(r.datos?.bulto?.actual || r.bulto_actual || '')}/${esc(r.datos?.bulto?.total || r.bulto_total || '')} · ${fdate(r.created_at)} <a href="${esc(urlRotulo(r.datos))}" target="_blank" rel="noopener">Reimprimir</a> <button type="button" class="link sm danger" data-rdel="${r.id}" title="Quitar del historial">✕</button></span>`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      <div class="fgrid">
        <div class="fsec">Bulto</div>
        ${lab('Bulto N°', inp('b_actual', base.bulto.actual, '01'))}
        ${lab('De un total de', inp('b_total', base.bulto.total, '01'))}
        ${lab('Tipo de bulto', inp('b_tipo', base.bulto.tipo, 'Cajas', 'list="dl-btipo"') + '<datalist id="dl-btipo"><option>Cajas</option><option>Caja de madera</option><option>Jabas</option><option>Pallets</option><option>Sobre</option></datalist>')}
        ${lab('Peso (kg)', inp('peso', base.peso, 'Ej. 90', 'inputmode="decimal"'))}
        ${lab('Dimensiones (cm) largo × ancho × alto', inp('dims', base.dimensiones, '84 × 68 × 67'))}
        ${lab('Preparado por', inp('prep', base.preparadoPor))}
        ${lab('Tamaño de hoja', `<select name="tamano"><option value="A4" ${base.tamano === 'A4' ? 'selected' : ''}>A4 horizontal</option><option value="A3" ${base.tamano === 'A3' ? 'selected' : ''}>A3 horizontal</option></select>`)}
        <div class="fsec">Productos en este bulto</div>
        <div class="full" style="grid-column:1/-1">${C.length ? `<div class="tbl-wrap"><table><thead><tr><th></th><th>Descripción</th><th>N° parte</th><th>N° serie</th><th style="width:80px">Cant.</th></tr></thead><tbody>
          ${C.map(c => `<tr><td><input type="checkbox" data-ci="${c.id}" ${yaEnBultos.has(c.id) ? '' : 'checked'} style="width:auto"></td><td>${esc(c.descripcion)}${yaEnBultos.has(c.id) ? ' <span class="small">(ya rotulado)</span>' : ''}</td><td class="mono small">${esc(c.numero_parte || '—')}</td><td class="mono small">${esc(c.numero_serie || '—')}</td><td><input data-cq="${c.id}" value="${esc(c.cantidad ?? 1)}" style="width:70px"></td></tr>`).join('')}
          </tbody></table></div><div class="small" style="margin-top:4px">1 producto marcado = formato de producto único; 2 o más = tabla de contenido del bulto.</div>` : '<div class="err">Esta OT no tiene componentes. Agrégalos en la pestaña Componentes (descripción, N° de parte y N° de serie).</div>'}</div>
        <div class="fsec">Destino y documentos</div>
        ${lab('Cliente', inp('c_nom', base.cliente.nombre))}
        ${lab('Dirección de entrega (según indique el cliente)', inp('c_dir', base.cliente.direccion, 'Ej. Almacén central, Av. … (no necesariamente la fiscal)'))}
        ${lab('Ciudad / distrito de entrega', inp('c_ciu', base.cliente.ciudad, 'Ej. San Juan de Marcona'))}
        ${lab('Destino final / unidad', inp('destino', base.destinoFinal, 'Ej. San Nicolás'))}
        ${lab('Referencia (tipo)', inp('r_tipo', base.referencia.tipo, 'SOLPED', 'list="dl-rtipo"') + `<datalist id="dl-rtipo">${TIPOS_REF.filter(t => t !== 'LICITACIÓN').map(t => `<option>${t}</option>`).join('')}</datalist>`)}
        ${lab('Referencia (N°)', inp('r_num', base.referencia.numero))}
        ${lab('Referencia (detalle)', inp('r_det', base.referencia.detalle, 'Pedido / requerimiento del cliente'))}
        ${lab('Orden de compra del cliente', inp('oc', base.ordenCompra))}
        ${lab('Factura', inp('fac', base.factura, 'Solo sale en el formato de varios productos'))}
        ${lab('Guía de remisión', inp('guia', base.guia, 'EG07-…'))}
        ${lab('Fecha de despacho', inp('fecha', base.fecha, 'dd/mm/aaaa'))}
      </div>
      <div class="err" hidden></div>
    </div>
    <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Guardar e imprimir rótulo</button></footer></form></div>`;
  const form = $modal.querySelector('form');
  const fin = () => { $modal.innerHTML = ''; };
  $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = fin);
  const showErr = (m) => { const e = form.querySelector('.err'); e.hidden = false; e.textContent = m; };
  $modal.querySelectorAll('[data-rdel]').forEach(b => b.onclick = async () => {
    if (!confirm('¿Quitar este rótulo del historial?')) return;
    const { error } = await sb.from('proyecto_rotulos').delete().eq('id', b.dataset.rdel);
    if (error) return toast(error.message); b.parentElement.remove(); toast('Rótulo quitado del historial');
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = (n) => (form.elements[n]?.value || '').trim();
    const sel = C.filter(c => form.querySelector(`[data-ci="${c.id}"]`)?.checked);
    if (!sel.length) return showErr('Marca al menos un producto para este bulto.');
    const pad = (x) => String(x).padStart(2, '0');
    const datos = {
      ot: s.numero_orden_trabajo || '', tamano: v('tamano') || 'A4',
      proveedor: ROTULO_PROVEEDOR,
      cliente: { nombre: v('c_nom'), direccion: v('c_dir'), ciudad: v('c_ciu') },
      destinoFinal: v('destino'),
      referencia: { tipo: v('r_tipo'), numero: v('r_num'), detalle: v('r_det') },
      ordenCompra: v('oc'), factura: v('fac'), guia: v('guia'), fecha: v('fecha'),
      items: sel.map((c, i) => ({ item: pad(i + 1), descripcion: c.descripcion || '', numeroParte: c.numero_parte || '', numeroSerie: c.numero_serie || '', cantidad: form.querySelector(`[data-cq="${c.id}"]`)?.value.trim() || String(c.cantidad ?? 1), _cid: c.id })),
      bulto: { actual: pad(v('b_actual') || '1'), total: pad(v('b_total') || '1'), tipo: v('b_tipo') },
      peso: v('peso'), dimensiones: v('dims'), preparadoPor: v('prep'),
    };
    const w = window.open('about:blank', '_blank');  // se abre ya (si se espera al guardado, el navegador lo bloquea)
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    const { error } = await sb.from('proyecto_rotulos').insert({ proyecto_id: s.id, bulto_actual: +datos.bulto.actual || null, bulto_total: +datos.bulto.total || null, datos });
    if (error) { if (w) w.close(); btn.disabled = false; return showErr(error.message); }
    if (w) w.location.href = urlRotulo(datos); else location.href = urlRotulo(datos);
    fin(); toast(`Rótulo del bulto ${datos.bulto.actual}/${datos.bulto.total} generado`);
  };
}

// ---------- FACTORING: cartas de cesión de facturas ----------
const EST_FACT = { EMITIDA:'Emitida · por abonar', ABONADO:'Abonado', ANULADA:'Anulada' };
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const codigoCarta = (c) => `CARTA Nº ${String(c.numero).padStart(2, '0')} -${c.anio}/ ${c.sigla} -GTO`;
const codigoCorto = (c) => `${String(c.numero).padStart(2, '0')}-${c.anio}/${c.sigla}`;
const fechaLarga = (d) => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${+dd} de ${MESES_ES[+m - 1]} de ${y}`; };
const fechaPuntos = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('.') : '—';
const importeCarta = (n, m) => (m === 'DOLARES' ? '$' : 'S/ ') + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let filtroFact = { estado: 'ACTIVAS', q: '' };
const CONCEPTO_ABONO = { DESEMBOLSO:'Desembolso', CONFIRMACION:'Pendiente por confirmación', EXCEDENTE:'Excedente (devolución)', OTRO:'Otro' };
const costosLiq = (c) => ['costo_interes','costo_comision','costo_gastos','costo_igv'].some(k => c[k] != null) ? ['costo_interes','costo_comision','costo_gastos','costo_igv'].reduce((t, k) => t + Number(c[k] || 0), 0) : null;
// costo real del factoring: costos de la liquidación; si no hay, importe − detracción − neto
const costoFactoring = (c) => { const k = costosLiq(c); if (k != null) return k; return c.neto_recibir == null ? null : Number(c.importe) - Number(c.detraccion || 0) - Number(c.neto_recibir); };

async function cargarFactoring(){
  const [c, e, d, cfg, ab, dc] = await Promise.all([
    sb.from('factoring_cartas').select('*, proyectos:proyecto_id(numero_orden_trabajo,numero_oc_cliente,nombre)').order('fecha', { ascending: false }).order('numero', { ascending: false }),
    sb.from('factoring_entidades').select('*').order('nombre'),
    sb.from('factoring_destinatarios').select('*').order('razon_social'),
    sb.from('factoring_config').select('*').eq('id', 1).maybeSingle(),
    sb.from('factoring_abonos').select('*').order('fecha', { ascending: true, nullsFirst: false }),
    sb.from('factoring_documentos').select('*').order('creado_at'),
  ]);
  if (c.error) throw new Error(c.error.message);
  const A = ab.data || [];
  const DC = dc.data || [];
  (c.data || []).forEach(x => { x.abonos = A.filter(a => a.carta_id === x.id); x.docs = DC.filter(a => a.carta_id === x.id); });
  return { cartas: c.data || [], entidades: e.data || [], destinatarios: d.data || [], config: cfg.data || { id: 1, lugar: 'Arequipa' } };
}

async function renderFactoring(){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  let D;
  try { D = await cargarFactoring(); } catch (e) { $app.querySelector('main').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const { cartas } = D;
  const vig = cartas.filter(c => c.estado !== 'ANULADA');
  const suma = (l, f) => { const r = {}; l.forEach(c => { const v = f(c); if (v != null) r[c.moneda] = (r[c.moneda] || 0) + Number(v); }); return Object.entries(r).map(([m, v]) => money(v, m)).join(' · ') || '—'; };
  const porRecibir = vig.filter(c => c.estado === 'EMITIDA');
  const sinNeto = porRecibir.filter(c => c.neto_recibir == null).length;
  const kpi = (n, l) => `<div class="kpi" style="cursor:default"><div class="n" style="font-size:18px">${n}</div><div class="l">${l}</div></div>`;
  const q = filtroFact.q.toLowerCase();
  const rows = cartas.filter(c => (filtroFact.estado === 'TODAS' || (filtroFact.estado === 'ACTIVAS' ? c.estado !== 'ANULADA' : c.estado === filtroFact.estado)) &&
    (!q || [codigoCorto(c), c.cliente_razon, c.numero_factura, c.entidad_nombre, c.proyectos?.numero_orden_trabajo, c.proyectos?.numero_oc_cliente].some(x => String(x || '').toLowerCase().includes(q))));
  $app.querySelector('main').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h1>Factoring · Cartas de cesión</h1><div class="sub">Cartas de cesión de facturas al factoring, vinculadas a la OT / OC del cliente. El neto a recibir alimenta el presupuesto de GTO Finanzas.</div></div>
      <div class="row"><button id="fac-cfg">⚙ Configuración</button><button class="pri" id="fac-nueva">+ Nueva carta</button></div>
    </div>
    ${D.config.firma_imagen ? '' : '<div class="err" style="margin-top:12px">Falta cargar la imagen de firma y sello de Gerencia General. Entra a ⚙ Configuración para subirla (las cartas saldrán sin firma hasta entonces).</div>'}
    <div class="kpis">${kpi(vig.length, 'Cartas emitidas')}${kpi(suma(vig, c => c.importe), 'Importe cedido')}${kpi(suma(vig, c => c.abonos.length ? c.abonos.filter(a => !a.recibido).reduce((t, a) => t + Number(a.monto), 0) : (c.estado === 'EMITIDA' ? c.neto_recibir : null)), 'Neto por recibir' + (sinNeto ? ` · ${sinNeto} sin neto` : ''))}${kpi(suma(vig, c => c.abonos.length ? c.abonos.filter(a => a.recibido).reduce((t, a) => t + Number(a.monto), 0) : (c.estado === 'ABONADO' ? c.neto_recibir : null)), 'Neto ya recibido')}${kpi(suma(vig, costoFactoring), 'Costo del factoring')}</div>
    <div class="panel">
      <div class="toolbar">
        <input type="search" id="fac-q" placeholder="Buscar carta, cliente, factura, OT u OC…" value="${esc(filtroFact.q)}">
        <select id="fac-est">${[['ACTIVAS','Vigentes'],['EMITIDA','Por abonar'],['ABONADO','Abonadas'],['ANULADA','Anuladas'],['TODAS','Todas']].map(([k, l]) => `<option value="${k}" ${filtroFact.estado === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div style="flex:1"></div><span class="small">${rows.length} carta(s)</span>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>Carta / cliente</th><th>OT / OC</th><th>Factura</th><th style="text-align:right">Importe</th><th>Factoring</th><th style="text-align:right">Neto a recibir</th><th>Abonos</th><th>Estado / acciones</th></tr></thead>
      <tbody>${rows.map(c => `<tr>
        <td style="min-width:150px"><span class="mono" style="white-space:nowrap;font-weight:500">${esc(codigoCorto(c))}</span><div class="small">${fdate(c.fecha)}</div><div class="small">${esc(c.cliente_razon)}</div></td>
        <td style="white-space:nowrap">${c.proyecto_id ? `<a class="mono" href="#/servicio/${c.proyecto_id}">${esc(c.proyectos?.numero_orden_trabajo || 'OT')}</a>${c.proyectos?.numero_oc_cliente ? `<div class="small">OC ${esc(c.proyectos.numero_oc_cliente)}</div>` : ''}` : '<span class="small">Sin OT</span>'}</td>
        <td class="mono" style="white-space:nowrap">${esc(c.numero_factura)}<div class="small">Vence ${fdate(c.fecha_vencimiento)}</div></td>
        <td class="money" style="white-space:nowrap">${money(c.importe, c.moneda)}</td>
        <td class="small" style="color:var(--ink)">${esc(c.entidad_nombre)}</td>
        <td class="money" style="white-space:nowrap">${c.neto_recibir != null ? money(c.neto_recibir, c.moneda) : '<span class="small">Por definir</span>'}${costoFactoring(c) != null ? `<div class="small">Costo ${money(costoFactoring(c), c.moneda)}</div>` : ''}${c.detraccion ? `<div class="small">Detracción ${money(c.detraccion, c.moneda)}</div>` : ''}</td>
        <td style="white-space:nowrap">${c.abonos.length ? c.abonos.map(a => `<div class="small" style="color:${a.recibido ? 'var(--ok)' : 'var(--warn)'}">${a.recibido ? '✓' : '○'} ${money(a.monto, c.moneda)} · ${a.fecha ? fdate(a.fecha) : 'sin fecha'}<br><span style="color:var(--muted)">${esc(CONCEPTO_ABONO[a.concepto] || a.concepto)}</span></div>`).join('') : fdate(c.fecha_abono)}${c.liquidacion_numero ? `<div class="small">Liq. N° ${esc(c.liquidacion_numero)}</div>` : ''}</td>
        <td style="min-width:170px">${c.estado === 'EMITIDA' && c.abonos.some(x => x.recibido) ? badge('PARCIAL', 'Abono parcial') : badge(c.estado === 'ABONADO' ? 'COBRADO' : c.estado === 'ANULADA' ? 'ANULADA' : 'PENDIENTE', EST_FACT[c.estado])}
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:0 2px">
          <button class="link sm" data-fp="${c.id}">Imprimir</button>
          <button class="link sm" data-fe="${c.id}">Editar</button>
          ${c.estado !== 'ANULADA' ? `<button class="link sm" data-fa="${c.id}">Liquidación y abonos</button>` : ''}
          <button class="link sm" data-fd="${c.id}" title="Evidencias: carta recibida, liquidación, depósitos…">📎 Documentos${c.docs.length ? ` (${c.docs.length})` : ''}</button>
          ${c.estado !== 'ANULADA' ? `<button class="link sm danger" data-fx="${c.id}">Anular</button>` : ''}
        </div></td></tr>`).join('') || '<tr><td colspan="9" class="empty">No hay cartas con este filtro.</td></tr>'}</tbody></table></div>
    </div>`;
  const reload = () => renderFactoring();
  const busca = (id) => cartas.find(c => c.id === id);
  document.getElementById('fac-nueva').onclick = async () => { if (await editarCarta(null, D)) reload(); };
  document.getElementById('fac-cfg').onclick = () => configFactoring(D, reload);
  document.getElementById('fac-q').oninput = (e) => { filtroFact.q = e.target.value; clearTimeout(window._fq); window._fq = setTimeout(() => renderFactoring().then(() => { const i = document.getElementById('fac-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
  document.getElementById('fac-est').onchange = (e) => { filtroFact.estado = e.target.value; reload(); };
  $app.querySelectorAll('[data-fp]').forEach(b => b.onclick = () => imprimirCarta(busca(b.dataset.fp), D.config));
  $app.querySelectorAll('[data-fe]').forEach(b => b.onclick = async () => { if (await editarCarta(busca(b.dataset.fe), D)) reload(); });
  $app.querySelectorAll('[data-fd]').forEach(b => b.onclick = () => documentosFactoring(busca(b.dataset.fd), reload));
  $app.querySelectorAll('[data-fa]').forEach(b => b.onclick = async () => { if (await liquidacionAbonos(busca(b.dataset.fa))) reload(); });
  $app.querySelectorAll('[data-fx]').forEach(b => b.onclick = async () => {
    const c = busca(b.dataset.fx);
    if (!await confirmModal(`¿Anular la carta ${codigoCorto(c)}? Queda en el historial como anulada y ya no se considera en el presupuesto. El número no se reutiliza.`)) return;
    const { error } = await sb.from('factoring_cartas').update({ estado: 'ANULADA' }).eq('id', c.id); error ? toast(error.message) : (toast('Carta anulada'), reload());
  });
}

// formulario de carta (nueva o edición)
async function editarCarta(carta, D){
  const { entidades, destinatarios, config } = D;
  const ents = entidades.filter(e => e.activo || e.id === carta?.entidad_id);
  const dests = destinatarios.filter(d => d.activo || d.id === carta?.destinatario_id);
  if (!ents.length || !dests.length) { toast('Primero registra el factoring y el cliente destinatario en ⚙ Configuración'); return false; }
  // OT con facturas (para vincular la carta a la OC del cliente)
  const [pr, fa] = await Promise.all([
    sb.from('proyectos_maestro').select('id,numero_orden_trabajo,numero_oc_cliente,cliente,nombre,clase').neq('clase', 'INTERNO').order('numero_orden_trabajo', { ascending: false }),
    sb.from('proyecto_facturas').select('id,proyecto_id,numero_factura,moneda,monto,fecha_emision,fecha_vencimiento,estado_cobro').neq('estado_cobro', 'ANULADA'),
  ]);
  const P = pr.data || [], F = fa.data || [];
  const cedidas = new Set(D.cartas.filter(c => c.estado !== 'ANULADA' && c.id !== carta?.id && c.factura_id).map(c => c.factura_id));
  const norm = (x) => String(x || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
  const destDe = (cliente) => dests.find(d => { const a = norm(d.razon_social), b = norm(cliente); return a && b && (a.includes(b.slice(0, 12)) || b.includes(a.slice(0, 12))); });
  const conFact = P.filter(p => F.some(f => f.proyecto_id === p.id));
  const c0 = carta || {};
  const hoy = new Date().toISOString().slice(0, 10);
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(l)}</option>`;
  const lab = (t, html, full = false) => `<label class="f ${full ? 'full' : ''}"><span>${t}</span>${html}</label>`;
  $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:820px">
    <header><h2>${carta ? 'Editar carta ' + esc(codigoCorto(carta)) : 'Nueva carta de cesión (factoring)'}</h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body"><div class="fgrid">
      <div class="fsec">Servicio y factura</div>
      ${lab('OT / OC del cliente', `<select name="proyecto_id"><option value="">— Sin OT (factura manual) —</option>${conFact.map(p => opt(p.id, `${p.numero_orden_trabajo || ''} · ${p.cliente || ''}${p.numero_oc_cliente ? ' · OC ' + p.numero_oc_cliente : ''}`, p.id === c0.proyecto_id)).join('')}</select>`, true)}
      ${lab('Factura de la OT', `<select name="factura_id"><option value="">— Escribir manualmente —</option></select>`, true)}
      ${lab('N° de factura *', `<input name="numero_factura" value="${esc(c0.numero_factura || '')}" placeholder="E001-482" required>`)}
      ${lab('Moneda', `<select name="moneda">${opt('DOLARES', 'Dólares', (c0.moneda || 'DOLARES') === 'DOLARES')}${opt('SOLES', 'Soles', c0.moneda === 'SOLES')}</select>`)}
      ${lab('Importe de la factura (con IGV) *', `<input name="importe" type="number" step="any" value="${esc(c0.importe ?? '')}" required>`)}
      ${lab('Fecha de vencimiento', `<input name="fecha_vencimiento" type="date" value="${esc(c0.fecha_vencimiento || '')}">`)}
      <div class="fsec">Carta</div>
      ${lab('Dirigida a (cliente) *', `<select name="destinatario_id">${dests.map(d => opt(d.id, `${d.razon_social} (${d.sigla})`, d.id === c0.destinatario_id)).join('')}</select>`)}
      ${lab('Atención', `<input name="atencion" value="${esc(c0.atencion || '')}" placeholder="SRA. … - JEFE DE FINANZAS">`)}
      ${lab('Factoring (a quién se paga) *', `<select name="entidad_id">${ents.map(e => opt(e.id, `${e.nombre}${e.ruc ? ' · RUC ' + e.ruc : ''}`, e.id === c0.entidad_id)).join('')}</select>`)}
      ${lab('Fecha de la carta', `<input name="fecha" type="date" value="${esc(c0.fecha || hoy)}">`)}
      ${lab('Lugar', `<input name="lugar" value="${esc(c0.lugar || config.lugar || 'Arequipa')}">`)}
      ${lab('N° de carta', `<input name="numero" type="number" min="1" value="${esc(c0.numero ?? '')}" placeholder="Automático">`)}
      <div class="fsec">Lo que se recibirá (para el presupuesto)</div>
      ${c0.abonos?.length ? `<div class="small" style="grid-column:1/-1">Esta carta ya tiene ${c0.abonos.length} abono(s) registrados (neto ${money(c0.neto_recibir, c0.moneda)}). Se editan en <b>Liquidación y abonos</b>.</div>` : lab('Neto a recibir del factoring (estimado)', `<input name="neto_recibir" type="number" step="any" value="${esc(c0.neto_recibir ?? '')}" placeholder="Lo que deposita el factoring">`)}
      ${c0.abonos?.length ? '' : lab('Fecha de abono (estimada)', `<input name="fecha_abono" type="date" value="${esc(c0.fecha_abono || '')}">`)}
      ${lab('Observación', `<input name="observacion" value="${esc(c0.observacion || '')}">`, true)}
    </div><div class="small" id="fc-info" style="margin-top:8px"></div><div class="err" hidden></div></div>
    <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">${carta ? 'Guardar' : 'Guardar e imprimir carta'}</button></footer></form></div>`;
  const form = $modal.querySelector('form');
  const el = (n) => form.elements[n];
  const info = form.querySelector('#fc-info');
  const showErr = (m) => { const e = form.querySelector('.err'); e.hidden = false; e.textContent = m; };
  const actualizaInfo = () => {
    const imp = +el('importe').value, neto = !el('neto_recibir') || el('neto_recibir').value === '' ? null : +el('neto_recibir').value;
    const d = dests.find(x => x.id === el('destinatario_id').value);
    const sig = d ? d.sigla : '';
    const anio = (el('fecha').value || hoy).slice(0, 4);
    const prox = el('numero').value || (Math.max(0, ...D.cartas.filter(c => c.sigla === sig && String(c.anio) === anio).map(c => c.numero)) + 1);
    info.innerHTML = `Saldrá como <b class="mono">CARTA Nº ${String(prox).padStart(2, '0')} -${anio}/ ${esc(sig)} -GTO</b>` + (imp && neto != null ? ` · Costo del factoring: <b>${money(imp - neto, el('moneda').value)}</b> (${(100 * (imp - neto) / imp).toFixed(2)}%)` : '');
  };
  const llenarFacturas = (keep) => {
    const pid = el('proyecto_id').value;
    const lf = F.filter(f => f.proyecto_id === pid);
    el('factura_id').innerHTML = `<option value="">— Escribir manualmente —</option>` + lf.map(f => opt(f.id, `${f.numero_factura} · ${money(f.monto, f.moneda)}${f.fecha_vencimiento ? ' · vence ' + fdate(f.fecha_vencimiento) : ''}${cedidas.has(f.id) ? ' · YA CEDIDA' : ''}`, keep ? f.id === c0.factura_id : false)).join('');
    if (!keep && lf.length === 1) { el('factura_id').value = lf[0].id; aplicarFactura(); }
    const p = P.find(x => x.id === pid);
    if (p && !keep) { const d = destDe(p.cliente); if (d) { el('destinatario_id').value = d.id; aplicarDest(); } }
  };
  const aplicarFactura = () => {
    const f = F.find(x => x.id === el('factura_id').value); if (!f) return;
    el('numero_factura').value = f.numero_factura || ''; el('moneda').value = f.moneda || 'DOLARES';
    el('importe').value = f.monto ?? ''; el('fecha_vencimiento').value = f.fecha_vencimiento || '';
    actualizaInfo();
  };
  const aplicarDest = () => { const d = dests.find(x => x.id === el('destinatario_id').value); if (d) el('atencion').value = [d.atencion, d.cargo].filter(Boolean).join(' - '); actualizaInfo(); };
  llenarFacturas(true);
  if (!carta) aplicarDest();
  el('proyecto_id').onchange = () => llenarFacturas(false);
  el('factura_id').onchange = aplicarFactura;
  el('destinatario_id').onchange = aplicarDest;
  ['importe', 'neto_recibir', 'moneda', 'fecha', 'numero'].forEach(n => el(n)?.addEventListener('input', actualizaInfo));
  actualizaInfo();
  return new Promise(resolve => {
    const close = (r) => { $modal.innerHTML = ''; resolve(r); };
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close(false));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = (n) => el(n).value.trim();
      if (!v('numero_factura')) return showErr('Completa el N° de factura.');
      if (!(+v('importe') > 0)) return showErr('Completa el importe de la factura.');
      if (v('factura_id') && cedidas.has(v('factura_id')) && !await new Promise(r => { r(confirm('Esa factura ya tiene una carta de cesión vigente. ¿Emitir otra de todas formas?')); })) return;
      const d = dests.find(x => x.id === v('destinatario_id')), en = ents.find(x => x.id === v('entidad_id'));
      const fecha = v('fecha') || hoy;
      const row = {
        proyecto_id: val(v('proyecto_id')), factura_id: val(v('factura_id')),
        numero_factura: v('numero_factura').toUpperCase(), moneda: v('moneda'), importe: +v('importe'), fecha_vencimiento: val(v('fecha_vencimiento')),
        destinatario_id: d.id, cliente_razon: d.razon_social, sigla: d.sigla, atencion: val(v('atencion')),
        entidad_id: en.id, entidad_nombre: en.nombre, entidad_ruc: en.ruc, entidad_telefono: en.telefono, entidad_correo: en.correo,
        fecha, anio: +fecha.slice(0, 4), lugar: v('lugar') || 'Arequipa',
        observacion: val(v('observacion')),
      };
      if (el('neto_recibir')) { row.neto_recibir = v('neto_recibir') === '' ? null : +v('neto_recibir'); row.fecha_abono = val(v('fecha_abono')); }
      if (v('numero')) row.numero = +v('numero'); else if (!carta) row.numero = null;
      const w = carta ? null : window.open('about:blank', '_blank');
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const r = carta ? await sb.from('factoring_cartas').update(row).eq('id', carta.id).select().single()
                      : await sb.from('factoring_cartas').insert(row).select().single();
      if (r.error) { if (w) w.close(); btn.disabled = false; return showErr(/duplicate|unique/i.test(r.error.message) ? 'Ese N° de carta ya existe para este cliente y año.' : r.error.message); }
      if (w) imprimirCarta(r.data, config, w);
      toast(carta ? 'Carta actualizada' : `Carta ${codigoCorto(r.data)} emitida`);
      close(true);
    };
  });
}

async function liquidacionAbonos(c){
  const hoy = new Date().toISOString().slice(0, 10);
  const sim = c.moneda === 'DOLARES' ? 'US$' : 'S/';
  let filas = c.abonos.length ? c.abonos.map(a => ({ ...a })) : [];
  const num = (v) => v === '' || v == null ? null : Number(v);
  const lab = (t, html) => `<label class="f"><span>${t}</span>${html}</label>`;
  const inpN = (n, v) => `<input name="${n}" type="number" step="any" value="${esc(v ?? '')}">`;
  $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:860px">
    <header><h2>Liquidación y abonos · carta ${esc(codigoCorto(c))} · factura ${esc(c.numero_factura)} (${money(c.importe, c.moneda)})</h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body"><div class="fgrid">
      <div class="fsec">Liquidación de ${esc(c.entidad_nombre)}</div>
      ${lab('N° de liquidación', `<input name="liquidacion_numero" value="${esc(c.liquidacion_numero || '')}" placeholder="41788">`)}
      ${lab('Fecha de operación', `<input name="liquidacion_fecha" type="date" value="${esc(c.liquidacion_fecha || '')}">`)}
      ${lab(`Detracción (${sim})`, inpN('detraccion', c.detraccion))}
      ${lab(`Diferencia de precio / interés (${sim})`, inpN('costo_interes', c.costo_interes))}
      ${lab(`Comisión (${sim})`, inpN('costo_comision', c.costo_comision))}
      ${lab(`Gastos operacionales y otros (${sim})`, inpN('costo_gastos', c.costo_gastos))}
      ${lab(`IGV (${sim})`, inpN('costo_igv', c.costo_igv))}
    </div>
    <div class="fsec" style="margin-top:12px">Abonos que deposita el factoring</div>
    <div class="tbl-wrap"><table><thead><tr><th>Concepto</th><th style="width:130px">Monto (${sim})</th><th style="width:150px">Fecha</th><th>Recibido</th><th></th></tr></thead><tbody id="ab-rows"></tbody></table></div>
    <div class="row" style="margin-top:6px"><button type="button" class="sm" id="ab-add">+ Agregar abono</button><button type="button" class="sm" id="ab-plant" title="Desembolso + pendiente por confirmación (CxP) + excedente">Plantilla BANPRO</button></div>
    <div id="ab-cuadre" class="small" style="margin-top:10px"></div>
    <label class="f" style="margin-top:8px;flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="marcar" ${c.factura_id ? 'checked' : 'disabled'} style="width:auto"><span>Cuando todo esté recibido, marcar la factura de la OT como cobrada</span></label>
    <div class="err" hidden></div></div>
    <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Guardar</button></footer></form></div>`;
  const form = $modal.querySelector('form');
  const tb = form.querySelector('#ab-rows');
  const leer = () => { tb.querySelectorAll('tr').forEach((tr, i) => { const f = filas[i]; f.concepto = tr.querySelector('[data-k=concepto]').value; f.monto = num(tr.querySelector('[data-k=monto]').value); f.fecha = tr.querySelector('[data-k=fecha]').value || null; f.recibido = tr.querySelector('[data-k=recibido]').checked; }); };
  const cuadre = () => {
    leer();
    const v = (n) => Number(form.elements[n].value || 0);
    const costos = v('costo_interes') + v('costo_comision') + v('costo_gastos') + v('costo_igv');
    const abonos = filas.reduce((t, f) => t + Number(f.monto || 0), 0);
    const rec = filas.filter(f => f.recibido).reduce((t, f) => t + Number(f.monto || 0), 0);
    const dif = Math.round((Number(c.importe) - v('detraccion') - costos - abonos) * 100) / 100;
    form.querySelector('#ab-cuadre').innerHTML = `Factura ${money(c.importe, c.moneda)} − detracción ${money(v('detraccion'), c.moneda)} − costos ${money(costos, c.moneda)} − abonos ${money(abonos, c.moneda)} = <b style="color:${Math.abs(dif) < 0.01 ? 'var(--ok)' : 'var(--bad)'}">${money(dif, c.moneda)}</b> ${Math.abs(dif) < 0.01 ? '✓ cuadra' : '(debería ser 0)'}<br>Recibido: <b>${money(rec, c.moneda)}</b> · Por recibir: <b>${money(abonos - rec, c.moneda)}</b> · Costo real: <b>${money(costos, c.moneda)}</b>${costos && c.importe ? ` (${(100 * costos / c.importe).toFixed(2)}%)` : ''}`;
  };
  const pintar = () => {
    tb.innerHTML = filas.map((f, i) => `<tr>
      <td><select data-k="concepto">${Object.entries(CONCEPTO_ABONO).map(([k, l]) => `<option value="${k}" ${f.concepto === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${f.descripcion ? `<div class="small">${esc(f.descripcion)}</div>` : ''}</td>
      <td><input data-k="monto" type="number" step="any" value="${esc(f.monto ?? '')}"></td>
      <td><input data-k="fecha" type="date" value="${esc(f.fecha || '')}"></td>
      <td style="text-align:center"><input data-k="recibido" type="checkbox" ${f.recibido ? 'checked' : ''} style="width:auto"></td>
      <td><button type="button" class="link sm danger" data-del="${i}">Quitar</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin abonos. Usa "Plantilla BANPRO" o "+ Agregar abono".</td></tr>';
    tb.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { leer(); filas.splice(+b.dataset.del, 1); pintar(); });
    tb.querySelectorAll('input,select').forEach(x => x.addEventListener('input', cuadre));
    cuadre();
  };
  form.querySelectorAll('input[name]').forEach(x => x.addEventListener('input', cuadre));
  form.querySelector('#ab-add').onclick = () => { leer(); filas.push({ concepto: 'DESEMBOLSO', monto: null, fecha: hoy, recibido: false }); pintar(); };
  form.querySelector('#ab-plant').onclick = () => { leer(); filas.push(
    { concepto: 'DESEMBOLSO', monto: null, fecha: form.elements.liquidacion_fecha.value || hoy, recibido: true, descripcion: 'Monto líquido de la liquidación' },
    { concepto: 'CONFIRMACION', monto: null, fecha: null, recibido: false, descripcion: 'Monto CxP: se deposita cuando el cliente confirme la factura' },
    { concepto: 'EXCEDENTE', monto: null, fecha: c.fecha_vencimiento || null, recibido: false, descripcion: 'Excedente que se devuelve cuando el cliente pague' }); pintar(); };
  pintar();
  return new Promise(resolve => {
    const close = (r) => { $modal.innerHTML = ''; resolve(r); };
    $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close(false));
    form.onsubmit = async (e) => {
      e.preventDefault(); leer();
      const showErr = (m) => { const x = form.querySelector('.err'); x.hidden = false; x.textContent = m; };
      if (filas.some(f => !(f.monto > 0))) return showErr('Cada abono debe tener un monto mayor a 0.');
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const v = (n) => form.elements[n].value.trim();
        chk(await sb.from('factoring_cartas').update({ liquidacion_numero: val(v('liquidacion_numero')), liquidacion_fecha: val(v('liquidacion_fecha')),
          detraccion: num(v('detraccion')), costo_interes: num(v('costo_interes')), costo_comision: num(v('costo_comision')), costo_gastos: num(v('costo_gastos')), costo_igv: num(v('costo_igv')) }).eq('id', c.id));
        const quedan = new Set(filas.filter(f => f.id).map(f => f.id));
        const borrar = c.abonos.filter(a => !quedan.has(a.id)).map(a => a.id);
        if (borrar.length) chk(await sb.from('factoring_abonos').delete().in('id', borrar));
        for (const f of filas) {
          const row = { carta_id: c.id, concepto: f.concepto, monto: f.monto, fecha: f.fecha, recibido: !!f.recibido, descripcion: f.descripcion || null };
          chk(f.id ? await sb.from('factoring_abonos').update(row).eq('id', f.id) : await sb.from('factoring_abonos').insert(row));
        }
        if (!filas.length) chk(await sb.from('factoring_cartas').update({ estado: 'EMITIDA' }).eq('id', c.id));
        const todo = filas.length && filas.every(f => f.recibido);
        if (todo && form.elements.marcar.checked && c.factura_id) {
          const ult = filas.map(f => f.fecha).filter(Boolean).sort().pop() || hoy;
          chk(await sb.from('proyecto_facturas').update({ estado_cobro: 'COBRADO', monto_cobrado: c.importe, fecha_cobro: ult, observacion: `Cedida a ${c.entidad_nombre} · carta ${codigoCorto(c)}` }).eq('id', c.factura_id));
        }
        toast('Liquidación y abonos guardados'); close(true);
      } catch (err) { btn.disabled = false; showErr(err.message); }
    };
  });
}

// evidencias de cada factoring (carta recibida, liquidación, depósitos, confirmación…)
const TIPO_DOC_FACT = { CARTA_RECIBIDA:'Carta con cargo / recibida', LIQUIDACION:'Liquidación del factoring', DEPOSITO:'Constancia de depósito', CONFIRMACION:'Confirmación del cliente', FACTURA:'Factura / XML / CDR', OTRO:'Otro' };
const ACEPTA_EVID = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.xml,.zip,image/*,application/pdf';
async function documentosFactoring(c, reload){
  const { data: docs0 } = await sb.from('factoring_documentos').select('*').eq('carta_id', c.id).order('creado_at');
  const docs = docs0 || [];
  const urls = await firmarUrls(docs);
  $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:780px">
    <header><h2>📎 Documentos · carta ${esc(codigoCorto(c))} · factura ${esc(c.numero_factura)}</h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body">
      <div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th>Archivo</th><th>Subido</th><th></th></tr></thead><tbody>
        ${docs.map(d => `<tr><td>${esc(TIPO_DOC_FACT[d.tipo] || d.tipo)}${d.descripcion ? `<div class="small">${esc(d.descripcion)}</div>` : ''}</td>
          <td>${urls[d.storage_path] ? `<a href="${esc(urls[d.storage_path])}" target="_blank" rel="noopener"${esImg(d) || /pdf/.test(d.mime || '') ? '' : ` download="${esc(d.nombre)}"`}><span class="doc-tag ${esWord(d) ? 'w' : 'p'}">${tipoDoc(d)}</span> ${esc(d.nombre)}</a>` : esc(d.nombre)}<div class="small">${d.tamano ? kb(d.tamano) : ''}</div></td>
          <td class="small" style="white-space:nowrap">${fdate(d.creado_at)}</td>
          <td style="text-align:right"><button type="button" class="link sm danger" data-dd="${d.id}">Quitar</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aún no hay documentos. Sube la carta con cargo de recepción, la liquidación, las constancias de depósito, etc.</td></tr>'}
      </tbody></table></div>
      <div class="fsec">Subir evidencia</div>
      <div class="fgrid">
        <label class="f"><span>Tipo de documento</span><select name="tipo">${Object.entries(TIPO_DOC_FACT).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label class="f"><span>Descripción (opcional)</span><input name="desc" placeholder="Ej. Liquidación N° 41788 · depósito 15/10"></label>
        <label class="f full"><span>Archivos (PDF, foto, Word, Excel, XML o ZIP · puedes elegir varios)</span><input type="file" name="f" multiple accept="${ACEPTA_EVID}"></label>
      </div>
      <p class="small">Límite: 25 MB por archivo. Solo los usuarios del Maestro pueden ver estos documentos.</p>
      <div class="small prog"></div><div class="err" hidden></div>
    </div>
    <footer><button type="button" data-x>Cerrar</button><button class="pri" type="submit">Subir</button></footer></form></div>`;
  const form = $modal.querySelector('form');
  const cerrar = () => { $modal.innerHTML = ''; reload(); };
  $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = cerrar);
  $modal.querySelectorAll('[data-dd]').forEach(b => b.onclick = async () => {
    const d = docs.find(x => x.id === b.dataset.dd);
    if (!confirm(`¿Quitar "${d.nombre}"? Se borra el archivo.`)) return;
    const r = await sb.from('factoring_documentos').delete().eq('id', d.id);
    if (r.error) return toast(r.error.message);
    await sb.storage.from(BUCKET).remove([d.storage_path]);
    toast('Documento quitado'); documentosFactoring(c, reload);
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const files = [...form.f.files];
    const showErr = (m) => { const x = form.querySelector('.err'); x.hidden = false; x.textContent = m; };
    if (!files.length) return showErr('Elige al menos un archivo.');
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    const prog = form.querySelector('.prog'); const errs = [];
    for (let k = 0; k < files.length; k++) {
      prog.textContent = `Subiendo ${k + 1} de ${files.length}…`;
      let f = await comprimir(files[k]);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!f.type && MIME_EXT[ext]) f = new File([f], f.name, { type: MIME_EXT[ext] });
      if (f.type === 'text/xml') f = new File([f], f.name, { type: 'application/xml' });
      if (f.size > 25 * 1024 * 1024) { errs.push(`${f.name}: supera 25 MB`); continue; }
      const path = `factoring/${c.id}/${Date.now()}_${k}_${limpiarNombre(f.name)}`;
      const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (up.error) { errs.push(`${f.name}: ${/mime/i.test(up.error.message) ? 'tipo de archivo no permitido' : up.error.message}`); continue; }
      const ins = await sb.from('factoring_documentos').insert({ carta_id: c.id, tipo: form.tipo.value, storage_path: path, nombre: f.name, mime: f.type, tamano: f.size, descripcion: val(form.desc.value.trim()) });
      if (ins.error) { await sb.storage.from(BUCKET).remove([path]); errs.push(`${f.name}: ${ins.error.message}`); }
    }
    if (errs.length) { btn.disabled = false; prog.textContent = ''; showErr(errs.join(' · ')); return; }
    toast(files.length > 1 ? `${files.length} documentos subidos` : 'Documento subido');
    documentosFactoring(c, reload);
  };
}

// configuración: firma, factorings y clientes destinatarios
function configFactoring(D, reload){
  const { entidades, destinatarios, config } = D;
  $modal.innerHTML = `<div class="ov"><div class="modal" style="max-width:820px">
    <header><h2>Configuración de factoring</h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body">
      <div class="fsec" style="margin-top:0">Firma y sello de Gerencia General</div>
      <div class="row" style="align-items:flex-start">
        <div style="border:1px dashed var(--line);border-radius:6px;padding:8px;min-width:240px;min-height:90px;display:flex;align-items:center;justify-content:center;background:#fff">${config.firma_imagen ? `<img src="${esc(config.firma_imagen)}" style="max-width:260px;max-height:130px">` : '<span class="small">Sin firma cargada</span>'}</div>
        <div><input type="file" id="cfg-firma" accept="image/png,image/jpeg" style="width:auto"><div class="small" style="margin-top:4px">PNG con fondo transparente (recomendado) o JPG. Se inserta sola en cada carta.</div>
        ${config.firma_imagen ? '<button class="link sm danger" id="cfg-firma-del" style="margin-top:6px">Quitar firma</button>' : ''}</div>
      </div>
      <div class="fsec">Empresas de factoring</div>
      <div class="tbl-wrap"><table><thead><tr><th>Nombre</th><th>RUC</th><th>Teléfono</th><th>Correo</th><th></th></tr></thead><tbody>
        ${entidades.map((e, i) => `<tr style="${e.activo ? '' : 'opacity:.5'}"><td>${esc(e.nombre)}</td><td class="mono">${esc(e.ruc || '—')}</td><td>${esc(e.telefono || '—')}</td><td>${esc(e.correo || '—')}</td><td style="text-align:right;white-space:nowrap"><button class="link sm" data-ee="${i}">Editar</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin registros</td></tr>'}
      </tbody></table></div><button class="sm" id="cfg-ent-add" style="margin-top:6px">+ Agregar factoring</button>
      <div class="fsec">Clientes destinatarios (a quién va dirigida la carta)</div>
      <div class="tbl-wrap"><table><thead><tr><th>Razón social</th><th>Sigla</th><th>Atención</th><th>Cargo</th><th></th></tr></thead><tbody>
        ${destinatarios.map((d, i) => `<tr style="${d.activo ? '' : 'opacity:.5'}"><td>${esc(d.razon_social)}</td><td class="mono">${esc(d.sigla)}</td><td>${esc(d.atencion || '—')}</td><td>${esc(d.cargo || '—')}</td><td style="text-align:right;white-space:nowrap"><button class="link sm" data-de="${i}">Editar</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin registros</td></tr>'}
      </tbody></table></div><button class="sm" id="cfg-dest-add" style="margin-top:6px">+ Agregar cliente</button>
      <div class="small" style="margin-top:6px">La sigla va en el número de carta (CARTA Nº 07 -2026/ <b>SHP</b> -GTO) y cada cliente lleva su propio correlativo por año.</div>
    </div>
    <footer><button type="button" data-x>Cerrar</button></footer></div></div>`;
  const cerrar = () => { $modal.innerHTML = ''; reload(); };
  $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = cerrar);
  const reabrir = async () => { const nd = await cargarFactoring(); Object.assign(D, nd); configFactoring(D, reload); };
  document.getElementById('cfg-firma').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const url = await reducirImagen(f, 1000);
      chk(await sb.from('factoring_config').upsert({ id: 1, firma_imagen: url, actualizado_at: new Date().toISOString() }));
      toast('Firma guardada'); reabrir();
    } catch (err) { toast(err.message); }
  };
  const del = document.getElementById('cfg-firma-del');
  if (del) del.onclick = async () => { if (!await confirmModal('¿Quitar la firma? Las cartas saldrán sin firma.')) return reabrir(); chk(await sb.from('factoring_config').update({ firma_imagen: null }).eq('id', 1)); reabrir(); };
  const fEnt = [{ k: 'nombre', l: 'Razón social', req: true, full: true }, { k: 'ruc', l: 'RUC' }, { k: 'telefono', l: 'Teléfono' }, { k: 'correo', l: 'Correo' }, { k: 'activo', l: 'Estado', t: 'select', opts: [['true', 'Activo'], ['false', 'Inactivo']], def: 'true' }];
  const fDest = [{ k: 'razon_social', l: 'Razón social del cliente', req: true, full: true }, { k: 'sigla', l: 'Sigla (para el N° de carta)', req: true, ph: 'SHP' }, { k: 'atencion', l: 'Atención (nombre)', ph: 'SRA. GABRIELA OLIVARES' }, { k: 'cargo', l: 'Cargo', ph: 'JEFE DE FINANZAS' }, { k: 'activo', l: 'Estado', t: 'select', opts: [['true', 'Activo'], ['false', 'Inactivo']], def: 'true' }];
  const guardar = (tabla, fields, row) => formModal({ title: row ? 'Editar' : 'Agregar', fields, data: row ? { ...row, activo: String(row.activo) } : {}, onSave: async (d) => {
    d.activo = d.activo !== 'false'; if (d.sigla) d.sigla = d.sigla.toUpperCase();
    chk(row ? await sb.from(tabla).update(d).eq('id', row.id) : await sb.from(tabla).insert(d));
  } }).then(reabrir);
  document.getElementById('cfg-ent-add').onclick = () => guardar('factoring_entidades', fEnt, null);
  document.getElementById('cfg-dest-add').onclick = () => guardar('factoring_destinatarios', fDest, null);
  $modal.querySelectorAll('[data-ee]').forEach(b => b.onclick = () => guardar('factoring_entidades', fEnt, entidades[b.dataset.ee]));
  $modal.querySelectorAll('[data-de]').forEach(b => b.onclick = () => guardar('factoring_destinatarios', fDest, destinatarios[b.dataset.de]));
}
function reducirImagen(file, max){
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) return reject(new Error('La imagen supera 5 MB'));
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
      resolve(cv.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = u;
  });
}

// carta imprimible (A4, membrete GTO)
function htmlCarta(c, config){
  const e = esc;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(codigoCarta(c))} · ${e(c.numero_factura)}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:#e5e7eb;font-family:Roboto,Arial,sans-serif;color:#111}
.hoja{width:210mm;height:297mm;margin:10mm auto;background:#fff url('${location.origin}/membrete-gto.jpg') center/210mm 297mm no-repeat;position:relative;padding:47mm 22mm 0 26mm;font-size:11.5pt;line-height:1.45;box-shadow:0 2px 12px rgba(0,0,0,.15)}
h1{font-size:12.5pt;text-align:center;margin:0 0 9mm;font-weight:700;text-decoration:underline;letter-spacing:.2px}
p{margin:0 0 3mm}
.blk{margin-bottom:6mm}
table{width:100%;border-collapse:collapse;margin:3mm 0 9mm;font-size:10.5pt}
th{background:#0a9447;color:#fff;font-weight:700;border:1px solid #333;padding:2mm 1.5mm;line-height:1.15}
td{border:1px solid #333;text-align:center;padding:1.3mm}
.just{text-align:justify}
.firma{text-align:center;margin-top:2mm;height:42mm}
.firma img{max-height:42mm;max-width:80mm;margin-left:30mm}
a{color:#1155cc}
.bar{position:fixed;top:0;left:0;right:0;background:#18212b;color:#fff;padding:8px 14px;display:flex;gap:10px;align-items:center;font:13px system-ui;z-index:5}
.bar button{font:inherit;padding:5px 12px;border-radius:5px;border:0;background:#0f766e;color:#fff;cursor:pointer}
@media print{html,body{background:#fff}.hoja{margin:0;box-shadow:none}.bar{display:none}}
</style></head><body>
<div class="bar"><b>${e(codigoCarta(c))}</b><span style="flex:1"></span><span>Guarda como PDF desde Imprimir</span><button onclick="print()">Imprimir / PDF</button></div>
<div class="hoja">
  <h1>${e(codigoCarta(c))}</h1>
  <p class="blk">${e(c.lugar || 'Arequipa')}, ${e(fechaLarga(c.fecha))}</p>
  <p>Señor(es):</p>
  <p>${e(c.cliente_razon)}</p>
  ${c.atencion ? `<p>Atención: ${e(c.atencion)}</p>` : ''}
  <p class="blk">Referencia: Factoring - Cesión de Factura / Factura: ${e(c.numero_factura)}</p>
  <p>De nuestra consideración.</p>
  <table><thead><tr><th style="width:25%">Nº DE FACTURA</th><th style="width:25%">MONEDA</th><th style="width:25%">IMPORTE</th><th style="width:25%">FECHA DE<br>VENCIMIENTO</th></tr></thead>
  <tbody><tr><td>${e(c.numero_factura)}</td><td>${c.moneda === 'DOLARES' ? 'DOLARES' : 'SOLES'}</td><td>${e(importeCarta(c.importe, c.moneda))}</td><td>${e(fechaPuntos(c.fecha_vencimiento))}</td></tr></tbody></table>
  <p class="just blk">Ha sido cedido por su acreedor GTO PERU S.A.C., con Ruc 20519998786, con domicilio fiscal CAL.GERMAN SCHEREIBER NRO. 276 INT. T301 URB. SANTA ANA (ENTRE CUADRA 1 Y 2 DE CANAVAL Y MOREYRA) LIMA - LIMA - SAN ISIDRO.</p>
  <p class="just blk">El pago deberá efectuarse a ${e(c.entidad_nombre)}${c.entidad_ruc ? ` con RUC. ${e(c.entidad_ruc)}` : ''}.${c.entidad_telefono || c.entidad_correo ? ` Para más información, comunicarse con ${e(String(c.entidad_nombre).replace(/\./g, ''))}${c.entidad_telefono ? ` al teléfono ${e(c.entidad_telefono)}` : ''}${c.entidad_correo ? `, correo electrónico: <a href="mailto:${e(c.entidad_correo)}">${e(c.entidad_correo)}</a>` : ''}` : ''}</p>
  <p class="blk">Sin otro particular, agradecemos su gentil atención</p>
  <p>Atentamente</p>
  <div class="firma">${config?.firma_imagen ? `<img src="${e(config.firma_imagen)}" alt="Firma">` : ''}</div>
</div></body></html>`;
}
function imprimirCarta(c, config, w = null){
  const win = w || window.open('about:blank', '_blank');
  if (!win) { toast('El navegador bloqueó la ventana. Permite ventanas emergentes.'); return; }
  win.document.open(); win.document.write(htmlCarta(c, config)); win.document.close();
}

// detracción de una factura: depósito en el Banco de la Nación + constancia de SUNAT
async function registrarDetraccion(f, proyectoId, reload){
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: arch } = await sb.from('proyecto_archivos').select('*').eq('factura_id', f.id).eq('categoria', 'DETRACCION');
  const lab = (t, html, full = false) => `<label class="f ${full ? 'full' : ''}"><span>${t}</span>${html}</label>`;
  $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:640px">
    <header><h2>Detracción · factura ${esc(f.numero_factura)}</h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body">
      <p class="small" style="margin-top:0">Total ${money(f.monto, f.moneda)} · detracción ${Number(f.detraccion_pct)} % = <b>${money(f.detraccion_monto, f.moneda)}</b> · neto a cobrar <b>${money(Number(f.monto) - Number(f.detraccion_monto || 0), f.moneda)}</b></p>
      <div class="fgrid">
        ${lab('Estado', `<select name="estado"><option value="PENDIENTE" ${f.detraccion_estado !== 'DEPOSITADA' ? 'selected' : ''}>Por depositar</option><option value="DEPOSITADA" ${f.detraccion_estado === 'DEPOSITADA' ? 'selected' : ''}>Depositada</option></select>`)}
        ${lab('Fecha del depósito', `<input name="fecha" type="date" value="${esc(f.detraccion_fecha || hoy)}">`)}
        ${lab('Monto depositado en soles (S/)', `<input name="soles" type="number" step="any" value="${esc(f.detraccion_soles ?? '')}" placeholder="Según la constancia">`)}
        ${lab('N° de constancia / operación', `<input name="const" value="${esc(f.detraccion_constancia || '')}" placeholder="N° de constancia de depósito">`)}
        ${lab('Constancia de SUNAT (PDF o imagen)', `<input type="file" name="f" multiple accept="application/pdf,.pdf,image/*">`, true)}
      </div>
      ${(arch || []).length ? `<div class="small">Archivos ya cargados: ${(arch || []).map(a => esc(a.nombre)).join(', ')}</div>` : ''}
      <div class="small prog"></div><div class="err" hidden></div>
    </div>
    <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Guardar</button></footer></form></div>`;
  const form = $modal.querySelector('form');
  const cerrar = () => { $modal.innerHTML = ''; };
  $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = cerrar);
  if (f.detraccion_estado !== 'DEPOSITADA') form.estado.value = 'DEPOSITADA';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const showErr = (m) => { const x = form.querySelector('.err'); x.hidden = false; x.textContent = m; };
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    const errs = [];
    for (const [k, file] of [...form.f.files].entries()) {
      form.querySelector('.prog').textContent = `Subiendo ${k + 1}…`;
      const ff = await comprimir(file);
      if (ff.size > 25 * 1024 * 1024) { errs.push(`${ff.name}: supera 25 MB`); continue; }
      const path = `${proyectoId}/detraccion/${Date.now()}_${k}_${limpiarNombre(ff.name)}`;
      const up = await sb.storage.from(BUCKET).upload(path, ff, { contentType: ff.type || 'application/pdf', upsert: false });
      if (up.error) { errs.push(`${ff.name}: ${up.error.message}`); continue; }
      const ins = await sb.from('proyecto_archivos').insert({ proyecto_id: proyectoId, factura_id: f.id, categoria: 'DETRACCION', storage_path: path, nombre: ff.name, mime: ff.type, tamano: ff.size, descripcion: `Constancia de detracción · factura ${f.numero_factura}`, subido_por: session.user.id });
      if (ins.error) { await sb.storage.from(BUCKET).remove([path]); errs.push(`${ff.name}: ${ins.error.message}`); }
    }
    const v = (n) => form.elements[n].value.trim();
    const { error } = await sb.from('proyecto_facturas').update({ detraccion_estado: v('estado'), detraccion_fecha: val(v('fecha')), detraccion_soles: v('soles') === '' ? null : Number(v('soles')), detraccion_constancia: val(v('const')) }).eq('id', f.id);
    if (error) errs.push(error.message);
    if (errs.length) { btn.disabled = false; form.querySelector('.prog').textContent = ''; return showErr(errs.join(' · ')); }
    cerrar(); toast('Detracción registrada'); reload();
  };
}

// ---------- dividir OT: pasa componentes a una OT nueva (OC por separado del cliente) ----------
async function dividirOT({ s, C, G, A }){
  if (C.length < 2) { toast('Para dividir, la OT debe tener al menos 2 componentes'); return; }
  const GE = G.filter(g => g.tipo === 'ENTRADA');
  const REFS = A.filter(esReferencia);
  const lab = (t, html, full = false) => `<label class="f ${full ? 'full' : ''}"><span>${t}</span>${html}</label>`;
  $modal.innerHTML = `<div class="ov"><form class="modal" novalidate style="max-width:820px">
    <header><h2>Dividir ${esc(s.numero_orden_trabajo || 'OT')}</h2><button type="button" class="link" data-x>✕</button></header>
    <div class="body">
      <p class="small" style="margin-top:0">Los componentes marcados pasan a una <b>OT nueva</b> del mismo cliente, con sus fotos y datos técnicos. Úsalo cuando el cliente emite una OC por separado: así cada OT lleva su propia cotización, OC, informe, guía de salida y factura.</p>
      <div class="fsec">Componentes que pasan a la OT nueva</div>
      <div class="tbl-wrap"><table><thead><tr><th></th><th>Componente</th><th>N° parte</th><th>N° serie</th><th>Fotos</th></tr></thead><tbody>
        ${C.map(c => `<tr><td><input type="checkbox" data-mv="${c.id}" style="width:auto"></td><td>${esc(c.descripcion)}<div class="small">${esc([c.marca, c.modelo].filter(Boolean).join(' / '))}</div></td><td class="mono small">${esc(c.numero_parte || '—')}</td><td class="mono small">${esc(c.numero_serie || '—')}</td><td class="small">${A.filter(a => a.componente_id === c.id).length}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="fgrid" style="margin-top:10px">
        <div class="fsec">Datos de la OT nueva</div>
        ${lab('Nombre del servicio', `<input name="nombre" value="${esc(s.nombre || '')}">`, true)}
        ${lab('Estado comercial', `<select name="estado_comercial">${Object.entries(EST_COM).filter(([k]) => k !== 'CON_OC').map(([k, l]) => `<option value="${k}" ${k === (s.estado_comercial === 'CON_OC' ? 'EN_EVALUACION' : s.estado_comercial) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
        ${lab('Responsable', `<input name="responsable" value="${esc(s.responsable || '')}">`)}
        ${lab('Descripción / falla reportada', `<textarea name="descripcion" rows="3" placeholder="Falla observada de los componentes que se separan"></textarea>`, true)}
        <div class="fsec">Qué se copia a la OT nueva</div>
        <div class="full" style="grid-column:1/-1">
          ${GE.map(g => `<label style="display:flex;gap:8px;align-items:center;margin:3px 0"><input type="checkbox" data-gc="${g.id}" checked style="width:auto"> Guía de ingreso <b class="mono">${esc(g.numero_guia)}</b> · ${fdate(g.fecha)} <span class="small">(queda en ambas OT)</span></label>`).join('') || '<div class="small">Esta OT no tiene guía de ingreso registrada.</div>'}
          ${REFS.length ? `<label style="display:flex;gap:8px;align-items:center;margin:3px 0"><input type="checkbox" name="refs" checked style="width:auto"> Documentos de referencia del cliente (${REFS.length})</label>` : ''}
        </div>
      </div>
      <div class="small prog" style="margin-top:8px"></div><div class="err" hidden></div>
    </div>
    <footer><button type="button" data-x>Cancelar</button><button class="pri" type="submit">Crear OT nueva y mover</button></footer></form></div>`;
  const form = $modal.querySelector('form');
  const showErr = (m) => { const x = form.querySelector('.err'); x.hidden = false; x.textContent = m; };
  $modal.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { $modal.innerHTML = ''; });
  const sel = () => C.filter(c => form.querySelector(`[data-mv="${c.id}"]`).checked);
  form.querySelectorAll('[data-mv]').forEach(cb => cb.onchange = () => {
    const ds = form.elements.descripcion;
    if (!ds.dataset.manual) ds.value = sel().map(c => [c.descripcion, c.datos_tecnicos, c.observacion].filter(Boolean).join(' · ')).join('\n');
  });
  form.elements.descripcion.oninput = (e) => { e.target.dataset.manual = '1'; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const mover = sel();
    if (!mover.length) return showErr('Marca al menos un componente para pasar a la OT nueva.');
    if (mover.length === C.length) return showErr('Deja al menos un componente en la OT original.');
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    const prog = (t) => { form.querySelector('.prog').textContent = t; };
    const v = (n) => form.elements[n].value.trim();
    try {
      prog('Creando la OT nueva…');
      const nueva = chk(await sb.from('proyectos').insert({
        clase: 'SERVICIO', nombre: v('nombre') || s.nombre, cliente: s.cliente, tipo: s.tipo, responsable: val(v('responsable')),
        moneda: s.moneda, estado_comercial: v('estado_comercial') || 'EN_EVALUACION', estado_operativo: s.estado_operativo || 'POR_INICIAR',
        fecha_inicio: s.fecha_inicio, descripcion: val(v('descripcion')),
        observaciones: `Separada de ${s.numero_orden_trabajo} (OC por separado del cliente).`, creado_por: session.user.id,
      }).select('id,numero_orden_trabajo').single());
      const ids = mover.map(c => c.id);
      prog('Moviendo componentes y fotos…');
      chk(await sb.from('proyecto_componentes').update({ proyecto_id: nueva.id }).in('id', ids));
      chk(await sb.from('proyecto_archivos').update({ proyecto_id: nueva.id }).in('componente_id', ids));
      // copia de guías de ingreso (y su PDF) y de documentos de referencia
      const copiarArchivo = async (a, extra) => {
        const destino = `${nueva.id}/${a.categoria === 'GUIA' ? 'guia' : 'referencia'}/${Date.now()}_${limpiarNombre(a.nombre)}`;
        const cp = await sb.storage.from(BUCKET).copy(a.storage_path, destino);
        if (cp.error) throw new Error(`No se pudo copiar ${a.nombre}: ${cp.error.message}`);
        chk(await sb.from('proyecto_archivos').insert({ proyecto_id: nueva.id, categoria: a.categoria, storage_path: destino, nombre: a.nombre, mime: a.mime, tamano: a.tamano, descripcion: a.descripcion, subido_por: session.user.id, ...extra }));
      };
      for (const g of GE.filter(g => form.querySelector(`[data-gc="${g.id}"]`)?.checked)) {
        prog(`Copiando guía ${g.numero_guia}…`);
        const ng = chk(await sb.from('proyecto_guias').insert({ proyecto_id: nueva.id, tipo: g.tipo, numero_guia: g.numero_guia, fecha: g.fecha, detalle: mover.map(c => c.descripcion).join(', '), observacion: `También registrada en ${s.numero_orden_trabajo}` }).select('id').single());
        for (const a of A.filter(a => a.guia_id === g.id)) await copiarArchivo(a, { guia_id: ng.id });
      }
      if (form.elements.refs?.checked) for (const a of REFS) { prog('Copiando documentos de referencia…'); await copiarArchivo(a, {}); }
      prog('Anotando en la OT original…');
      const nota = `Se separó a ${nueva.numero_orden_trabajo}: ${mover.map(c => c.descripcion + (c.numero_serie ? ' (S/N ' + c.numero_serie + ')' : '')).join(', ')}.`;
      chk(await sb.from('proyectos').update({ observaciones: [s.observaciones, nota].filter(Boolean).join('\n'), updated_at: new Date().toISOString() }).eq('id', s.id));
      $modal.innerHTML = '';
      toast(`Se creó ${nueva.numero_orden_trabajo} con ${mover.length} componente(s)`);
      location.hash = `#/servicio/${nueva.id}`;
    } catch (err) { btn.disabled = false; prog(''); showErr(err.message || String(err)); }
  };
}

// ---------- guías de remisión (todas las OT) ----------
let filtroGuia = { q: '', tipo: 'TODAS', mes: '' };
async function renderGuias(){
  $app.innerHTML = shell('<div class="loading">Cargando…</div>'); bindShell();
  let G, A, P;
  try {
    const [g, a, p] = await Promise.all([
      sb.from('proyecto_guias').select('*').order('fecha', { ascending: false }),
      sb.from('proyecto_archivos').select('id,proyecto_id,guia_id,storage_path,nombre,mime,created_at').not('guia_id', 'is', null),
      LAB() ? sb.rpc('lab_servicios').select('id,numero_orden_trabajo,cliente,nombre') : sb.from('proyectos_maestro').select('id,numero_orden_trabajo,cliente,nombre,clase'),
    ]);
    if (g.error) throw new Error(g.error.message);
    G = g.data || []; A = a.data || []; P = p.data || [];
  } catch (e) { $app.querySelector('main').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const urls = await firmarUrls(A);
  const pById = Object.fromEntries(P.map(x => [x.id, x]));
  // una fila por guía (la misma guía puede estar registrada en varias OT)
  const norm = (n) => String(n || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const grupos = new Map();
  for (const g of G) {
    const k = g.tipo + '|' + norm(g.numero_guia).replace(/\s+(GTO|SHP)$/,'');
    if (!grupos.has(k)) grupos.set(k, { ...g, ots: [], ids: [] });
    const r = grupos.get(k);
    r.ids.push(g.id); if (g.proyecto_id && !r.ots.some(o => o.id === g.proyecto_id)) r.ots.push(pById[g.proyecto_id] || { id: g.proyecto_id });
    if (!r.detalle && g.detalle) r.detalle = g.detalle;
  }
  const lista = [...grupos.values()].map(r => ({ ...r, archivos: A.filter(a => r.ids.includes(a.guia_id)).filter((a, i, l) => l.findIndex(x => x.nombre === a.nombre) === i) }));
  const q = filtroGuia.q.toLowerCase();
  const rows = lista.filter(r => (filtroGuia.tipo === 'TODAS' || r.tipo === filtroGuia.tipo) && (!filtroGuia.mes || String(r.fecha || '').startsWith(filtroGuia.mes)) &&
    (!q || [r.numero_guia, r.detalle, r.observacion, ...r.ots.flatMap(o => [o.numero_orden_trabajo, o.cliente, o.nombre])].some(x => String(x || '').toLowerCase().includes(q))));
  const sal = lista.filter(r => r.tipo === 'SALIDA'), ent = lista.filter(r => r.tipo === 'ENTRADA');
  const ultGTO = [...sal].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))[0];
  const sinArch = lista.filter(r => !r.archivos.length).length;
  const meses = [...new Set(lista.map(r => String(r.fecha || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const MESN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
  const kpi = (n, l, k) => `<div class="kpi ${k && filtroGuia.tipo === k ? 'sel' : ''}" ${k ? `data-kt="${k}"` : 'style="cursor:default"'}><div class="n">${n}</div><div class="l">${l}</div></div>`;
  $app.querySelector('main').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h1>Guías de remisión</h1><div class="sub">Todas las guías registradas en las OT: las que emite GTO (salida) y las del cliente (entrada), con su PDF.</div></div>
    </div>
    <div class="kpis">${kpi(lista.length, 'Guías registradas', 'TODAS')}${kpi(sal.length, 'Guías GTO (salida)', 'SALIDA')}${kpi(ent.length, 'Guías del cliente (entrada)', 'ENTRADA')}${kpi(sinArch, 'Sin PDF adjunto')}${kpi(ultGTO ? `<span style="font-size:17px">${esc(ultGTO.numero_guia)}</span>` : '—', 'Última guía GTO' + (ultGTO ? ' · ' + fdate(ultGTO.fecha) : ''))}</div>
    <div class="panel">
      <div class="toolbar">
        <input type="search" id="gu-q" placeholder="Buscar N° de guía, OT, cliente o detalle…" value="${esc(filtroGuia.q)}">
        <select id="gu-tipo"><option value="TODAS">Todas</option><option value="SALIDA" ${filtroGuia.tipo === 'SALIDA' ? 'selected' : ''}>Salida (emite GTO)</option><option value="ENTRADA" ${filtroGuia.tipo === 'ENTRADA' ? 'selected' : ''}>Entrada (del cliente)</option></select>
        <select id="gu-mes"><option value="">Todos los meses</option>${meses.map(m => `<option value="${m}" ${filtroGuia.mes === m ? 'selected' : ''}>${MESN[+m.slice(5) - 1]} ${m.slice(0, 4)}</option>`).join('')}</select>
        <div style="flex:1"></div><span class="small">${rows.length} guía(s)</span>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>N° guía</th><th>Tipo</th><th>Fecha</th><th>OT / cliente</th><th>Detalle</th><th>Archivo</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td class="mono" style="font-weight:500;white-space:nowrap">${esc(r.numero_guia)}</td>
        <td>${badge(r.tipo, r.tipo === 'SALIDA' ? 'Salida · GTO' : 'Entrada · cliente')}</td>
        <td style="white-space:nowrap">${fdate(r.fecha)}</td>
        <td>${r.ots.map(o => `<div><a class="mono" href="#/servicio/${o.id}">${esc(o.numero_orden_trabajo || 'OT')}</a>${o.cliente ? `<div class="small">${esc(o.cliente)}</div>` : ''}</div>`).join('') || '<span class="small">—</span>'}</td>
        <td>${plegable(r.detalle)}${r.observacion ? `<div class="small">${esc(r.observacion)}</div>` : ''}</td>
        <td style="white-space:nowrap">${r.archivos.map(a => urls[a.storage_path] ? `<a class="link-sm" href="${esc(urls[a.storage_path])}" target="_blank" rel="noopener" title="${esc(a.nombre)}"><span class="doc-tag p">${tipoDoc(a)}</span></a>` : '').join(' ')}
          ${!LAB() && r.ots[0]?.id ? `<button class="link sm" data-gup="${r.ids[0]}" data-pid="${r.ots[0].id}">${r.archivos.length ? '+ otro' : '📎 Adjuntar PDF'}</button>` : (r.archivos.length ? '' : '<span class="small">Sin archivo</span>')}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty">No hay guías con este filtro.</td></tr>'}
      </tbody></table></div>
    </div>
    <p class="small" style="margin-top:8px">Las guías se registran dentro de cada OT (pestaña <b>Guías de remisión</b>); aquí se ven todas juntas.</p>`;
  const again = () => renderGuias();
  document.getElementById('gu-q').oninput = (e) => { filtroGuia.q = e.target.value; clearTimeout(window._gq); window._gq = setTimeout(() => renderGuias().then(() => { const i = document.getElementById('gu-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
  document.getElementById('gu-tipo').onchange = (e) => { filtroGuia.tipo = e.target.value; again(); };
  document.getElementById('gu-mes').onchange = (e) => { filtroGuia.mes = e.target.value; again(); };
  $app.querySelectorAll('[data-kt]').forEach(k => k.onclick = () => { filtroGuia.tipo = k.dataset.kt; again(); });
  $app.querySelectorAll('[data-gup]').forEach(b => b.onclick = () => subirArchivos({ proyectoId: b.dataset.pid, categoria: 'GUIA', guiaId: b.dataset.gup, accept: 'application/pdf,image/*' }).then(ok => ok && again()));
}

// ---------- router ----------
async function route(){
  $modal.innerHTML = ''; document.onkeydown = null;  // cerrar ventanas abiertas al cambiar de página
  if (!session) { MODO = null; return renderLogin(); }
  if (!MODO) {
    const r = await sb.rpc('acceso_maestro'); MODO = r.error ? 'total' : (r.data || 'ninguno');
    if (MODO === 'laboratorio') { const g = await sb.rpc('ve_guias'); VE_GUIAS = g.data === true; }
  }
  // QR del rótulo: #/ot/OT-2026-0003 -> ficha de la OT
  const mo = location.hash.match(/^#\/ot\/(.+)$/);
  if (mo) {
    const num = decodeURIComponent(mo[1]).trim();
    const r = LAB() ? await sb.rpc('lab_servicios').select('id').eq('numero_orden_trabajo', num).maybeSingle()
                    : await sb.from('proyectos_maestro').select('id').eq('numero_orden_trabajo', num).maybeSingle();
    if (r.data?.id) { location.replace(`#/servicio/${r.data.id}`); return; }
    toast(`No se encontró la OT ${num}`); location.replace('#/'); return;
  }
  const m = location.hash.match(/^#\/servicio\/([0-9a-f-]{36})/);
  if (LAB()) {
    if (m) return renderLabDetalle(m[1]);
    if (location.hash.startsWith('#/informes')) return renderInformes();
    if (VE_GUIAS && location.hash.startsWith('#/guias')) return renderGuias();
    return renderLabLista();
  }
  if (m) return renderDetalle(m[1]);
  if (location.hash.startsWith('#/informes')) return renderInformes();
  if (location.hash.startsWith('#/factoring')) return renderFactoring();
  if (location.hash.startsWith('#/guias')) return renderGuias();
  return renderLista();
}
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/servicio/')) { tabActual = 'componentes'; tabLab = 'componentes'; } route(); });
sb.auth.onAuthStateChange((_e, s) => { const changed = (s?.user?.id || null) !== (session?.user?.id || null); session = s; if (changed) { MODO = null; route(); } });
const { data } = await sb.auth.getSession();
session = data.session;
route();
