# Pablo Tablet

Pablo Tablet es un panel doméstico local para una Teclast T65. La tablet actúa como nodo central del hogar y la interfaz de control principal. El proyecto combina una app web React con Capacitor + Android para ofrecer un dashboard minimalista, útil sin Internet, pensado para uso continuo en una sala, cocina o escritorio.

Este documento recoge el estado real del repositorio a 05/10/2026. La versión actual es `0.1.0` y solo cambiará por indicación expresa de Pablo. La base funcional y las decisiones de producto quedan en la [especificación funcional](ESPECIFICACION-FUNCIONAL.md). La operación fuera de la vivienda se resume en [OPERACION-REMOTA.md](OPERACION-REMOTA.md). El histórico de conversaciones y decisiones previas sigue en el [índice de chats](chats/INDICE-CHATS.md).

## Resumen ejecutivo

La versión actual del repositorio ya no es solo un mockup ni una base técnica parcial. El proyecto incluye una app funcional con:

- navegación por páginas y dashboard con widgets;
- notas con colores, recordatorios, archivado y restauración;
- alarmas, temporizadores, cronómetro y notificaciones locales;
- calendario local con eventos, tareas, repeticiones y recordatorios;
- meteorología real con Open‑Meteo, varias ubicaciones y una ubicación Casa;
- galería con importación de imágenes, selección múltiple por pulsación larga, papelera y salvapantallas;
- pantalla de ajustes con brillo, volumen, rotación, inactividad y modo salvapantallas;
- persistencia privada de la aplicación en SQLite, con migración automática de los datos anteriores de `localStorage`.
- primera versión funcional de la administración móvil local, con servidor Android, API autenticada, WebSocket, QR y editor web.
- comprobación y descarga segura de actualizaciones desde GitHub Releases, pendiente de preparar el canal firmado de producción.

La arquitectura final sigue planteada como híbrida y local, pero la parte ya implementada en este código es la capa funcional principal del prototipo realista del MVP.

## Estado real del proyecto

| Área                                           | Estado                    | Evidencia real en el repositorio                                                          |
| ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Base web                                       | Implementado              | React + TypeScript + Vite + Capacitor Android + build y lint configurados                 |
| Dashboard y navegación                         | Implementado              | páginas, rotación, widgets, navegación por gestos, indicadores y layout persistente       |
| Meteorología                                   | Implementado              | Open‑Meteo, previsión actual/horaria/diaria, ubicaciones guardadas, Casa y caché local     |
| Notas y recordatorios                          | Implementado              | crear, editar, colores, fijar, archivar, restaurar, eliminar y avisos simulados           |
| Alarmas y temporizadores                       | Implementado              | alarmas diarias, temporizadores con cuenta atrás, cronómetro y activación de avisos       |
| Notificaciones del sistema                     | Implementado parcialmente | integración con Local Notifications para alarmas, temporizadores y eventos del calendario |
| Calendario local                               | Implementado              | eventos, tareas, fechas, repeticiones, recordatorios y ocultado de tareas completadas     |
| Galería y salvapantallas                       | Implementado              | selección de fotos, papelera de 30 días, carrusel aleatorio y cierre táctil               |
| Ajustes del dispositivo                        | Implementado              | brillo, volumen, bloqueo de pantalla, rotación, inactividad, sonido de interacción        |
| Gestión desde móvil                            | Implementado parcialmente | editor web local para notas, calendario, reloj, tiempo, fotos y visibilidad del panel      |
| Persistencia local de la aplicación            | Implementado              | SQLite privado en Android, migración del estado anterior y fallback web para desarrollo   |
| Servidor local para el móvil                   | Implementado parcialmente | HTTP en LAN, API REST, WebSocket, tokens por dispositivo y archivos privados               |
| Actualizaciones remotas                        | Implementado parcialmente | consulta, descarga, SHA-256 e instalador; falta canal público y firma definitiva            |
| Comentarios y mejoras desde móvil              | Planificado               | especificación preparada; implementación prevista para la fase técnica 2                    |
| Copias y restauración                          | Pendiente                 | no está desarrollada en esta rama                                                         |
| Integración con Google Calendar / datos reales | Pendiente                 | queda fuera del MVP actual                                                                |

## Qué ya está implementado en este repositorio

### 1. Dashboard y widgets

- Cuadrícula adaptable de 3 columnas.
- Páginas de Inicio, Calendario, Reloj, Tiempo, Notas y Galería.
- Rotación automática configurable para páginas elegibles.
- Widgets de reloj, tiempo, notas y agenda con layout persistente.
- El widget meteorológico utiliza siempre la ubicación marcada como Casa.
- Normalización y recolocación segura para evitar solapamientos en el grid.
- Visualización diferenciada entre página principal y páginas fullscreen.

### Meteorología

- Búsqueda mundial de ciudades y códigos postales mediante la geocodificación de Open‑Meteo.
- Varias ubicaciones persistentes, selección independiente y una ubicación marcada como Casa.
- Tiempo actual, previsión horaria y previsión diaria de siete días.
- Actualización automática cada 30 minutos, actualización manual y caché de la última respuesta.
- Estados de carga, error, reintento y funcionamiento con la última previsión disponible sin conexión.

### 2. Notas

- Crear notas nuevas desde la UI.
- Editar título, contenido, color y prioridad visual.
- Fijar notas y archivarlas/restaurarlas.
- Recordatorios asociados con fecha/hora.
- Eliminación directa y estado persistido en almacenamiento local.

### 3. Alarmas y temporizadores

- Alarmas con hora y días de la semana.
- Activación/desactivación por alarma.
- Sonidos de alarma seleccionables por dispositivo.
- Múltiples temporizadores con duración y reinicio.
- Cronómetro con inicio/pausa/reset.
- Reproducción local/aviso visual con vibración en web.

### 4. Calendario local

- Eventos, tareas y cumpleaños.
- Fechas de inicio y fin, horario y evento de todo el día.
- Repeticiones diarias, semanales, mensuales y anuales.
- Recordatorios del calendario.
- Vista de agenda, ocultado de tareas completadas y gestión básica de eventos.

### 5. Galería y salvapantallas

- Importación de imágenes desde el sistema.
- Botón **Seleccionar** o pulsación larga sobre una foto para activar la selección múltiple, seleccionar todas y mover el conjunto completo a la papelera.
- La Papelera ofrece el mismo modo de selección múltiple para restaurar varias fotos o eliminarlas definitivamente, siempre con confirmación previa al borrado.
- Copia de cada imagen al almacenamiento privado de Pablo Tablet; la capacidad queda limitada por el espacio libre de la tablet, no por la base de datos.
- La base local guarda los metadatos y la ruta de cada archivo para que el futuro cliente móvil pueda consultarlos a través de la tablet.
- Mantenimiento de metadatos y vías de eliminación a papelera.
- Papelera recuperable con caducidad de 30 días.
- Salvapantallas con carrusel aleatorio de fotos.
- Detección de inactividad y cierre manual por toque.

### 6. Ajustes del dispositivo y experiencia del panel

- Brillo, volumen de alarma y multimedia.
- Modo de pantalla siempre activa.
- Timeout de pantalla configurable.
- Rotación habilitada/deshabilitada.
- Sonidos de interacción.
- Modo inmersivo y comportamiento de pantalla de inicio preparados para Android/Capacitor.

### 7. Administración móvil local

- Servidor HTTP embebido en Android en el puerto `8765`, iniciado junto con Pablo Tablet.
- API REST autenticada para leer y modificar el estado local y para subir/visualizar fotografías.
- WebSocket para avisar inmediatamente a los móviles cuando cambia el estado.
- Editor web responsive servido por la propia tablet, con manifiesto PWA y reconexión automática.
- Edición móvil de notas, calendario, alarmas, temporizadores, ciudades meteorológicas y visibilidad de páginas/widgets. El calendario móvil muestra duración y estado; los eventos finalizados quedan en modo consulta sin cambio de título. En Tiempo solo se escribe la ciudad; región, país y coordenadas se resuelven automáticamente con Open‑Meteo.
- Subida de fotografías al almacenamiento privado de la tablet; el borrado definitivo sigue reservado a la tablet.
- QR temporal de cinco minutos, solicitud desde el móvil y confirmación física Permitir/Rechazar en la tablet.
- Credencial larga e individual por dispositivo; en SQLite solo se conserva su hash permanente.
- Dispositivos autorizados consultables, renombrables y revocables desde Ajustes.
- Sincronización tablet-móvil por SQLite compartido, con estrategia Last Write Wins.

El contrato técnico y los pasos de validación están documentados en [ADMINISTRACION-MOVIL.md](ADMINISTRACION-MOVIL.md).

### 8. Actualizaciones remotas

- Sección **Ajustes → Sistema → Actualizaciones** con versión instalada y búsqueda manual.
- Consulta de un repositorio público separado que contendrá únicamente Releases y APK firmados.
- Descarga restringida al repositorio oficial y verificación SHA-256 antes de abrir el instalador.
- Validación adicional de identificador, `versionCode` y firma realizada por Android.
- Workflow de GitHub Actions preparado para lint, tests, build, firma y publicación.
- Pendiente crear el repositorio de distribución, la clave definitiva, los secretos y la primera instalación firmada.

El funcionamiento, la seguridad y la preparación operativa están en [ACTUALIZACIONES.md](ACTUALIZACIONES.md). La visión conjunta de administración, actualizaciones y feedback está en [OPERACION-REMOTA.md](OPERACION-REMOTA.md).

### 9. Comentarios y mejoras desde el móvil

Esta función está especificada pero no implementada en `0.1.0`. La fase técnica 2 añadirá un formulario móvil que creará GitHub Issues mediante un endpoint seguro y podrá generar archivos Markdown automáticamente. No se incluirán tokens de GitHub en el cliente. Véase [COMENTARIOS-Y-MEJORAS.md](COMENTARIOS-Y-MEJORAS.md).

## Qué queda pendiente

La administración móvil ya dispone de un recorrido funcional completo en código. Queda cerrar la parte operativa y de robustez en hardware real:

- validación extremo a extremo con la Teclast T65 y uno o varios móviles reales;
- convertir el servidor ligado al proceso de la app en un servicio Android recuperable ante cierre o fallo;
- verificar el registro mDNS/NSD y la resolución de `pablotablet.local` en los routers y móviles objetivo;
- comprobar la instalación como PWA en cada navegador; la V1 por HTTP local siempre permite usar el editor desde el navegador, pero el Service Worker exige un contexto seguro;
- ampliar la edición móvil de dibujos y del posicionamiento exacto del grid;
- copias de seguridad y restauración automática;
- integración con Google Calendar;
- pruebas reales en la Teclast T65.
- preparación y prueba extremo a extremo del canal firmado de actualizaciones;
- implementación y validación del formulario de comentarios y mejoras.

## Arquitectura actual y decisiones vigentes

- La app web es la capa funcional principal del MVP local.
- Capacitor permite empaquetar la experiencia en Android con acceso nativo.
- En Android, los datos estructurados persisten en `pablo_tablet.db`, una base SQLite privada de la aplicación.
- Al instalar esta versión por primera vez, el estado anterior de `localStorage` se migra automáticamente y se conserva como respaldo de transición.
- Las fotografías se almacenan como archivos privados dentro de la tablet; SQLite conserva sus metadatos y referencias, evitando límites artificiales por guardar imágenes como texto o BLOB.
- La versión web de desarrollo mantiene `localStorage` como fallback, ya que no dispone del plugin nativo Android.
- El servidor móvil comparte la misma base SQLite: la tablet sigue siendo la única fuente de verdad y los móviles no conservan una copia maestra.
- Las credenciales permanentes se identifican por hashes SHA-256 y pueden revocarse individualmente; el token temporal del QR caduca a los cinco minutos o al cerrar la pantalla.
- La lógica de widgets, notificaciones y estados ha sido normalizada para evitar corrupción o layouts inválidos.
- El diseño sigue orientado a uso local sin Internet y sin dependencia de la nube.
- Las actualizaciones usan Internet únicamente para consultar y descargar una Release pública; el código fuente permanece privado.
- Los comentarios futuros se enviarán mediante un endpoint con credenciales solo en servidor; nunca desde un token incluido en el cliente.

## Fases del MVP y estado real

| Fase                               | Alcance                               | Estado actual                                   |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------- |
| 0. Base técnica                    | Web + Android + configuración inicial | Completada en gran parte                        |
| 1. Dashboard y widgets             | Grid, páginas y widgets               | Completada funcionalmente                       |
| 2. Notas y recordatorios           | Notas, recordatorios, archivado       | Completada funcionalmente                       |
| 3. Reloj, alarmas y temporizadores | Alarmas, temporizadores, cronómetro   | Completada funcionalmente                       |
| 4. Meteorología                    | Datos reales y widget                 | Implementada con Open‑Meteo                     |
| 5. Calendario                      | Calendario local                      | Implementado localmente                         |
| 6. Galería y salvapantallas        | Galería + carrusel                    | Implementado                                    |
| 7. Administración móvil            | Servidor, QR, PWA móvil               | Primera versión funcional; falta validar en hardware |
| 8. Copias y recuperación           | Backup / restore                      | Pendiente                                       |
| 9. Seguridad y cierre              | Tokens, logs, recuperación            | Pendiente                                       |

Estas son áreas de trabajo del MVP y no representan el número de versión. El producto continúa en `0.1.0` hasta que Pablo indique otro número.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

La estrategia, los casos cubiertos y las limitaciones de las pruebas están documentados en [TESTS.md](TESTS.md). Para trabajar en modo interactivo puede usarse `npm run test:watch`; el informe HTML de cobertura se genera con `npm run test:coverage`.

## Android

```bash
npm run android:sync
npm run android:open
```

## Notas de validación

- La aplicación puede ejecutarse como web y compilar para Android con Capacitor.
- La parte más avanzada ya tiene flujo completo de alarmas, calendario, galería y pantalla principal.
- La administración móvil compila y tiene el flujo completo implementado, pero todavía no se ha ejercitado de extremo a extremo en la Teclast T65 con un móvil real.
- La suite automática cubre migraciones, repeticiones del calendario, layouts, temporizadores, meteorología, navegación, creación persistente de notas y selección múltiple de la galería mediante pulsación larga.

Los acuerdos funcionales largos de producto y la historia de diseño se conservan en el [índice de chats](chats/INDICE-CHATS.md). Este README es la referencia actual del estado real del repositorio.
