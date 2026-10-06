# Pablo Tablet — Especificación funcional consolidada

> Estado: documento actualizado con el estado real del proyecto en el repositorio
> Actualizado: 05/10/2026
> Versión actual: `0.2.0`; solo cambia por indicación expresa de Pablo.
> Prevalencia: este documento y el README son la referencia funcional actual. La operación remota se detalla en `OPERACION-REMOTA.md`; los archivos de `chats/` siguen siendo históricos.

## 1. Alcance real del MVP

El MVP funcional que ya puede verse en este repositorio incluye:

- dashboard con widgets y páginas;
- notas con recordatorios y archivado;
- reloj, alarmas, temporizadores y cronómetro;
- calendario local con eventos y tareas;
- galería de fotos y salvapantallas;
- ajustes del dispositivo en la propia app;
- persistencia local para la experiencia actual;
- administración desde un móvil de la misma red local mediante un editor web autenticado.
- comprobación y descarga verificada de actualizaciones publicadas por el desarrollador.

La primera versión de administración móvil ya forma parte del código. Incluye servidor local, API REST, WebSocket, QR temporal, confirmación física, credenciales revocables y editor web. Su validación completa en la Teclast T65 y la recuperación del servidor como servicio Android independiente siguen pendientes.

## 2. Estado de implementación actual

### 2.1 Implementado en la app actual

- La app funciona como dashboard local en React y Android/Capacitor.
- Se soporta navegación principal, páginas de contenido y widgets con grid persistente.
- El sistema de notas ya permite edición, colores, fijado, archivado y restauración.
- Las alarmas y temporizadores tienen lógica local con activación y avisos.
- El calendario local ya gestiona eventos, repeticiones, tareas y recordatorios.
- La galería permite importación, papelera y visualización en salvapantallas.
- La interfaz incluye ajustes relevantes del dispositivo y del comportamiento del panel.
- En Android, los datos estructurados se guardan en una base SQLite privada de Pablo Tablet.
- La versión web de desarrollo utiliza `localStorage` como fallback y los datos Android anteriores se migran automáticamente a SQLite.
- La tablet sirve un editor móvil local que puede modificar notas, calendario, reloj, tiempo, fotos y visibilidad del panel.
- La vinculación exige un QR temporal y confirmación física en la tablet; cada móvil recibe una credencial individual revocable.
- Los cambios se propagan mediante WebSocket y la tablet vuelve a leer el estado compartido desde SQLite.
- La tablet puede consultar Releases, comparar versiones, descargar un APK, verificar su SHA-256 y abrir el instalador de Android.
- El formulario móvil crea GitHub Issues de forma segura mediante un Worker de Cloudflare y muestra los estados Enviado, Visto, En desarrollo e Implementado.

### 2.2 Pendiente respecto al objetivo final

- copia de seguridad y restauración automatizadas;
- integración con Google Calendar;
- validación real de mDNS, emparejamiento, reconexión, varios móviles y subida de fotografías;
- servicio Android con autoarranque y recuperación independiente del proceso visible;
- edición móvil avanzada de dibujos y distribución exacta del grid.
- preparación operativa de la firma definitiva y del repositorio público de APK;

## 3. Arquitectura funcional vigente

- La Teclast T65 es el dispositivo central y la fuente de verdad local del panel.
- La interfaz utiliza React dentro de Capacitor.
- La solución es híbrida: app web + servidor nativo Android embebido.
- La tablet es la fuente de verdad y guarda su estado estructurado en `pablo_tablet.db`, dentro del espacio privado de la aplicación.
- No existe ni se necesita una base de datos externa para el funcionamiento doméstico.
- Los móviles autorizados se gestionan en la red local mediante una API autenticada y un editor web servido por la tablet.
- El servidor usa REST para leer/escribir y WebSocket para comunicar cambios; la estrategia de conflicto de la V1 es Last Write Wins.
- El código fuente es público y los APK de actualización se distribuirán desde un repositorio público separado; las claves y tokens permanecen siempre fuera de ambos repositorios.

## 4. Acceso, vinculación y seguridad

Los principios funcionales del producto siguen siendo estos:

- El acceso local utiliza la IP que muestra la tablet. El servidor se anuncia mediante NSD/mDNS y queda pendiente validar `pablotablet.local` en hardware y redes reales.
- Los móviles se vincularán desde la misma red local.
- La V1 utilizará una credencial local, individual y revocable.
- El emparejamiento requerirá QR temporal + confirmación física.
- Los tokens permanentes se generan aleatoriamente, son individuales y revocables, y su forma persistente es un hash SHA-256.

La V1 utiliza HTTP dentro de la LAN, tal como estaba acordado. Esto evita depender de certificados locales, pero mantiene el riesgo de intercepción propio de una red doméstica no confiable; HTTPS sigue siendo una mejora posterior.

Las actualizaciones y el futuro envío de comentarios utilizan Internet. Ninguna credencial de escritura de GitHub puede guardarse en la tablet o el móvil; los comentarios deberán pasar por un endpoint HTTPS con permisos mínimos en servidor.

## 5. Datos, archivos y papelera

- El flujo local de galería ya contempla la papelera y la recuperación.
- Las fotografías se copian al almacenamiento privado de Pablo Tablet y pueden borrarse desde la propia tablet.
- La base SQLite almacena los metadatos y las rutas de los archivos, no el contenido binario de las imágenes.
- El usuario podrá subir tantas fotografías como permita el almacenamiento libre del dispositivo.
- El cliente móvil sube y visualiza las fotografías a través del servidor local de la tablet; no conserva una copia maestra externa.
- Las decisiones sobre álbumes, deduplicación y transferencia por red siguen planteadas para la siguiente etapa.

## 6. Notas y recordatorios

- Las notas admiten contenido editable, colores, fijado y estado archivado.
- Se gestionan recordatorios asociados a la nota.
- La experiencia actual ya deja una base funcional para la siguiente evolución del sistema.
- La versión de producto final aún exigirá más refinamiento en formato, tachado, completado y flujo de avisos.

## 7. Alarmas y temporizadores

- Las alarmas pueden configurarse por hora y días de la semana.
- Los temporizadores cuentan con duración, reinicio y finalización.
- El prototipo ya soporta avisos visuales y sonoros locales.
- Las mejoras previstas incluyen posponer, modo nocturno/No molestar más estricto y validación nativa completa.

## 8. Meteorología

- La app integra Open‑Meteo para datos actuales y previsiones horarias y diarias.
- Permite varias ubicaciones, una ubicación Casa, actualización periódica y caché local.
- Incluye estados de carga, error, reintento y uso de la última previsión disponible sin conexión.

## 9. Calendario

- El calendario local ya está funcional.
- Admite eventos, repeticiones, tareas, recordatorios y ocultado de completados.
- La integración con Google Calendar queda fuera del MVP actual.

## 10. Galería y salvapantallas

- La galería permite añadir fotos y las copia al directorio privado de la aplicación.
- El salvapantallas activa una rotación aleatoria de imágenes tras inactividad.
- La papelera permite restaurarlas y las elimina físicamente tras 30 días o al borrarlas definitivamente desde la tablet.
- La carga y visualización desde otro dispositivo ya están implementadas; la eliminación física continúa realizándose desde la tablet.

## 11. Interfaz, temas y modo nocturno

- La app cuenta con un dashboard visual moderno, layouts adaptativos y navegación oculta según interacción.
- El modo nocturno/No molestar y la gestión de inactividad están previstos en la lógica de UI.
- La experiencia actual ya incluye controles del sistema relevantes, aunque la capa del modo nocturno completo sigue siendo de diseño previo.

## 12. Operación remota y actualizaciones

- La versión actual es `0.2.0` y su cambio requiere confirmación expresa de Pablo.
- La interfaz de actualización y el plugin Android están implementados y validados con una compilación debug.
- El canal de producción requiere repositorio público de Releases, clave definitiva, secretos y una primera instalación firmada.
- Android solicitará confirmación física para instalar mientras la tablet no sea un dispositivo administrado.
- La administración móvil existente funciona únicamente dentro de la misma Wi‑Fi.
- El formulario, la cola local y el relay HTTPS de comentarios están implementados; la creación real quedó validada con el Issue #1.
- El estado completo y los flujos se mantienen en [OPERACION-REMOTA.md](OPERACION-REMOTA.md), [CONFIGURACION-REMOTA.md](CONFIGURACION-REMOTA.md), [ACTUALIZACIONES.md](ACTUALIZACIONES.md), [ADMINISTRACION-MOVIL.md](ADMINISTRACION-MOVIL.md) y [COMENTARIOS-Y-MEJORAS.md](COMENTARIOS-Y-MEJORAS.md).

## 13. Copias de seguridad y recuperación

- En la especificación funcional siguen siendo requeridas.
- En la implementación actual no existe aún un mecanismo real de backup ni restauración.
- Esta funcionalidad queda prevista como fase posterior del MVP.

## 14. Cambios y mejoras aplicados respecto a la primera documentación

Respecto a la primera versión de la documentación, el repositorio actual ya incluye:

- dashboard con widgets funcionales;
- calendario local implementado;
- galería con papelera y salvapantallas;
- recordatorios y temporizadores completos;
- ajustes del dispositivo y notificaciones locales;
- persistencia local y normalización del estado.

Esto implica que la documentación debe entenderse como un estado real del prototipo funcional, no como una hoja de ruta completamente vacía.

## 15. Fuera del MVP actual

- Google Calendar y sincronización cloud;
- reconocimiento facial;
- asistentes de IA;
- control por voz avanzado;
- perfiles personalizados del dashboard;
- edición libre de temas;
- sincronización multipanel entre varias tabletas;
- administración remota completa desde Internet.

## 16. Decisiones que no requieren definición funcional

El puerto local, las librerías concretas, la estructura de procesos, el formato de mensajes, el esquema interno de tokens y otros detalles de implementación se elegirán en la fase técnica. No alteran el comportamiento funcional acordado del editor ni de la tablet.
