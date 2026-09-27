# Pablo Tablet — Especificación funcional consolidada

> Estado: documento actualizado con el estado real del proyecto en el repositorio
> Actualizado: 27/09/2026
> Prevalencia: este documento y el README son la referencia funcional actual. Los archivos de `chats/` siguen siendo históricos; la arquitectura de tablet-móvil quedó documentada en el hilo consolidado y el README refleja el estado del código actual.

## 1. Alcance real del MVP

El MVP funcional que ya puede verse en este repositorio incluye:

- dashboard con widgets y páginas;
- notas con recordatorios y archivado;
- reloj, alarmas, temporizadores y cronómetro;
- calendario local con eventos y tareas;
- galería de fotos y salvapantallas;
- ajustes del dispositivo en la propia app;
- persistencia local para la experiencia actual.

La parte de administración desde móvil, sincronización local, QR, tokens y servidor nativo sigue siendo trabajo futuro y no forma parte de la versión actual del código.

## 2. Estado de implementación actual

### 2.1 Implementado en la app actual

- La app funciona como dashboard local en React y Android/Capacitor.
- Se soporta navegación principal, páginas de contenido y widgets con grid persistente.
- El sistema de notas ya permite edición, colores, fijado, archivado y restauración.
- Las alarmas y temporizadores tienen lógica local con activación y avisos.
- El calendario local ya gestiona eventos, repeticiones, tareas y recordatorios.
- La galería permite importación, papelera y visualización en salvapantallas.
- La interfaz incluye ajustes relevantes del dispositivo y del comportamiento del panel.
- Los datos se guardan en almacenamiento local del navegador para el prototipo.

### 2.2 Pendiente respecto al objetivo final

- servidor local Android con API REST y WebSocket;
- emparejamiento y autorización de dispositivos por QR;
- PWA de administración desde el móvil;
- almacenamiento definitivo con Room + SQLite;
- copia de seguridad y restauración automatizadas;
- sincronización local segura con tokens y revocación;
- integración real de meteorología y Google Calendar.

## 3. Arquitectura funcional vigente

- La Teclast T65 es el dispositivo central y la fuente de verdad local del panel.
- La interfaz utiliza React dentro de Capacitor.
- La entidad final del sistema será híbrida: app web + servicio nativo Android.
- La persistencia actual del prototipo es localStorage, no la solución final.
- La capa definitiva será Room sobre SQLite en la tablet.
- Los móviles autorizados se gestionarán en la red local, pero esta parte no está implementada aún.
- La API local y la sincronización en tiempo real quedan como objetivo de la siguiente fase.

## 4. Acceso, vinculación y seguridad

Los principios funcionales del producto siguen siendo estos:

- El acceso local se realizará mediante `pablotablet.local` y la IP local.
- Los móviles se vincularán desde la misma red local.
- La V1 utilizará una credencial local, individual y revocable.
- El emparejamiento requerirá QR temporal + confirmación física.
- La validación de seguridad y permisos de sesión queda pendiente de implementación.

No existe todavía un backend ni una autenticación real en este repositorio; la parte de seguridad es una decisión de diseño aún no materializada.

## 5. Datos, archivos y papelera

- El flujo local de galería ya contempla la papelera y la recuperación.
- El almacenamiento actual usa archivos locales del navegador y metadatos persistidos en la app.
- La solución definitiva será Room + almacenamiento privado de Android para fotos.
- Las decisiones sobre álbumes, deduplicación y trasciego de imágenes siguen planteadas para la siguiente etapa.

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

- La app incluye un widget y una vista de detalle con datos de demostración.
- La integración real con una API externa queda pendiente.
- La lógica de caché, ciudades, estados de error y desconexión no está implementada todavía.

## 9. Calendario

- El calendario local ya está funcional.
- Admite eventos, repeticiones, tareas, recordatorios y ocultado de completados.
- La integración con Google Calendar queda fuera del MVP actual.

## 10. Galería y salvapantallas

- La galería permite añadir fotos desde el sistema local.
- El salvapantallas activa una rotación aleatoria de imágenes tras inactividad.
- Varios aspectos ya están implementados en la app actual.
- El funcionamiento completo del almacenamiento privado, álbumes y sincronización aún queda para la fase siguiente.

## 11. Interfaz, temas y modo nocturno

- La app cuenta con un dashboard visual moderno, layouts adaptativos y navegación oculta según interacción.
- El modo nocturno/No molestar y la gestión de inactividad están previstos en la lógica de UI.
- La experiencia actual ya incluye controles del sistema relevantes, aunque la capa del modo nocturno completo sigue siendo de diseño previo.

## 12. Copias de seguridad y recuperación

- En la especificación funcional siguen siendo requeridas.
- En la implementación actual no existe aún un mecanismo real de backup ni restauración.
- Esta funcionalidad queda prevista como fase posterior del MVP.

## 13. Cambios y mejoras aplicados respecto a la primera documentación

Respecto a la primera versión de la documentación, el repositorio actual ya incluye:

- dashboard con widgets funcionales;
- calendario local implementado;
- galería con papelera y salvapantallas;
- recordatorios y temporizadores completos;
- ajustes del dispositivo y notificaciones locales;
- persistencia local y normalización del estado.

Esto implica que la documentación debe entenderse como un estado real del prototipo funcional, no como una hoja de ruta completamente vacía.

## 14. Fuera del MVP actual

- Google Calendar y sincronización cloud;
- reconocimiento facial;
- asistentes de IA;
- control por voz avanzado;
- perfiles personalizados del dashboard;
- edición libre de temas;
- sincronización multipanel entre varias tabletas;
- administración remota completa desde Internet.

## 15. Decisiones que no requieren definición funcional

El puerto local, las librerías concretas, la estructura de procesos, el formato de mensajes, el esquema interno de tokens y otros detalles de implementación se elegirán en la fase técnica. No alteran el comportamiento funcional acordado del editor ni de la tablet.
