# Comprobación de los artefactos de evaluación #72

Fecha: 10/11/2026. Base de producto `02d1d7280de4c9ec3870bdc448c2ade2c05a1824`.

Esta validación corresponde a la documentación y los bocetos de la evaluación previa a la elección. La posterior implementación B1 y su instalación se registran en [IMPLEMENTACION-B1.md](IMPLEMENTACION-B1.md); los resultados de producto no deben confundirse con los del prototipo.

| Comprobación | Resultado y límite |
| --- | --- |
| Generación reproducible | `python3 docs/design/issue-72/render_proposals.py --png`: nueve SVG y nueve PNG de revisión. Los PNG se generan en `/tmp/pablo-72-propuestas`, fuera del producto. Solo la opción PNG requiere las bibliotecas del sistema librsvg/cairo; no se añadieron dependencias al repositorio/APK. |
| XML de los bocetos | Nueve SVG válidos, con `title`, `desc` y viewBox horizontal o vertical. Sin recursos externos ni imágenes del usuario. |
| Geometría comparable | Las cuatro cajas principales del dashboard tienen las mismas coordenadas/dimensiones entre A/B/C para cada orientación. No se prueba el motor de layout de la app con estos dibujos. |
| Inspección visual | Revisados los nueve bocetos renderizados con librsvg; ajustados etiquetas, segundos, selección, herramientas de dibujo, proveedores y controles temporales. No es render de Android WebView ni una prueba física. |
| Comparativa HTML | Once escenarios DOM con JSDOM/Node 22: seis combinaciones dirección/orientación, cuatro pantallas de B y vuelta a Inicio al pasar a vertical. Rutas de SVG existentes, un único botón seleccionado por grupo y páginas B ocultas cuando corresponde. |
| Enlaces/recursos HTML | Enlaces relativos existentes y cero scripts/hojas/frames remotos, sin fetch/XHR/WebSocket. Puede abrirse localmente y sin red. |
| Alcance del check DOM | No mide geometría, contraste compuesto, foco visible real ni tamaño de los controles en un navegador. La revisión de HTML responsive real queda separada de la inspección de los SVG. |
| Higiene | Archivos menores de 1 MB, sin espacios finales; `git diff --check` correcto. Cambios limitados a `docs/design/issue-72/`. |
| Producto y Android | Sin cambios en `src`, Android, scripts de producto, dependencias o configuración. No se repitieron suites de producto ni builds por esta entrega documental. No se instaló una versión nueva ni se modificaron datos de la tablet. |

## Contraste de las parejas opacas del boceto B / Original

Cálculo de luminancia relativa sRGB. Son parejas de colores sólidos del boceto, no mediciones de fondos compuestos ni certificación de la app.

| Pareja | Relación |
| --- | --- |
| Texto `#f7f8ff` / panel `#1c2c43` | 13.30:1 |
| Metadatos `#b8c5d9` / panel `#1c2c43` | 8.07:1 |
| Metadatos `#b8c5d9` / control `#243952` | 6.75:1 |
| Texto de acción `#07142d` / acento `#7899ff` | 6.80:1 |
| Separador decorativo `#3f536e` / panel `#1c2c43` | 1.79:1 |

El separador decorativo **no sirve como única señal de foco, estado o contorno de un control que necesite esa señal**. Los checkboxes del boceto usan un contorno más claro; los controles reales deberán conservar sus áreas táctiles, semántica y contraste en la implementación.

## Pendiente para aceptar #72

Elección y alcance aprobados; implementación por entregas; checks de producto; revisión completa de temas/idiomas/estados y tamaños; pruebas táctiles y de rendimiento en Teclast; evidencia real antes/después y aprobación independiente de integración/publicación. Matriz detallada en [README.md](README.md).
