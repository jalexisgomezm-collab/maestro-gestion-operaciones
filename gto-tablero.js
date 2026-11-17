/* Read-only board built from the existing filtered list. No network or storage writes. */
(() => {
  const root = document.getElementById('app');
  if (!root) return;
  let mode = 'board';
  const states = ['Por iniciar', 'En proceso', 'Terminado', 'Entregado'];
  const colors = ['pending', 'progress', 'done', 'delivered'];
  function element(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function decorateBoard() {
    const main = root.querySelector('main');
    if (!main || !main.querySelector('#q') || !main.querySelector('#est')) return;
    const table = main.querySelector('.tbl-wrap table');
    if (!table || table.dataset.gtoBoard === 'ready') return;
    const wrap = table.closest('.tbl-wrap');
    const panel = wrap?.parentElement;
    if (!panel) return;
    table.dataset.gtoBoard = 'ready';
    const headers = Array.from(table.querySelectorAll('thead th')).map(h => h.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).filter(r => r.querySelector('.b-op'));
    const grouped = new Map(states.map(s => [s, []]));
    rows.forEach(row => {
      const status = row.querySelector('.b-op').textContent.trim() || 'Sin estado';
      if (!grouped.has(status)) grouped.set(status, []);
      grouped.get(status).push(row);
    });
    const toolbar = element('div', 'gto-board-toolbar');
    const caption = element('div', 'gto-board-caption');
    caption.append(element('strong', '', 'Seguimiento por estado operativo'), element('span', '', 'Consulta los registros del filtro actual.'));
    const buttons = element('div', 'gto-board-switch');
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', 'Vista de los registros');
    const boardButton = element('button', '', 'Tablero');
    const listButton = element('button', '', 'Lista');
    boardButton.type = listButton.type = 'button';
    buttons.append(boardButton, listButton);
    toolbar.append(caption, buttons);
    const board = element('div', 'gto-board');
    board.setAttribute('aria-label', 'Registros agrupados por estado operativo');
    grouped.forEach((items, state) => {
      const col = element('section', 'gto-board-column ' + (colors[states.indexOf(state)] || 'other'));
      const heading = element('div', 'gto-board-column-head');
      heading.append(element('h2', '', state), element('span', 'gto-board-count', String(items.length)));
      const body = element('div', 'gto-board-cards');
      items.forEach(row => {
        const cells = Array.from(row.cells);
        const card = element('article', 'gto-board-card');
        card.append(element('div', 'gto-board-code', cells[0]?.textContent.trim() || '—'));
        const title = cells[1]?.querySelector('div:not(.small)')?.textContent.trim() || cells[1]?.textContent.trim() || '—';
        card.append(element('h3', '', title));
        const secondary = cells[1]?.querySelector('.small')?.textContent.trim();
        if (secondary) card.append(element('p', 'gto-board-secondary', secondary));
        const badges = element('div', 'gto-board-badges');
        row.querySelectorAll('.badge').forEach(b => badges.append(b.cloneNode(true)));
        if (badges.childNodes.length) card.append(badges);
        const details = element('details', 'gto-board-extra');
        details.append(element('summary', '', 'Información del registro'));
        const dl = element('dl', '');
        cells.forEach((cell, i) => {
          if (i < 2 || cell.querySelector('.b-op') || !headers[i]) return;
          const line = element('div', '');
          line.append(element('dt', '', headers[i]), element('dd', '', cell.textContent.trim() || '—'));
          dl.append(line);
        });
        if (dl.childNodes.length) { details.append(dl); card.append(details); }
        const open = element('button', 'gto-board-open', 'Ver detalle →');
        open.type = 'button';
        open.addEventListener('click', () => row.click());
        card.append(open);
        body.append(card);
      });
      if (!items.length) body.append(element('p', 'gto-board-empty', 'Sin registros en este estado.'));
      col.append(heading, body);
      board.append(col);
    });
    function show(next) {
      mode = next;
      board.hidden = next !== 'board';
      wrap.hidden = next !== 'list';
      boardButton.classList.toggle('on', next === 'board');
      listButton.classList.toggle('on', next === 'list');
      boardButton.setAttribute('aria-pressed', String(next === 'board'));
      listButton.setAttribute('aria-pressed', String(next === 'list'));
    }
    boardButton.addEventListener('click', () => show('board'));
    listButton.addEventListener('click', () => show('list'));
    panel.insertBefore(toolbar, wrap);
    panel.append(board);
    show(mode);
  }
  let pending;
  new MutationObserver(() => { clearTimeout(pending); pending = setTimeout(decorateBoard, 0); }).observe(root, { childList: true, subtree: true });
  decorateBoard();
})();
