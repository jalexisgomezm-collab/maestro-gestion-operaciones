/* Directorio de correos GTO PERU \u2014 widget compartido (Maestro, Sistema OC, RR.HH.)
 * Lee la lista desde Supabase (BD OC/Maestro) con la funci\u00f3n directorio_correos_lista().
 * Uso:  DirectorioGTO.abrir()                      \u2192 abre la lista para copiar
 *       DirectorioGTO.abrir({ sb })                \u2192 si el usuario es administraci\u00f3n, permite editar (cliente supabase-js con sesi\u00f3n)
 *       <button data-directorio-gto>Correos</button> \u2192 cualquier elemento con ese atributo abre la lista
 */
(function () {
  if (window.DirectorioGTO) return;
  var URL_SB = 'https://cbguxckfkaxytgzxvpxe.supabase.co';
  var KEY = 'sb_publishable_yx0C0-9u7_Z4FsfkFRPm8g__2FsSEf4';
  var VERDE = '#0A9447';
  var cache = null;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function css() {
    if (document.getElementById('dgto-css')) return;
    var s = document.createElement('style'); s.id = 'dgto-css';
    s.textContent =
      '.dgto-bg{position:fixed;inset:0;background:rgba(15,23,20,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Arial,Helvetica,sans-serif}' +
      '.dgto{background:#fff;border-radius:12px;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.25);color:#1f2a24}' +
      '.dgto-h{background:' + VERDE + ';color:#fff;padding:12px 16px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:8px}' +
      '.dgto-h b{font-size:15px;flex:1}.dgto-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}' +
      '.dgto-tools{padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #e5e9e6}' +
      '.dgto-tools input{flex:1;min-width:160px;padding:7px 10px;border:1px solid #cfd8d3;border-radius:8px;font-size:13px}' +
      '.dgto-list{overflow:auto;padding:4px 8px;flex:1}' +
      '.dgto-row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px}.dgto-row:hover{background:#f1f7f3}' +
      '.dgto-row label{display:flex!important;align-items:center;justify-content:flex-start;gap:10px;flex:1;cursor:pointer;min-width:0;margin:0;text-align:left;font-size:13px;color:#1f2a24}' +
      '.dgto-row label>span{flex:1;min-width:0;text-align:left}' +
      '.dgto input[type=checkbox]{width:16px!important;height:16px;min-width:16px;margin:0!important;padding:0!important;flex:0 0 16px;border:0;accent-color:' + VERDE + ';cursor:pointer}' +
      '.dgto input[type=search]{width:auto}' +
      '.dgto-n{font-size:13px;font-weight:600}.dgto-c{font-size:12.5px;color:#4b5a52;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dgto-b{border:1px solid #cfd8d3;background:#fff;border-radius:7px;padding:6px 10px;font-size:12.5px;cursor:pointer;white-space:nowrap}' +
      '.dgto-b:hover{border-color:' + VERDE + ';color:' + VERDE + '}.dgto-p{background:' + VERDE + ';border-color:' + VERDE + ';color:#fff}.dgto-p:hover{color:#fff;filter:brightness(1.08)}' +
      '.dgto-f{padding:10px 16px;border-top:1px solid #e5e9e6;display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.dgto-f .dgto-sel{flex:1;font-size:12px;color:#5b6b62}' +
      '.dgto-ok{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#16361f;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:100000;font-family:Arial,sans-serif}' +
      '.dgto-ed input{padding:6px 8px;border:1px solid #cfd8d3;border-radius:7px;font-size:12.5px;min-width:0}' +
      '.dgto-msg{padding:16px;font-size:13px;color:#5b6b62}';
    document.head.appendChild(s);
  }

  function aviso(t) { var d = document.createElement('div'); d.className = 'dgto-ok'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }

  function copiar(texto, msg) {
    var ok = function () { aviso(msg || 'Copiado'); };
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(texto).then(ok, function () { viejo(); }); }
    else viejo();
    function viejo() { var t = document.createElement('textarea'); t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { aviso('No se pudo copiar'); } t.remove(); }
  }

  function cargar(force) {
    if (cache && !force) return Promise.resolve(cache);
    return fetch(URL_SB + '/rest/v1/rpc/directorio_correos_lista', {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}'
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { cache = d || []; return cache; });
  }

  function abrir(opts) {
    opts = opts || {};
    css();
    var bg = document.createElement('div'); bg.className = 'dgto-bg';
    bg.innerHTML = '<div class="dgto" role="dialog" aria-label="Directorio de correos GTO">' +
      '<div class="dgto-h"><b>\u2709 Directorio de correos \u00b7 GTO PERU</b><button class="dgto-x" title="Cerrar">\u00d7</button></div>' +
      '<div class="dgto-tools"><input type="search" placeholder="Buscar por nombre o correo\u2026"><button class="dgto-b" data-all>Marcar todos</button></div>' +
      '<div class="dgto-list"><div class="dgto-msg">Cargando\u2026</div></div>' +
      '<div class="dgto-f"><span class="dgto-sel">Marca los destinatarios y p\u00e9galos en Para / CC de tu correo.</span>' +
      '<button class="dgto-b dgto-p" data-copy>Copiar seleccionados</button></div></div>';
    document.body.appendChild(bg);
    var $ = function (q) { return bg.querySelector(q); };
    var cerrar = function () { bg.remove(); document.removeEventListener('keydown', esc_); };
    var esc_ = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', esc_);
    bg.addEventListener('click', function (e) { if (e.target === bg) cerrar(); });
    $('.dgto-x').onclick = cerrar;

    var lista = [], marcados = {}, q = '';
    function pintar() {
      var f = lista.filter(function (x) { var s = (x.nombre + ' ' + x.correo).toLowerCase(); return !q || s.indexOf(q) >= 0; });
      if (!f.length) { $('.dgto-list').innerHTML = '<div class="dgto-msg">Sin resultados.</div>'; return; }
      $('.dgto-list').innerHTML = f.map(function (x) {
        return '<div class="dgto-row"><label><input type="checkbox" data-c="' + esc(x.correo) + '"' + (marcados[x.correo] ? ' checked' : '') + '>' +
          '<span style="min-width:0"><div class="dgto-n">' + esc(x.nombre) + '</div><div class="dgto-c">' + esc(x.correo) + '</div></span></label>' +
          '<button class="dgto-b" data-one="' + esc(x.correo) + '" title="Copiar este correo">Copiar</button></div>';
      }).join('');
      bg.querySelectorAll('input[data-c]').forEach(function (i) { i.onchange = function () { if (i.checked) marcados[i.dataset.c] = 1; else delete marcados[i.dataset.c]; contar(); }; });
      bg.querySelectorAll('[data-one]').forEach(function (b) { b.onclick = function () { copiar(b.dataset.one, 'Correo copiado: ' + b.dataset.one); }; });
    }
    function contar() {
      var n = Object.keys(marcados).length;
      $('.dgto-sel').textContent = n ? n + ' seleccionado' + (n > 1 ? 's' : '') + ' \u00b7 se copian separados por \u201c;\u201d (Outlook / Gmail)' : 'Marca los destinatarios y p\u00e9galos en Para / CC de tu correo.';
    }
    $('input[type=search]').oninput = function (e) { q = e.target.value.trim().toLowerCase(); pintar(); };
    $('[data-all]').onclick = function () {
      var todos = lista.every(function (x) { return marcados[x.correo]; });
      marcados = {}; if (!todos) lista.forEach(function (x) { marcados[x.correo] = 1; });
      $('[data-all]').textContent = todos ? 'Marcar todos' : 'Desmarcar todos'; pintar(); contar();
    };
    $('[data-copy]').onclick = function () {
      var sel = lista.filter(function (x) { return marcados[x.correo]; }).map(function (x) { return x.correo; });
      if (!sel.length) return aviso('Marca al menos un correo');
      copiar(sel.join('; '), sel.length + ' correo' + (sel.length > 1 ? 's' : '') + ' copiado' + (sel.length > 1 ? 's' : ''));
    };

    cargar(true).then(function (d) { lista = d; pintar(); }).catch(function () {
      $('.dgto-list').innerHTML = '<div class="dgto-msg">No se pudo cargar el directorio. Revisa tu conexi\u00f3n e int\u00e9ntalo de nuevo.</div>';
    });

    // edici\u00f3n (solo administraci\u00f3n, con sesi\u00f3n del Maestro)
    if (opts.sb) {
      opts.sb.rpc('puede_editar_directorio').then(function (r) {
        if (!r || r.error || r.data !== true) return;
        var b = document.createElement('button'); b.className = 'dgto-b'; b.textContent = 'Editar directorio';
        $('.dgto-f').insertBefore(b, $('[data-copy]'));
        b.onclick = function () { cerrar(); editar(opts.sb); };
      });
    }
  }

  function editar(sb) {
    css();
    var bg = document.createElement('div'); bg.className = 'dgto-bg';
    bg.innerHTML = '<div class="dgto" style="max-width:680px"><div class="dgto-h"><b>Editar directorio de correos</b><button class="dgto-x">\u00d7</button></div>' +
      '<div class="dgto-list dgto-ed"><div class="dgto-msg">Cargando\u2026</div></div>' +
      '<div class="dgto-f"><span class="dgto-sel">Los cambios se ven en el Maestro, el Sistema OC y RR.HH.</span><button class="dgto-b dgto-p" data-new>+ Agregar correo</button></div></div>';
    document.body.appendChild(bg);
    var $ = function (q) { return bg.querySelector(q); };
    var cerrar = function () { bg.remove(); };
    $('.dgto-x').onclick = cerrar;
    bg.addEventListener('click', function (e) { if (e.target === bg) cerrar(); });

    function fila(x) {
      return '<div class="dgto-row" data-id="' + esc(x.id || '') + '">' +
        '<input data-k="nombre" value="' + esc(x.nombre) + '" placeholder="Nombre / \u00e1rea" style="flex:1">' +
        '<input data-k="correo" value="' + esc(x.correo) + '" placeholder="correo@gtoperu.com" style="flex:1.4" type="email">' +
        '<button class="dgto-b dgto-p" data-save>Guardar</button><button class="dgto-b" data-del title="Quitar">Quitar</button></div>';
    }
    function cargarEd() {
      sb.from('directorio_correos').select('id,nombre,correo,orden').eq('activo', true).order('orden').order('nombre').then(function (r) {
        if (r.error) { $('.dgto-list').innerHTML = '<div class="dgto-msg">' + esc(r.error.message) + '</div>'; return; }
        $('.dgto-list').innerHTML = (r.data || []).map(fila).join('') || '<div class="dgto-msg">Sin correos.</div>';
        enlazar();
      });
    }
    function enlazar() {
      bg.querySelectorAll('.dgto-row').forEach(function (row) {
        var g = function (k) { return row.querySelector('[data-k=' + k + ']').value.trim(); };
        row.querySelector('[data-save]').onclick = function () {
          var nombre = g('nombre'), correo = g('correo').toLowerCase();
          if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return aviso('Revisa el nombre y el correo');
          var id = row.dataset.id;
          var p = id ? sb.from('directorio_correos').update({ nombre: nombre, correo: correo, updated_at: new Date().toISOString() }).eq('id', id)
            : sb.from('directorio_correos').insert({ nombre: nombre, correo: correo, orden: 100 });
          p.then(function (r) { if (r.error) return aviso(/duplicate|unique/i.test(r.error.message) ? 'Ese correo ya est\u00e1 en el directorio' : 'No se pudo guardar'); cache = null; aviso('Guardado'); cargarEd(); });
        };
        row.querySelector('[data-del]').onclick = function () {
          var id = row.dataset.id;
          if (!id) { row.remove(); return; }
          if (!confirm('\u00bfQuitar ' + g('correo') + ' del directorio?')) return;
          sb.from('directorio_correos').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id)
            .then(function (r) { if (r.error) return aviso('No se pudo quitar'); cache = null; aviso('Quitado'); cargarEd(); });
        };
      });
    }
    $('[data-new]').onclick = function () {
      var l = $('.dgto-list'); var m = l.querySelector('.dgto-msg'); if (m) m.remove();
      l.insertAdjacentHTML('afterbegin', fila({ nombre: '', correo: '' })); enlazar(); l.querySelector('input').focus();
    };
    cargarEd();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-directorio-gto]');
    if (t) { e.preventDefault(); abrir(window.DirectorioGTO_opts || {}); }
  });

  // <script src="directorio-correos.js" data-flotante> agrega un boton flotante "Correos GTO" (para sistemas sin menu propio)
  var yo = document.currentScript;
  if (yo && yo.hasAttribute('data-flotante')) {
    var poner = function () {
      css();
      if (!document.getElementById('dgto-fab-css')) {
        var s2 = document.createElement('style'); s2.id = 'dgto-fab-css';
        s2.textContent = '.dgto-fab{position:fixed;right:18px;bottom:18px;z-index:99990;background:' + VERDE + ';color:#fff;border:0;border-radius:999px;padding:10px 16px;font:600 13px Arial,Helvetica,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer}.dgto-fab:hover{filter:brightness(1.08)}@media print{.dgto-fab{display:none}}';
        document.head.appendChild(s2);
      }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dgto-fab'; b.setAttribute('data-directorio-gto', '');
      b.title = 'Directorio de correos de GTO para copiar al enviar formatos'; b.textContent = '\u2709 Correos GTO';
      document.body.appendChild(b);
    };
    if (document.body) poner(); else document.addEventListener('DOMContentLoaded', poner);
  }

  window.DirectorioGTO = { abrir: abrir, editar: editar, cargar: cargar };
})();
