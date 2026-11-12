# Validación del estudio de diez apariencias

11/11/2026. Solo documentación/prototipos de la #72. No se atribuyen estos resultados a la aplicación instalada.

| Comprobación | Resultado y límite |
| --- | --- |
| Generación | 360 SVG de vistas: 10 temas × 8 pantallas × 2 orientaciones × ES/EN = 320; más 40 vistas de edición de Inicio. Una hoja de contacto adicional: 361 archivos, aproximadamente 5,1 MB en total. |
| XML / recursos | Los 361 SVG se analizan correctamente. Tienen título; las vistas individuales incluyen descripción. Sin scripts, imágenes remotas, fuentes descargadas o referencias externas. |
| Geometría de Inicio | Las cuatro cajas `agenda`, `clock`, `notes`, `weather` tienen idénticas coordenadas/dimensiones entre los diez temas, ES/EN y normal/edición: 80 estados de Inicio. Se respetan las dos cuadrículas del boceto; no valida `widgetLayout.ts` ni una migración de datos. |
| Render nativo | Los 361 SVG renderizan correctamente con librsvg/cairo. PNG de revisión en `output/issue72/appearances/`, fuera de Git. |
| Inspección visual | Revisada la hoja de contacto de los diez temas; muestra de las ocho pantallas en horizontal EN; Inicio Nórdico vertical ES, Reloj Cálido vertical EN, Ajustes Retro vertical EN y Calendario AMOLED horizontal EN a tamaño completo. No se han inspeccionado manualmente las 360 vistas individuales. |
| Correcciones durante revisión | Separación de etiqueta/contador de calendario; colores propios en el resumen por puntos; iconos oscuros para mantener lectura sobre blanco en Nórdico/Brutalista; reflejo de Cristal recortado dentro de su lámina en la hoja de contacto. |
| Comparador DOM | 360 combinaciones de tema/pantalla/orientación/idioma/edición, selección única, rutas existentes, dimensiones declaradas de imagen, enlace a tamaño completo, edición desactivada fuera de Inicio, mosaico de diez, paso de mosaico a detalle y parámetros válidos/inválidos correctos. Validado con JSDOM/Node 22. No mide layout, desplazamiento o foco renderizados. |
| Recursos del comparador | Enlaces y scripts locales existentes; sin iframes, fetch, almacenamiento de app o servicios remotos. JavaScript válido con `node --check`. |
| Servidor web | La URL local de `apariencias.html` responde HTTP 200 en Vite. La disponibilidad no acredita geometría del comparador en un navegador. |
| Lint / higiene | Lint sin errores, cuatro avisos de refs ya existentes en CalendarConnectionsPanel. `git diff --check` correcto. |
| Producto / Android | No se modifica código de producto, datos o dependencias para este estudio. No se repiten build/tests de la app ni se instala o publica Android por esta entrega. |

## Contraste básico de los tokens opacos

Luminancia relativa sRGB, pares sólidos del boceto. No es contraste renderizado de superficies compuestas ni certificación WCAG de la app.

| Tema | Texto / panel | Metadatos / panel | Metadatos / control | Texto de acción / acento |
| --- | ---: | ---: | ---: | ---: |
| Cálido | 14,14:1 | 6,46:1 | 5,27:1 | 6,56:1 |
| AMOLED | 17,39:1 | 9,26:1 | 8,15:1 | 10,87:1 |
| Retro | 12,13:1 | 5,97:1 | 4,97:1 | 6,45:1 |
| Cristal | 9,79:1 | 7,28:1 | 5,62:1 | 11,15:1 |
| Original | 12,54:1 | 8,13:1 | 6,44:1 | 8,11:1 |
| Nórdico | 16,38:1 | 6,66:1 | 5,65:1 | 10,13:1 |
| Suizo | 17,72:1 | 7,22:1 | 6,18:1 | 6,23:1 |
| Mediterráneo | 12,08:1 | 5,93:1 | 4,63:1 | 7,38:1 |
| Monocromo | 17,93:1 | 7,25:1 | 6,29:1 | 17,93:1 |
| Brutalista | 17,42:1 | 9,06:1 | 7,40:1 | 14,09:1 |

El mínimo de estos cuarenta pares es 4,63:1. Los contornos decorativos no se contabilizan como señal de foco. La implementación deberá medir estados, eventos, controles, reflejos y transparencias reales; Cristal se ha representado con panel opaco deliberadamente para no prometer un contraste compuesto no medido.

## Pendiente

Revisión del usuario y aprobación de los diez conceptos; inventario completo de componentes/estados; implementación selectiva y comprobación responsive real (incluyendo texto ampliado, tamaños mínimos, todos los temas ES/EN), teclado/lector/foco y movimiento reducido. Las curvas del dibujo no acreditan áreas táctiles reales. La T65 se probará cuando Pablo lo solicite. La issue #72 sigue abierta por alcance y validaciones pendientes.
