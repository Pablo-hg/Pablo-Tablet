# Issue #71 — Primer incremento de interacción táctil

Fecha: 10/11/2026. Base: `df6398c504b0a02ef51e8d84eb37fa373812f50d`.

## Alcance y estado

Primer incremento implementado localmente en la rama existente `Feature/71-mejorar-ux`. Al iniciar, el árbol estaba limpio y su HEAD coincidía con la referencia local `origin/dev`. Posteriormente se compiló e instaló la variante DEV en la Teclast para las pruebas solicitadas por Pablo, como se detalla abajo. No se ha creado un commit ni un PR, fusionado o publicado una versión.

Las dependencias #25, #30 y #33 se consultaron en GitHub: estaban cerradas con etiqueta `instalado`. #51 sigue abierta; su revisión preliminar local es parcial. Este trabajo continúa sus líneas de revisión de áreas táctiles, controles, estados y scroll, con nuevos problemas reproducidos específicamente para #71. No representa una auditoría completa de #51.

La cuadrícula existente se mantiene: 4 × 3 en horizontal y 3 × 4 en vertical. La discrepancia documental señalada en #51 queda fuera de este incremento.

## Problemas reproducidos y cambios

| ID | Prioridad | Antes | Después | Evidencia |
| --- | --- | --- | --- | --- |
| UX71-01 | Media | `pointercancel` ejecutaba el guardado de posición y tamaño. Perder la captura dejaba previsualizaciones activas. | Solo `pointerup` confirma; cancelar o perder captura descarta la previsualización. | Pruebas de cancelación y de guardado normal en `App.interactions.test.tsx`. |
| UX71-02 | Media | El gesto de navegación solo comparaba inicio y final; podía navegar después de empezar un scroll vertical, con varios dedos o con otro identificador de contacto. | El desplazamiento vertical cancela la navegación del gesto; se conserva el identificador del contacto y se rechaza la interacción con varios dedos. | Escenarios de scroll, segundo dedo e identificador diferente. |
| UX71-03 | Media | El editor de texto de notas admitía navegación por deslizamiento, desenfocaba el campo y abandonaba la página. | Los campos de edición conservan su interacción nativa; el deslizamiento no cambia de página. | El editor permanece visible y con foco después del gesto. El teclado real sigue pendiente. |
| UX71-04 | Media | Los botones de la barra del mes compartían la excepción que permite deslizar desde los días del calendario. | Solo los días mantienen esa excepción. Se conserva la navegación desde días y zonas libres. | Prueba conjunta de protección de «Mes anterior» y navegación desde un día; regresiones existentes del calendario. |
| UX71-05 | Media | Los gestos en curso conservaban coordenadas al cambiar las dimensiones o perder el foco de la ventana. | Cambio de dimensiones, pérdida de foco u ocultación cancelan gestos y previsualizaciones. El botón secundario y los punteros secundarios no inician navegación. | Pruebas de `resize`, `blur`, botón secundario y recorrido normal con ratón. La ocultación y la rotación física están pendientes. |
| UX71-06 | Media | Los tiradores medían 25 × 54 o 54 × 25 px según CSS. «Listo» carecía de altura táctil mínima; el aviso de edición carecía de ancho máximo. | Tiradores de 44 × 54 o 54 × 44 px, «Listo» de al menos 44 px y aviso ajustable al ancho disponible. Navegación de al menos 44 px cuando ambos ejes alcanzan 600 px; controles de icono y reordenación de notas de al menos 44 px. | Comparación de reglas CSS; medición renderizada, posibles solapamientos y prueba táctil pendientes. No se afirma cobertura universal de todos los controles. |
| UX71-07 | Media | Los widgets oscilaban y los tiradores pulsaban continuamente en edición. Toggles y otras animaciones no tenían una política transversal de movimiento reducido; el asistente desplazaba siempre con suavidad. | Señal estática de edición y una única animación durante la pulsación larga. La preferencia de movimiento reducido desactiva animaciones/transiciones y el asistente desplaza sin animación. | Revisión de CSS y prueba del comportamiento de scroll del asistente. Comprobación visual pendiente. |
| UX71-08 | Baja | Los nombres y etiquetas accesibles de edición de widgets estaban fijados en español. Faltaba respuesta de pulsación compartida y foco explícito para distintos controles. | Etiquetas ES/EN, respuesta de pulsación mediante brillo y foco visible con el color de acción del tema. | Prueba de los controles en inglés y revisión de CSS. Contraste y percepción táctil pendientes. |

La pulsación larga sigue durando un segundo y se cancela al desplazar más de 14 px. Las zonas internas protegidas de scroll/edición no inician la pulsación larga del widget. Al pulsar «Listo» se limpia también la protección de activación que quedara pendiente.

No se han añadido dependencias. Las Skills citadas en la issue no se han instalado ni se declara haberlas ejecutado; se han aplicado comprobaciones de código y regresiones disponibles en este proyecto.

## Evidencia funcional antes/después

La misma versión de los primeros 16 escenarios nuevos se ejecutó contra una copia temporal del código de la base indicada: **13 fallaron y 3 pasaron**. El resumen por escenario está en [qa/issue-71-baseline.json](qa/issue-71-baseline.json). Las tres comprobaciones que ya pasaban preservan el recorrido con ratón, el guardado normal de widgets y la cancelación de la pulsación larga al mover el dedo.

La suite actual añade dos escenarios de cancelación de navegación por `blur`/`resize` y una prueba de movimiento reducido del asistente. Resultado final web: **41 archivos y 232 pruebas correctas**, incluidas las 19 pruebas nuevas. Las pruebas de geometría de widgets usan un tablero simulado de 800 × 600; JSDOM no mide la interfaz renderizada ni reproduce gestos físicos de Android.

Esta es evidencia funcional y de código, no una comparativa de capturas. La conexión del navegador permitía descubrir pestañas, pero fallaba al navegar, inspeccionar el DOM o interactuar. No se ha conseguido completar la revisión visual con el navegador conectado.

## Validación ejecutada

- `npm run lint`: correcto; cuatro avisos previos de acceso a refs en `CalendarConnectionsPanel.tsx`. Sin avisos nuevos en los archivos modificados.
- `npm test -- --maxWorkers=2 --reporter=dot`: 41 archivos, 232 pruebas correctas. La ejecución inicial sin límite de procesos agotó el tiempo de arranque de workers; con dos procesos se completó. Se corrigió además el aislamiento del doble de `matchMedia` en la nueva prueba del asistente.
- `npm run android:sync`: compilación TypeScript/web y sincronización de Capacitor correctas con Node 22.13.0. Persiste el aviso de bundle superior a 500 kB.
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew --offline --no-daemon :app:testDebugUnitTest :app:assembleDebug`: pruebas nativas y APK debug correctos tras la sincronización final; 43 pruebas Android sin fallos ni omisiones.
- `git diff --check`: correcto.

## Revisión pendiente antes de integrar y cerrar

1. Capturar el antes/después del editor, controles y estados, con el mismo estado y resolución. Revisar que la ampliación de áreas táctiles no tape contenido ni controles vecinos.
2. Comprobar dashboard, calendario mensual/diario, notas, asistente flotante/página, Ajustes y diálogos, con scroll y gestos de inicio en controles, zonas libres y contenido interno. Revisar también la reordenación de listas de notas.
3. Revisar los diez temas y ES/EN en 1280 × 800, 800 × 1280, 1920 × 1200, 1200 × 1920 y 600 × 960; añadir tamaños compactos para detectar límites. Incluir widgets mínimos, textos extensos, vacíos, errores, teclado y overlays.
4. Revisar carga, guardado y error de los módulos para seleccionar mejoras adicionales justificadas; este incremento no cubre aún ese inventario completo.
5. Verificar movimiento reducido activado/desactivado, foco de teclado, contraste, estados desactivados y continuidad de alarmas/avisos.
6. Preparar commits o PRs acotados hacia `dev`, con referencias a los IDs UX71. Agrupación prevista: seguridad de gestos y cancelación; controles táctiles y etiquetas; movimiento y respuesta visual. Asociar los identificadores reales al crear esas entregas.
7. Con la compilación DEV instalada, comprobar en Teclast T65 el uso con dedos, cancelación del sistema, rotación, tamaños de widget, persistencia tras reinicio, ausencia de toques accidentales y fluidez percibida.

## Instalación DEV para las pruebas de Pablo

El 10/11/2026, tras solicitar Pablo tener la compilación en Pablo Tablet DEV:

- `npm run android:dev:build`: correcto. El automatizador sincronizó recursos, compiló y verificó identidad y versión del APK, y generó su registro de compilación.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, paquete `com.pablohorcajada.tablet.debug`, nombre **Pablo Tablet DEV**, versión **0.5.2-dev**.
- SHA-256: `e0d29069948af6912f34d26df5c649dc65e4a9fa0b528c7e9ea580a8c5913a6b`.
- `npm run android:dev:install -- --yes`: correcto en la Teclast T65 conectada; resultado ADB `Success`. Se actualizó DEV con `adb install -r`, sin desinstalar ni borrar sus datos.
- El instalador comprobó que el paquete estable `com.pablohorcajada.tablet`, versión `0.5.2`, conservaba los mismos datos de instalación y actualización antes y después. No se publicó una Release.

La instalación está confirmada; la comprobación de gestos, aspecto y fluidez por Pablo sigue pendiente. #71 permanece abierta y no se ha marcado como validada en hardware ni como `instalado` en GitHub. La fusión y publicación siguen pendientes de su proceso habitual.

## Segundo incremento — Correcciones tras la prueba de Pablo

Fecha: 10/11/2026. Pablo confirmó el comportamiento de cancelación de widgets, calendario, rechazo de gestos con varios dedos y animaciones, y comunicó cuatro ajustes pendientes con capturas. Se corrigieron en la misma rama:

| ID | Problema comunicado | Corrección | Comprobación en DEV |
| --- | --- | --- | --- |
| UX71-09 | El tirador inferior tapaba el tamaño del widget. | Indicador elevado a 38 px del borde y limitado al ancho libre entre controles. Durante la edición se reservan 24 px inferiores para que los tiradores no queden recortados ni invadan el dock. | [Widget de Tiempo en edición](../output/playwright/issue71-feedback/widget-final.png): tamaño y tirador inferior completos y separados. |
| UX71-10 | No se podía deslizar desde las tarjetas de Ajustes. | Se permite navegar desde sus zonas libres; botones, selectores, rangos, diálogos y QR mantienen protección propia. | [Deslizar a la derecha](../output/playwright/issue71-feedback/settings-right.png) abre Galería; [deslizar a la izquierda](../output/playwright/issue71-feedback/settings-left.png) abre Inicio. |
| UX71-11 | La vista ampliada de notas ocultaba la navegación mientras el campo conservaba el foco, sin una salida visible. | Botón «Listo»/«Done», con etiqueta accesible «Terminar edición»/«Finish editing», que desenfoca el campo y recupera la vista normal. Escape ofrece la misma salida. El botón permanece disponible al alcanzarlo con el teclado. | [Vista de escritura](../output/playwright/issue71-feedback/notes-editing.png) con teclado y «Listo»; [salida](../output/playwright/issue71-feedback/notes-exit.png) con teclado cerrado y navegación recuperada. El contenido mantiene sus 84 caracteres. |
| UX71-12 | Las páginas dejaban espacios distintos alrededor del dock inferior. | El dock compacto mide su altura real con `ResizeObserver`; las páginas comparten 12 px CSS por encima y debajo, además del área segura de Android. El viewport de contenido termina antes del dock, incluso al hacer scroll. Se eliminan las reservas duplicadas de Tiempo y Calendario. | Comparación de [Inicio](../output/playwright/issue71-feedback/after-home.png), [Calendario](../output/playwright/issue71-feedback/calendar.png), [Tiempo](../output/playwright/issue71-feedback/weather.png), [Notas](../output/playwright/issue71-feedback/after-notes.png) y [Ajustes](../output/playwright/issue71-feedback/settings.png). |

Las capturas anteriores se guardan localmente en `output/playwright/issue71-feedback/`, excluido de Git. La comprobación se hizo sobre la Teclast T65, en horizontal, tema Original, con gestos inyectados por ADB y revisión de capturas a 1920 × 1200. Tiempo se revisó en estado sin ubicación. Siguen pendientes otras orientaciones, temas, tamaños de widget y previsiones con datos, y la confirmación manual final de Pablo.

Validación del segundo incremento:

- Lint correcto, con los cuatro avisos previos de `CalendarConnectionsPanel.tsx`.
- 41 archivos y **238 pruebas web correctas**. Se añadieron seis escenarios: Ajustes en ambos sentidos, protección de controles/scroll, salida de notas con Listo/Escape y acceso al botón mediante teclado.
- Compilación web, sincronización Capacitor, ensamblado y verificación de la variante DEV correctos. El último ajuste posterior a esa suite solo añade el margen CSS de los tiradores; se recompiló y comprobó en la tablet.
- Instalación protegida correcta y apertura de `com.pablohorcajada.tablet.debug`, versión **0.5.2-dev**. El instalador verificó de nuevo que la app estable conservaba su estado de instalación y actualización.
- SHA-256 del APK final: `22d88cb3dcb8b5ed1375bdc47f8ebbfcd6c54950a03b3efb28ede37ed8a7c693`.
- DEV se dejó en Inicio, fuera de edición. Sin publicación, fusión ni cambios de estado en GitHub.

La comparación visual por el navegador conectado sigue sin estar disponible; la comprobación directa de estos cuatro hallazgos en la tablet sí se ha realizado. #71 continúa abierta hasta completar su alcance y la validación final.

## Tercer incremento — Geometría estable y editor de dibujo ampliable

Fecha: 10/11/2026. Corrige los cuatro puntos de la segunda devolución de Pablo. Este incremento sustituye expresamente la reserva adicional de 24 px durante la edición y el viewport reducido de Ajustes descritos en el segundo incremento.

| ID | Hallazgo | Cambio final | Evidencia local |
| --- | --- | --- | --- |
| UX71-13 | Línea horizontal entre Inicio y el dock, especialmente durante la pulsación larga o la edición. | El viewport conserva `100svh`; el espacio del dock se reserva mediante padding, evitando cortar sombras y fondos en una frontera intermedia. La pulsación larga usa un contorno interior estático. | [Inicio normal](../output/playwright/issue71-third/home-normal.png) y [en edición](../output/playwright/issue71-third/home-edit.png). |
| UX71-14 | La cuadrícula y las tarjetas cambiaban de tamaño al entrar en edición. | Eliminados el padding condicional de la página y las escalas de pulsación larga, edición y arrastre. Los tiradores de 44 px quedan dentro del widget, sin exigir cambios de geometría. El indicador de tamaño se coloca fuera de su zona; en widgets de poca altura muestra solo las dimensiones. | Comparación de los mismos bordes en las dos capturas de Inicio. No se movieron ni redimensionaron widgets para esta comprobación. |
| UX71-15 | Ajustes se cortaba por encima del dock en lugar de continuar hasta el borde inferior. | Ajustes recupera el viewport completo y el scroll por detrás del dock. Solo el final de su documento reserva espacio para alcanzar los últimos controles. | [Ajustes sin corte intermedio](../output/playwright/issue71-third/settings.png). |
| UX71-16 | Faltaba un control para ampliar y reducir el editor de dibujo. | Botón «Ampliar»/«Reducir», con etiquetas accesibles ES/EN y estado pulsado. La vista ampliada mantiene el mismo lienzo montado, oculta los paneles auxiliares y permite reducir con el botón o Escape. No modifica los datos ni las herramientas del dibujo al alternar. | [Dibujo normal](../output/playwright/issue71-third/drawing-normal.png), [ampliado](../output/playwright/issue71-third/drawing-expanded.png) y [restaurado](../output/playwright/issue71-third/drawing-restored.png). |

Validación:

- Lint correcto, con los cuatro avisos previos de refs en `CalendarConnectionsPanel.tsx`.
- **41 archivos y 240 pruebas web correctas.** Dos nuevos escenarios comprueban la conservación del mismo lienzo, trazos, color y grosor, el funcionamiento de Deshacer después de alternar, la protección frente a navegación accidental y la salida con Escape. La captura de puntero SVG se simula únicamente en JSDOM.
- Build web, sincronización Capacitor, ensamblado y comprobación del APK DEV correctos mediante `npm run android:dev:build`.
- Instalación protegida correcta de **Pablo Tablet DEV 0.5.2-dev**, con comprobación de que la app estable conserva sus datos de instalación y actualización.
- SHA-256: `6a1c7b9b6d5343f74ddc4534136a78f84101e04312de856506ea7b2292c003e1`.
- Comprobación directa en Teclast T65 horizontal, tema Original, 1920 × 1200, mediante ADB y capturas: misma geometría de widgets antes y después de activar edición, tiradores contenidos en sus bordes, fondo continuo, Ajustes con scroll completo y ampliación/reducción de un dibujo existente. Se conservaron sus dos trazos; no se dibujó ni alteró su contenido durante la prueba física.
- Capturas locales en `output/playwright/issue71-third/`, excluidas de Git. DEV queda en la vista normal del dibujo para que Pablo pruebe «Ampliar».

Pablo confirmó «todo ok» después de probar estas cuatro correcciones en la tablet. Queda registrada su validación del fondo continuo, la geometría estable al editar widgets, el scroll completo de Ajustes y los controles para ampliar/reducir el dibujo.

Esta confirmación corresponde a las correcciones del tercer incremento; no presupone completar la matriz restante de orientaciones, temas y tamaños. #71 permanece abierta; sin commits, PR, fusión ni publicación automática.
