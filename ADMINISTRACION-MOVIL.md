# Administración móvil local

> Esta administración funciona dentro de la misma Wi‑Fi. Para la visión completa de mantenimiento fuera de la vivienda, actualizaciones y futuras incidencias, consultar [OPERACION-REMOTA.md](OPERACION-REMOTA.md).

## Alcance implementado

La Teclast T65 sigue siendo la fuente de verdad. Cuando el usuario activa el acceso LAN, un servicio Android en primer plano mantiene el servidor HTTP local en el puerto `8765` y anuncia un servicio `_http._tcp.` llamado `pablotablet` mediante Android NSD. La dirección IP válida se muestra en **Ajustes → Administración móvil**.

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

Al solicitar acceso, la persona escribe un nombre reconocible y puede indicar el modelo del dispositivo. La tablet muestra el nombre, el tipo de dispositivo y el navegador en líneas separadas, tanto en la solicitud como en los dispositivos autorizados. La cadena técnica completa queda plegada en **Detalles técnicos**. El modelo es opcional y lo indica el usuario: los navegadores modernos pueden ocultarlo y reducir la información del sistema.

## Acceso directo en el móvil

Después de vincular el móvil aparece **Acceso directo en tu móvil**. Si el navegador ofrece instalación, el botón abre su diálogo de instalación. En el acceso LAN por HTTP se muestran instrucciones para usar **Añadir a pantalla de inicio** desde el menú de Chrome/Brave o **Compartir → Añadir a pantalla de inicio** en Safari. La web no puede crear un acceso directo automáticamente.

El acceso directo abre la dirección del editor sin guardar el token temporal del QR. Sigue necesitando conexión con la tablet y la autorización del navegador; no convierte el editor en una aplicación autónoma ni permite editar sin conexión. Si cambia la IP de la tablet, hay que usar la nueva dirección de Ajustes.

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

## Ciclo de vida y recuperación

`MobileAdminService` usa el tipo `connectedDevice`, mantiene una notificación persistente y devuelve `START_STICKY` mientras el acceso LAN esté activado. Comparte el proceso de la aplicación, pero su ciclo de vida es independiente del de la interfaz. Android puede recrearlo después de terminar el proceso; la recuperación no tiene un plazo garantizado.

La preferencia LAN no basta para abrir el servidor: el servicio debe haber entrado en primer plano. Al detenerlo se cierran el servidor, sus conexiones y el anuncio mDNS. Los cambios de Wi-Fi no pueden reabrirlos hasta que el servicio vuelva a arrancar. Los arranques repetidos reutilizan el mismo gestor y la misma notificación.

El receptor de `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED` restaura el servicio solo si el acceso seguía activado. Con el acceso desactivado no se abre el servidor ni se anuncia en la red.

| Situación | Comportamiento esperado |
| --- | --- |
| Cerrar la interfaz o retirarla de recientes | El servicio y la administración móvil continúan disponibles |
| Android termina el proceso | Android puede recrear el servicio y el móvil intenta reconectar con su credencial existente |
| Reiniciar la tablet o actualizar la aplicación | Se restaura el servicio si el acceso LAN estaba activado |
| Desactivar el acceso LAN | Se detienen el servidor y el anuncio; no se restauran tras cambios de red o reinicio |
| Perder y recuperar la Wi-Fi | Se cierra el enlace anterior y se usa la nueva IPv4 privada; si cambia la IP, hay que abrir la dirección actual que muestra Ajustes |
| Pulsar «Forzar detención» en Android | La aplicación queda detenida hasta una nueva interacción del usuario; no se espera recuperación automática |

«Forzar detención» no equivale a cerrar la interfaz ni a una muerte del proceso por el sistema. Android conserva el estado de detención hasta una interacción del usuario: [documentación de Android](https://developer.android.com/about/versions/15/behavior-changes-all#package-stopped-state).

## Validación pendiente en hardware

El código compila como web y Android. Antes de considerar cerrada esta fase hay que probar en la Teclast T65:

- conexión con uno y dos móviles reales;
- Permitir/Rechazar, caducidad y revocación;
- reinicio de tablet, móvil y router;
- pérdida/recuperación de Wi‑Fi y reconexión de WebSocket;
- subida y visualización de fotografías;
- resolución mDNS/NSD;
- comportamiento de instalación desde pantalla de inicio.

Para validar la recuperación hay que comprobar, después de cada escenario, la conexión desde el móvil autorizado, el rechazo HTTP `401` de `/api/state` sin credencial, una única instancia de `MobileAdminService` y una sola notificación. La prueba de muerte del proceso debe distinguirse expresamente de «Forzar detención». Las pruebas locales no acreditan que una corrección esté instalada; se repiten sobre la versión oficial actualizada desde **Buscar actualizaciones**.
