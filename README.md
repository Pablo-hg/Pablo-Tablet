# Pablo Tablet

Pablo Tablet es un panel doméstico local para una Teclast T65. La tablet actúa como nodo central del hogar y la interfaz de control principal. El proyecto combina una app web React con Capacitor + Android para ofrecer un dashboard minimalista, útil sin Internet, pensado para uso continuo en una sala, cocina o escritorio.

Este documento recoge el estado real del repositorio a 27/09/2026. La base funcional y las decisiones de producto quedan en la [especificación funcional](ESPECIFICACION-FUNCIONAL.md). El histórico de conversaciones y decisiones previas sigue en el [índice de chats](chats/INDICE-CHATS.md).

## Resumen ejecutivo

La versión actual del repositorio ya no es solo un mockup ni una base técnica parcial. El proyecto incluye una app funcional con:

- navegación por páginas y dashboard con widgets;
- notas con colores, recordatorios, archivado y restauración;
- alarmas, temporizadores, cronómetro y notificaciones locales;
- calendario local con eventos, tareas, repeticiones y recordatorios;
- galería con importación de imágenes, papelera y salvapantallas;
- pantalla de ajustes con brillo, volumen, rotación, inactividad y modo salvapantallas;
- persistencia en localStorage con recuperación de layouts y datos.

La arquitectura final sigue planteada como híbrida y local, pero la parte ya implementada en este código es la capa funcional principal del prototipo realista del MVP.

## Estado real del proyecto

| Área                                           | Estado                    | Evidencia real en el repositorio                                                          |
| ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Base web                                       | Implementado              | React + TypeScript + Vite + Capacitor Android + build y lint configurados                 |
| Dashboard y navegación                         | Implementado              | páginas, rotación, widgets, navegación por gestos, indicadores y layout persistente       |
| Notas y recordatorios                          | Implementado              | crear, editar, colores, fijar, archivar, restaurar, eliminar y avisos simulados           |
| Alarmas y temporizadores                       | Implementado              | alarmas diarias, temporizadores con cuenta atrás, cronómetro y activación de avisos       |
| Notificaciones del sistema                     | Implementado parcialmente | integración con Local Notifications para alarmas, temporizadores y eventos del calendario |
| Calendario local                               | Implementado              | eventos, tareas, fechas, repeticiones, recordatorios y ocultado de tareas completadas     |
| Galería y salvapantallas                       | Implementado              | selección de fotos, papelera de 30 días, carrusel aleatorio y cierre táctil               |
| Ajustes del dispositivo                        | Implementado              | brillo, volumen, bloqueo de pantalla, rotación, inactividad, sonido de interacción        |
| Gestión desde móvil                            | Pendiente                 | aún no hay servidor, QR, credenciales ni PWA de administración                            |
| Persistencia definitiva                        | Pendiente                 | localStorage es funcional para prototipo, pero no es la base final definitiva             |
| Servidor local / Room / SQLite                 | Pendiente                 | la arquitectura está diseñada, pero no está implementada todavía                          |
| Copias y restauración                          | Pendiente                 | no está desarrollada en esta rama                                                         |
| Integración con Google Calendar / datos reales | Pendiente                 | queda fuera del MVP actual                                                                |

## Qué ya está implementado en este repositorio

### 1. Dashboard y widgets

- Cuadrícula adaptable de 3 columnas.
- Páginas de Inicio, Calendario, Reloj, Tiempo, Notas y Galería.
- Rotación automática configurable para páginas elegibles.
- Widgets de reloj, tiempo, notas y agenda con layout persistente.
- Normalización y recolocación segura para evitar solapamientos en el grid.
- Visualización diferenciada entre página principal y páginas fullscreen.

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

## Qué queda pendiente

La parte funcional ya hecha es sólida como prototipo local, pero aún queda la capa de infraestructura y la funcionalidad de administración móvil:

- servidor local nativo Android;
- API REST + WebSocket para sincronización local;
- emparejamiento por QR y confirmación física;
- tokens y credenciales revocables por dispositivo;
- PWA de administración desde móvil;
- detección de red local y resolución de nombres `pablotablet.local`;
- persistencia definitiva con Room + SQLite;
- copias de seguridad y restauración automática;
- integración real con meteorología y Google Calendar;
- pruebas reales en la Teclast T65.

## Arquitectura actual y decisiones vigentes

- La app web es la capa funcional principal del MVP local.
- Capacitor permite empaquetar la experiencia en Android con acceso nativo.
- Los datos persisten en localStorage como base del prototipo funcional.
- La lógica de widgets, notificaciones y estados ha sido normalizada para evitar corrupción o layouts inválidos.
- El diseño sigue orientado a uso local sin Internet y sin dependencia de la nube.

## Fases del MVP y estado real

| Fase                               | Alcance                               | Estado actual                                   |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------- |
| 0. Base técnica                    | Web + Android + configuración inicial | Completada en gran parte                        |
| 1. Dashboard y widgets             | Grid, páginas y widgets               | Completada funcionalmente                       |
| 2. Notas y recordatorios           | Notas, recordatorios, archivado       | Completada funcionalmente                       |
| 3. Reloj, alarmas y temporizadores | Alarmas, temporizadores, cronómetro   | Completada funcionalmente                       |
| 4. Meteorología                    | Datos reales y widget                 | En prototipo visual, pendiente integración real |
| 5. Calendario                      | Calendario local                      | Implementado localmente                         |
| 6. Galería y salvapantallas        | Galería + carrusel                    | Implementado                                    |
| 7. Administración móvil            | Servidor, QR, PWA móvil               | Pendiente                                       |
| 8. Copias y recuperación           | Backup / restore                      | Pendiente                                       |
| 9. Seguridad y cierre              | Tokens, logs, recuperación            | Pendiente                                       |

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Android

```bash
npm run android:sync
npm run android:open
```

## Notas de validación

- La aplicación puede ejecutarse como web y compilar para Android con Capacitor.
- La parte más avanzada ya tiene flujo completo de alarmas, calendario, galería y pantalla principal.
- La parte que aún requiere trabajo real es la capa de sincronización y la persistencia final.

Los acuerdos funcionales largos de producto y la historia de diseño se conservan en el [índice de chats](chats/INDICE-CHATS.md). Este README es la referencia actual del estado real del repositorio.
