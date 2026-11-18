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
  function aplicar() { try { cabecera(); ficha(); } catch (e) { /* solo diseño: si algo falla, la pantalla sigue igual */ } }
  new MutationObserver(aplicar).observe(root, { childList: true, subtree: true });
  aplicar();
})();
