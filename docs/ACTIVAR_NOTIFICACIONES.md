# Hora, avisos y actividad GTO

La hora y los avisos comparten un componente. Los avisos generales provienen de `recordatorios.js` del portal; no deben contener información privada porque este recurso es público. Su lectura se guarda únicamente en el navegador, como en el portal actual.

## OT — primera integración

Maestro y Logística comparten el proyecto Supabase `cbguxckfkaxytgzxvpxe`. El adaptador consulta `gto_ot_actividad` y marca una OT como leída con `gto_ot_marcar_leida`. Solo almacena la lectura del usuario autenticado; no modifica la OT. Consulta hasta 50 OT de los últimos 30 días al abrir y cada minuto mientras la página está visible. No envía correo, WhatsApp ni notificaciones fuera de la página.

La migración adjunta es un borrador: antes de aplicarla hay que confirmar en Supabase los tipos de `proyectos`, la seguridad de `proyectos_maestro`, el resultado y permisos de `acceso_maestro()` y la fuente técnica `lab_servicios()`. La vista técnica puede requerir una rama de consulta específica: no se deben ampliar los permisos de la vista comercial para habilitar avisos.

Pruebas obligatorias con roles reales antes de activar: usuario sin sesión, Maestro total, vista técnica, Administración sin Maestro, solicitante; aislamiento de lecturas entre dos usuarios; permisos revocados; lectura de la misma OT desde dos dispositivos; inserción real controlada en entorno de prueba y aparición en ambos módulos. No crear registros ficticios en producción para probar.

Los módulos de Bitácora, RRHH, Finanzas y Cotizaciones usan sesiones o proyectos distintos. En esta primera integración reciben reloj y avisos generales. Su actividad se muestra como pendiente de conexión; no se comparten tokens ni se asume que un correo igual otorga acceso a OT. La federación entre proyectos requiere validar identidades y permisos explícitos antes de implementarla.

## Publicación

Las ramas de revisión usan el despliegue de revisión del portal para los recursos comunes. Tras activar y validar el backend, sustituir esa base por `https://sistema-integrado-gto.vercel.app/`, retirar la página de demostración y publicar primero los recursos comunes. Después publicar los consumidores y comprobar sesiones reales. Conservar sin fusionar la propuesta visual de Logística hasta su aprobación independiente.

## Validación ejecutada

`node --test status.test.cjs`: zona de Lima al cruzar medianoche UTC, horarios y víspera semanal, expiración de avisos, ausencia de datos ficticios en fuentes vacías y propagación de errores de backend. La demostración no prueba permisos de base de datos ni sincronización real.
