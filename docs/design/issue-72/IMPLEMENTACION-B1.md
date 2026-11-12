# #72 — Primera entrega B: Inicio

Fecha: 10/11/2026. Rama `feat/72-evolucion-visual`, base `02d1d7280de4c9ec3870bdc448c2ade2c05a1824`.

## Decisión y alcance

Después de ver A/B/C, Pablo respondió **«vamos con la b»**. Se ejecuta la primera entrega presentada: sistema visual aplicado a Inicio. Calendario, Notas, Ajustes y demás pantallas completas siguen conservando su diseño anterior; sus exploraciones B2/B3 no se implementan en esta entrega.

La compilación de prueba se instala solo en **Pablo Tablet DEV**, siguiendo la autorización previa de la conversación para preparar y tener las compilaciones de desarrollo en esa aplicación. La elección del diseño no se usa como autorización para fusionar ni publicar una release.

## Cambios

| Hallazgo | Implementación |
| --- | --- |
| EV72-01, capas interiores compitiendo con el contenido | Calendario sin fondo/borde de cada día vacío; separadores semanales y marca de hoy. Mes sin segunda superficie. Eventos y festivos conservan iconos, color y acceso al detalle; se retiran fondos/sombras decorativos. Notas conserva el color de la nota y el lienzo, sin otra caja alrededor de la vista previa. |
| EV72-02, jerarquía y letra pequeña | Roles locales de título, cuerpo, metadatos y leyenda. Títulos de 1–1.125rem, cuerpo .875–1rem según espacio y metadatos .875rem; leyendas .75rem. Se mantienen los resúmenes existentes en tamaños mínimos. Los datos de previsión conservan sus adaptaciones anteriores; no se rehace la meteorología. |
| EV72-03, fondo visible a través del texto | Superficies sólidas propias de cada tema. En Original: panel `#1c2c43`, texto secundario `#b8c5d9`, fondo estable y radio 20px. Cristal conserva transparencia; Brutalista conserva colores de módulos, contornos y formas. |
| EV72-08, evitar regresiones de geometría | Hoja `src/dashboardVisual.css` limitada a `.dashboard-page`; no modifica cuadrícula, layouts guardados, escalas, padding de edición ni reserva del dock. El marco de pulsación larga usa el mismo radio que la tarjeta. |
| Lectura de agenda con texto mayor | El bloque de próximos eventos/festivos permite scroll vertical y foco por teclado. Se protege con `data-swipe-block`: el scroll/una pulsación larga en ese bloque no navega ni activa edición; sus botones siguen abriendo el día correspondiente. |
| Colores y etiquetas al comprobar temas/EN | Los títulos secundarios de agenda, sus fechas y los segundos usan el color semántico del tema; en el calendario azul de Brutalista heredan el texto de su tarjeta. Los días de meses adyacentes conservan el color secundario sin reducir otra vez su opacidad. Las iniciales de los días usan el idioma activo: `L M X J V S D` / `M T W T F S S`. |

La nueva hoja se importa al final de los estilos existentes. Los aliases Original solo se redefinen dentro de Inicio, incluidos los equivalentes antiguos `--theme-*` que aún usan algunos componentes. Al salir de Inicio, los otros módulos y el dock siguen recibiendo los tokens originales. No se añaden dependencias ni se cambian contratos, defaults o datos.

## Comprobaciones automáticas

- `npm run lint`: correcto; cuatro avisos de refs ya existentes en `CalendarConnectionsPanel.tsx`.
- `npm test -- --maxWorkers=2 --reporter=dot`: **41 archivos, 242 pruebas correctas** en la ejecución final. Se añaden regresiones de foco, pulsación larga, navegación accidental y apertura de evento desde la agenda desplazable, y del idioma de los días. La primera suite pasó 241 pruebas; al ampliar a 242 se corrigió el aislamiento del fixture inglés clonando el estado completo, ya que el cargador sin datos devuelve el objeto por defecto compartido. Se verificó el archivo afectado y después la suite completa. JSDOM no mide layout ni scroll real.
- `npm run android:dev:build`: TypeScript, build web, sincronización Capacitor, APK debug y comprobación de identidad/versiones correctos. Se recompiló después de ajustar radios, iconos y recuadros detectados en la primera revisión física. Avisos conocidos de bundle >500 kB, flatDir y deprecaciones Gradle.
- `:app:lintDebug :app:testDebugUnitTest`: correcto; **43 pruebas nativas**, cero fallos, errores u omisiones. Android Lint: **0 errores, 29 avisos**. El primer intento offline no pudo resolver dependencias de comprobación ausentes de la caché; el segundo con acceso a los repositorios terminó correctamente.
- El instalador rechazó un intento mientras la recompilación aún no había terminado, por faltar el registro del APK verificado. No se instaló nada en ese intento; la posterior instalación se hizo tras finalizar correctamente el build y verificar su registro.
- `git diff --check`: correcto. Los cambios de producto son la importación de CSS, la nueva hoja y la accesibilidad/protección del bloque de agenda. `widgetLayout.ts`, persistencia, servicios Android, versiones y dependencias permanecen iguales.

## APK y dispositivo

- Paquete `com.pablohorcajada.tablet.debug`, nombre **Pablo Tablet DEV**, versión **0.5.2-dev**.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- SHA-256 final: `11db1fa21a06d54a1127b6916bb5443d9561e22897756e0eb6c09f232a5cd8c0`.
- Instalación protegida con `android:dev:install -- --yes`: correcta, `Success`.
- Teclast T65, serial `J014BACGDD00556800`.
- El instalador comprobó que la app estable `com.pablohorcajada.tablet` **0.5.2** conserva `firstInstallTime` y `lastUpdateTime` de `2026-11-10 12:38:31`. Sin desinstalar, limpiar datos ni publicar.

## Revisión visual y límites

La conexión del navegador permite descubrir Chrome, pero falla al navegar e inspeccionar con el error de `timeoutMs`. No se declara completada la matriz web por esa vía. Se continúa con la comprobación directa de DEV en la Teclast mediante ADB y capturas; no se usa otra automatización para controlar Chrome.

Evidencias locales, excluidas de Git, en `output/playwright/issue72-b1/`. La referencia anterior `before-home.png` corresponde a los mismos widgets guardados y datos que se revisan después. La nota de dibujo ya tenía **tres trazos antes de actualizar**; no se modifica su contenido para las pruebas.

Las capturas negras iniciales corresponden a pantalla en reposo/despertando y no sirven como evidencia visual. Se conservan separadas; no se cuentan como pruebas superadas.

### Comprobaciones directas realizadas

| Caso | Evidencia y resultado |
| --- | --- |
| Original, horizontal, mismos widgets | `before-home.png` frente a `final-awake.png`: mismas cuatro posiciones/tamaños guardados, texto más legible y retirada de capas interiores; configuración sin reinicializar. La hora avanza entre capturas. |
| Entrada/salida de edición | `final-edit.png`: mismos bordes que en reposo, tiradores interiores, tamaño visible y fondo continuo. Se sale con Listo sin mover ni redimensionar nada. |
| Ajustes | `settings-original.png`: conserva sus tarjetas, selectores y fondo anterior, con contenido que continúa detrás del dock; no adopta B2/B3. |
| Cálido, Cristal y Brutalista en horizontal | `home-warm.png`, `home-glass.png`, `home-brutalist.png`: geometría conservada e identidad de los temas mantenida. Esta primera ronda detectó colores secundarios fijos con poco contraste, corregidos después en el APK final. No equivale a medir todos los contrastes. |
| Original, vertical | `home-portrait.png`, 1200 × 1920: cuadrícula 3 × 4, calendario grande y widgets inferiores usando los layouts guardados para esa orientación, con acceso al dock. |
| Rotación segura | La revisión automática rechazó el primer comando porque cambiaba la rotación sin restaurarla dentro de esa misma operación; no se ejecutó. La alternativa aceptada leyó los valores 1/1, hizo una captura vertical de dos segundos y restauró ambos en `finally`. La lectura final confirmó `accelerometer_rotation=1` y `user_rotation=1`. |
| Inglés horizontal | `home-en.png`: se revisaron títulos, estado vacío, festivos y texto de tiempo; esa ronda reveló las iniciales españolas de los días y se corrigieron en el APK final. Idioma restaurado a español. |

Las capturas de las rondas intermedias se distinguen de las del APK final; no se atribuye su cobertura a cada ajuste posterior. Falta la confirmación manual de Pablo. La matriz completa de los diez temas, ES/EN, tamaños mínimos/máximos, texto ampliado, estados de datos y fluidez se mantiene en [README.md](README.md). No se considera cerrada #72 por esta primera entrega.

### Revisión del APK final

- `final-installed.png`: Original horizontal en inglés, con los días ya traducidos y colores secundarios semánticos.
- `final-warm.png`: Cálido horizontal en español, con texto de agenda, fechas y segundos legibles sobre el panel claro.
- `final-brutalist.png`: Brutalista horizontal en español, con texto blanco de agenda sobre azul y segundos oscuros sobre verde; mantiene colores, bordes y sombras propios.
- `final-home-es.png`: Original horizontal en español, fuera de edición, con las tres notas y el dibujo original conservados.
- `final-portrait.png`: Original vertical en español sobre el mismo APK final, incluida la fecha del reloj con el nuevo tamaño. Rotación 1/1 restaurada y comprobada dentro de la misma operación.
- DEV queda en Inicio, español y tema Original. Las pruebas no movieron ni redimensionaron widgets ni escribieron contenido en las notas. No se ha creado commit/PR, fusionado ni publicado una versión.
