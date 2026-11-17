/* Presentation only: reuse live nodes and existing handlers; no data/API access. */
(() => {
  const root = document.getElementById('app');
  if (!root) return;
  const menu = 'https://sistema-integrado-gto.vercel.app';
  const iconPaths = {
    home: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    informes: 'M5 3h10l4 4v14H5zM14 3v5h5M9 12h6M9 16h6',
    guias: 'M2 6h13v11H2zM15 10h4l3 4v3h-7M7 17a2 2 0 1 0 0 .1M18 17a2 2 0 1 0 0 .1',
    propuestas: 'M4 3h16v18H4zM8 8h8M8 12h8M8 16h4',
    factoring: 'M4 20V10M10 20V4M16 20v-7M3 20h18',
  };
  function icon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    svg.append(p);
    return svg;
  }
  function highlight() {
    const hash = location.hash || '#/';
    root.querySelectorAll('.ops-navigation a').forEach(a => {
      const href = a.getAttribute('href');
      const active = href === '#/' ? !/^#\/(informes|guias|propuestas|factoring)/.test(hash) : hash.startsWith(href);
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function decorate() {
    const header = root.querySelector(':scope > header.top');
    if (!header) { root.classList.remove('ops-shell', 'ops-menu-open'); return; }
    if (root.querySelector(':scope > .ops-workspace')) return;
    const main = root.querySelector(':scope > main');
    if (!main) return;
    root.classList.add('ops-shell');
    const logo = document.createElement('a');
    logo.className = 'ops-logo';
    logo.href = menu;
    logo.setAttribute('aria-label', 'Ir al portal GTO');
    const image = document.createElement('img');
    image.src = `${menu}/assets/logo-gto.png`;
    image.alt = 'GTO Electrónica y Eléctrico de Potencia';
    logo.append(image);
    header.prepend(logo);
    const brand = header.querySelector('.brand');
    if (brand) {
      const title = document.createElement('span');
      title.className = 'ops-brand-title';
      title.append(...Array.from(brand.childNodes));
      const small = document.createElement('small');
      small.textContent = 'SISTEMA INTEGRADO GTO';
      brand.append(small, title);
    }
    const workspace = document.createElement('div');
    workspace.className = 'ops-workspace';
    const sidebar = document.createElement('aside');
    sidebar.className = 'ops-sidebar';
    sidebar.id = 'ops-sidebar';
    sidebar.setAttribute('aria-label', 'Navegación de Operaciones');
    const module = document.createElement('div');
    module.className = 'ops-module';
    module.innerHTML = `<img src="${menu}/assets/icono-maestro.png" alt=""><div><small>Gestión de servicios</small><strong>Operaciones</strong></div>`;
    const label = document.createElement('div');
    label.className = 'ops-nav-label';
    label.textContent = 'Espacio de trabajo';
    const nav = document.createElement('nav');
    nav.className = 'ops-navigation';
    const home = document.createElement('a');
    home.href = '#/';
    home.textContent = 'Servicios y órdenes';
    nav.append(home);
    // Move only links already supplied by the application for the current role.
    Array.from(header.querySelectorAll(':scope > a[href^="#/"]:not(.brand)')).forEach(a => {
      if (a.getAttribute('href') === '#/') return;
      nav.append(a);
    });
    nav.querySelectorAll('a').forEach(a => {
      const key = a.getAttribute('href').replace('#/', '') || 'home';
      a.prepend(icon(iconPaths[key] || iconPaths.home));
      a.addEventListener('click', () => {
        root.classList.remove('ops-menu-open');
        root.querySelector('.ops-nav-toggle')?.setAttribute('aria-expanded', 'false');
      });
    });
    const foot = document.createElement('p');
    foot.className = 'ops-sidebar-foot';
    foot.textContent = 'GTO PERÚ · Minería, industria y ferrovías';
    sidebar.append(module, label, nav, foot);
    workspace.append(sidebar, main);
    root.append(workspace);
    const portal = document.createElement('a');
    portal.href = menu;
    portal.className = 'ops-menu-link';
    portal.textContent = 'Menú GTO';
    header.insertBefore(portal, header.querySelector('#logout'));
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ops-nav-toggle';
    toggle.textContent = 'Menú de Operaciones';
    toggle.setAttribute('aria-controls', 'ops-sidebar');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const open = root.classList.toggle('ops-menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    header.after(toggle);
    highlight();
  }
  new MutationObserver(decorate).observe(root, { childList: true });
  window.addEventListener('hashchange', highlight);
  decorate();
})();
