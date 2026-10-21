// Reportes imprimibles del Maestro de Gestión (ficha de OT / PI y reporte global) + exportación a Excel.
// Se generan en el navegador: se abre una ventana con el documento sobre la hoja membretada de GTO
// y el usuario lo imprime o lo guarda como PDF ("Guardar como PDF" en el diálogo de impresión).

const EMPRESA = {
  nombre: 'GTO PERU S.A.C.', ruc: '20519998786',
  fiscal: 'Cal. German Schereiber 276 Int. T301, San Isidro - Lima',
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fdate = (d) => d ? String(d).split('T')[0].split('-').reverse().join('/') : '—';
const sym = (m) => m === 'DOLARES' ? 'US$' : 'S/';
const num = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n, m) => n == null || n === '' ? '—' : `${sym(m)} ${num(n)}`;
const montos = (obj) => Object.entries(obj).filter(([, v]) => v).map(([m, v]) => money(v, m)).join(' · ') || '—';
const hoyTexto = () => new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dias = (a, b) => Math.max(0, Math.round((new Date((b || new Date().toISOString().slice(0, 10)) + 'T00:00:00') - new Date(String(a).slice(0, 10) + 'T00:00:00')) / 86400000));
const sumaPorMoneda = (l, campo, monCampo = 'moneda') => l.reduce((m, r) => { const k = r[monCampo] || 'SOLES'; m[k] = (m[k] || 0) + Number(r[campo] || 0); return m; }, {});

/** fechas tomadas de las guías: primer ingreso y última salida */
export function fechasGuias(G) {
  const orden = (l) => [...l].filter(g => g.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const ge = G.filter(g => g.tipo === 'ENTRADA'), gs = G.filter(g => g.tipo === 'SALIDA');
  const ing = orden(ge)[0] || null, sal = orden(gs).slice(-1)[0] || null;
  return { ge, gs, ing, sal, dias: ing ? dias(ing.fecha, sal ? String(sal.fecha).slice(0, 10) : null) : null };
}

// ------------------------------------------------------------------ hoja base imprimible
const CSS = `
  @page { size: A4; margin: 0; }
  @page horizontal { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #e9eeec; }
  .hoja { width: 210mm; margin: 0 auto; background: #fff; position: relative; }
  .apaisada .hoja { width: 297mm; }
  .fondo { position: fixed; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
  .apaisada .fondo { display: none; }
  table.marco { width: 100%; border-collapse: collapse; position: relative; z-index: 1; }
  table.marco > thead td { height: 30mm; padding: 0; }
  table.marco > tfoot td { height: 33mm; padding: 0; }
  .apaisada table.marco > thead td { height: 12mm; } .apaisada table.marco > tfoot td { height: 12mm; }
  table.marco > tbody > tr > td { padding: 0 12mm; vertical-align: top; }
  .cab { display: flex; justify-content: space-between; align-items: flex-start; margin-top: -21mm; margin-bottom: 4mm; }
  .apaisada .cab { margin-top: 0; }
  .cab .izq { padding-top: 22mm; font-size: 8.5pt; color: #333; }
  .apaisada .cab .izq { padding-top: 0; }
  .cab .der { text-align: right; }
  .titulo { color: #02934E; font-size: 17pt; font-weight: bold; letter-spacing: .3px; }
  .sub { font-weight: bold; font-size: 9pt; color: #333; margin-top: 1mm; }
  .num { display: inline-block; background: #02934E; color: #fff; font-weight: bold; font-size: 12pt; padding: 1.2mm 4mm; margin-top: 1.5mm; }
  .caja { border: 1px solid #8FBFA3; margin-top: 3mm; page-break-inside: avoid; break-inside: avoid; background: #fff; }
  .caja h3 { margin: 0; background: #EAF7EF; color: #016B39; font-size: 9pt; padding: 1.4mm 2.5mm; border-bottom: 1px solid #8FBFA3; text-transform: uppercase; letter-spacing: .3px; }
  .caja .cuerpo { padding: 2mm 2.5mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.3mm 6mm; }
  .grid.tres { grid-template-columns: 1fr 1fr 1fr; }
  .dato { display: flex; gap: 2mm; } .dato b { color: #016B39; min-width: 30mm; flex: none; } .dato.full { grid-column: 1 / -1; }
  .pre { white-space: pre-line; }
  table.t { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.t th { background: #02934E; color: #fff; text-align: left; padding: 1.3mm 1.8mm; font-weight: bold; }
  table.t td { border-bottom: 1px solid #cfe5d8; padding: 1.2mm 1.8mm; vertical-align: top; }
  table.t tr:nth-child(even) td { background: #F6FBF8; }
  table.t td.r, table.t th.r { text-align: right; } table.t td.c, table.t th.c { text-align: center; }
  table.t .mono { font-family: 'Courier New', monospace; }
  .vacio { color: #888; font-style: italic; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; margin-top: 2mm; }
  .kpi { border: 1px solid #8FBFA3; padding: 2mm; } .kpi .n { font-size: 11pt; font-weight: bold; color: #016B39; } .kpi .l { font-size: 8pt; color: #555; }
  .pie { font-size: 7.5pt; color: #016B39; font-style: italic; margin-top: 4mm; }
  .barra { position: sticky; top: 0; z-index: 5; background: #1d2b29; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font-family: Arial, sans-serif; font-size: 13px; }
  .barra button { background: #02934E; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
  .barra button.sec { background: transparent; border: 1px solid #8aa; }
  @media print { body { background: #fff; } .barra { display: none; } .hoja { margin: 0; } }
`;

function documento({ titulo, cuerpo, apaisada = false, fondo }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}${apaisada ? '@page{size:A4 landscape;margin:0}' : ''}</style></head>
<body class="${apaisada ? 'apaisada' : ''}">
<div class="barra"><button onclick="window.print()">🖨 Imprimir / Guardar como PDF</button><button class="sec" onclick="window.close()">Cerrar</button>
<span>En el diálogo de impresión elige <b>“Guardar como PDF”</b> para descargarlo${apaisada ? ' (orientación horizontal)' : ''}. Activa “Gráficos de fondo” si no ves la hoja membretada.</span></div>
<div class="hoja">${!apaisada && fondo ? `<img class="fondo" src="${esc(fondo)}" alt="">` : ''}
<table class="marco"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>${cuerpo}</td></tr></tbody></table></div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 600));</script>
</body></html>`;
}

// La hoja membretada se incrusta como imagen (data URI) para que cargue siempre en la ventana de impresión.
const cacheFondo = {};
async function fondoIncrustado(url) {
  if (!url) return null;
  if (cacheFondo[url]) return cacheFondo[url];
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const blob = await r.blob();
    return cacheFondo[url] = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(blob); });
  } catch { return null; }
}

function abrir(html) {
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

const caja = (t, contenido) => `<div class="caja"><h3>${esc(t)}</h3><div class="cuerpo">${contenido}</div></div>`;
const dato = (l, v, full = false, pre = false) => `<div class="dato${full ? ' full' : ''}"><b>${esc(l)}</b><span class="${pre ? 'pre' : ''}">${v == null || v === '' ? '—' : v}</span></div>`;
const tabla = (cab, filas, vacio) => filas.length
  ? `<table class="t"><thead><tr>${cab.map(([t, cl]) => `<th class="${cl || ''}">${esc(t)}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table>`
  : `<div class="vacio">${esc(vacio)}</div>`;

/** Lista de informes técnicos de la OT (módulo de informes): N° correlativo, título, tipo de archivo y fecha */
function informesTexto(s, INF) {
  const tipo = (a) => /msword|wordprocessingml/.test(a.mime || '') || /\.docx?$/i.test(a.nombre || '') ? 'Word' : (a.mime || '').includes('pdf') || /\.pdf$/i.test(a.nombre || '') ? 'PDF' : (a.mime || '').startsWith('image/') ? 'imagen' : 'archivo';
  if (!INF.length) return esc(s.numero_informe || '');
  return `<div>${[...INF].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.numero || '').localeCompare(String(b.numero || ''))).map(i => {
    const tipos = [...new Set((i.informe_archivos || []).map(tipo))];
    return `• <b style="color:#111">${esc(i.numero || '')}</b> — ${esc(i.titulo || '')} <span style="color:#555">(${[tipos.join(', ') || 'sin archivo', fdate(i.fecha)].join(' · ')})</span>`;
  }).join('<br>')}</div>`;
}

// ------------------------------------------------------------------ ficha de una OT / PI
/**
 * d = { s, C, G, F, O, S, INF, REF, OCC, cot, etiquetas:{EST_COM, EST_OP, EST_COBRO, TIPOS_PI}, fondo }
 */
export async function fichaOT(d) {
  const fondo = await fondoIncrustado(d.fondo);
  const { s, C = [], G = [], F = [], O = [], S = [], INF = [], cot = null, etiquetas: L } = d;
  const esPI = s.clase === 'INTERNO';
  const mon = s.moneda || 'SOLES';
  const { ing, sal, dias: dT } = fechasGuias(G);
  const Fv = F.filter(f => f.estado_cobro !== 'ANULADA');
  const facturado = sumaPorMoneda(Fv, 'monto'), cobrado = sumaPorMoneda(Fv, 'monto_cobrado');
  const porCobrar = {}; Object.keys(facturado).forEach(k => porCobrar[k] = (facturado[k] || 0) - (cobrado[k] || 0));
  const compras = sumaPorMoneda(O.filter(o => o.estado !== 'anulada'), 'total');

  const cab = `<div class="cab"><div class="izq">Impreso: ${esc(hoyTexto())}<br>${esPI ? 'Proyecto interno' : 'Servicio a cliente'}</div>
    <div class="der"><div class="titulo">${esPI ? 'FICHA DE PROYECTO INTERNO' : 'FICHA DE ORDEN DE TRABAJO'}</div>
    <div class="sub">${EMPRESA.nombre} · R.U.C. ${EMPRESA.ruc}</div><div class="num">N° ${esc(s.numero_orden_trabajo || '—')}</div></div></div>`;

  const datos = esPI
    ? caja('Datos del proyecto', `<div class="grid">
        ${dato('Proyecto', esc(s.nombre), true)}
        ${dato('Tipo', esc(L.TIPOS_PI[s.tipo] || s.tipo || ''))}${dato('Responsable', esc(s.responsable || ''))}
        ${dato('Estado', esc(L.EST_OP[s.estado_operativo] || ''))}${dato('Registro', esc(s.estado || ''))}
        ${dato('Presupuesto', s.presupuesto != null ? money(s.presupuesto, mon) : '—')}${dato('Invertido (OC)', montos(compras))}
        ${dato('Inicio / término', `${fdate(s.fecha_inicio)} → ${fdate(s.fecha_entrega)}`)}
        ${dato('Objetivo / alcance', esc(s.descripcion || ''), true, true)}</div>`)
    : caja('Datos del servicio', `<div class="grid">
        ${dato('Servicio', `<b style="color:#111">${esc(s.nombre)}</b>`, true)}
        ${dato('Cliente', esc(s.cliente || ''))}${dato('R.U.C. cliente', esc(cot?.cliente_ruc || ''))}
        ${dato('Tipo', esc((s.tipo || '').charAt(0) + (s.tipo || '').slice(1).toLowerCase()))}${dato('Responsable', esc(s.responsable || ''))}
        ${dato('Estado comercial', esc(L.EST_COM[s.estado_comercial] || ''))}${dato('Estado operativo', esc(L.EST_OP[s.estado_operativo] || ''))}
        ${dato('Descripción / alcance', esc(s.descripcion || ''), true, true)}</div>`);

  const comerciales = esPI ? '' : caja('Documentos comerciales', `<div class="grid">
      ${dato('Cotización', s.numero_cotizacion ? `${esc(s.numero_cotizacion)}${cot ? ` · ${fdate(cot.fecha)} · ${esc(cot.moneda || '')} ${num(cot.total)} c/IGV` : ''}` : '—')}
      ${dato('Referencia cliente', esc(cot?.referencia || ''))}
      ${dato('OC del cliente', s.numero_oc_cliente ? `${esc(s.numero_oc_cliente)} · ${fdate(s.fecha_oc_cliente)}` : '—')}
      ${dato('Monto (sin IGV)', money(s.monto_servicio, mon))}
      ${dato('Informe técnico', informesTexto(s, INF), true)}
      ${dato('Condiciones', cot?.condiciones ? esc([cot.condiciones.forma_pago, cot.condiciones.plazo_entrega && `Plazo: ${cot.condiciones.plazo_entrega}`, cot.condiciones.garantia && `Garantía: ${cot.condiciones.garantia}`].filter(Boolean).join(' · ')) : '—')}</div>`);

  const fechas = esPI ? '' : caja('Fechas del servicio', `<div class="grid">
      ${dato('Ingreso (guía)', ing ? `${fdate(ing.fecha)} · Guía ${esc(ing.numero_guia)}` : 'Sin guía de entrada')}
      ${dato('Salida (guía)', sal ? `${fdate(sal.fecha)} · Guía ${esc(sal.numero_guia)}` : 'Pendiente')}
      ${dato('Días en taller', dT != null ? `${dT} día${dT === 1 ? '' : 's'}${sal ? '' : ' (a la fecha)'}` : '—')}
      ${dato('Inicio / entrega', `${fdate(s.fecha_inicio)} → ${fdate(s.fecha_entrega)}`)}</div>`);

  const comps = caja(esPI ? 'Equipos / componentes' : 'Componentes', tabla(
    [['#', 'c'], ['Componente'], ['Marca / modelo'], ['N° parte'], ['N° serie'], ['Cant.', 'r']],
    C.map((c, i) => `<tr><td class="c">${i + 1}</td><td>${esc(c.descripcion)}${c.observacion ? `<div style="color:#555">${esc(c.observacion)}</div>` : ''}</td><td>${esc([c.marca, c.modelo].filter(Boolean).join(' / ') || '—')}</td><td class="mono">${esc(c.numero_parte || '—')}</td><td class="mono">${esc(c.numero_serie || '—')}</td><td class="r">${esc(c.cantidad ?? '')}</td></tr>`),
    'Sin componentes registrados.'));

  const guias = esPI ? '' : caja('Guías de remisión', tabla(
    [['Tipo'], ['N° guía'], ['Fecha'], ['Detalle']],
    [...G].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || ''))).map(g => `<tr><td>${g.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'}</td><td class="mono">${esc(g.numero_guia)}</td><td>${fdate(g.fecha)}</td><td>${esc(g.detalle || '—')}${g.observacion ? `<div style="color:#555">${esc(g.observacion)}</div>` : ''}</td></tr>`),
    'Sin guías registradas.'));

  const compras_ = caja('Requerimientos y órdenes de compra', `
    ${tabla([['SOLPED'], ['Fecha'], ['Área'], ['Solicitante'], ['Estado']],
      S.map(r => `<tr><td class="mono">N° ${esc(r.numero)}</td><td>${fdate(r.fecha_solicitud)}</td><td>${esc(r.area || '')}</td><td>${esc(r.solicitante || '')}</td><td>${esc(r.estado || '')}</td></tr>`), 'Sin requerimientos vinculados.')}
    <div style="height:2mm"></div>
    ${tabla([['OC / OS'], ['Proveedor'], ['Fecha'], ['Estado'], ['Total', 'r']],
      O.map(o => `<tr><td class="mono">N° ${esc(o.numero)}</td><td>${esc(o.proveedores?.razon_social || '')}</td><td>${fdate(o.fecha_emision)}</td><td>${esc(o.estado || '')}</td><td class="r">${money(o.total, o.moneda)}</td></tr>`), 'Sin órdenes de compra vinculadas.')}`);

  const fact = esPI ? '' : caja('Facturación y cobranza', tabla(
    [['Factura'], ['Emisión'], ['Vence'], ['Monto', 'r'], ['Cobrado', 'r'], ['Estado'], ['Fecha cobro']],
    F.map(f => `<tr><td class="mono">${esc(f.numero_factura)}</td><td>${fdate(f.fecha_emision)}</td><td>${fdate(f.fecha_vencimiento)}</td><td class="r">${money(f.monto, f.moneda)}</td><td class="r">${money(f.monto_cobrado, f.moneda)}</td><td>${esc(L.EST_COBRO[f.estado_cobro] || f.estado_cobro || '')}</td><td>${fdate(f.fecha_cobro)}</td></tr>`),
    'Aún no se registra factura.'));

  const resumen = caja('Resumen económico', esPI
    ? `<div class="kpis"><div class="kpi"><div class="n">${s.presupuesto != null ? money(s.presupuesto, mon) : '—'}</div><div class="l">Presupuesto</div></div>
       <div class="kpi"><div class="n">${montos(compras)}</div><div class="l">Invertido en OC</div></div>
       <div class="kpi"><div class="n">${s.presupuesto != null ? money(Number(s.presupuesto) - (compras[mon] || 0), mon) : '—'}</div><div class="l">Saldo</div></div>
       <div class="kpi"><div class="n">${S.length} / ${O.length}</div><div class="l">Requerimientos / OC</div></div></div>`
    : `<div class="kpis"><div class="kpi"><div class="n">${money(s.monto_servicio, mon)}</div><div class="l">Monto del servicio (sin IGV)</div></div>
       <div class="kpi"><div class="n">${montos(facturado)}</div><div class="l">Facturado (con IGV)</div></div>
       <div class="kpi"><div class="n">${montos(cobrado)}</div><div class="l">Cobrado</div></div>
       <div class="kpi"><div class="n">${montos(porCobrar)}</div><div class="l">Por cobrar</div></div></div>
       <div style="margin-top:2mm">${dato('Compras asociadas', `${montos(compras)} <span style="color:#555">(${O.filter(o => o.estado !== 'anulada').length} OC/OS vigentes)</span>`)}</div>`);

  const obs = s.observaciones ? caja('Observaciones', `<div class="pre">${esc(s.observaciones)}</div>`) : '';
  const pie = `<div class="pie">Documento interno de ${EMPRESA.nombre} generado desde el Maestro de Gestión el ${esc(hoyTexto())}. Los montos de la cotización se leen en vivo del cotizador.</div>`;

  abrir(documento({
    titulo: `Ficha ${s.numero_orden_trabajo || ''} - ${s.nombre || ''}`,
    fondo,
    cuerpo: cab + datos + comerciales + fechas + comps + guias + compras_ + fact + resumen + obs + pie,
  }));
}

// ------------------------------------------------------------------ reporte global
/**
 * d = { P (proyectos), F, C, G, O, S, etiquetas, fondo, clase: 'SERVICIO'|'INTERNO' }
 * Devuelve las filas ya calculadas (las usa también el Excel).
 */
export function filasGlobal(d) {
  const { P, F = [], C = [], G = [], O = [], S = [], I = [], etiquetas: L } = d;
  const by = (arr) => arr.reduce((m, r) => { (m[r.proyecto_id] ||= []).push(r); return m; }, {});
  const bF = by(F), bC = by(C), bG = by(G), bO = by(O), bS = by(S), bI = by(I);
  return P.map(p => {
    const g = bG[p.id] || [], { ing, sal, dias: dT, ge, gs } = fechasGuias(g);
    const fs = (bF[p.id] || []).filter(f => f.estado_cobro !== 'ANULADA');
    const fact = fs.reduce((t, f) => t + Number(f.monto || 0), 0), cob = fs.reduce((t, f) => t + Number(f.monto_cobrado || 0), 0);
    const monF = fs[0]?.moneda || p.moneda || 'SOLES';
    const ocs = (bO[p.id] || []).filter(o => o.estado !== 'anulada');
    const compras = sumaPorMoneda(ocs, 'total');
    const estCobro = !fs.length ? 'Sin factura' : fs.every(f => f.estado_cobro === 'COBRADO') ? 'Cobrado' : fs.some(f => ['PARCIAL', 'COBRADO'].includes(f.estado_cobro)) ? 'Parcial' : 'Por cobrar';
    return {
      p, ot: p.numero_orden_trabajo || '', cliente: p.cliente || '', nombre: p.nombre || '',
      tipo: p.clase === 'INTERNO' ? (L.TIPOS_PI[p.tipo] || p.tipo || '') : (p.tipo || ''),
      responsable: p.responsable || '', estCom: L.EST_COM[p.estado_comercial] || '', estOp: L.EST_OP[p.estado_operativo] || '', registro: p.estado || '',
      cotizacion: p.numero_cotizacion || '', ocCliente: p.numero_oc_cliente || '', fechaOc: p.fecha_oc_cliente || '',
      moneda: p.moneda || 'SOLES', monto: p.monto_servicio != null ? Number(p.monto_servicio) : null, presupuesto: p.presupuesto != null ? Number(p.presupuesto) : null,
      ingreso: ing?.fecha || '', guiaIng: ing?.numero_guia || '', salida: sal?.fecha || '', guiaSal: sal?.numero_guia || '', dias: dT,
      nGe: ge.length, nGs: gs.length, comps: (bC[p.id] || []).length, informe: (bI[p.id] || []).map(i => i.numero).join(', ') || p.numero_informe || '',
      reqs: (bS[p.id] || []).length, nOc: ocs.length, comprasS: compras.SOLES || 0, comprasD: compras.DOLARES || 0,
      facturas: fs.map(f => f.numero_factura).join(', '), monedaFact: monF, facturado: fact, cobrado: cob, porCobrar: fact - cob, estCobro,
      creado: p.created_at ? String(p.created_at).slice(0, 10) : '', observaciones: p.observaciones || '',
    };
  });
}

export async function reporteGlobalPDF(d) {
  const logo = await fondoIncrustado(d.logo);
  const filas = filasGlobal(d);
  const esPI = d.clase === 'INTERNO';
  const act = filas.filter(f => f.registro === 'activo');
  const cuenta = (k) => act.filter(f => f.p.estado_comercial === k).length;
  const porCobrar = {}; filas.forEach(f => { if (f.porCobrar > 0.009) porCobrar[f.monedaFact] = (porCobrar[f.monedaFact] || 0) + f.porCobrar; });
  const monto = {}; act.forEach(f => { if (f.monto) monto[f.moneda] = (monto[f.moneda] || 0) + f.monto; });
  const comprasT = act.reduce((m, f) => { m.SOLES = (m.SOLES || 0) + f.comprasS; m.DOLARES = (m.DOLARES || 0) + f.comprasD; return m; }, {});
  const cab = `<div class="cab"><div class="izq">${logo ? `<img src="${esc(logo)}" alt="GTO" style="height:17mm;display:block;margin-bottom:2mm">` : '<b style="font-size:12pt;color:#02934E">GTO PERU S.A.C.</b><br>'}Impreso: ${esc(hoyTexto())}${d.filtroTexto ? `<br>${esc(d.filtroTexto)}` : ''}</div>
    <div class="der"><div class="titulo">${esPI ? 'REPORTE GLOBAL DE PROYECTOS INTERNOS' : 'REPORTE GLOBAL DE SERVICIOS'}</div>
    <div class="sub">${EMPRESA.nombre} · R.U.C. ${EMPRESA.ruc}</div><div class="num">${filas.length} registro${filas.length === 1 ? '' : 's'}</div></div></div>`;
  const kpis = esPI
    ? `<div class="kpis"><div class="kpi"><div class="n">${act.length}</div><div class="l">Proyectos activos</div></div>
        <div class="kpi"><div class="n">${act.filter(f => f.p.estado_operativo === 'EN_PROCESO').length}</div><div class="l">En proceso</div></div>
        <div class="kpi"><div class="n">${montos(act.reduce((m, f) => { if (f.presupuesto) m[f.moneda] = (m[f.moneda] || 0) + f.presupuesto; return m; }, {}))}</div><div class="l">Presupuesto (activos)</div></div>
        <div class="kpi"><div class="n">${montos(comprasT)}</div><div class="l">Invertido en OC (activos)</div></div></div>`
    : `<div class="kpis"><div class="kpi"><div class="n">${act.length}</div><div class="l">Servicios activos · ${cuenta('CON_OC')} con OC · ${cuenta('EN_EVALUACION')} en evaluación · ${cuenta('PENDIENTE_OC')} pend. OC</div></div>
        <div class="kpi"><div class="n">${montos(monto)}</div><div class="l">Monto de servicios activos (sin IGV)</div></div>
        <div class="kpi"><div class="n">${montos(porCobrar)}</div><div class="l">Facturado por cobrar</div></div>
        <div class="kpi"><div class="n">${montos(comprasT)}</div><div class="l">Compras asociadas (activos)</div></div></div>`;
  const tablaHtml = esPI
    ? tabla([['PI'], ['Proyecto'], ['Tipo'], ['Responsable'], ['Estado'], ['Presupuesto', 'r'], ['Invertido (OC)', 'r'], ['Req / OC', 'c'], ['Inicio → término']],
        filas.map(f => `<tr><td class="mono">${esc(f.ot)}</td><td>${esc(f.nombre)}${f.registro !== 'activo' ? ` <i>(${esc(f.registro)})</i>` : ''}</td><td>${esc(f.tipo)}</td><td>${esc(f.responsable)}</td><td>${esc(f.estOp)}</td><td class="r">${f.presupuesto != null ? money(f.presupuesto, f.moneda) : '—'}</td><td class="r">${montos({ SOLES: f.comprasS, DOLARES: f.comprasD })}</td><td class="c">${f.reqs} / ${f.nOc}</td><td>${fdate(f.p.fecha_inicio)} → ${fdate(f.p.fecha_entrega)}</td></tr>`), 'Sin registros.')
    : tabla([['OT'], ['Servicio / cliente'], ['Estado'], ['Cotización'], ['OC cliente'], ['Monto s/IGV', 'r'], ['Ingreso'], ['Salida'], ['Días', 'c'], ['Informe'], ['Factura'], ['Por cobrar', 'r'], ['Cobranza']],
        filas.map(f => `<tr><td class="mono" style="white-space:nowrap">${esc(f.ot)}</td><td><b>${esc(f.nombre)}</b><div style="color:#555">${esc(f.cliente)}${f.registro !== 'activo' ? ` · ${esc(f.registro)}` : ''}</div></td><td>${esc(f.estCom)}<div style="color:#555">${esc(f.estOp)}</div></td><td class="mono">${esc(f.cotizacion || '—')}</td><td class="mono">${esc(f.ocCliente || '—')}</td><td class="r">${f.monto != null ? money(f.monto, f.moneda) : '—'}</td><td style="white-space:nowrap">${f.ingreso ? fdate(f.ingreso) : '—'}</td><td style="white-space:nowrap">${f.salida ? fdate(f.salida) : '—'}</td><td class="c">${f.dias ?? '—'}</td><td class="mono">${esc(f.informe || '—')}</td><td class="mono">${esc(f.facturas || '—')}</td><td class="r">${f.porCobrar > 0.009 ? money(f.porCobrar, f.monedaFact) : '—'}</td><td>${esc(f.estCobro)}</td></tr>`), 'Sin registros.');
  abrir(documento({
    titulo: esPI ? 'Reporte global de proyectos internos' : 'Reporte global de servicios',
    apaisada: true, fondo: d.fondo,
    cuerpo: cab + kpis + `<div style="height:3mm"></div>` + tablaHtml + `<div class="pie">Generado desde el Maestro de Gestión de ${EMPRESA.nombre}.</div>`,
  }));
}

// ------------------------------------------------------------------ Excel
let xlsxCargado = null;
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxCargado ||= new Promise((ok, mal) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    sc.onload = () => ok(window.XLSX); sc.onerror = () => { xlsxCargado = null; mal(new Error('No se pudo cargar el generador de Excel')); };
    document.head.appendChild(sc);
  });
}

export async function reporteGlobalExcel(d) {
  const XLSX = await cargarXLSX();
  const filas = filasGlobal(d);
  const fecha = (v) => v ? new Date(String(v).slice(0, 10) + 'T00:00:00') : '';
  const wb = XLSX.utils.book_new();
  const hoja = (nombre, cab, datos, anchos) => {
    const ws = XLSX.utils.aoa_to_sheet([cab, ...datos], { cellDates: true, dateNF: 'dd/mm/yyyy' });
    ws['!cols'] = anchos.map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: datos.length, c: cab.length - 1 } }) };
    ws['!freeze'] = { xSplit: 1, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  };
  const srv = filas.filter(f => (f.p.clase || 'SERVICIO') === 'SERVICIO');
  const pis = filas.filter(f => f.p.clase === 'INTERNO');
  hoja('Servicios (OT)',
    ['OT', 'Cliente', 'Servicio', 'Tipo', 'Responsable', 'Estado comercial', 'Estado operativo', 'Registro', 'Cotización', 'OC cliente', 'Fecha OC cliente', 'Moneda', 'Monto servicio (sin IGV)',
      'Fecha ingreso', 'Guía ingreso', 'Fecha salida', 'Guía salida', 'Días en taller', 'Componentes', 'Informe técnico', 'Requerimientos', 'OC/OS compras', 'Compras S/', 'Compras US$',
      'Facturas', 'Moneda factura', 'Facturado (con IGV)', 'Cobrado', 'Por cobrar', 'Cobranza', 'Creado', 'Observaciones'],
    srv.map(f => [f.ot, f.cliente, f.nombre, f.tipo, f.responsable, f.estCom, f.estOp, f.registro, f.cotizacion, f.ocCliente, fecha(f.fechaOc), f.moneda === 'DOLARES' ? 'US$' : 'S/', f.monto ?? '',
      fecha(f.ingreso), f.guiaIng, fecha(f.salida), f.guiaSal, f.dias ?? '', f.comps, f.informe, f.reqs, f.nOc, f.comprasS || '', f.comprasD || '',
      f.facturas, f.facturas ? (f.monedaFact === 'DOLARES' ? 'US$' : 'S/') : '', f.facturado || '', f.cobrado || '', f.porCobrar || '', f.estCobro, fecha(f.creado), f.observaciones]),
    [14, 32, 40, 14, 18, 20, 14, 10, 11, 14, 12, 7, 14, 12, 14, 12, 14, 9, 8, 14, 8, 8, 12, 12, 18, 8, 14, 12, 12, 11, 11, 40]);
  if (pis.length) hoja('Proyectos internos (PI)',
    ['PI', 'Proyecto', 'Tipo', 'Responsable', 'Estado', 'Registro', 'Moneda', 'Presupuesto', 'Compras S/', 'Compras US$', 'Requerimientos', 'OC/OS', 'Inicio', 'Término', 'Observaciones'],
    pis.map(f => [f.ot, f.nombre, f.tipo, f.responsable, f.estOp, f.registro, f.moneda === 'DOLARES' ? 'US$' : 'S/', f.presupuesto ?? '', f.comprasS || '', f.comprasD || '', f.reqs, f.nOc, fecha(f.p.fecha_inicio), fecha(f.p.fecha_entrega), f.observaciones]),
    [14, 40, 22, 18, 14, 10, 7, 13, 12, 12, 8, 8, 12, 12, 40]);
  const otDe = Object.fromEntries(filas.map(f => [f.p.id, f]));
  const facts = (d.F || []).filter(x => otDe[x.proyecto_id]);
  if (facts.length) hoja('Facturas',
    ['OT', 'Cliente', 'Factura', 'Emisión', 'Vence', 'Moneda', 'Monto', 'Cobrado', 'Saldo', 'Estado', 'Fecha cobro'],
    facts.map(x => [otDe[x.proyecto_id].ot, otDe[x.proyecto_id].cliente, x.numero_factura, fecha(x.fecha_emision), fecha(x.fecha_vencimiento), x.moneda === 'DOLARES' ? 'US$' : 'S/', Number(x.monto || 0), Number(x.monto_cobrado || 0), Number(x.monto || 0) - Number(x.monto_cobrado || 0), d.etiquetas.EST_COBRO[x.estado_cobro] || x.estado_cobro, fecha(x.fecha_cobro)]),
    [14, 32, 14, 11, 11, 7, 12, 12, 12, 12, 11]);
  XLSX.writeFile(wb, `Reporte_global_Maestro_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellDates: true });
}
