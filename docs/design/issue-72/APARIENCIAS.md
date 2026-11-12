# Diez apariencias con personalidad — propuesta #72

Fecha: 11/11/2026. Pablo autorizó preparar **diez diseños diferentes**, con curvas, formas y estructura coherentes con la tarea. Se mantiene la dirección B como criterio de lectura. Esta entrega es una comparación previa a implementar las apariencias, disponible en [apariencias.html](apariencias.html).

**Estado posterior:** Pablo aprobó los diez conceptos y pidió implementarlos para ir indicando errores. La primera aplicación al producto web se registra en [IMPLEMENTACION-APARIENCIAS.md](IMPLEMENTACION-APARIENCIAS.md). Este documento y sus láminas conservan el alcance y los límites del estudio original.

## Cómo compararlas

La página muestra los diez temas existentes, una vista detallada y el modo **Las diez juntas**. Ofrece Inicio, Asistente, Calendario, Reloj, Tiempo, Notas, Galería y Ajustes; horizontal/vertical y contenido ES/EN. La muestra de edición solo se activa en Inicio. Se pueden abrir las láminas a tamaño completo.

En la web local: `http://127.0.0.1:5173/docs/design/issue-72/apariencias.html`. También se puede abrir el HTML directamente: hojas, scripts y SVG son locales, sin fuentes descargadas, peticiones remotas ni lectura de almacenamiento de la app. Los parámetros `theme`, `page`, `orientation`, `language` y `mode` permiten compartir una vista inicial del estudio.

## Qué cambia en cada diseño

Se conserva el orden y los diez identificadores de `DASHBOARD_THEMES`. Los nombres descriptivos son conceptos de evaluación; no son nuevos IDs o preferencias.

| Tema | Dirección | Formas / tipo / profundidad | Beneficio a contrastar | Coste relativo de adaptación |
| --- | --- | --- | --- | --- |
| Cálido | Papel y terracota | Radio 26, control 12, serif en títulos, relieve suave | Jerarquía doméstica y lectura pausada | Medio |
| AMOLED | Instrumentos nocturnos | Radio 12, control 7, cifras/cuerpo mono y contornos sobre negro | Lectura nocturna y datos reconocibles | Medio |
| Retro | Estudio de los setenta | Curvas asimétricas de 30/8, control 10, serif y tinta oliva | Una identidad cálida y expresiva | Alto |
| Cristal | Vidrio y luz | Radio 30, control 18, reflejo superior y base azul/lavanda | Distinguir planos sin perder el texto | Alto |
| Original | Azul en calma | Radio 20, control 12, superficies mates y sans | Familiaridad con la B ya elegida | Bajo |
| Nórdico | Claro y botánico | Radio 32, control 18, blanco mate, verde vivo y hora oscura | Localizar dato principal y selección | Medio |
| Suizo | Precisión azul | Radio 6, control 5, sans firme, acentos y rótulos precisos | Jerarquía editorial con poco ruido | Medio |
| Mediterráneo | Cal y cerámica | Radio 34, control 14, serif, marfil, azul y arcos discretos | Claridad luminosa con carácter doméstico | Medio |
| Monocromo | Tinta y papel | Radio 2, control 2, serif editorial y líneas de tinta | Reconocer selección por tono, contorno y texto | Medio |
| Brutalista | Bloques expresivos | Radio 0, borde 3 y sombra desplazada, títulos firmes | Límites y acciones muy explícitos | Alto |

Las dimensiones de la tabla son unidades del boceto, no medidas físicas ni tamaños que se deban copiar ciegamente a CSS. Coste relativo de adaptar y validar componentes, no una estimación cerrada de jornadas. Las curvas asimétricas de Retro y el vidrio de Cristal necesitan comprobarse especialmente en el modo de edición y los tamaños mínimos.

Las referencias aportadas por Pablo inspiran Nórdico (blancos, verde y bloques oscuros) y Suizo (claros, azul y geometría precisa). El contenido de las imágenes suministradas se ha usado como referencia visual; no se han copiado funciones, marcas ni fotografías.

## Estructura y restricciones que conservan

- Los mismos datos ficticios y fecha —miércoles 11 de noviembre de 2026— en todas las muestras. Cambiar de tema conserva la pantalla, idioma y orientación.
- Misma cuadrícula de Inicio y mismas cajas entre temas y entre normal/edición: horizontal 4 × 3, calendario 2 × 3, reloj 2 × 1, notas/tiempo 1 × 2. Vertical 3 × 4, calendario 2 × 3, reloj/tiempo 1 × 2 y notas 2 × 1. Son ejemplos válidos; no se escriben en las configuraciones del usuario.
- Ocho destinos en el mismo orden y dock de la misma altura/posición. La propuesta varía forma y acabado; no introduce otra arquitectura de navegación ni cambia las opciones guardadas del dock.
- Hoy conserva círculo, fondo y contorno. Los eventos mantienen cuatro colores informativos, etiquetas suaves, contador y próximos eventos. El marco Monocromo no elimina esas señales de los eventos. En celdas pequeñas, el resumen usa puntos de su color y mantiene el contador.
- Tipos locales genéricos —sans, serif y monospace—, sin descargar ni añadir familias. Las cifras se comparan con el mismo formato digital; el tema no elige automáticamente el estilo de reloj del usuario.
- En Reloj vertical, la propuesta ordena hora/fecha, alarmas, temporizadores y estilos al final. Ajustes representa continuidad de contenido, coherente con la corrección ya validada. Los SVG no prueban scroll real.
- Contornos, arcos, reflejos y sombras no reducen ni escalan la caja de los widgets. No se añaden movimientos continuos, filtros animados o dependencias.

## Alcance y límites

Son **bocetos vectoriales**, no capturas de la app ni pantallas funcionales. Los botones dentro del dibujo no ejecutan acciones. Las ocho vistas representan contenido y estados seleccionados; no sustituyen el inventario de filtros, herramientas de dibujo, proveedores, recordatorios, diálogos, teclado, carga, error o sin conexión. La ausencia de un control en una lámina no autoriza eliminarlo del producto.

El SVG de Cristal usa colores opacos y un fondo ilustrativo; no acredita transparencia real, contraste compuesto o rendimiento de blur. AMOLED no implica ahorro energético en una pantalla que no se haya medido. Los paisajes de Galería son ilustraciones neutrales de muestra; las fotos reales no se recolorearán al cambiar de tema.

La entrega original del estudio no modificó `src/themes.css`, la app, Android, preferencias, datos, API o SQLite. La posterior autorización de los diez conceptos inicia su implementación en web, con revisión independiente de lo aceptado anteriormente en Inicio/Reloj y división posterior de PRs por componentes o pantallas.

La siguiente fase medirá estados y contraste renderizado, textos largos, texto ampliado, tamaños mínimos de widgets, ES/EN, horizontal/vertical, gestos, foco, lectores, movimiento reducido y rendimiento. Se prioriza web; tablet únicamente cuando Pablo lo solicite. La integración y publicación conservan su autorización independiente.

## Reproducción y revisión

`python3 docs/design/issue-72/render_appearances.py` genera 360 láminas (10 temas × 8 vistas × 2 idiomas × 2 orientaciones, más 40 de edición) y una hoja de contacto. `--png` usa librsvg/cairo del sistema y escribe las imágenes de revisión en `output/issue72/appearances/`, excluido de Git. No añade dependencias al APK.

Los archivos se guardan en `assets/appearances/`; el catálogo y los tokens comparables en `appearances-data.js`. El generador reutiliza únicamente el renderizador vectorial y los iconos de la documentación anterior.

La validación de este estudio se registra en [APARIENCIAS-VALIDACION.md](APARIENCIAS-VALIDACION.md). Las comprobaciones de SVG/DOM y parejas opacas de color no acreditan aceptación de producto, tacto real ni la matriz física de #72.
