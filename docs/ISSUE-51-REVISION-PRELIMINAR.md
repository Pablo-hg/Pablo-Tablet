# Issue 51: revisión preliminar y continuidad

Fecha: 02/11/2026. Esta revisión documental y de código no constituye una auditoría visual completa.

## Referencias y alcance

- Issue: https://github.com/Pablo-hg/Pablo-Tablet/issues/51, abierta con etiqueta `en-desarrollo`.
- Por indicación de Pablo, la revisión se realizará sobre `feature/51-auditorio-visual`, commit de partida `1b713137c6084bac37d42938cdd1adaf15295363`, incluyendo sus cambios recientes. Esta decisión sustituye la referencia a `dev` indicada en la issue para esta revisión.
- La rama parte de `main` en `94e0c79740040613c0c963f864357e93f4376067` (base común comprobada). `dev`, consultado solo como referencia, estaba en `9e82855a7535e60869c90090a9fb51a17c99d480`; no es el código que se revisará.
- No se han realizado cambios de producto, publicación ni instalación como parte de esta revisión.

## Estado de lo anterior

| Evidencia | Estado | Límite |
| --- | --- | --- |
| [PR 52](https://github.com/Pablo-hg/Pablo-Tablet/pull/52) | Fusionada en main; commit `1812497` presente en dev. Reorganiza Ajustes y aborda controles, fondos, scroll y navegación. | Su fusión no valida individualmente cada tema y orientación hoy. |
| [PR 58](https://github.com/Pablo-hg/Pablo-Tablet/pull/58) | Cerrada sin fusionar. | No considerar su matriz histórica como prueba de la versión actual. |
| [PR 60](https://github.com/Pablo-hg/Pablo-Tablet/pull/60) | Fusionada en main; merge `4acc9f8` presente en dev. Describe integración responsive de widgets y dock. | La integración posterior no demuestra equivalencia exacta de todos los cambios de PR 58 ni validación física actual. |
| Commit local `1b71313` | Incluye el reciente ajuste del espacio de Ajustes, tema, Tiempo, versión y web móvil. | No es evidencia de integración en dev ni de instalación en la tablet. |

## Inventario inicial

- Temas: Original, Cálido, AMOLED, Retro, Cristal, Nórdico, Suizo, Mediterráneo, Monocromo y Brutalista (`src/dashboardState.ts`).
- Tokens de interfaz: `--ui-canvas`, `--ui-text`, `--ui-text-muted`, `--ui-panel`, `--ui-control`, `--ui-border`, `--ui-action` y otros en `src/themes.css`.
- Componentes reutilizados de Ajustes: `SettingToggle`, selectores, controles de rango y hora, `ThemePicker`, notificaciones, actualizaciones y administración móvil.
- Hay pruebas unitarias de navegación, ajustes móviles, actualizaciones, layout y temas; `scripts/qa/weather-responsive.js` es una referencia de comprobación responsive. Su cobertura visual actual debe revisarse, no se presupone equivalente a la matriz histórica.

## Discrepancia a resolver

La issue pide 3 columnas × 4 filas sin reducir filas. `src/widgetLayout.ts` en la rama actual declara **4 columnas × 3 filas en horizontal y 3 columnas × 4 filas en vertical**. Son doce celdas en ambos casos, pero no el mismo número de columnas y filas. No modificar la cuadrícula durante la auditoría: registrar la discrepancia y confirmar el contrato antes de proponer cambios.

## Matriz de aceptación y trabajo pendiente

| Requisito | Estado | Siguiente comprobación |
| --- | --- | --- |
| SHA y correcciones históricas | Revisión preliminar | Contrastar individualmente los 15 hallazgos marcados con código y capturas de la rama actual. |
| Inventario de tokens y componentes | Parcial | Completar variantes, estados, tipografías, tamaños y usos reales. |
| Temas y ES/EN | Pendiente | Revisar los diez temas en ambos idiomas; registrar contraste medido y capturas, sin confundir gusto con defecto. |
| Ajustes, scroll, controles, estados y modales | Pendiente | Reproducir horizontal y vertical, al máximo scroll, teclado y estados disponibles. |
| Widgets y tamaños | Pendiente | Definir y ejecutar matriz representativa respetando la cuadrícula existente; revisar la prueba responsive. |
| Clasificación y plan | Pendiente | Documentar componente, tema, orientación, pasos, resultado esperado, evidencia, gravedad y corrección propuesta. |
| Lint, pruebas, compilación web y Android | Web correcto; Android pendiente | Resultados actuales abajo; las cifras de los PR son históricas. |
| Instalación y Teclast | Pendiente | Solo tras autorización de publicación y actualización iniciada por Pablo; no marcar instalado ni cerrar antes de su confirmación. |

## Orden propuesto

1. Ejecutar la rama actual y registrar el SHA y cualquier cambio local presente en cada comprobación.
2. Registrar línea base, revisar Ajustes y reproducir posibles desbordamientos con evidencia; comprobar el ajuste del hueco inferior comunicado por Pablo.
3. Revisar los diez temas, ES/EN, estados, controles y orientaciones; continuar con widgets y modales. Clasificar únicamente defectos observados.
4. Proponer correcciones pequeñas por impacto y riesgo. Tratar gestos y microanimaciones en #71 y rediseños en #72.
5. Tras aprobar las correcciones, trabajar en la rama actual y ejecutar las validaciones; mantener la integración, instalación y revisión física como pasos separados.

## Revisión ejecutada en la rama actual

Fecha: 02/11/2026. Código `1b713137c6084bac37d42938cdd1adaf15295363`; sin cambios de producto sin confirmar al iniciar. Servidor Vite local y navegador Chromium de Playwright, datos del navegador de pruebas. Las mediciones no equivalen a una revisión física ni a una auditoría integral de accesibilidad.

### Ajustes: prueba de geometría

- 100 combinaciones: diez temas × español/inglés × 1280×800, 1920×1200, 1200×1920, 800×600 y 600×960; dock inferior, tamaño de texto predeterminado y estados iniciales de web.
- No se detectó desbordamiento horizontal del documento ni de las tarjetas de Ajustes, ni solapamiento del último bloque con el dock al llegar al final del scroll. La separación medida fue de 40–46 px en horizontal y 24–30 px en vertical. Se comprobó visualmente una captura en 600×960, tema Brutalista e inglés.
- Estos cálculos no comprueban recortes internos de cada control, contraste, estados de Android, accesibilidad táctil, diálogos, todas las posiciones del dock ni el aspecto físico en Teclast.

### Tiempo: hallazgo y resultados pendientes de clasificación

#### Ficha reproducible T-01

| Campo | Detalle |
| --- | --- |
| Prioridad | Media: impide consultar parte de la previsión en una ventana horizontal pequeña. Su impacto en la resolución real de la tablet no está comprobado. |
| Estado | Corregido localmente para pantallas horizontales de hasta 480 px de alto; pendiente de revisión física y de integración. |
| Condiciones | Commit `1b71313`, Chromium, 640 × 360 horizontal, tema Cristal, español, texto base 16 px y dock inferior. Previsión meteorológica simulada. |
| Pasos | Abrir la web, configurar una ubicación con previsión, entrar en Tiempo y reducir el viewport a 640 × 360 horizontal. |
| Resultado observado | Parte de la información queda recortada por el borde inferior y la previsión diaria aparece sin filas visibles. El panel horario midió 24 px de alto con 138 px de contenido y desbordamiento oculto. |
| Resultado esperado | Poder leer y alcanzar los datos meteorológicos mediante una distribución adaptada o desplazamiento interno, sin alterar la cuadrícula del dashboard. |
| Evidencia | [Captura a 640 × 360](../output/playwright/weather33-failure-0-bottom-640x360-font16.png). La prueba automática también detectó recortes a 568 × 320. |
| Corrección y validación | `src/pages/WeatherPage.css` permite crecer y desplazarse a los paneles en horizontal con altura de hasta 480 px. La prueba a 640 × 360 pasó con cuatro posiciones del dock y texto de 16, 20 y 24 px; falta comprobar físicamente en la tablet. |

**Número de fallos confirmados hasta ahora: uno.** Los 119 avisos automáticos descritos a continuación son combinaciones señaladas, no 119 fallos distintos.

- **T-01, medio: contenido de Tiempo recortado en horizontal compacto.** El fallo previo se reprodujo con dock inferior, tema Cristal, español, datos de previsión simulados y viewport 640×360 a 16 px. La previsión horaria quedaba cortada y el panel de próximos días no mostraba sus filas. Evidencia anterior: `output/playwright/weather33-failure-0-bottom-640x360-font16.png`. La corrección local se describe en la ficha; no se ha comprobado en la Teclast.
- Se ejecutó `scripts/qa/weather-responsive.js`, fragmento 0: dock en cuatro posiciones, 21 tamaños y tres tamaños de fuente, **252 casos; 119 señalados**. Ejemplos automáticos: 568×320, 640×360 y 720×480. Los avisos de `sourceOverlap` deben revisarse antes de considerarlos defectos porque la previsión diaria tiene scroll interno. Por ejemplo, 1108×635, dock inferior y fuente 16 px no produjo aviso; las otras posiciones sí marcaron `sourceOverlap` sin recorte de panel detectado. No extrapolar los 119 avisos a 119 errores confirmados.
- Tras la corrección local, el mismo fragmento señala 71 de 252 combinaciones; los 12 casos a 640 × 360 pasan. Los avisos restantes corresponden a otros tamaños y siguen pendientes de análisis.
- Quedan sin ejecutar los otros estilos de paginador y el modo de estrés de temas/idiomas de esa prueba. Tampoco se ha completado una matriz de widgets, modales o contraste de todos los temas.

### Validaciones de esta revisión

- `npm run lint`: correcto.
- `npm test`: 31 archivos y 172 pruebas correctas.
- `npm run build`: correcto; aviso de tamaño de bundle superior a 500 kB.
- Sincronización y compilación Android: no ejecutadas en esta revisión. Sin actualización, instalación ni validación en tablet.
- Próximo paso: reproducir y clasificar los avisos de Tiempo, completar widgets, modales, contraste y estados ES/EN, y proponer correcciones pequeñas. No cerrar la issue con esta cobertura parcial.
