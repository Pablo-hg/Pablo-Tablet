# Estilos del widget de reloj

Fecha: 11/11/2026. Extensión de alcance solicitada por Pablo: añadir estilos analógicos y digitales que se elijan desde Reloj. Esta petición autoriza este selector y la preferencia necesaria; no supone aprobar el resto de B2/B3.

## Uso y cambios

En Reloj, el grupo **Estilo del widget de reloj** ofrece cuatro opciones con vista previa comparable a las 09:41: digital clásico, digital en bloques, analógico con números y analógico minimalista. La elección se aplica al widget de Inicio y se guarda automáticamente. El reloj grande de la pantalla Reloj conserva su representación digital.

Se reutiliza el tick existente de la aplicación. Las agujas SVG se actualizan sin bucles de animación, intervalos nuevos ni dependencias. El modo 1 × 1 omite segundos; los otros tamaños conservan el segundero o los segundos digitales. La hora tiene representación accesible en texto y las opciones usan radios nativos, foco visible y nombres ES/EN.

El formato clásico conserva el marcado y la distribución anteriores. Los demás estilos usan una distribución propia dentro de la misma caja, conservando fecha y resumen de alarmas según el espacio disponible. No cambian las posiciones guardadas, las restricciones de cuadrícula ni las operaciones de alarmas, temporizadores y cronómetro.

La única ampliación de datos es `preferences.clockWidgetStyle`, dentro del estado existente. Se normaliza mediante una lista de cuatro valores; configuraciones anteriores o valores desconocidos recuperan `digital`. No se cambia la clave de almacenamiento ni el esquema SQLite. Reabrir una versión anterior conserva sus funciones; no se garantiza que esa versión antigua vuelva a guardar la preferencia nueva.

## Comprobaciones

- Suite web: **42 archivos / 253 pruebas correctas**. Incluye elección y reapertura de los cuatro estilos, conservación de layout/alarmas/temporizadores, traducción inglesa, actualización de agujas con el tick real de App, medianoche y fallback de configuraciones anteriores o inválidas.
- Lint web correcto, con los cuatro avisos previos de refs de CalendarConnectionsPanel.
- Build web/TypeScript, sincronización Capacitor, ensamblado e identidad del APK DEV correctos. Aviso existente de tamaño del bundle.
- Android Lint/pruebas nativas: **0 errores, 29 avisos, 43 pruebas correctas**. Ejecutadas después del primer ensamblado, antes de dos ajustes posteriores exclusivamente CSS del selector.
- Inspección física parcial: T65 horizontal, Cristal, ES, reloj 1 × 1 y distribución existente del usuario. Se comprobó el clásico y la selección del digital en bloques, con la caja y contenido restantes conservados. Se detectó el recorte inicial de los nombres de los analógicos; se compactó el reloj grande y se distribuyó el nombre a todo el ancho de la opción. La comprobación visual final del selector y ambos analógicos queda pendiente en web.
- El navegador de pruebas conectado falló al intentar inspeccionar la web (`timeoutMs`); no se atribuye una revisión visual automatizada web a las pruebas DOM.

Capturas parciales, excluidas de Git: `output/playwright/issue72-clock/`. `picker.png` y `picker-final.png` son pasos intermedios, anteriores al último ajuste de espacio; no representan el resultado final del selector. `home-blocks.png` acredita la selección del digital en bloques en el widget compacto.

## Compilación y preferencia de prueba

APK DEV generado: `android/app/build/outputs/apk/debug/app-debug.apk`, paquete `com.pablohorcajada.tablet.debug`, versión 0.5.2-dev. SHA-256: `9a6f43bbc317b298adf8c4a0b14f18d8d6fd7de7ebbda975d53606f006383827`. El instalador protegido completó la actualización de DEV y verificó que la estable no cambió.

Pablo indicó después que prefiere **probar primero en web y usar la tablet cuando él lo pida**. Se detuvo la revisión física; no realizar nuevas instalaciones o pruebas en la tablet hasta esa petición. La web de desarrollo usa `http://127.0.0.1:5173/`.

## Corrección de distribución en web — 11/11/2026

Pablo aportó una captura donde la columna del selector se desplazaba y recortaba los nombres de los analógicos. Solicitó que dibujos y textos cupieran en cada tarjeta y que la ventana no necesitara scroll para consultar sus componentes.

- Se elimina la columna desplazable `clock-appearance` y sus alturas mínimas acumuladas.
- En horizontal, el reloj ocupa la primera columna y alarmas/temporizadores comparten la segunda. El selector usa una fila inferior de ancho completo con cuatro opciones. En horizontal compacto de 601–900px y hasta 600px de alto, el resumen horario se convierte en una fila superior para dar más anchura a las herramientas.
- Las tarjetas separan muestra y nombre en dos filas; el radio nativo queda en una esquina. El texto envuelve, las cifras responden al ancho de cada tarjeta y el dibujo analógico conserva una proporción cuadrada dentro de su zona.
- En vertical de tablet se apilan resumen, selector y herramientas dentro del espacio disponible. Se conserva un fallback desplazable en anchos de teléfono hasta 600px para no ocultar controles. Las listas extensas de alarmas/temporizadores mantienen su desplazamiento interno; no se impone un número máximo de registros ni se oculta contenido para simular ausencia de scroll.
- Se compacta la presentación del cronómetro dentro de su panel y se conservan sus acciones. No cambian valores persistidos ni lógica de las herramientas.

Comprobaciones de este ajuste: **34 pruebas correctas** de estilos, interacciones y sonido del temporizador; lint web correcto con los avisos anteriores; build TypeScript/web correcto. Son pruebas de comportamiento y compilación, no acreditan la geometría renderizada. El navegador conectado volvió a fallar en navegación/inspección (`timeoutMs`); el ajuste queda disponible mediante Vite para la revisión visual del usuario. No se compiló ni instaló Android para esta corrección.

En una segunda captura Pablo detectó que el título se montaba sobre el borde. Se sustituyó el `fieldset`/`legend` (que interrumpe el borde por diseño nativo) por un grupo con nombre accesible y encabezado interior. El título comparte el padding del contenido y puede envolver sin salirse del panel; se mantienen los radios nativos y su agrupación.

## Corrección de la vista vertical — 11/11/2026

Pablo detectó que la fecha salía de la tarjeta de la hora, que el contenido terminaba con un corte por encima del dock y que el selector de estilos aparecía antes de las herramientas. Para vertical pidió explícitamente el comportamiento de Ajustes cuando el contenido supera la pantalla; esta indicación sustituye el intento anterior de encajar toda la vista vertical a una altura fija.

- El contenedor activo recibe `is-clock`. En vertical se desplaza ese contenedor de página completo; se retiran alturas fijas, filas comprimibles y scrolls interiores del área de trabajo y las listas.
- La tarjeta de hora/fecha conserva altura natural, mínimo de 148px, padding interior y elementos que no se contraen. Una fecha en varias líneas hace crecer la tarjeta.
- El orden vertical pasa a ser hora/fecha, alarmas, temporizadores/cronómetro y estilos. El selector ya era el último elemento en el DOM y ahora también lo es visualmente.
- Con dock inferior, la página continúa por detrás de la navegación y solo su final reserva `--bottom-nav-space`, siguiendo el patrón existente de Ajustes. No se modifica el comportamiento de Ajustes ni el resto de pantallas.
- Los cambios se limitan a web. No se recompila ni instala Android.

Verificación: **51 pruebas correctas** de estilos, interacciones y navegación; build TypeScript/web y lint correctos con los avisos previos. La inspección del navegador conectado vuelve a fallar por `timeoutMs`, incluso al intentar revisar la pestaña web existente. No se presenta la prueba DOM como validación de dimensiones o scroll renderizados.

Pendiente: confirmar visualmente en la ventana del usuario la hora y fecha dentro de la tarjeta, continuidad del scroll por detrás del dock y estilos al final, además de variantes de tamaño, vertical/horizontal, temas, teclado/foco y ES/EN renderizados. La validación física completa queda para cuando Pablo solicite probar en tablet. Esta entrega no cierra #72 ni incluye integración/publicación.
