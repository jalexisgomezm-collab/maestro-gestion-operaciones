/* Maqueta Maestro de Gestión (18/11/2026). Solo presentación: agrega íconos y ordena textos en pantalla.
   No consulta ni guarda datos, no cambia acciones ni botones (los mismos elementos y sus funciones siguen igual). */
(() => {
  const root = document.getElementById('app');
  if (!root) return;
  const P = {
    capas: 'M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5',
    mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
    carrito: 'M2 4h3l2.5 11h11L21 7H6.2M9 20h.01M18 20h.01',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    barras: 'M4 20V11M10 20V5M16 20v-6M3 20h18',
    usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    portapapeles: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
    etiqueta: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
    pdf: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h4',
    dividir: 'M6 3v6a6 6 0 0 0 6 6h0M18 3v6a6 6 0 0 1-6 6v6M6 3h.01M18 3h.01',
    lapiz: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
    basura: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6',
    caja: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
    camion: 'M2 6h12v10H2zM14 10h4l3 3v3h-7M6 18.5h.01M17 18.5h.01',
    doc: 'M6 2h9l5 5v15H6zM14 2v6h6M9 12h6M9 16h6',
    moneda: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9h-3a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-3M12 7v2M12 15v2',
    campana: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0',
    imagen: 'M3 5h18v14H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 16l-5-5-8 8',
  };
  const svg = (k) => {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    for (const [a, b] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'gto-maq-ic' })) s.setAttribute(a, b);
    p.setAttribute('d', P[k]); s.append(p); return s;
  };
  const conIcono = (el, k) => { if (!el || el.dataset.maq) return; el.dataset.maq = '1'; el.prepend(svg(k)); };
  const textoLimpio = (el) => el.textContent.replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, '').trim();
  // Título en forma de oración, conservando siglas y códigos (GPR, ACS2000, 17EA33)
  const oracion = (t) => t.toLowerCase().replace(/(^|\s)(\S+)/g, (m, sp, w) => {
    const orig = t.substr(t.toLowerCase().indexOf(w, 0), w.length);
    return sp + w;
  });
  function titulo(h1) {
    if (h1.dataset.maq) return; h1.dataset.maq = '1';
    const orig = h1.textContent.trim();
    if (orig !== orig.toUpperCase()) return;
    const palabras = orig.split(/(\s+)/).map((w, i) => {
      if (/^\s+$/.test(w)) return w;
      if (/\d/.test(w) || (w.length <= 3 && !/^(DE|LA|EL|Y|EN|DEL|LOS|LAS|CON|POR|AL|UN|UNA|SUS|SU|A|E|O|U)$/.test(w))) return w;
      return w.toLowerCase();
    }).join('');
    h1.title = orig;
    h1.textContent = palabras.charAt(0).toUpperCase() + palabras.slice(1);
  }
  function cabecera() {
    const bar = root.querySelector('.gto-shared-toolbar');
    if (!bar) return;
    const img = bar.querySelector('.gto-toolbar-brand img');
    if (img && !img.dataset.maq) { img.dataset.maq = '1'; img.src = '/logo-gto-blanco.png'; }
    const span = bar.querySelector('.gto-toolbar-brand span');
    if (span && !span.dataset.maq) { span.dataset.maq = '1'; span.replaceChildren(svg('capas'), document.createTextNode('Maestro de Gestión')); }
    bar.querySelectorAll('.gto-toolbar-quick :is(a,button)').forEach(el => {
      const t = el.textContent.trim();
      if (/correos/i.test(t)) conIcono(el, 'mail');
      else if (/sistema oc|log[ií]stica/i.test(t)) { if (!el.dataset.maq) { el.textContent = 'Logística'; } conIcono(el, 'carrito'); }
      else if (/men[uú]/i.test(t)) conIcono(el, 'grid');
    });
    bar.querySelectorAll('.gto-toolbar-menu>summary').forEach(s => conIcono(s, /indicador/i.test(s.textContent) ? 'barras' : 'usuario'));
  }
  /* ---------- Bandeja de avisos del Maestro (solo lectura) ----------
     Junta: avisos manuales de avisos-taller.js (el mismo archivo de la Bitácora), entregas próximas o atrasadas, OT registradas
     esta semana y los recordatorios generales. Solo consulta; la marca de leído queda en este navegador. */
  const VISTOS = 'gto_maestro_avisos_vistos';
  const fDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hoy = () => fDia.format(new Date());
  const sumar = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const dif = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  const ddmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';
  const vistos = () => { try { const v = JSON.parse(localStorage.getItem(VISTOS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const marcar = keys => { try { localStorage.setItem(VISTOS, JSON.stringify([...new Set([...vistos(), ...keys])].slice(-600))); } catch {} };
  const ETIQ = { visita: 'Visita del cliente', urgente: 'Cliente pide apurar', recojo: 'Recojo', entrega: 'Entrega', aviso: 'Aviso' };
  let avisos = [], cargando = false, errorTxt = '', ultimo = 0;
  function cargarArchivo() {
    if (window.AVISOS_TALLER || document.getElementById('gto-avisos-taller')) return;
    const s = document.createElement('script'); s.id = 'gto-avisos-taller'; s.src = 'https://bitacora-tecnica-gto.vercel.app/avisos-taller.js?t=' + Math.floor(Date.now() / 600000);
    s.onload = () => { pintarBandeja(); }; document.head.append(s);
  }
  async function consultar() {
    const sb = window.DirectorioGTO_opts && window.DirectorioGTO_opts.sb;
    if (cargando || !sb) return;
    cargando = true; pintarBandeja();
    const d = hoy(); const lunes = sumar(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7));
    const lista = [];
    try {
      const [sem, ent] = await Promise.all([
        sb.from('proyectos_maestro').select('id,numero_orden_trabajo,nombre,cliente,estado,created_at').gte('created_at', lunes + 'T05:00:00Z').order('created_at', { ascending: false }).limit(40),
        sb.from('proyectos_maestro').select('id,numero_orden_trabajo,nombre,cliente,estado,estado_operativo,fecha_entrega').gte('fecha_entrega', sumar(d, -30)).lte('fecha_entrega', sumar(d, 7)).order('fecha_entrega').limit(60),
      ]);
      if (sem.error && ent.error) throw sem.error;
      for (const o of ent.data || []) {
        if (o.estado !== 'activo' || o.estado_operativo === 'ENTREGADO' || !o.fecha_entrega) continue;
        const n = dif(d, o.fecha_entrega);
        const cuando = n === 0 ? 'se entrega hoy' : n === 1 ? 'se entrega mañana' : n > 1 ? `se entrega en ${n} días (${ddmm(o.fecha_entrega)})` : `entrega atrasada ${-n} día${n === -1 ? '' : 's'} (era el ${ddmm(o.fecha_entrega)})`;
        lista.push({ key: `ent-${o.id}-${o.fecha_entrega}`, grupo: 'entregas', titulo: `${o.numero_orden_trabajo} ${cuando}`, texto: [o.nombre, o.cliente].filter(Boolean).join(' · '), href: `#/servicio/${o.id}`, alerta: n < 0 });
      }
      for (const o of sem.data || []) {
        if (o.estado === 'cancelado' || !o.created_at || o.created_at < lunes + 'T05:00:00Z') continue;
        const f = new Date(o.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        lista.push({ key: `sem-${o.id}`, grupo: 'semana', titulo: `${o.numero_orden_trabajo} · ${o.nombre || ''}`.trim(), texto: [o.cliente, 'registrada ' + f].filter(Boolean).join(' · '), href: `#/servicio/${o.id}` });
      }
      errorTxt = '';
    } catch (e) { errorTxt = 'No se pudieron consultar las OT. Recarga la página para reintentar.'; }
    avisos = lista; cargando = false; ultimo = Date.now(); pintarBandeja();
  }
  function manuales() {
    const d = hoy();
    return (window.AVISOS_TALLER || []).filter(a => a && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha >= d && a.fecha <= sumar(d, 7)).map(a => {
      const n = dif(d, a.fecha); const cuando = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : ddmm(a.fecha);
      return { key: `man-${a.fecha}-${a.titulo}`, grupo: 'taller', titulo: a.titulo || ETIQ[a.tipo] || 'Aviso', texto: [a.texto, a.ot].filter(Boolean).join(' · '), etiqueta: `${ETIQ[a.tipo] || 'Aviso'} · ${cuando}${a.hora ? ' · ' + a.hora : ''}`, alerta: a.tipo === 'urgente' };
    }).sort((x, y) => x.etiqueta.localeCompare(y.etiqueta));
  }
  function generales() {
    try {
      if (!window.GTOStatus || !window.GTOStatus.notices || !window.FIJOS) return [];
      return window.GTOStatus.notices(new Date(), { events: window.EVENTOS, fixed: window.FIJOS, safety: window.SEGURIDAD })
        .filter(x => x.active).map(x => ({ key: 'gen-' + x.id, grupo: 'general', titulo: x.title, texto: x.text, etiqueta: x.label }));
    } catch { return []; }
  }
  let boton = null, panel = null, fondo = null, lista = null, contador = null;
  function crearBandeja() {
    if (boton) return;
    boton = document.createElement('button'); boton.type = 'button'; boton.className = 'gto-bit-campana';
    boton.append(svg('campana')); contador = document.createElement('span'); contador.className = 'gto-bit-n'; boton.append(contador);
    fondo = document.createElement('div'); fondo.className = 'gto-bit-fondo'; fondo.hidden = true;
    panel = document.createElement('section'); panel.className = 'gto-bit-bandeja'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Bandeja de avisos');
    const cab = document.createElement('header'); const h = document.createElement('h2'); h.textContent = 'Bandeja de avisos';
    const cerrar = document.createElement('button'); cerrar.type = 'button'; cerrar.textContent = 'Cerrar';
    cab.append(h, cerrar); lista = document.createElement('div'); lista.className = 'gto-bit-lista'; panel.append(cab, lista);
    document.body.append(fondo, panel);
    const ocultar = () => { panel.hidden = fondo.hidden = true; };
    boton.onclick = () => { panel.hidden = fondo.hidden = false; pintarBandeja(); if (Date.now() - ultimo > 120000) consultar(); };
    cerrar.onclick = ocultar; fondo.onclick = ocultar;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) ocultar(); });
    lista.addEventListener('click', e => { const a = e.target.closest('a[data-key]'); if (a) { marcar([a.dataset.key]); ocultar(); pintarBandeja(); } });
    setInterval(consultar, 10 * 60 * 1000);
  }
  function pintarBandeja() {
    if (!boton) return;
    const todos = [...manuales(), ...avisos, ...generales()];
    const v = vistos(); const n = todos.filter(a => !v.includes(a.key)).length;
    contador.textContent = n ? String(n) : ''; boton.setAttribute('aria-label', `Bandeja de avisos, ${n} sin leer`); boton.title = 'Bandeja de avisos';
    if (panel.hidden) return;
    lista.replaceChildren();
    const sec = (titulo, items, vacio) => {
      const h = document.createElement('h3'); h.textContent = titulo + (items.length ? ` · ${items.length}` : ''); lista.append(h);
      if (!items.length) { if (vacio) { const p = document.createElement('p'); p.className = 'gto-bit-vacio'; p.textContent = vacio; lista.append(p); } return; }
      for (const a of items) {
        const art = document.createElement(a.href ? 'a' : 'article');
        art.className = 'gto-bit-item' + (v.includes(a.key) ? '' : ' nuevo') + (a.alerta ? ' alerta' : '');
        if (a.href) { art.href = a.href; art.dataset.key = a.key; }
        if (a.etiqueta) { const s = document.createElement('small'); s.textContent = a.etiqueta; art.append(s); }
        const b = document.createElement('strong'); b.textContent = a.titulo; const p = document.createElement('p'); p.textContent = a.texto || '';
        art.append(b, p); lista.append(art);
      }
    };
    if (errorTxt) { const p = document.createElement('p'); p.className = 'gto-bit-error'; p.textContent = errorTxt; lista.append(p); }
    if (cargando && !avisos.length) { const p = document.createElement('p'); p.className = 'gto-bit-vacio'; p.textContent = 'Consultando OT…'; lista.append(p); }
    sec('Visitas y pedidos de clientes', todos.filter(a => a.grupo === 'taller'), 'Sin visitas ni pedidos de urgencia registrados para estos días.');
    sec('Entregas próximas y atrasadas', todos.filter(a => a.grupo === 'entregas'), 'Ningún servicio con entrega en los próximos 7 días.');
    sec('OT registradas esta semana', todos.filter(a => a.grupo === 'semana'), 'Aún no se registran OT esta semana.');
    sec('Recordatorios generales', todos.filter(a => a.grupo === 'general'));
    if (todos.some(a => !v.includes(a.key))) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gto-bit-leer'; b.textContent = 'Marcar todo como leído';
      b.onclick = () => { marcar(todos.map(a => a.key)); pintarBandeja(); }; lista.append(b);
    }
  }
  function ubicarBandeja(bar2) {
    crearBandeja();
    if (boton.parentElement !== bar2) {
      const general = bar2.querySelector('.gto-shared-bell, .gto-status-bell-only');
      const sitio = general ? (general.closest('.gto-shared-bell') || general) : null;
      if (sitio) sitio.after(boton); else bar2.append(boton);
    }
  }
  const ICON_BTN = { rotulo: 'etiqueta', ficha: 'pdf', dividir: 'dividir', edit: 'lapiz', del: 'basura' };
  const ICON_TAB = [[/componente/i, 'caja'], [/gu[ií]a/i, 'camion'], [/requerimiento/i, 'carrito'], [/orden/i, 'carrito'], [/informe/i, 'doc'], [/factura/i, 'moneda'], [/foto|archivo/i, 'imagen']];
  function ficha() {
    const head = root.querySelector('.ot-sheet .detail-head');
    if (head && !head.dataset.maq) {
      head.dataset.maq = '1';
      const info = head.querySelector(':scope > div');
      const h1 = info && info.querySelector('h1'); const tag = info && info.querySelector('.ot-tag');
      if (info && h1) {
        const cab = document.createElement('div'); cab.className = 'gto-maq-cab'; cab.append(svg('portapapeles'));
        info.prepend(cab);
        if (tag) { const cod = document.createElement('div'); cod.className = 'gto-maq-codigo'; cod.append('Código:', tag); h1.after(cod); }
        titulo(h1);
      }
      head.querySelectorAll(':scope > .row > button').forEach(b => {
        const k = ICON_BTN[b.id]; if (!k || b.dataset.maq) return;
        b.dataset.maq = '1'; const label = textoLimpio(b); b.replaceChildren(svg(k), document.createTextNode(label));
      });
    }
    root.querySelectorAll('.ot-sheet .tabs button').forEach(b => {
      if (b.dataset.maq) return; const m = ICON_TAB.find(([re]) => re.test(b.textContent)); if (m) conIcono(b, m[1]);
    });
  }
  // Clima y tipo de cambio a la vista en la barra (como la hora); se mueven dentro de la misma barra,
  // así siguen actualizándose solos. Sistema OC se oculta y Correos pasa al menú lateral.
  function indicadores() {
    const bar = root.querySelector('.gto-shared-toolbar'); if (!bar) return;
    const barra = bar.querySelector('.barra'); const reloj = barra && barra.querySelector('.chip.reloj');
    const ind = bar.querySelector('.gto-toolbar-indicators');
    if (reloj && ind) {
      ind.querySelectorAll('.gto-toolbar-popover > .chip').forEach(c => { c.classList.add('gto-maq-chip'); reloj.before(c); });
      if (!ind.querySelector('.gto-toolbar-popover > *')) ind.classList.add('gto-maq-oculto');
    }
    bar.querySelectorAll('.gto-toolbar-quick :is(a,button)').forEach(el => {
      if (/sistema oc|log[ií]stica/i.test(el.textContent)) el.classList.add('gto-maq-oculto');
    });
    const correos = Array.from(bar.querySelectorAll('.gto-toolbar-quick :is(a,button)')).find(el => /correos/i.test(el.textContent));
    const nav = root.querySelector('.ops-navigation');
    if (correos && nav && !nav.querySelector('.gto-maq-correos')) {
      const a = document.createElement('a'); a.href = '#/correos'; a.className = 'gto-maq-correos'; a.setAttribute('role', 'button');
      const ic = svg('mail'); ic.removeAttribute('class'); a.append(ic, document.createTextNode('Correos'));
      a.addEventListener('click', e => { e.preventDefault(); root.classList.remove('ops-menu-open'); correos.click(); });
      nav.append(a); correos.classList.add('gto-maq-oculto');
    }
  }
  function bandeja() {
    const bar2 = root.querySelector('.gto-shared-toolbar .barra'); if (!bar2) return;
    ubicarBandeja(bar2); cargarArchivo();
    if (!ultimo && !cargando) consultar();
  }
  function aplicar() { try { cabecera(); indicadores(); bandeja(); ficha(); } catch (e) { /* solo diseño: si algo falla, la pantalla sigue igual */ } }
  new MutationObserver(aplicar).observe(root, { childList: true, subtree: true });
  aplicar();
})();
