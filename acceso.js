// Bloquea el Maestro para quien no tenga acceso de Maestro (es_maestro): solicitantes de área y rol Administración.
// Lee la sesión que guarda app.js (no crea otro cliente de Supabase) y consulta el rol con mi_perfil().
const URL_SB = 'https://cbguxckfkaxytgzxvpxe.supabase.co';
const KEY = 'sb_publishable_yx0C0-9u7_Z4FsfkFRPm8g__2FsSEf4';
const STORAGE_KEY = 'sb-cbguxckfkaxytgzxvpxe-auth-token';
const OC_APP = 'https://gto-oc-sistema-app.vercel.app';
let revisado = null;

function sesion(){
  try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return s?.access_token ? s : null; } catch { return null; }
}

function bloquear(email, rol){
  if (document.getElementById('sin-acceso')) return;
  document.getElementById('app').style.display = 'none';
  const d = document.createElement('div');
  d.id = 'sin-acceso';
  d.innerHTML = `<div class="login"><h1>Maestro de Gestión</h1><div class="sub">GTO PERU · Operaciones</div>
    <p style="margin:14px 0">Tu usuario (<span></span>) no tiene acceso a este módulo<span id="rol-txt"></span>. Si lo necesitas, pide al área de compras que te asigne el rol <b>Compras</b>.</p>
    <p class="small">Tus requerimientos y su seguimiento están en el <a href="${OC_APP}/solicitudes">sistema de solicitudes</a>.</p>
    <button class="pri" style="margin-top:14px">Salir</button></div>`;
  d.querySelector('span').textContent = email || '';
  if (rol === 'administracion') d.querySelector('#rol-txt').textContent = ' (rol Administración)';
  else if (rol === 'solicitante') d.querySelector('#rol-txt').textContent = ' (rol Solicitante de área)';
  d.querySelector('button').onclick = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} location.reload(); };
  document.body.appendChild(d);
}
function desbloquear(){
  document.getElementById('sin-acceso')?.remove();
  document.getElementById('app').style.display = '';
}

async function revisar(){
  const s = sesion();
  const uid = s?.user?.id || null;
  if (uid === revisado) return;
  if (!uid) { revisado = null; return desbloquear(); }
  try {
    const r = await fetch(`${URL_SB}/rest/v1/rpc/mi_perfil`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!r.ok) return; // token vencido: se reintenta cuando la app lo renueve
    const data = await r.json();
    const p = Array.isArray(data) ? data[0] : data;
    revisado = uid;
    if (p && !p.es_maestro) bloquear(s.user.email, p.rol); else desbloquear();
  } catch { /* sin red: se reintenta */ }
}

revisar();
setInterval(revisar, 1500);
