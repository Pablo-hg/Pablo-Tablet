# Revisión rápida de los temas 03–10

12/11/2026. Pablo pide continuar con los ocho temas restantes, manteniendo el vistazo rápido acordado para AMOLED. Se revisan en web y no se actualiza la tablet.

## Alcance y resultado

Ocho pantallas principales —Inicio, Asistente, Calendario, Reloj, Tiempo, Notas, Galería y Ajustes— en español, horizontal 1280 × 800 y vertical 800 × 1280. Playwright usa perfiles desechables, contenido ficticio y el selector real de Apariencia. No se ejecuta la suite de 255 tests ni se amplía al recorrido exhaustivo de diálogos, estados vacíos, widgets/gestos, ES/EN, hardware o rendimiento.

| Tema | Horizontal / vertical | Resultado del vistazo |
| --- | --- | --- |
| 3. Retro | Revisado | Etiquetas legibles y relieve interior que conserva las esquinas asimétricas. |
| 4. Cristal | Revisado | Corregidos textos secundarios del widget meteorológico y placeholder. |
| 5. Original | Revisado | Corregido el contraste del placeholder meteorológico. |
| 6. Nórdico | Revisado | Etiquetas legibles; se mantiene el reloj oscuro y sus roles locales. |
| 7. Suizo | Revisado | Etiquetas y estados con colores semánticos; se mantiene la marca azul interior. |
| 8. Mediterráneo | Revisado | Etiquetas y tareas marcadas legibles; se conserva el detalle cerámico. |
| 9. Monocromo | Revisado | Texto legible conservando tipografía editorial, bordes y colores informativos de eventos. |
| 10. Brutalista | Revisado | Corregida la hora amarilla de próxima alarma sobre superficie clara; se conservan bordes y sombra recta. |

Se inspeccionaron capturas representativas de cada tema, alternando pantallas y orientaciones. El recorrido automatizado de las ocho páginas no encontró errores JavaScript, desbordamiento horizontal de página ni textos críticos fuera de su contenedor. Es un visto bueno técnico acotado para revisión del usuario; no aprobación final de todos los estados.

## Correcciones compartidas

- La solución de miniaturas 4:3 de Cálido/AMOLED pasa a todos los temas. Evita tiras de fotos estiradas, sin cambiar imágenes ni datos.
- Los ajustes semánticos comprobados en Cálido se extienden a los demás perfiles: días de semana, etiquetas meteorológicas, contador de fotos, formato de nota, placeholders, controles y vista horaria usan los roles de cada tema. Los colores pálidos heredados dejan de imponerse sobre superficies claras; los oscuros conservan sus roles claros de lectura.
- Los iconos de tipo de evento conservan sus cuatro familias de color con tonos más profundos en los temas claros. No se eliminan hoy, selección, categorías o colores de eventos.
- Las tareas marcadas mantienen el tachado y adoptan el color secundario completo, evitando que la opacidad vuelva ilegible el texto en Retro/Mediterráneo.
- Retro usa relieve interior para evitar cortes de sombra. Brutalista usa el rol de texto de acción para la hora de alarma, manteniendo amarillo como relleno de acción.

No se cambia la cuadrícula, navegación, persistencia, funcionalidades o fuentes/dependencias. Estos ajustes amplían parte de las correcciones antes limitadas a Cálido; no se altera retrospectivamente su evidencia histórica.

## Evidencia

- Antes de corregir colores: `output/playwright/issue72-rest-quick/<tema>/`, 20 capturas y `report.json` por tema. La galería ya incluye la corrección compartida en este recorrido.
- Después: `output/playwright/issue72-rest-final/<tema>/`, 20 capturas y `report.json` por tema. Siete temas sin hallazgos de contraste del texto medido. Brutalista registra un único hallazgo residual: hora de alarma amarilla; corregido después.
- Repetición selectiva de esa corrección: `output/playwright/issue72-rest-brutalist-final/`, 2 capturas y `report.json`, cero errores y cero hallazgos de contraste.
- El cálculo de contraste es acotado a texto visible y placeholders sobre fondos CSS compuestos, sin certificar WCAG completa ni todos los píxeles/estados.
- Se usa `scripts/visual-review-theme.mjs` con tema explícito y `PABLO_VISUAL_QUICK=1`. Las ocho ejecuciones se orquestan desde un script temporal, como máximo dos navegadores a la vez. Playwright sigue en `/tmp`, sin dependencia añadida a la app.

Build web/TypeScript, lint y `git diff --check` comprobados. Se conservan los avisos previos de refs en CalendarConnectionsPanel y bundle grande. No se sincroniza, compila o instala Android. Pendiente la valoración de Pablo desde Ajustes → Apariencia.

## Aprobación web y entrega posterior a DEV

12/11/2026. Tras la revisión, Pablo confirma «todo ok» y pide expresamente «pasalo a tablet dev». Se compila e instala una nueva DEV con todos los ajustes compartidos y de los diez temas.

- `npm run android:dev:build`: correcto; TypeScript/build web, sincronización Capacitor y `:app:assembleDebug` completados (Gradle 22 s). Persisten los avisos previos de bundle grande y deprecaciones. No se repite la suite de 255 pruebas.
- `npm run android:dev:install -- --yes`: correcto en T65 `J014BACGDD00556800`, reemplazando DEV sin borrar datos. La comprobación antes/después mantiene la estable `com.pablohorcajada.tablet` en `0.5.2`, con fechas `2026-11-10 12:38:31`.
- APK `com.pablohorcajada.tablet.debug`, versión `0.5.2-dev`, SHA-256 `fee04c2efcabadc9eab15b0f5d78d7bf39ad6b2be675948c9b746c7a2d087f49`.
- Arranque verificado en Inicio. Se conserva la selección que tenía el usuario: AMOLED y reloj analógico minimalista, además de sus widgets y notas. Capacitor usa los recursos locales del APK, sin live reload.
- Captura de apertura: `output/playwright/issue72-all-themes-tablet/loaded.png` (1920 × 1200). Logs: `/tmp/pablo-72-all-themes-dev-build.log` y `/tmp/pablo-72-all-themes-dev-install.log`.

Pendiente la valoración física del usuario sobre los diez temas, tacto, rotación y fluidez. La comprobación de apertura no sustituye esa aceptación ni autoriza fusión/publicación o cierre automático de #72.
