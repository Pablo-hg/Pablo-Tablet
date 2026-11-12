# Revisión rápida 02 — AMOLED

11/11/2026. Pablo autoriza seguir con AMOLED y pide expresamente un vistazo rápido, sin profundizar como con Cálido. Se revisa solo la web y se espera su valoración; no se instala en la tablet.

Playwright aislado, contenido ficticio y selector real de Ajustes. Ocho pantallas en español, 1280 × 800 y 800 × 1280. Se capturan también los extremos del scroll donde corresponde. No se recorren todos los diálogos, estados vacíos, edición, variantes de widgets ni la matriz ES/EN completa.

## Resultado

Sin fallos evidentes de contraste del texto medido, errores JavaScript, desbordamiento horizontal de página o textos críticos fuera de sus cajas en el recorrido principal. Se inspeccionan muestras de Inicio, Reloj, Calendario, Tiempo, Notas, Asistente, Galería y Ajustes, alternando ambas orientaciones. No equivale a una auditoría exhaustiva ni validación física.

Único fallo claro encontrado: Galería seguía estirando las miniaturas para llenar toda la altura. Se extiende a AMOLED la corrección ya probada en Cálido: proporción 4:3, alineación superior e imagen fuera del cálculo de altura intrínseca. Se repite únicamente Galería, con resultado correcto en ambas orientaciones. No se altera la paleta ni los datos del usuario.

## Evidencia local

- `output/playwright/issue72-amoled-quick/`: 20 capturas y `report.json`. Los únicos dos errores registrados corresponden a la proporción de Galería, antes de corregirla.
- `output/playwright/issue72-amoled-gallery-final/`: 2 capturas y `report.json`, cero errores y cero hallazgos del cálculo acotado de contraste.
- `git diff --check` correcto. No se ejecuta la suite de 255 pruebas, build Android o instalación.

El script `scripts/visual-review-theme.mjs` acepta selección explícita `PABLO_VISUAL_THEME=amoled`, con `PABLO_VISUAL_QUICK=1`; no itera automáticamente al siguiente tema. Pendiente valoración web de Pablo antes de cualquier instalación o revisión del siguiente tema.
