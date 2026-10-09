# Administración móvil local

> Esta administración funciona dentro de la misma Wi‑Fi. Para la visión completa de mantenimiento fuera de la vivienda, actualizaciones y futuras incidencias, consultar [OPERACION-REMOTA.md](OPERACION-REMOTA.md).

## Alcance implementado

La Teclast T65 sigue siendo la fuente de verdad. Al arrancar Pablo Tablet se abre un servidor HTTP local en el puerto `8765` y se anuncia un servicio `_http._tcp.` llamado `pablotablet` mediante Android NSD. La dirección IP válida se muestra en **Ajustes → Administración móvil**.

El editor móvil se sirve desde la propia tablet y sus funciones locales no necesitan Internet. La búsqueda de una ciudad en Tiempo sí requiere acceso a Open‑Meteo para resolver sus datos. Permite:

- consultar el estado del panel;
- crear y administrar notas;
- buscar y añadir una ubicación meteorológica escribiendo únicamente la ciudad; el editor obtiene automáticamente región, país, coordenadas y zona horaria mediante Open‑Meteo;
- crear y administrar eventos, tareas, alarmas y temporizadores;
- administrar ubicaciones meteorológicas;
- cambiar la visibilidad de páginas y widgets;
- subir y visualizar fotografías guardadas en el directorio privado de la app.

El borrado de fotografías continúa realizándose desde la tablet. Los dibujos y la colocación exacta del grid siguen siendo operaciones de tablet en esta versión.

## Vinculación

1. Abrir **Ajustes → Administración móvil → Vincular un móvil**.
2. Escanear el QR con un móvil conectado a la misma Wi‑Fi.
3. Escribir o revisar el nombre del móvil y solicitar autorización.
4. Comprobar nombre, navegador y hora en la tablet.
5. Pulsar **Permitir** o **Rechazar** físicamente en la tablet.

El QR y la solicitud caducan a los cinco minutos. El QR también se invalida al cerrar su panel. Una autorización aceptada crea una credencial larga, individual y revocable. La credencial en claro solo queda en el navegador móvil; la tablet persiste su hash SHA-256 y los datos básicos del dispositivo.

La acción **Revocar todos los dispositivos** solo aparece si existe al menos un móvil autorizado y requiere confirmación explícita. La operación revoca todas las credenciales activas, cancela QR y solicitudes pendientes y elimina credenciales temporales en una única transacción. Después cierra los WebSockets asociados; los clientes abiertos eliminan su credencial local y muestran que deben volver a vincularse. Es posible generar un QR nuevo inmediatamente después.

El endpoint de solicitud admite un máximo de 5 intentos por dirección IP y 30 intentos globales por minuto. Tras 3 fallos consecutivos de una misma IP aplica esperas progresivas de 30, 60, 120 segundos, hasta un máximo de 5 minutos. Los límites usan la dirección remota del socket, nunca cabeceras aportadas por el navegador, y responden con HTTP `429`, `Retry-After` y un mensaje con el tiempo restante. Hay como máximo 8 solicitudes simultáneas pendientes. El gestor nativo conserva estos contadores aunque se cierre la pantalla o se reinicie el servidor local por un cambio de red.

## Contrato local

| Operación | Método y ruta | Autenticación |
| --- | --- | --- |
| Salud del servidor | `GET /api/health` | no |
| Solicitar vinculación | `POST /api/pair/request` | token temporal del QR |
| Consultar vinculación | `GET /api/pair/request/{id}` | token temporal del QR |
| Leer estado | `GET /api/state` | `Authorization: Bearer …` |
| Guardar estado | `PUT /api/state` | `Authorization: Bearer …` |
| Subir fotografía | `POST /api/photos` | `Authorization: Bearer …` |
| Leer fotografía | `GET /api/photos/{id}` | `Authorization: Bearer …` |
| Cambios en tiempo real | `WS /ws?token=…` | credencial del dispositivo |

La sincronización normal usa **Last Write Wins**. No hay cola de cambios offline en el móvil: cuando se pierde la conexión, el editor conserva la última vista, bloquea la edición e intenta reconectar.

## Persistencia

Las tablas `mobile_devices`, `pairing_sessions` y `pairing_requests` viven en `pablo_tablet.db`. El estado funcional permanece en `app_storage` y los archivos de galería en `files/gallery`. La API móvil escribe sobre esa misma base, y la interfaz de la tablet detecta los cambios externos una vez por segundo.

Cada minuto se marcan las solicitudes caducadas, se borran sus credenciales temporales y se purga el historial de vinculación con más de 24 horas. El limitador conserva como máximo 256 direcciones de origen y elimina entradas inactivas, por lo que ni SQLite ni la memoria crecen indefinidamente por este flujo.

## Validación pendiente en hardware

El código compila como web y Android. Antes de considerar cerrada esta fase hay que probar en la Teclast T65:

- conexión con uno y dos móviles reales;
- Permitir/Rechazar, caducidad y revocación;
- reinicio de tablet, móvil y router;
- pérdida/recuperación de Wi‑Fi y reconexión de WebSocket;
- subida y visualización de fotografías;
- resolución mDNS/NSD;
- comportamiento de instalación desde pantalla de inicio.

El servidor actual vive dentro del proceso de Pablo Tablet. Como el dispositivo funciona en modo kiosco, esto cubre el uso normal, pero la recuperación autónoma mediante un Android Service/Watchdog queda como endurecimiento posterior.
