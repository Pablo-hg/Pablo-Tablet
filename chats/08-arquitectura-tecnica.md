# Pablo Tablet — Arquitectura Tablet ↔ Móvil

> Estado: Definido
> Actualizado: 18/09/2026
> Dispositivo objetivo: Teclast T65
> Alcance: comunicación, acceso, autorización y comportamiento entre la tablet y los dispositivos móviles.

---

## 1. Principios generales

Pablo Tablet será un sistema doméstico diseñado para funcionar principalmente de forma local.

La **Teclast T65 será el dispositivo central** del sistema.

La tablet deberá poder funcionar de forma autónoma incluso cuando:

- No haya Internet.
- No haya Wi-Fi.
- No haya ningún móvil conectado.
- El servidor local tenga que reiniciarse.
- La tablet se reinicie.

Los móviles actuarán como dispositivos de administración y edición.

La tablet estará orientada principalmente a visualización y acciones rápidas.

---

## 2. Servidor local

El servidor de Pablo Tablet se ejecutará directamente en la **Teclast T65**.

La arquitectura será híbrida:

- React se ejecutará dentro de Capacitor y proporcionará la interfaz.
- Un servicio nativo Android ejecutará el servidor local.
- El servicio nativo gestionará el autoarranque y la recuperación ante fallos.
- Room sobre SQLite será el almacenamiento definitivo y la tablet será la única fuente de verdad.
- Una API REST atenderá consultas y modificaciones.
- WebSocket propagará los cambios en tiempo real.

No será necesario disponer de:

- Raspberry Pi.
- NAS.
- Ordenador encendido.
- Servidor externo.
- Infraestructura cloud.

La tablet será responsable de:

- Almacenar los datos.
- Ejecutar el panel.
- Ejecutar el servidor local.
- Servir el editor web a los móviles.
- Gestionar dispositivos autorizados.
- Sincronizar los cambios.
- Almacenar las fotografías y archivos locales.

---

## 3. Acceso desde el móvil

El acceso habitual será mediante:

`pablotablet.local`

También existirá una dirección basada en la IP local de la tablet como mecanismo alternativo.

Ejemplo:

`192.168.1.37:<puerto>`

La IP actual podrá consultarse desde:

**Ajustes → Conexión**

El sistema QR podrá utilizar automáticamente una dirección válida para realizar la conexión.

Esto permite seguir accediendo a Pablo Tablet en redes donde la resolución de `pablotablet.local` no funcione correctamente.

---

## 4. Editor móvil

El editor será una aplicación web local servida por la propia tablet.

Podrá utilizarse de dos formas:

1. Desde el navegador accediendo a `pablotablet.local`.
2. Instalándolo como PWA en la pantalla de inicio del móvil.

La PWA deberá comportarse de forma similar a una aplicación independiente.

No existirá una aplicación móvil nativa como requisito de la V1.

---

## 5. Red local

El móvil y la tablet deberán estar conectados a la **misma red local** para poder comunicarse.

No existirá acceso remoto desde Internet en la V1.

Por ejemplo:

- Tablet + móvil en Wi-Fi de casa → funciona.
- Wi-Fi funcionando pero sin Internet → funciona.
- Tablet sin Wi-Fi → panel funciona, editor móvil no disponible.
- Móvil utilizando 5G fuera de casa → no puede acceder a la tablet.

El funcionamiento del panel no dependerá de Internet.

---

## 6. Funcionamiento offline

Pablo Tablet deberá continuar funcionando aunque la tablet no tenga ninguna conexión Wi-Fi.

Seguirán disponibles las funcionalidades completamente locales, como:

- Calendario local.
- Listas.
- Tareas.
- Notas.
- Fotografías locales.
- Reloj.
- Temporizadores.
- Alarmas locales.
- Widgets.
- Configuración almacenada.
- Salvapantallas.

Las funcionalidades que necesiten servicios externos podrán quedar temporalmente indisponibles.

Ejemplos:

- Meteorología.
- Futuras integraciones con Google Calendar.
- Otros servicios externos que puedan añadirse.

---

## 7. Vinculación mediante QR

Los dispositivos móviles deberán autorizarse antes de poder administrar Pablo Tablet.

Desde la tablet se podrá acceder a una pantalla para vincular un dispositivo.

La tablet generará un **QR temporal**.

El QR contendrá la información necesaria para iniciar el proceso de vinculación y un token temporal.

### Caducidad

El QR caducará cuando ocurra primero cualquiera de estas situaciones:

- se utilice correctamente;
- se cierre la pantalla que lo muestra;
- transcurran 5 minutos desde su generación.

Una vez invalidado deberá generarse uno nuevo.

---

## 8. Proceso de autorización

El flujo será:

1. El usuario abre la opción de vinculación en la tablet.
2. La tablet genera un QR temporal.
3. El móvil escanea el QR.
4. Se abre el editor local en el móvil.
5. El móvil solicita autorización.
6. La tablet muestra un popup.
7. El usuario acepta o rechaza físicamente la solicitud desde la tablet.
8. Si se acepta, el móvil recibe una credencial permanente.
9. El dispositivo queda registrado como autorizado.

No será suficiente con tener acceso a la red Wi-Fi para administrar Pablo Tablet.

---

## 9. Solicitud de autorización

El popup mostrado en la tablet incluirá:

- Nombre del dispositivo.
- Tipo de dispositivo/navegador.
- Hora de la solicitud.
- Botón **Permitir**.
- Botón **Rechazar**.

La solicitud tendrá una duración máxima de:

**5 minutos**

Si nadie responde durante ese periodo, la solicitud caducará.

Será necesario iniciar nuevamente el proceso de vinculación.

---

## 10. Identificación de dispositivos

Durante la vinculación se generará automáticamente un nombre descriptivo para el dispositivo.

Por ejemplo:

`Chrome en Android`

El usuario podrá modificarlo antes de solicitar la autorización.

Ejemplo:

`Móvil Pablo`

Después de autorizarlo también podrá cambiarse el nombre desde la configuración de Pablo Tablet.

---

## 11. Autorización permanente

Una vez autorizado un dispositivo, permanecerá autorizado indefinidamente.

No será necesario:

- Escanear nuevamente el QR.
- Confirmarlo periódicamente.
- Introducir contraseñas.
- Introducir códigos.

La autorización permanecerá aunque:

- Se reinicie la tablet.
- Se apague la tablet.
- Cambie la Wi-Fi de la tablet.
- Cambie la IP local.

---

## 12. Gestión de dispositivos autorizados

Existirá una sección:

**Ajustes → Dispositivos autorizados**

Desde ella se podrá:

- Consultar los dispositivos autorizados.
- Ver información básica.
- Cambiar el nombre de un dispositivo.
- Revocar su autorización.

Al revocar un dispositivo, su credencial dejará de ser válida.

Para volver a utilizarlo será necesario realizar nuevamente:

**QR → solicitud → confirmación física en tablet**

No existirá un límite práctico de dispositivos autorizados.

---

## 13. Credenciales del navegador

La V1 utilizará HTTP dentro de la red local con un token largo, aleatorio, individual y revocable por dispositivo. Se acepta para esta versión doméstica el riesgo de intercepción asociado a HTTP en una LAN.

La autorización estará vinculada a la credencial almacenada por el navegador/PWA.

Si el usuario:

- Borra los datos del navegador.
- Borra el almacenamiento de la PWA.
- Utiliza otro navegador.
- Reinstala la PWA perdiendo sus datos.

será necesario volver a realizar el proceso de autorización.

No se intentará identificar automáticamente el dispositivo mediante fingerprinting u otros mecanismos similares.

---

## 14. Varios móviles simultáneamente

Pablo Tablet permitirá que varios dispositivos autorizados utilicen el editor al mismo tiempo.

No existirá un bloqueo de edición exclusivo.

Ejemplo:

- Móvil A añade un producto.
- Tablet recibe el cambio.
- Móvil B recibe el cambio.
- Los tres muestran el nuevo estado.

La sincronización deberá realizarse en tiempo real.

---

## 15. Sincronización

Los cambios realizados desde el móvil se reflejarán prácticamente de forma inmediata en:

- La tablet.
- Los demás móviles conectados.

También deberán propagarse las acciones realizadas directamente desde la tablet.

Ejemplo:

Si alguien marca una tarea como completada desde la tablet, los móviles conectados deberán recibir el nuevo estado.

No será necesario pulsar un botón general de **Guardar** para aplicar cambios normales.

---

## 16. Cambios silenciosos

La sincronización normal no mostrará notificaciones en la pantalla principal.

Ejemplo:

Si desde el móvil se añade:

`Leche`

la entrada aparecerá directamente en el widget correspondiente.

No aparecerán mensajes como:

`Lista actualizada`

salvo que en el futuro exista alguna acción que específicamente necesite feedback.

---

## 17. Conflictos de edición

Para la V1 se utilizará una estrategia:

**Last Write Wins**

Es decir:

> El último cambio válido recibido por la tablet será el que permanezca almacenado.

No se implementará inicialmente:

- Fusión automática de cambios.
- Historial colaborativo.
- Resolución manual de conflictos.
- CRDT.
- Edición colaborativa de texto avanzada.

Esta decisión podrá revisarse si aparecen casos reales donde sea necesario.

---

## 18. Pérdida de conexión del móvil

Si un móvil pierde la conexión con la tablet:

- Podrá mantener visible el último estado cargado.
- La edición quedará temporalmente bloqueada.
- No se almacenarán modificaciones offline en el móvil.

El editor indicará que no existe conexión con Pablo Tablet.

Cuando vuelva a estar disponible, intentará reconectarse automáticamente.

---

## 19. Reconexión automática

Si:

- Se reinicia la tablet.
- Se reinicia el servidor local.
- Se pierde temporalmente el Wi-Fi.
- Se interrumpe temporalmente la comunicación.

el editor móvil intentará reconectarse automáticamente.

Cuando consiga conexión:

1. Recuperará el estado actual desde la tablet.
2. Restablecerá la sincronización en tiempo real.
3. Permitirá nuevamente realizar modificaciones.

No será necesario cerrar o recargar manualmente el editor en condiciones normales.

---

## 20. Interacción desde la tablet

La tablet será principalmente un dispositivo de visualización.

Sin embargo, permitirá realizar **acciones rápidas** directamente sobre los widgets.

Ejemplos:

- Completar una tarea.
- Marcar un producto de una lista.
- Iniciar/detener un temporizador.
- Interactuar con determinados elementos del calendario.
- Pasar fotografías.
- Ejecutar acciones específicas de cada widget.

Las operaciones complejas se realizarán desde el editor móvil.

Ejemplos:

- Crear/configurar widgets.
- Reorganizar el dashboard.
- Cambiar configuraciones avanzadas.
- Administrar contenido de forma masiva.

No habrá PIN. Las acciones sensibles exigirán un mensaje de confirmación explícito. Si se solicitan desde un móvil autorizado, la confirmación se realizará en ese mismo móvil.

---

## 21. Cambio de red Wi-Fi

Cambiar la tablet a otra red Wi-Fi no eliminará los dispositivos autorizados.

La autorización pertenece a la instalación de Pablo Tablet, no a una determinada red.

Cuando un móvil autorizado vuelva a estar en la misma LAN que la tablet podrá conectarse nuevamente.

---

## 22. Arranque automático

Pablo Tablet deberá arrancar automáticamente cuando se inicie la Teclast T65.

El flujo esperado será aproximadamente:

`Encender tablet`
→ `Android inicia`
→ `Pablo Tablet arranca automáticamente`
→ `Se cargan los datos locales`
→ `Se inicia el servidor local`
→ `Se muestra el dashboard`

No deberá ser necesario abrir manualmente Pablo Tablet después de cada reinicio.

---

## 23. Persistencia tras reinicio

Después de reiniciar deberán conservarse:

- Datos.
- Widgets.
- Layout.
- Configuración.
- Fotografías.
- Dispositivos autorizados.
- Credenciales.
- Eventos.
- Tareas.
- Listas.
- Notas.
- Preferencias.

Un reinicio no deberá modificar el estado lógico del sistema.

---

## 24. Recuperación automática de Pablo Tablet

Si Pablo Tablet se cierra o falla inesperadamente, el sistema intentará recuperarla automáticamente.

El objetivo es que la tablet se comporte como un panel doméstico dedicado y no requiera intervención frecuente.

---

## 25. Recuperación del servidor local

Si el servidor local falla:

- El dashboard continuará funcionando utilizando los datos locales.
- Pablo Tablet intentará reiniciar automáticamente el servicio.
- Los móviles perderán temporalmente la conexión.
- Los móviles intentarán reconectarse.
- Una vez recuperado el servicio, la administración volverá a funcionar.

Un fallo del servidor de administración no deberá provocar que desaparezca el dashboard.

---

## 26. Modo inmersivo

Pablo Tablet funcionará en **modo inmersivo**.

El objetivo es ocultar al máximo los elementos visuales de Android:

- Barra de navegación.
- Barra de estado.
- Notificaciones.
- Elementos innecesarios del sistema.

La experiencia deberá transmitir que la tablet es un dispositivo dedicado a Pablo Tablet y no simplemente una página web abierta sobre Android.

No se utilizará inicialmente un bloqueo kiosco absoluto que impida completamente acceder al sistema.

---

## 27. Salir a Android

Existirá una opción:

**Ajustes → Salir al sistema**

Al pulsarla aparecerá una confirmación.

Ejemplo:

> ¿Quieres salir de Pablo Tablet?

Opciones:

- Cancelar
- Salir

Después de confirmar se abandonará el modo Pablo Tablet y se permitirá acceder normalmente a Android.

---

## 28. Dirección alternativa por IP

`pablotablet.local` será el método de acceso principal.

Sin embargo, Pablo Tablet mostrará también su dirección IP local.

Ejemplo:

`192.168.1.37:<puerto>`

Esto permitirá acceder al editor en redes donde el sistema de resolución de nombres locales no funcione correctamente.

El QR deberá poder utilizar una dirección válida automáticamente.

---

# Flujo general

## Uso habitual

`Teclast T65`
→ ejecuta Pablo Tablet
→ almacena datos localmente
→ ejecuta servidor local

`Móvil autorizado`
→ abre PWA / pablotablet.local
→ conecta con tablet
→ obtiene estado
→ modifica información
→ tablet persiste cambio
→ sincroniza con panel y otros móviles

---

## Vinculación de un móvil nuevo

`Tablet → Ajustes → Vincular dispositivo`

↓

`Generar QR temporal (uso/cierre/5 min)`

↓

`Escanear desde móvil`

↓

`Abrir editor`

↓

`Nombre automático editable`

↓

`Solicitar autorización`

↓

`Popup en tablet`

↓

`Permitir / Rechazar`

↓

`Guardar credencial`

↓

`Dispositivo autorizado permanentemente`

---

# Decisiones de implementación todavía abiertas

El comportamiento y la arquitectura base ya están decididos. Durante la implementación se concretarán:

- librería y configuración del servidor nativo Android;
- endpoints y contratos concretos de la API REST;
- mensajes, reconexión y latidos de WebSocket;
- esquema Room, migraciones e índices;
- formato y custodia interna de los tokens;
- puerto utilizado por el servidor;
- implementación de `pablotablet.local` mediante mDNS/NSD;
- Service Worker de la PWA;
- detalles del servicio Android, autoarranque y recuperación ante fallos.

Estas elecciones no cambian los requisitos funcionales vigentes.

---

# Resumen de requisitos clave

Pablo Tablet deberá cumplir estos principios:

1. **Local-first.**
2. **La tablet es el nodo central.**
3. **Sin servidores externos obligatorios.**
4. **El dashboard funciona sin Internet.**
5. **El dashboard funciona incluso sin Wi-Fi.**
6. **Administración desde móviles autorizados de la misma LAN.**
7. **Sincronización en tiempo real.**
8. **Varios móviles simultáneamente.**
9. **Autorización física mediante QR + confirmación en tablet.**
10. **Credenciales permanentes y revocables.**
11. **Recuperación automática ante fallos.**
12. **Arranque automático tras reinicio.**
13. **Android oculto mediante modo inmersivo.**
14. **La tablet prioriza visualización y acciones rápidas.**
15. **La administración completa se realiza desde el móvil.**
