# Revisión visual 01 — Cálido

Flujo vigente aclarado por Pablo el 11/11/2026: **revisar primero en web y no volver a instalar en tablet hasta que lo pida expresamente**. No repetir la suite de 255 pruebas. Revisar con Playwright horizontal/vertical y esperar su valoración antes del siguiente tema. El primero es Cálido, en el orden del selector existente. La instalación descrita al final es histórica: el agente se adelantó y Pablo corrigió esa interpretación.

## Estado

**Cálido aprobado en web por Pablo y actualizado en DEV con su autorización expresa. Pendiente de su prueba física.** Los otros nueve temas siguen pendientes de este recorrido. No se cierra #72 con el resultado del navegador.

## Entrega autorizada a tablet tras aprobación web

11/11/2026, alrededor de las 16:36 CET. Pablo confirma «lo veo todo perfecto en la web, vamos a llevarlo a la tablet». Se compila de nuevo el código aprobado y se instala mediante los comandos protegidos de DEV. Esta autorización corresponde a esta entrega; futuras instalaciones siguen requiriendo petición expresa.

- `npm run android:dev:build`: correcto, incluyendo TypeScript/build web, sincronización Capacitor y `:app:assembleDebug` (7 s). Se conservan los avisos conocidos de bundle grande y deprecaciones Gradle. No se repite la suite de 255 pruebas.
- `npm run android:dev:install -- --yes`: correcto en T65 `J014BACGDD00556800`, con reemplazo conservando datos. El instalador verifica que la estable mantiene versión `0.5.2` y fechas `2026-11-10 12:38:31` antes/después.
- Paquete `com.pablohorcajada.tablet.debug`, versión `0.5.2-dev`; SHA-256 `280161af569c99cdc075aae69050062054b590ac8c209483bbeabe107be52257`.
- Configuración nativa sin URL de live reload: usa los recursos compilados del APK. Se verifica apertura tras despertar la pantalla; Inicio aparece en Cálido con su configuración previa, notas y estilo digital en bloques.
- Evidencia local: `output/playwright/issue72-warm-approved-tablet/loaded.png` (1920 × 1200); logs `/tmp/pablo-72-warm-approved-build.log` y `/tmp/pablo-72-warm-approved-install.log`.

La comprobación de apertura no sustituye la revisión táctil, rotación y rendimiento del usuario. Se espera su valoración antes de pasar al siguiente tema.

### Comparación de tono tras la foto del monitor y la tablet

Pablo observa la T65 más blanca/fría que la web. Se comprueba sin cambiar código, filtros ni ajustes de pantalla:

- El CSS de `dist`, la copia sincronizada de Android y el archivo dentro de la APK son idénticos: `index-CRYt7LvM.css`, SHA-256 `2ec6efb88ef4d735e7917bc92fd8141623785af3ce457a881f81790be894fe4e`.
- Una captura directa de Inicio de la T65 y la captura de Inicio del navegador aislado contienen exactamente los mismos colores de fondo `#F3EDE3`, panel `#FFFCF5`, controles `#EEE4D6`, acción `#9B4228` y texto `#30281F`. Los tamaños, configuración y contenido difieren; se compara la paleta, no se afirma igualdad píxel a píxel de pantallas completas.
- Android informa Night Display no activado con matriz identidad, saturación global no activada y reducción de colores brillantes no activada. No hay balance de blancos disponible desde ese servicio. GNOME tiene luz nocturna desactivada; se consultan los perfiles de los monitores sin alterarlos.
- Evidencia local: `output/playwright/issue72-warm-color-parity/tablet-home.png` y `pixels.json`; referencia web `issue72-warm-polish-states/warm-es-landscape-dashboard.png`. La primera captura `tablet-direct.png` era del salvapantallas y se descartó para la comparación de Inicio.

Conclusión acotada: no hay una paleta distinta en la compilación Android ni en los colores base renderizados medidos. La foto apunta a diferencias de reproducción física, blanco, brillo/perfiles o condiciones de observación; no identifica por sí sola cuál predomina. Igualar la percepción entre pantallas requiere comparar sus ajustes/calibración, no corregir una divergencia de CSS inexistente. No se modifica la paleta aprobada ni la configuración del dispositivo.

## Correcciones posteriores al feedback de Pablo — solo web

- El asistente muestra «Escribe o dicta una petición» dentro del placeholder. Se elimina la etiqueta exterior y se conserva ese nombre accesible con `aria-label`, también en inglés.
- Se retira el panel Agenda del día. «+ Nuevo» pasa a la izquierda de Ocultar finalizados, conservando el editor y los eventos existentes.
- Se reproduce el fallo del clic real en un día: la captura inmediata del puntero en el contenedor redirigía el clic y no llegaba al botón. En botones que admiten swipe, la captura se difiere hasta que comienza un arrastre horizontal. El clic vuelve a abrir horas y el arrastre sigue cambiando de página. La expectativa del test de navegación se adapta a la captura diferida, sin ejecutar la suite.
- El botón Volver al mes existía pero conservaba texto casi blanco. Botones, cabeceras, horas, eventos y cuadrícula de la agenda horaria usan ahora roles legibles en Cálido. Se deja margen para que la sombra exterior siga el borde redondeado sin recortarse.
- La cabecera horaria se adapta en vertical y la agenda conserva un área de scroll con altura útil en ventanas pequeñas.

Playwright reproduce primero el fallo (`issue72-warm-feedback-before`, timeout al abrir horas). Después comprueba mes → horas → mes con ratón, toque y teclado; Nuevo abre el editor; arrastrar desde un día sigue navegando a Reloj. Comprueba además ausencia del panel retirado, posición de Nuevo y placeholder/nombre accesible.

Resultados finales: 26 capturas en ES/EN a 1280 × 800 / 800 × 1280 (`output/playwright/issue72-warm-feedback-final/`) y 13 capturas ES a 1024 × 640 / 600 × 960 (`issue72-warm-feedback-compact/`). Ambos informes `report.json` tienen cero errores y cero hallazgos del cálculo acotado de contraste del texto. Se revisaron las capturas de asistente, mes y horas con/sin eventos en ambas orientaciones. La prueba configura por separado idioma de la aplicación e idioma del asistente, sin cambiar las preferencias reales del usuario.

Build TypeScript/web y lint correctos; permanecen los avisos previos de bundle grande y refs. No se ejecuta Vitest, Capacitor, compilación ni instalación Android para estas correcciones. La APK instalada anteriormente no contiene este último feedback.

Tras fallar la conexión de Chrome, Pablo eligió expresamente «Playwright en navegador aislado». Se usó Playwright 1.65.0 con Chromium 149.0.7827.55 y Node 22, en perfiles desechables. Playwright está instalado en `/tmp`; no añade dependencias al proyecto ni al APK. Se visitó Vite y se seleccionó Cálido desde Ajustes.

## Recorrido completado

### Segundo feedback web: tiempo, esquinas y azules

- La curva de temperatura aprovecha la altura libre del panel; las tarjetas horarias dejan de estirarse y mantienen una altura compacta. En vertical hay 200 px para la gráfica; en horizontal se adapta al espacio disponible con un mínimo de 120 px. Las ventanas horizontales bajas permiten scroll para conservar todos los datos.
- Se señalan una mínima y una máxima del intervalo horario visible con valor y hora, sin confundirlas con el rango diario. Las etiquetas HTML y los puntos circulares conservan su tamaño al escalar el SVG. El nombre accesible incluye los extremos y ES/EN tiene traducciones. Una previsión constante usa una sola etiqueta mín./máx., evitando división por cero y superposición.
- El relieve de Cálido pasa de sombra exterior desplazada a sombra interior inferior. Sigue la curva del panel sin sobresalir de contenedores recortados; no modifica dimensiones ni posiciones. Se revisan Tiempo, Notas, Reloj, Calendario, Galería y las distintas secciones de Ajustes.
- Se usa azul informativo oscuro `#224690` para los iconos y controles que conservan ese significado. Se eliminan literales azules pálidos en estados vacíos de Notas/Galería/Calendario, menú de formatos, medidas de hora/minuto, botones de subir/bajar y probar sonido, presets y etiquetas de temporizadores/alarma. Los botones principales conservan el color de acción de Cálido. La selección de fotos también usa un contorno legible.

Evidencia del nuevo recorrido: `issue72-warm-polish-states` incluye las ocho páginas, menú de notas, editores de alarma/temporizador y scroll de todas las secciones de Ajustes (38 capturas). Ese recorrido detectó contrastes heredados de 1,06–2,50:1 en los editores; se corrigieron después y se repitieron los componentes afectados. `issue72-warm-empty-colors` conserva el antes de los vacíos, con contrastes de 1,10–2,24:1.

Resultados finales adicionales, dentro de `output/playwright/`, con `report.json` y PNG:

| Recorrido | Capturas | Comprobación |
| --- | --- | --- |
| `issue72-warm-clock-weather-final` | 18 | Reloj, editores y Tiempo, ES/EN, 1280 × 800 / 800 × 1280. |
| `issue72-warm-empty-verified` | 20 | Ocho pantallas vacías, ES, ambas orientaciones. |
| `issue72-warm-weather-large-final` | 2 | Tiempo a 1920 × 1200 / 1200 × 1920; gráfica grande y tarjetas compactas. |
| `issue72-warm-weather-negative` | 4 | Temperaturas negativas, EN, 1024 × 640 / 600 × 960 y extremos del scroll. |
| `issue72-warm-weather-flat` | 3 | Previsión constante negativa y etiqueta única mín./máx., ES, ambas orientaciones. |

Los cinco informes finales tienen cero errores, cero hallazgos del cálculo acotado de contraste textual y cero azules de poco contraste entre elementos visibles medidos. Se comprueban además extremos contra valores de las tarjetas, etiquetas contenidas y gráfica más alta que cada tarjeta horaria. Esto no equivale a una certificación de todos los píxeles/estados ni a pruebas físicas. Se inspeccionaron las capturas de gráfica, paneles, vacíos y editores.

Build TypeScript/web y lint correctos, con los avisos previos de bundle grande y refs. No se ejecuta la suite de 255 pruebas ni se sincroniza, compila o instala Android. Se espera la valoración de Pablo en web.

| Pantalla | Horizontal | Vertical | Revisar |
| --- | --- | --- | --- |
| Inicio | OK | OK | Hoy, colores de eventos y widgets; edición conserva posición, ancho y alto. |
| Asistente | OK | OK | Entrada, burbujas de conversación local, lectura y botones. |
| Calendario | OK | OK | Hoy, colores, próximos eventos, proveedores y editor con pie alcanzable. |
| Reloj | OK | OK | Hora/fecha, alarma larga, temporizador, cronómetro y cuatro estilos; estilos al final en vertical. |
| Tiempo | OK | OK | Previsión, scroll y error con última previsión guardada. |
| Notas | OK | OK | Nota larga, lista, dibujo y ampliación/reducción sin alterar trazos. |
| Galería | OK | OK | Medios cargados, miniaturas 4:3 y apertura/cierre del visor. |
| Ajustes | OK | OK | Selector, controles y final del scroll detrás del dock. |

Contenido ficticio en almacenamiento aislado: nota larga, lista, dibujo, alarma, temporizador, eventos con cuatro colores, tres fotos y previsión controlada. Fecha fija 11/11/2026, zona Europe/Madrid. No se toca el almacenamiento del navegador habitual. Las capturas del estudio SVG no cuentan como evidencia del producto.

## Correcciones de la revisión

- Etiquetas heredadas azul claro de calendario, tiempo y contador de fotos: usan texto secundario legible sobre papel claro. Los datos pequeños del widget meteorológico ganan tamaño y permiten salto de línea.
- Medidas de widgets en edición con texto blanco/azul sobre fondo claro: usan texto normal y secundario de Cálido.
- Iconos de eventos, notas fijadas y controles apagados pálidos: color legible y contorno definido. Se conservan los cuatro colores informativos y el resaltado de hoy.
- Formato de nota y títulos de Ajustes/Calendario: superficie y tipografía coherentes con Cálido.
- Aviso meteorológico de error con contraste calculado 1,38:1: adopta el color de error del tema sobre una superficie estable. Placeholders con color secundario y opacidad completa.
- Pocas fotos en vertical se estiraban hasta ocupar toda la altura: miniaturas 4:3 alineadas arriba, sin reescribir ni filtrar los medios.
- Falso positivo del verificador de geometría: un título oculto en el diseño compacto no tiene caja y no debe tratarse como texto que desborda.

Los ajustes de esta revisión se limitan a Cálido. No se presenta su resultado como aprobación del resto de temas.

## Evidencia y límites

| Recorrido final | Viewport CSS | Idiomas | Capturas |
| --- | --- | --- | --- |
| Ocho pantallas y estados de detalle | 1280 × 800 / 800 × 1280 | ES/EN | 88 |
| Inicio/edición, Reloj y Ajustes compactos | 1024 × 640 / 600 × 960 | ES | 11 |
| Galería tras su corrección específica | 1280 × 800 / 800 × 1280 | ES/EN | 4 |

Los tres informes finales tienen cero errores JavaScript, desbordamientos horizontales de página o textos críticos fuera de sus cajas, y cero hallazgos de contraste del texto medido. Se inspeccionaron capturas de las ocho pantallas y de estados relevantes en ambas orientaciones. La última corrección solo afecta a galería y se verificó de nuevo en ese componente.

Script reproducible: `scripts/visual-review-theme.mjs`, limitado al tema `warm` para no avanzar sin confirmación física. Variables: `PABLO_PLAYWRIGHT_MODULE` apunta a `/tmp/pablo-72-playwright/node_modules/playwright/index.mjs`; `PABLO_CHROMIUM` al Chromium local; `PABLO_VISUAL_LANGUAGES=es,en` y `PABLO_VISUAL_DETAILS=1` habilitan el recorrido completo; `PABLO_VISUAL_COMPACT=1` el compacto; `PABLO_VISUAL_PAGES=gallery` la repetición selectiva.

Informes con medidas/hashes y PNG locales, excluidos de Git:

- `output/playwright/issue72-warm-verified/`: 88 capturas y `report.json`.
- `output/playwright/issue72-warm-compact-verified/`: 11 capturas y `report.json`.
- `output/playwright/issue72-warm-gallery-verified/`: 4 capturas y `report.json` posteriores al cambio de miniaturas.
- Evidencia anterior a las correcciones: `issue72-warm`, `issue72-warm-final`, `issue72-warm-details` y `issue72-warm-compact` en el mismo directorio.

El cálculo de contraste revisa texto visible y placeholders sobre colores CSS compuestos (4,5:1; 3:1 para texto grande). No certifica WCAG completa, todos los estados de foco, iconos, gráficos, fotografías, teclado Android, gestos o fluidez física.

No se repitió la suite de 255 pruebas. Lint correcto con los cuatro avisos previos de refs de CalendarConnectionsPanel; `git diff --check` correcto.

## Tablet y siguiente tema

Compilación e instalación completadas el 11/11/2026 en T65 `J014BACGDD00556800` mediante `npm run android:dev:build` y `npm run android:dev:install -- --yes`. TypeScript/build web, sincronización Capacitor y `:app:assembleDebug` correctos. Persisten los avisos conocidos de bundle web grande y deprecaciones de Gradle.

- Paquete `com.pablohorcajada.tablet.debug`, versión `0.5.2-dev`, etiqueta Pablo Tablet DEV.
- SHA-256 de la APK verificada por el instalador: `6c148b10616db15b2f6e2d9f882954f8e9144a162d332137d5a91ec158ba102c`.
- Instalación con reemplazo conservando datos; la app estable `com.pablohorcajada.tablet` mantiene versión `0.5.2` y fechas de instalación/actualización `2026-11-10 12:38:31`, comprobadas antes/después por el instalador.
- DEV abre correctamente. Se seleccionó Cálido desde Ajustes y se dejó en Inicio. Se conservan los widgets y el estilo digital en bloques que había seleccionado Pablo.
- Capturas nativas de apertura, selector y resultado en `output/playwright/issue72-warm-gallery-verified/tablet-*.png`, a 1920 × 1200. Acreditan instalación y selección; no sustituyen la prueba física de Pablo.

Logs locales: `/tmp/pablo-72-warm-android.log` y `/tmp/pablo-72-warm-install.log`.

La aceptación de esta iteración corresponde primero a la revisión web de Pablo. El siguiente será AMOLED tras recibir su confirmación. Cualquier nueva instalación física requiere su petición expresa; no se integra, publica o cierra #72 automáticamente.
