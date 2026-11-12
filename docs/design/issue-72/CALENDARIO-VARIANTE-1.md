# Calendario de Inicio — Etiquetas suaves

Fecha: 10/11/2026. Rama `feat/72-evolucion-visual`, base de producto `02d1d7280de4c9ec3870bdc448c2ade2c05a1824`, sobre los cambios locales de B1.

## Elección y alcance

Pablo eligió **«la 1º»** después de ver los tres ejemplos. Se aplica esa variante al **widget de calendario de Inicio**, incluyendo próximos eventos y festivos. La pantalla completa de Calendario y los otros módulos siguen pendientes de sus entregas; no se cambia la cuadrícula ni se escribe un layout nuevo.

## Cambios

- Hoy conserva el círculo del número y recupera fondo y borde de toda la celda en los temas de lectura clara. Se añade `aria-current="date"`. La etiqueta visual Hoy/Today aparece cuando hay espacio suficiente; no se superpone al número en los mínimos. Brutalista mantiene su selección y contornos propios.
- Las etiquetas del mes recuperan fondos suaves y marca lateral con el color del evento. Azul, verde, coral y amarillo conservan sus tonos independientemente del acento del tema. El texto usa el color de lectura del tema para mantener legibilidad en fondos claros.
- Próximos eventos/festivos usan filas con fondo suave del color correspondiente en los temas de lectura clara; Brutalista mantiene su caja y borde propios. Título de evento a .8125rem (13px con base 16px), menor que la cabecera; fecha a .75rem.
- Etiquetas del mes a .6875rem donde caben; se conservan los resúmenes por puntos y la ocultación de etiquetas de los tamaños mínimos anteriores. Las áreas pulsables siguen siendo las celdas completas y las filas de agenda.
- En espacio compacto se muestra un evento y `+N`. Cuando hay exactamente dos, un widget de área suficiente y contenedor grande puede mostrar los dos sin contador. Con tres o más se mantiene una etiqueta y el contador del resto, como en el ejemplo elegido. Se reserva espacio interior para el contador sin modificar los límites de la celda o del widget.
- El contador ES/EN se calcula sobre el resumen existente de cada día, después de agrupar las entradas nativas; no altera eventos, recurrencias, estados ni persistencia. Pulsarlo sigue abriendo el día mediante el botón existente.
- Se mantienen las señales de completado/pasado, los títulos completos de las etiquetas y la protección del scroll de la agenda de B1.

Archivos: `src/dashboardVisual.css`, marcado del widget en `src/App.tsx` y dos traducciones de contador en `src/i18n/translations.ts`. No cambian dependencias, servicios Android, `widgetLayout.ts` ni contratos de datos.

## Comprobaciones

- Prueba focalizada del widget: siete escenarios correctos. Tres nuevos casos comprueban cuatro eventos, contador `+3`, un único día actual, conservación de las cuatro entradas y navegación desde el contador, en 1×2/2×3 y ES/EN. Se clona el estado de prueba completo para no modificar los defaults compartidos.
- Suite completa: **41 archivos, 245 pruebas web correctas**. Lint web correcto, con cuatro avisos de refs previos de `CalendarConnectionsPanel.tsx`.
- Build TypeScript/web, sincronización Capacitor, ensamblado y comprobación de identidad del APK DEV correctos.
- Android Lint y pruebas nativas correctos: **0 errores de lint, 29 avisos, 43 pruebas sin fallos, errores u omisiones**. Se repitieron en secuencia después de terminar el build: la primera ejecución solapada con la sincronización Capacitor perdió metadatos de lint generados del plugin Cordova.
- Comprobación matemática de texto principal sobre los cuatro colores, mezclados al 16%/18% con panel opaco: contraste mínimo 8.91:1 en Original y 13.70:1 en Cálido. Esto no acredita las superficies compuestas de Cristal ni todos los estados/temas.
- Estas pruebas DOM no miden el layout, el tamaño táctil ni los colores renderizados; la validación física sigue siendo independiente.

## Dispositivo y revisión física

Al intentar abrir DEV antes de actualizar, Android devolvió el código 101. La consulta de solo lectura confirmó que la aplicación enfocada era **la estable** `com.pablohorcajada.tablet`, con `mLockTaskModeState=PINNED`. No se ha desactivado la fijación ni se ha detenido la app estable.

La captura `output/playwright/issue72-b1/calendar-before-choice1.png` muestra esa app estable y **no sirve como referencia del antes de DEV**. La referencia histórica de B1 es `final-home-es.png`, del incremento anterior; tenía otro tema y distribución, por lo que no constituye una comparación controlada de esta variante.

Se preguntó a Pablo si prefería salir él de la aplicación fijada para revisar DEV o dejar DEV actualizada y probarla después. Posteriormente confirmó «ya estoy dentro de table dev»; se verificó el foco de `com.pablohorcajada.tablet.debug` antes de continuar.

La instalación protegida ya terminó con `Success`: **Pablo Tablet DEV 0.5.2-dev**, paquete `com.pablohorcajada.tablet.debug`. SHA-256 del APK final: `ae4ff12ddc9f1122131e0eaf716448039fc38d90b0c71a852bceba6a39fd9d49`. El instalador comprobó que la estable 0.5.2 conserva sus fechas de instalación/actualización de `2026-11-10 12:38:31`. No se intentó saltar la fijación ni se relanzó DEV después de conocer ese bloqueo.

### Revisión física después de abrir DEV

Teclast T65, horizontal, captura física 1920 × 1200, ES, tema Cristal y distribución existente del usuario. Se conservaron calendario 2 × 3, reloj 2 × 1 y tiempo/notas 1 × 2, sin cambiar preferencias ni contenido.

- `calendar-choice1-dev.png`: hoy conserva círculo, fondo y borde; las etiquetas y las dos tarjetas de próximos festivos mantienen su verde. No hay próximos eventos ordinarios en los datos disponibles.
- `calendar-choice1-edit-verified.png`: entrada en edición mediante pulsación larga del reloj; cajas de los cuatro widgets en las mismas posiciones y dimensiones, con tiradores interiores y fondo continuo. Se salió con Listo sin arrastrar ni redimensionar.
- `calendar-choice1-restored.png`: después de salir de edición y un gesto vertical sobre la agenda, Inicio sigue activo y la distribución se conserva. Las dos tarjetas caben: esto no acredita el recorrido de una lista extensa.
- `calendar-choice1-open-day.png`: pulsar Día de la Constitución abre la vista por horas del domingo 6 de diciembre y muestra el festivo correcto.
- `calendar-choice1-final.png`: vuelta a Inicio, con Cristal y la distribución del usuario conservados.

Las capturas se guardan localmente en `output/playwright/issue72-b1/`, excluido de Git. Durante la comprobación se reactivó la pantalla y se descartó el salvapantallas; no se cambiaron ajustes de bloqueo o reposo.

Pendiente: valoración visual/táctil del usuario, contador con varios eventos reales y tamaños pequeños, agenda extensa y matriz restante de temas, idiomas y orientaciones de #72. El contador tiene cobertura automatizada, no evidencia física con los datos actuales. No cerrar la issue por este incremento.
