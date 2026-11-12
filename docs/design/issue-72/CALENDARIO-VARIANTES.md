# Calendario B — Variantes para elegir

Pablo pide conservar el día actual destacado, identificar eventos con sus colores y presentar eventos/próximos eventos con texto más pequeño. Después de revisar estos ejemplos eligió **la primera variante**, «Etiquetas suaves». Su implementación en el widget de Inicio se registra en [CALENDARIO-VARIANTE-1.md](CALENDARIO-VARIANTE-1.md). Las imágenes de esta comparativa siguen siendo bocetos, no capturas del producto.

## Común a las tres

- Mismo fondo y lenguaje visual B, mismo mes y datos ficticios.
- Hoy: fondo suave en toda la celda, borde, número con círculo de acento y etiqueta «HOY».
- Eventos: se conservan los colores asignados a cada evento, sin inventar categorías. El color se acompaña de texto.
- Tipografía menor para eventos que para títulos y fecha; no se reduce el tamaño de la zona táctil. Fechas/horas completas en próximos eventos.
- En el ejemplo compacto se muestra una etiqueta por celda, título abreviado si hace falta y `+N` para los restantes. El detalle se consultaría por el acceso existente al día. Los bocetos no prueban tamaños táctiles, reflow o contraste de todos los temas.
- El indicador `+N` es una propuesta de presentación para aprobación; no cambia datos ni cuadrícula. La implementación debe respetar los resúmenes y restricciones existentes de cada tamaño.

| Ejemplo | Eventos en el mes | Próximos eventos | Consideración |
| --- | --- | --- | --- |
| **1 — Etiquetas suaves (elegida)** | Fondo de color tenue, pequeña marca lateral y título en ese color. | Filas con fondo suave del mismo color. | Es la opción que más conserva la identificación por bloques de color del diseño anterior. |
| **2 — Líneas de color** | Marca vertical y texto coloreado, sin otra caja. | Marca lateral y separación fina entre filas. | Equilibra la lectura clara de B con señales de color reconocibles. |
| **3 — Puntos y texto** | Punto de color y título neutro. | Punto de color, título y hora. | Menos color de fondo; el color ocupa menos espacio y debe seguir siendo fácil de reconocer. |

Ver [la comparativa del calendario](calendario.html), con tamaños de muestra amplio y compacto. Son ilustraciones del componente, no una propuesta para cambiar la cuadrícula del dashboard.

Generación: `python3 docs/design/issue-72/render_calendar_options.py --png`. Los seis SVG se guardan en `assets/`; los PNG para mostrar en conversación quedan en `output/issue72/calendario/`, excluidos de Git.

## Comprobación de los ejemplos

- Seis SVG válidos, renderizados a PNG e inspeccionados: tres variantes en tamaño amplio y compacto. Se ajustó el contador de eventos restantes para que no se superpusiera a las etiquetas.
- Seis combinaciones del selector HTML verificadas con JSDOM; enlaces y archivos de imagen existentes, sin recursos remotos.
- El generador compartido se puede importar sin regenerar las propuestas anteriores. Al ejecutarlo como antes, los nueve SVG originales mantienen exactamente su contenido, comprobado por SHA-256.
- Sin cambios de producto, nueva compilación o instalación por esta solicitud de ejemplos. No representa validación táctil ni de responsive de la app.
