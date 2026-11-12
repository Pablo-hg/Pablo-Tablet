# Sistema visual propuesto — Pablo Tablet #72

Estado a 11/11/2026: **dirección B elegida y diez conceptos de apariencia aprobados por Pablo; primera aplicación global al producto web pendiente de revisión visual**. Se conservan los diez IDs de tema. Base de código `02d1d72`; alcance en [README.md](README.md), evaluación inicial en [comparativa.html](comparativa.html) y estado actual en [IMPLEMENTACION-APARIENCIAS.md](IMPLEMENTACION-APARIENCIAS.md).

## Propósito y principios

Una tablet de consulta continua debe permitir reconocer contenido, estado y acción sin que cada contenedor compita por atención. La evolución propuesta conserva los módulos y la personalización; prioriza jerarquía, legibilidad y tacto sobre decoración.

- Un título de página, un título de sección y contenido. Los metadatos apoyan esa lectura, sin sucesión de etiquetas del mismo peso.
- Una superficie principal por bloque. Otra superficie solo cuando distingue selección, entrada o un grupo con interacción propia; una línea suave puede separar información relacionada.
- El color de acción identifica acciones/selección. Error, éxito y advertencia incluyen texto o icono: el color no comunica el estado por sí solo.
- El contenido determina la adaptación dentro del widget; sus límites guardados no cambian al editar, pulsar o arrastrar.

## Tokens: aprovechar el sistema existente

`src/themes.css` ya define `--theme-*` y sus aliases `--ui-*`. Se mantendrán los roles y los diez IDs de tema; no introducir colores particulares en cada pantalla para eludir los tokens.

La adopción será gradual. Aprobar B1 permite aplicar estos roles a Inicio; no autoriza cambiar un alias global que altere las pantallas reservadas a B2/B3. Los valores se documentan como sistema común y se aplican por ámbito hasta aprobar las entregas restantes.

| Rol | Token existente | Regla propuesta |
| --- | --- | --- |
| Fondo | `--ui-canvas`, `--ui-wallpaper` | Mantener la identidad del tema. Trama y resplandores no interfieren con texto; no animarlos continuamente. |
| Texto | `--ui-text`, `--ui-text-muted`, `--ui-text-subtle` | Principal para contenido y acciones; muted para metadatos legibles; subtle solo para información secundaria que también cumpla contraste si es texto informativo. |
| Superficie | `--ui-panel`, `--ui-panel-solid` | Fondo de lectura estable; para B, reducir transparencia de Original. Cristal conserva su identidad y necesita comprobar el contraste compuesto. |
| Entrada/control | `--ui-control`, `--ui-control-hover` | Reserva visual para entrada, controles y selección. Evitar encerrar cada párrafo o día vacío en un panel adicional. |
| Bordes | `--ui-border`, `--ui-border-strong` | Border organiza; strong indica foco/selección cuando corresponda. Un borde decorativo no sustituye la señal necesaria para reconocer un control. |
| Acción | `--ui-action`, `--ui-action-soft`, `--ui-action-text` | Selección y acción principal. Texto e icono de la acción deben contrastar con su fondo real. |
| Estado | `--ui-positive`, `--ui-highlight`, `--ui-danger` | Éxito, aviso, error/destructivo con etiqueta y/o icono. No reutilizar un aviso como adorno general. |
| Forma | `--ui-radius-panel`, `--ui-radius-control`, `--ui-outline-width` | Aplicar por rol conservando variantes del tema; Brutalista no se convierte en tarjetas redondas. |
| Profundidad | `--ui-shadow`, `--ui-backdrop-blur` | Menos capas acumuladas. Sombra para elevación real, especialmente overlays. Sin animar blur/filtros ni añadir librerías. |
| Tipo | `--ui-font` | Fuente existente del tema y fallbacks locales. No descargar otra familia. Dígitos tabulares en horas y contadores. |

### Ejemplo de paleta B en Original

Valores de los bocetos, sujetos a comprobación en render real. No son valores que deban imponerse a otros temas.

| Uso | Color |
| --- | --- |
| Fondo | `#101a32` |
| Panel de lectura | `#1c2c43` |
| Control / superficie secundaria | `#243952` |
| Texto principal | `#f7f8ff` |
| Metadatos | `#b8c5d9` |
| Separador decorativo | `#3f536e` |
| Acción / texto de acción | `#7899ff` / `#07142d` |

El separador decorativo no está aprobado como contorno exclusivo de campos o foco. Para esos usos se conserva/refuerza el token fuerte y se mide el contraste no textual.

### Personalidad por tema

La evolución más expresiva solicitada el 11/11/2026 se compara en [Diez apariencias](apariencias.html) y se concreta en [APARIENCIAS.md](APARIENCIAS.md). Pablo aprobó los diez conceptos; su primera aplicación al producto web se documenta en [IMPLEMENTACION-APARIENCIAS.md](IMPLEMENTACION-APARIENCIAS.md), pendiente de revisión visual. La tabla siguiente conserva el criterio de adaptación inicial de B.

| Tema | Conservar al adaptar B |
| --- | --- |
| Original | Azul/teal y acento lavanda; superficies más estables, ejemplo de radio de panel 20px frente a 28px actuales. |
| Cálido | Fondo crema, acento terracota y tacto suave. |
| AMOLED | Fondo negro y superficies oscuras; no sustituirlo por azul ni añadir sombras obligatorias. |
| Retro | Paleta cálida y tipografía/forma propias ya definidas. |
| Cristal | Transparencia característica; asegurar base legible detrás del texto y medir contraste sobre el fondo. |
| Nórdico | Claridad y tonos suaves, sin perder contraste de información secundaria. |
| Suizo | Jerarquía tipográfica fuerte y su identidad sobria. |
| Mediterráneo | Fondo claro y acentos existentes; revisión específica de contraste. |
| Monocromo | Selección distinguible mediante forma/contorno/texto, además del tono. |
| Brutalista | Colores vivos, bordes fuertes, radios y sombra característicos. No aplicar el radio del boceto Original. |

## Tipografía y densidad

Escala propuesta en CSS, relativa al tamaño base del usuario. Las cifras orientan el rol; no fuerzan todos los widgets a mostrar toda la información a la vez.

| Rol | Tamaño orientativo | Peso / línea |
| --- | --- | --- |
| Título de página | 1.75–2rem | 600, 1.2 |
| Título de panel/widget | 1–1.125rem | 600–700, 1.3 |
| Contenido y controles | 1rem | 400–600, 1.45 |
| Metadatos informativos | .875rem | 400–500, 1.4 |
| Hora/dato principal | Adaptativo al contenedor | Tabular; mantener unidades y segundos disponibles según configuración actual. |

Objetivo: evitar que datos necesarios dependan de .65rem. En tamaños pequeños se prioriza el resumen existente y se mantiene acceso al detalle o scroll interno. No quitar datos ni reducir fuentes hasta que todo quepa. Etiquetas largas ES/EN deben envolver cuando sea apropiado; los controles conservan nombre accesible completo. Ver texto al 200% y accesibilidad de cada flujo; los bocetos SVG no demuestran reflow de la app.

No se añade un selector de densidad: se mejora la adaptación actual por contenedor y orientación.

## Espaciado, forma y elevación

- Escala compartida propuesta: 4, 8, 12, 16, 20, 24 y 32 CSS px. Ajustes intermedios solo cuando los requiera una medición de contenido o área segura.
- Interior de widgets: 16–24px según espacio; 12px en los mínimos cuando haga falta conservar área útil. Separación de grupos: 16–24px; elementos de la misma fila: 8–12px. La matriz de widgets decidirá el valor real, no el aspecto del boceto ampliado.
- Separación de cuadrícula: conservar las restricciones y adaptación actuales; no cambiar `WidgetPosition` para crear más aire.
- Dock inferior compacto: **mantener 12px CSS debajo y encima según su altura medida, más área segura**, como en #71. Los SVG son aproximaciones visuales, no una medida de esa reserva.
- **Ajustes es la excepción:** viewport y scroll llegan hasta el borde inferior, detrás del dock; solo el final del documento reserva espacio suficiente para alcanzar el último control. Nunca reintroducir un corte horizontal delante del dock.
- Original B explora radio 20px de panel y 12px de control. Los radios se asignan por tema/rol, no por pantalla. Evitar tres radios distintos anidados dentro del mismo widget sin propósito.
- El fondo principal permanece continuo. Sin escala de widget, animación de tamaño, sombra pulsante de larga pulsación ni padding condicional al editar.

## Iconos y tacto

- Reutilizar `lucide-react` existente. Tamaño visible orientativo 20–24px y trazo consistente; icono y área de activación son medidas distintas.
- Conservar nombres accesibles traducidos y estados `aria-pressed`/`aria-expanded` donde correspondan. Iconos decorativos no duplican el nombre del control.
- Mantener como mínimo los controles de 44px ya introducidos en #71; objetivo de nuevos controles generales 48 × 48 CSS px si el espacio lo permite. Revisar separación y el tamaño físico real en WebView; **CSS px no equivale automáticamente a dp**. La recomendación Android de 48dp y el mínimo WCAG AA de 24 CSS px con excepciones son referencias distintas ([Android](https://developer.android.com/guide/topics/ui/accessibility/apps), [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- No agrandar indiscriminadamente cada celda/herramienta si tapa otro control. Los tiradores siguen dentro de la caja del widget y el indicador de tamaño fuera de su zona.
- El área completa de día/acción sigue siendo pulsable aunque se quite su borde decorativo. Nunca convertir una interacción táctil en algo que solo se reconoce al pasar el ratón.

## Estados y movimiento

| Estado | Presentación esperada | Restricción |
| --- | --- | --- |
| Reposo | Contenido, título y acción con prioridad estable. | No todo necesita fondo propio. |
| Pulsado | Cambio breve de fondo/brillo o borde. | No escalar widgets ni desplazar layout. |
| Seleccionado | Fondo/acento y texto/icono/contorno apropiado. | No depender solo del color. |
| Foco | Contorno visible de al menos 2px, separado cuando haya espacio. | No quedar oculto por recortes del contenedor. |
| Desactivado | Apariencia diferenciada y semántica nativa. | No simular una acción que se ejecuta sin permiso. |
| Carga | Mensaje/indicador asociado a la operación. | No bloquear todo el dashboard por una lectura de un módulo. |
| Guardado | Estado local real, discreto y legible. | No mostrar éxito antes de persistir ni cambiar la lógica para el diseño. |
| Vacío | Explicación breve y acción existente si procede. | No inventar contenido o funcionalidad. |
| Error / sin conexión | Qué sucede y recuperación disponible; distinguir caché de ausencia de datos. | Conservar mensajes y recuperación reales. |
| Edición | Mismas cajas, borde/indicador y controles existentes. | Cancelación, persistencia y gestos de #71 se mantienen. |

Movimiento: conservar inicialmente las transiciones validadas de #71. Solo ajustar tras identificar beneficio: respuesta de control 120–160ms y transición contextual 180–240ms como objetivos de diseño, sin animar layout, blur o fondo de forma continua. `prefers-reduced-motion` desactiva movimiento no esencial y scroll suave. No añadir una nueva librería de animación.

## Accesibilidad y aceptación

- Texto normal: contraste mínimo 4.5:1; texto grande según la definición WCAG: 3:1 ([WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)). Medir también texto secundario sobre superficies compuestas; una pareja de hexadecimales no valida los diez temas.
- Componentes y señales visuales necesarias: revisar contraste no textual de al menos 3:1 con colores adyacentes ([WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Mantener foco, orden de lectura, nombres/roles/estados y salida de diálogos/teclado. Una captura no acredita el funcionamiento con lector de pantalla.
- Probar texto aumentado sin pérdida de controles y reflow donde corresponda; los layouts que necesitan dos dimensiones se evalúan según la excepción aplicable, no como exención de toda la app ([WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).
- Ninguna afirmación de conformidad, mejora de velocidad o fluidez hasta medir y validar la implementación en la T65. La aprobación visual elige dirección y alcance; no autoriza fusionar, instalar o publicar.

## Registro de decisión

| Decisión | Estado |
| --- | --- |
| Dirección A/B/C | Pablo eligió B después de ver las tres propuestas: «vamos con la b». |
| Primera entrega B1 | Implementada en Inicio; pendiente de confirmación manual del resultado final. |
| Presentación del calendario de Inicio | Pablo eligió el ejemplo 1: hoy destacado y etiquetas con fondo suave del color de cada evento. Véase CALENDARIO-VARIANTE-1.md. |
| Pantallas posteriores B2/B3 | Evaluables por separado después de B1. |
| Cuadrícula, contratos y datos | Conservar. Ningún cambio autorizado. |
| Integración e instalación/publicación | Consentimiento independiente tras validación. |
