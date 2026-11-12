# #72 — Evaluación de la evolución visual

Los SVG de los bocetos y `appearances-data.js` son archivos generados y no se incluyen en Git. Antes de abrir las comparativas HTML, regenerarlos desde la raíz del repositorio:

```bash
python3 docs/design/issue-72/render_proposals.py
python3 docs/design/issue-72/render_calendar_options.py
python3 docs/design/issue-72/render_appearances.py
```

No se requieren para ejecutar o compilar la aplicación. Se conservan generadores, comparadores y documentación; capturas de pruebas y compilaciones también están excluidas de Git. La copia local anterior a esta limpieza queda en `output/issue72/archivo-propuestas/`, fuera de Git.

Inicio de evaluación: 10/11/2026. **Dirección B elegida por Pablo. Inicio y Reloj tienen su visto bueno en web a 11/11/2026; la aceptación física completa sigue pendiente.**

Estado de código, comprobaciones e instalación DEV: [IMPLEMENTACION-B1.md](IMPLEMENTACION-B1.md). Las alternativas de este documento conservan el registro de la evaluación previa.

Tras generar los bocetos, abrir [comparativa.html](comparativa.html) en el navegador para alternar las tres direcciones, horizontal/vertical y las exploraciones de pantallas de B. Los SVG generados se pueden abrir directamente sin servidor ni conexión. El [sistema visual](DESIGN.md) concreta la dirección recomendada.

Las comprobaciones de estos artefactos y sus límites están en [VALIDACION.md](VALIDACION.md).

Tras revisar B, Pablo pidió conservar un resaltado fuerte de hoy y colores para eventos con letra menor. Eligió la primera de las [tres variantes de calendario](CALENDARIO-VARIANTES.md). El incremento del widget de Inicio se registra en [CALENDARIO-VARIANTE-1.md](CALENDARIO-VARIANTE-1.md), con revisión física parcial en DEV (Cristal, ES, horizontal), pendiente de su valoración y de la matriz restante; no extiende el rediseño a la pantalla completa de Calendario.

El 11/11/2026 pidió además [estilos analógicos y digitales para el widget de reloj](RELOJ-ESTILOS.md), elegibles desde Reloj. Esta ampliación está implementada con cuatro opciones y una preferencia compatible con estados anteriores. Las revisiones empiezan en web; cualquier nueva instalación en tablet requiere su petición expresa, conforme a su aclaración más reciente.

Tras dar su visto bueno a la vista vertical de Reloj, Pablo autorizó preparar **diez diseños con personalidad**, manteniendo las restricciones de #72. Están disponibles en la [comparativa de apariencias](apariencias.html), con ocho vistas, horizontal/vertical, ES/EN y muestra de edición de Inicio. El [alcance del estudio](APARIENCIAS.md) distingue estos bocetos de la implementación; la [validación](APARIENCIAS-VALIDACION.md) registra su evidencia y límites. Las láminas se conservan como referencia del alcance aprobado.

Posteriormente aprobó los diez conceptos y autorizó implementarlos para revisar errores en web. La [primera implementación de las apariencias](IMPLEMENTACION-APARIENCIAS.md) ya aplica el sistema a los componentes reales y conserva los diez IDs y preferencias existentes. Se revisan uno a uno con Playwright y valoración web de Pablo antes del siguiente; no se instala en tablet automáticamente. La [revisión 01 de Cálido](REVISION-TEMA-01-CALIDO.md) registra capturas reales, correcciones del último feedback y la instalación anterior a su aclaración. No se autoriza integración o publicación.

## Base y condiciones de inicio

12/11/2026: [revisión rápida en web de los ocho temas restantes y entrega a DEV](REVISION-TEMAS-03-10.md), por petición de Pablo. Tras su «todo ok» y autorización expresa, se instala la última DEV con todos los ajustes. Arranque comprobado; pendiente su valoración física.

Revisión posterior autorizada: [AMOLED — vistazo rápido en web](REVISION-TEMA-02-AMOLED.md). Recorrido de las ocho pantallas en ambas orientaciones, una corrección de miniaturas y pendiente de valoración del usuario; no instalado en tablet.

- Rama de evaluación: `feat/72-evolucion-visual`, creada desde `origin/dev` en `02d1d7280de4c9ec3870bdc448c2ade2c05a1824` (merge de [PR #100](https://github.com/Pablo-hg/Pablo-Tablet/pull/100), nivel 2).
- La rama encontrada inicialmente, `feat/82-evaluar-ejecutar-evo-visual`, estaba en `df6398c`, anterior a ese merge. Se conserva; no es la base de esta evaluación.
- [#25](https://github.com/Pablo-hg/Pablo-Tablet/issues/25), [#30](https://github.com/Pablo-hg/Pablo-Tablet/issues/30) y [#33](https://github.com/Pablo-hg/Pablo-Tablet/issues/33) figuran **cerradas** y con etiqueta `instalado` al consultar GitHub. Es su estado declarado de cierre. Sus descripciones mantienen casillas físicas sin marcar y los comentarios históricos consultados describen pruebas entonces pendientes; no se presenta ese historial como una nueva acreditación de toda la matriz física.
- [#51](https://github.com/Pablo-hg/Pablo-Tablet/issues/51) y [#71](https://github.com/Pablo-hg/Pablo-Tablet/issues/71) siguen abiertas, con etiqueta `implementado`. #71 sí está integrada en dev. El informe local recoge la confirmación «todo ok» de Pablo para sus últimas cuatro correcciones; no acredita automáticamente todos los temas/orientaciones.
- Se revisaron [el informe parcial de #51](../../ISSUE-51-REVISION-PRELIMINAR.md) y [los incrementos de #71](../../ISSUE-71-INTERACCION-TACTIL.md). No se contabilizan como nuevos problemas los solapamientos y cortes ya corregidos.
- Antes de implementar se requiere elegir dirección y aprobar el alcance, según la [condición expresa de #72](https://github.com/Pablo-hg/Pablo-Tablet/issues/72). Pablo vio las tres propuestas y respondió «vamos con la b»; se inicia B1, limitada a Inicio, conforme al primer paso presentado en la conversación.

## Método y límites de la evidencia

1. Revisión del código actual de `src/App.css`, `src/themes.css`, `src/widgetLayout.ts`, `PageHeader`, `NotesWidget`, `SettingsPage`, `AssistantPage` y las pantallas contenidas en `App.tsx`.
2. Inspección de capturas reales de la DEV de #71, Teclast T65, horizontal, tema Original, 1920 × 1200. Son antecedentes locales, no nuevas capturas de #72: `output/playwright/issue71-third/{home-normal,home-edit,settings,drawing-normal,drawing-expanded,drawing-restored}.png` y `output/playwright/issue71-feedback/{calendar,weather,after-notes,settings-left}.png`. Están excluidas de Git; no se copian datos de notas a los bocetos.
3. Bocetos vectoriales independientes con contenido ficticio. **No son capturas del después ni pruebas de rendimiento, tacto, contraste global o responsive de la app.** Comparan una dirección visual, no sustituyen el inventario de controles de cada pantalla.
4. La comparación A/B/C mantiene el mismo contenido, destinos y geometría por orientación. Horizontal: calendario 2 × 3, reloj 2 × 1, notas 1 × 2 y tiempo 1 × 2. Vertical: los mismos tamaños en una cuadrícula 3 × 4, con posiciones ilustrativas propias de esa orientación. No propone aplicar esas posiciones a las configuraciones guardadas del usuario.
5. Las exploraciones de Calendario, Notas y Ajustes de B son esquemas de su zona visible, no especificaciones completas de todas las herramientas, scroll, diálogos o estados. Ningún control ausente de un boceto queda autorizado para eliminarse. En particular se conservan filtros, navegación temporal, todos los proveedores, tipos de nota y herramientas de dibujo existentes.
6. Las dos referencias de X devolvieron HTTP 403 al intentar consultarlas. No se atribuyen patrones ni resultados a contenido inaccesible. Las Skills mencionadas en la issue no están disponibles en el catálogo de esta sesión: no se han instalado ni se declara haberlas ejecutado. La revisión utiliza el código, las pruebas y las referencias oficiales citadas en DESIGN.md.

## Auditoría: beneficios concretos que justifican evaluar cambios

Las observaciones distinguen lo visible de las hipótesis que necesitan prueba con usuarios. No se ha medido tiempo de localización ni carga de GPU en esta fase.

| ID | Observación y evidencia | Beneficio a contrastar | Propuesta / alcance |
| --- | --- | --- | --- |
| EV72-01 | En Inicio, la tarjeta de Calendario, su panel interno, cada día, los festivos y la vista previa de Notas tienen superficies/bordes propios. Visible en `home-normal.png`; estilos `.widget-card`, detalles del widget y `.notes-widget-preview`. | Que el día seleccionado, los eventos y el contenido de la nota se distingan antes que sus contenedores. | A reduce adornos; B/C retiran capas interiores decorativas. Se mantiene el área de activación completa de cada día y cada acción. |
| EV72-02 | Tamaños distintos para título, descripción y cuerpo según módulo: `.widget-title` .95rem, `.widget-subtitle` .76rem; en Notas `.notes-widget-open small` .65rem y cuerpo .72rem, con variantes compactas. Esto describe CSS, no una medida física en dp. | Leer metadatos sin depender de letra muy pequeña; conservar la prioridad del contenido principal. | Escala semántica y adaptación por tamaño real del widget; no reducir toda la tarjeta con `transform: scale`. |
| EV72-03 | Inicio y Calendario muestran la trama/fondo a través de superficies translúcidas. `.widget-card` usa el desenfoque del tema; Original define 22px. Visible en `home-normal.png` y `calendar.png`. | Fondo más estable para texto y menos competencia visual. | B usa superficies más opacas para lectura. Conservar identidad de Cristal y medir antes de afirmar mejoras de rendimiento. |
| EV72-04 | Ajustes repite Personalización/Idioma/Idioma y separa en grandes bloques el idioma y la apariencia. `SettingsPage` y `settings.png` muestran esa jerarquía. | Reconocer la sección y el control sin varios niveles tipográficos del mismo peso. | Unificar encabezados y filas. Mantener orden, controles y scroll completo detrás del dock; no introducir categorías nuevas ni otro árbol de navegación. |
| EV72-05 | Calendario muestra un título de página, etiqueta de agenda, mes, agenda del día y otros paneles de aspecto similar. Visible en `calendar.png`. | Distinguir mes, selección y acción de crear; reducir el peso de etiquetas decorativas y vacíos. | Jerarquía de tres niveles y vacíos breves. Mantener eventos, tareas, repeticiones, proveedores y rutas actuales. |
| EV72-06 | Notas/dibujo contiene colores de nota, acciones de nota, herramientas del lienzo, recordatorio y estado local. `drawing-normal.png` y `App.tsx`. | Reconocer qué controles afectan a la nota y cuáles al trazo, y localizar la salida del modo ampliado. | Dos grupos visuales claros; conservar el mismo lienzo montado, Ampliar/Reducir y Listo/Escape de #71. No cambiar herramientas ni formato de trazos. |
| EV72-07 | El dock admite estilos, posiciones y etiquetas configurables. El modo compacto observado usa iconos; esto no demuestra por sí solo un problema de navegación. | Valorar si los nombres ayudan a reconocer destinos sin restar espacio al contenido. | A/B mantienen la preferencia actual. C explora nombres persistentes: mayor coste de validación. No es necesario cambiar navegación para resolver EV72-01/02. |
| EV72-08 | Edición ya mantiene geometría, tiradores interiores y fondo continuo después de #71. Confirmado por Pablo y capturas normal/edición. | Preservar una interacción ya validada al cambiar superficies. | Restricción de todas las alternativas: cero cambios de dimensiones al entrar en edición, sin reintroducir escala, padding condicional ni divisoria delante del dock. |

### Pantallas restantes

| Pantalla | Evaluación | Decisión propuesta |
| --- | --- | --- |
| Reloj | El dato horario requiere máxima prioridad; alarmas, temporizadores y cronómetro deben conservar sus estados y acciones. Revisión de código; no nueva prueba física aquí. | Aplicar roles tipográficos/superficies después de validar Inicio. Conservar dígitos tabulares, segundos y temporizadores activos. No reorganizar herramientas. |
| Tiempo | Hay correcciones responsive de #51 y variantes por tamaño. La captura actual revisada está sin ubicación; no demuestra el caso con previsión. | Mantener disposición y scroll existentes. Revisar con caché/datos/sin ubicación/sin red antes de cambiar densidad. No proponer otro rediseño meteorológico independiente. |
| Asistente | Ya hay grupos de conversación, estado, confirmación de acciones y entrada. Fuente: `AssistantPage.tsx`. | Unificar color, jerarquía y botones; conservar lectura/dictado, estado real y confirmación. Ningún cambio de proveedor ni de ejecución. Requiere revisión renderizada posterior. |
| Galería | Selección, medios, papelera y salvapantallas tienen propósitos distintos; no hay evidencia actual suficiente para reorganizarlos. | Solo sistema compartido aprobado, sin recortar ni recolorear fotografías. Revisar selección y vacíos con contenido de prueba antes de cambios propios. |

No hay evidencia para cambiar la cuadrícula, el orden de páginas, la estructura de módulos, los datos o la lógica de negocio.

## Alternativas comparables

| Dirección | Cambio | Ventajas | Riesgo principal | Estimación orientativa |
| --- | --- | --- | --- | --- |
| **A — Continuidad pulida** | Conserva fondo y capas actuales; normaliza títulos, separaciones y estados. | Mayor familiaridad; adopción gradual. | Las superficies siguen compitiendo; beneficio más limitado en información densa. | 3–5 jornadas. |
| **B — Lectura clara (recomendada)** | Superficies estables, menos contenedores interiores y escala de lectura común. Mantiene navegación y estructura. | Aborda EV72-01 a 06 sin necesitar una nueva navegación. | Requiere adaptar bien cada tema y los widgets pequeños. | 5–8 jornadas. |
| **C — Jerarquía editorial** | Bordes más definidos, titulares más fuertes y nombres persistentes en el dock. | Mayor explicitud de los destinos. | Densidad y etiquetas largas; revisión de todas las variantes del paginador y riesgo sobre geometría validada. | 7–11 jornadas. |

Estimaciones de ingeniería para el alcance visual global, incluyendo regresiones y una ronda de ajustes. No son mediciones, compromisos de calendario ni tiempos de generación de un modelo. No incluyen esperas de aprobación/instalación. No se justifican tipografías descargables, nuevas librerías, navegación lateral nueva ni animaciones continuas.

## Alcance concreto propuesto para aprobación: B por entregas

Se puede aprobar **solo B1** y reevaluar el resto después de probarlo. Cada entrega requerirá su propia evidencia antes/después y PR hacia dev, con referencias EV72.

| Entrega | Alcance | Mantener | Criterio de revisión |
| --- | --- | --- | --- |
| **B1 — Sistema visual + Inicio** | Documentar/introducir roles de texto y espaciado, adaptar superficies a los temas, limpiar capas decorativas de los widgets y alinear encabezados/metadatos. EV72-01/02/03/08. | Cuadrícula 4 × 3 horizontal / 3 × 4 vertical, posiciones y tamaños persistidos, datos, rutas, variantes del dock, tiradores y gestos #71. | Localizar hoy, hora, contenido de nota y estado de tiempo sin pérdida de contenido o controles. Misma caja de cada widget antes/durante/después de edición. |
| **B2 — Calendario y Notas** | Aplicar jerarquía y estados compartidos a ambas pantallas; separar visualmente grupos de herramientas. EV72-05/06. PR independiente por pantalla. | Funciones, filtros, selección, scroll, proveedores, recordatorios, trazos, salida de teclado y ampliación. | Recorrer flujos existentes y textos largos, teclado y dibujo ampliado con evidencia comparable. |
| **B3 — Ajustes y resto** | Primero Ajustes con encabezados/filas coherentes; después Reloj, Tiempo, Asistente y Galería solo donde se confirme beneficio. PR por pantalla o grupo acotado de componentes. | Scroll de Ajustes hasta el borde, gestos desde zonas libres, preferencias y acciones, arranque sin red. | Sin recortes de controles ni cambios de comportamiento; revisar datos y estados reales antes de tocar geometría. |

La elección inicial de B permitió ejecutar B1 y reservó B2/B3 para una revisión posterior. Tras probar Inicio/Reloj, Pablo aprobó los diez conceptos de apariencia y su implementación iterativa: el sistema visual ya se aplica a los componentes de las ocho pantallas. La revisión propia de sus flujos y estados continúa pendiente; no se autoriza una reorganización funcional. Si aparece un cambio de contrato de datos, de cuadrícula o una necesidad de otra navegación, se detiene ese cambio y se plantea fuera de este alcance.

Si se aprueba solo B1, la aplicación de los roles visuales se limita a Inicio: las definiciones compartidas se añaden de forma compatible o se aplican con ámbito del dashboard. No cambiar tokens globales de modo que se rediseñen indirectamente las otras pantallas. Estimación orientativa de B1: 2–3 jornadas de trabajo, más la disponibilidad para la prueba física.

## Configuración persistida y migración

- El alcance propuesto usa los mismos IDs, layouts por orientación, idioma, tema y preferencias del dock. No necesita una migración de SQLite/localStorage ni reinicializar preferencias.
- No cambiar defaults, normalización o `readWidgets` para conseguir el aspecto del boceto. Los layouts del boceto son ejemplos válidos, no un nuevo layout que se escriba en los dispositivos.
- Al implementar, comprobar arranque con una configuración existente, editar, reiniciar y volver a la versión anterior manteniendo el mismo contrato. Usar datos de prueba aislados; no modificar notas o fotos del usuario para obtener capturas.

## Plan de validación después de aprobar

| Eje | Cobertura requerida | Evidencia |
| --- | --- | --- |
| Temas e idioma | Diez temas × ES/EN × horizontal/vertical = 40 combinaciones básicas por pantalla afectada. Incluir textos largos, estado seleccionado y desactivado. | Capturas identificadas por SHA, tema, idioma, tamaño y estado; contrastes del fondo renderizado, no solo tokens aislados. |
| Viewports | 1920 × 1200 y 1200 × 1920 físicos; registrar además viewport CSS, DPR y área segura. Web: 1280 × 800, 800 × 1280 y 600 × 960. Texto ampliado al 200%. | No equiparar píxel físico con CSS px o dp. Ausencia de solapamiento y acceso a controles finales. |
| Widgets | 1 × 1, 1 × 2, 2 × 1, 2 × 2 y máximo permitido por orientación; estados vacío/con datos/error. | Mismos tamaños y posiciones persistidos; scroll interno accesible; información crítica alcanzable. No eliminar filas. |
| Interacción | Navegación en ambos sentidos, scroll vertical, calendario, controles, dos dedos, pulsación larga, cancelación, arrastre, tamaño y cambio de orientación. | Reutilizar regresiones de #71 y probar tacto real; cancelar no guarda cambios. |
| Notas y overlays | Texto largo, Listo/Escape, teclado abierto/cerrado, lista extensa, dibujo Ampliar/Reducir, diálogos y foco. | Conservación del mismo lienzo y datos; salida visible y ninguna navegación accidental. |
| Accesibilidad | Foco visible, nombre/rol/estado, contraste, tamaño táctil, lector y movimiento reducido. | Medición por control y prueba manual; no declarar conformidad por inspección del mockup. |
| Funcionamiento | Offline, caché, guardado, errores, permisos y temporizadores activos durante navegación. | Sin cambios de comportamiento ni pérdida de datos; suite existente y pruebas nuevas de riesgos concretos. |
| Rendimiento | Misma tablet, datos y ajustes; recorrer/rotar/editar y grabar tiempos de frames antes/después. | Comparar tirones y latencia perceptible; no afirmar ganancia por quitar un blur sin medir. |
| Checks | Lint, tests web, build web, sincronización Capacitor y Android pertinentes para cada entrega. | Resultados y advertencias registrados por SHA; instalación DEV solo cuando se autorice. |

En Teclast, pedir a Pablo localizar la fecha seleccionada y próximo evento, leer una nota, reconocer un vacío/error, entrar/salir de edición y cambiar de página. Registrar dificultad, pulsaciones accidentales y fluidez; el aspecto preferido por sí solo no acredita la mejora UX.

## Estado de esta entrega

- [x] Revisar dependencias, integración de #71 e informes de #51/#71.
- [x] Auditar jerarquía con alcance y límites de evidencia explícitos.
- [x] Preparar tres alternativas comparables y documentar el sistema visual propuesto.
- [x] Preparar alcance por entregas y matriz de validación.
- [x] Dirección B elegida expresamente por Pablo e inicio de la primera entrega B1.
- [x] B1 implementada localmente, con checks web y Android correctos y compilación DEV instalada para revisión.
- [ ] Implementación y validaciones de producto por PR.
- [ ] Comparativa real antes/después y confirmación física de la versión resultante.
- [ ] Integración/publicación con su autorización independiente.

Esta documentación no cierra #72 ni sustituye las comprobaciones pendientes de #51/#71.
