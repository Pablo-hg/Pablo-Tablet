# Asistente de IA — alcance funcional y límites

> Estado: definición de producto para las issues #26, #27 y #28.
> Alcance: experiencia y reglas funcionales independientes del proveedor de IA.
> Fuera de este documento: elección de modelos, backend, voz y contrato técnico, que corresponden a #27.

## 1. Propósito y usuario principal

El **Asistente** es una capa transversal sobre Pablo Tablet. Su función es ayudar a consultar y utilizar notas, reloj, calendario, tiempo y ayuda local mediante lenguaje natural, sin sustituir las pantallas manuales ni convertirse en una aplicación de chat separada.

El usuario principal es Pablo, utilizando la Teclast T65 como panel doméstico. La experiencia debe resultar comprensible con poca atención, a cierta distancia de la pantalla y sin conocimientos técnicos. Los móviles autorizados para administrar la tablet no obtienen acceso automático al Asistente ni a sus conversaciones.

Principios de producto:

- la tablet continúa siendo útil cuando el Asistente, Internet o el proveedor no estén disponibles;
- voz y texto son dos entradas equivalentes; nunca habrá escucha permanente en el MVP;
- una respuesta de IA no modifica datos por sí sola;
- toda escritura se representa como un comando tipado, validado y confirmado visualmente;
- se envía el mínimo contexto necesario y no se guarda una conversación completa por defecto;
- el Asistente complementa la cuadrícula 3 × 4 y no añade filas ni altera su comportamiento.

## 2. Nombre y puntos de entrada

El nombre de producto inicial es **Asistente**. No se utilizará una personalidad humana ni una palabra de activación en el MVP.

Puntos de entrada:

1. Widget configurable **Asistente** dentro del catálogo actual del dashboard. Ocupa celdas existentes y se coloca con el mismo editor que el resto de widgets.
2. Pantalla del Asistente al tocar el widget, con campo de texto, botón de micrófono, cancelar y cerrar.
3. Accesos contextuales futuros desde Notas, Reloj, Calendario y Tiempo, siempre abriendo la misma pantalla con el contexto visible y editable antes de enviarlo.

No habrá un micrófono flotante permanente, grabación en segundo plano ni apertura automática de la conversación.

## 3. Cinco casos de uso prioritarios

### 3.1 Resumen del día

Ejemplos: «¿Qué tengo hoy?» o «Dame el resumen de esta mañana».

Flujo:

1. El usuario abre el Asistente y escribe o dicta la petición.
2. La aplicación reúne localmente la fecha, próximos eventos y tareas, alarmas relevantes y la última previsión de Casa.
3. Antes de usar un servicio remoto, reduce el contexto a los campos necesarios y excluye notas, fotos y credenciales.
4. Muestra un resumen breve con enlaces a Calendario, Reloj y Tiempo.
5. Si no hay conexión, compone una versión local con los datos disponibles e indica qué información puede estar desactualizada.

Es una consulta de solo lectura y no requiere confirmación.

### 3.2 Consultar agenda o tiempo

Ejemplos: «¿A qué hora es mi próxima cita?» o «¿Va a llover esta tarde en Casa?».

Flujo:

1. La petición se clasifica como consulta de agenda o meteorología.
2. La aplicación consulta únicamente el módulo relacionado.
3. La respuesta muestra la fuente y la fecha de actualización cuando utilice previsiones almacenadas.
4. Un botón permite abrir la pantalla original para comprobar o editar los datos manualmente.
5. Si la pregunta es ambigua, se solicita una aclaración sin ejecutar ninguna acción.

Es una consulta de solo lectura y no requiere confirmación.

### 3.3 Crear una nota o recordatorio

Ejemplos: «Guarda una nota: comprar pilas» o «Recuérdame llamar a Ana mañana a las seis».

Flujo:

1. El Asistente extrae título, contenido y, si existe, fecha y hora del recordatorio.
2. Valida fechas, zona horaria, longitud y campos obligatorios.
3. Presenta una tarjeta **Crear nota** con todos los valores editables.
4. Solo al pulsar **Confirmar** se crea la nota y se programa su aviso.
5. **Cancelar** cierra la propuesta sin cambios; un error conserva el borrador para reintentar manualmente.

Crear, editar, archivar o eliminar notas siempre requiere confirmación explícita.

### 3.4 Crear una alarma o un temporizador

Ejemplos: «Pon una alarma mañana a las ocho» o «Temporizador de veinte minutos».

Flujo:

1. El Asistente distingue alarma absoluta de temporizador relativo.
2. Resuelve fecha, hora, duración, repetición y etiqueta; nunca presupone AM/PM ante una ambigüedad.
3. Muestra una tarjeta **Crear alarma** o **Iniciar temporizador** con la hora final calculada.
4. Solicita confirmación y comprueba los permisos de notificaciones necesarios.
5. Tras confirmar, ejecuta la acción mediante el módulo Reloj y ofrece abrirlo.

Crear, modificar, activar, desactivar o eliminar alarmas y temporizadores requiere confirmación explícita.

### 3.5 Ayuda contextual y lectura accesible

Ejemplos: «¿Cómo cambio el brillo?» o «Léeme este resumen».

Flujo:

1. La ayuda se busca primero en contenido local controlado y versionado con la aplicación.
2. La respuesta ofrece instrucciones breves y un acceso a la pantalla correspondiente.
3. La lectura en voz alta solo empieza tras pulsar **Leer** o pedirla expresamente.
4. El usuario puede pausar o detener la lectura en cualquier momento.
5. Si no existe una respuesta fiable, el Asistente lo indica y no inventa pasos ni cambia ajustes.

La lectura y la navegación no requieren confirmación. Cualquier cambio de ajuste queda fuera del MVP inicial y, si se incorpora después, deberá confirmarse.

## 4. Permisos y confirmaciones

| Capacidad | Datos consultados | Permiso o consentimiento | Confirmación antes de ejecutar |
| --- | --- | --- | --- |
| Abrir y escribir en el Asistente | Texto introducido | Ninguno | No |
| Dictado | Audio mientras se mantiene la interacción activa | Micrófono, solicitado tras pulsar el botón | No, porque aún no modifica datos |
| Lectura en voz alta | Respuesta visible | Preferencia de voz; sin micrófono | No; requiere petición o botón **Leer** |
| Resumen diario | Agenda local, alarmas y previsión de Casa | Asistente activado y política de datos aceptada | No, solo lectura |
| Consultar agenda o tiempo | Solo el módulo solicitado | Asistente activado | No, solo lectura |
| Consultar contenido de notas | Metadatos o notas seleccionadas | Consentimiento específico antes de enviar contenido a la nube | No, solo lectura |
| Crear o editar nota/recordatorio | Campos mostrados en la tarjeta | Permiso de notificaciones cuando corresponda | Sí, siempre |
| Crear o editar alarma/temporizador | Campos mostrados en la tarjeta | Permiso de notificaciones cuando corresponda | Sí, siempre |
| Borrar, archivar o desactivar datos | Elemento identificado | Ninguno adicional | Sí, siempre, mostrando el efecto |
| Cambiar ajustes del dispositivo | Ajuste y valor propuestos | Permiso nativo si corresponde | Fuera del MVP; siempre requerirá confirmación |
| Analizar fotos o buscar por su contenido | Imágenes de la galería | No permitido inicialmente | Fuera del MVP |

Una confirmación válida debe mostrar la acción, el destino y todos los valores relevantes. Respuestas como «sí» solo se aceptan mientras haya una única tarjeta pendiente y visible. La propuesta caduca al cerrar la pantalla, cancelar o iniciar otra petición.

## 5. Privacidad, minimización y retención

Política inicial:

- el Asistente está desactivado hasta que el usuario acepta una explicación breve sobre conexión y tratamiento de datos;
- la aplicación no almacena el historial completo de conversación por defecto;
- la conversación activa vive únicamente durante la sesión y se elimina al cerrarla o reiniciar la aplicación;
- las acciones confirmadas persisten únicamente como los datos normales del módulo de destino;
- no se envían fotografías, base de datos completa, identificadores del dispositivo, credenciales de administración móvil, tokens, claves ni datos de firma;
- las notas no se incluyen como contexto general. Para consultar su contenido se seleccionan localmente las candidatas y se solicita consentimiento antes de compartir el fragmento mínimo;
- el audio se captura solo mientras la interfaz muestra el estado de grabación. No se conserva audio en la tablet tras obtener la transcripción;
- cualquier retención del proveedor deberá mostrarse antes de activarlo y poder revisarse en Ajustes;
- los diagnósticos no contienen texto, audio ni respuestas. Un futuro registro opcional podrá guardar solo fecha, tipo de intención, duración, resultado y código de error, con un máximo inicial de siete días.

Antes de enviar una petición remota, la interfaz indicará de forma comprensible que necesita Internet. Ajustes mostrará si el procesamiento es local o remoto, el proveedor activo y un enlace a su política de datos.

## 6. Funciones locales, remotas y modo degradado

| Situación | Comportamiento |
| --- | --- |
| Todo disponible | Interpreta texto o voz, presenta respuesta o comando validado y permite confirmar acciones. |
| Sin Internet | Mantiene todos los módulos manuales. Ofrece ayuda local, datos guardados y resumen determinista; indica que la interpretación avanzada no está disponible. |
| Proveedor no disponible o límite agotado | No reintenta indefinidamente ni bloquea la app. Conserva el texto para copiar o reintentar y ofrece abrir el módulo manual. |
| Sin permiso de micrófono | Mantiene la entrada de texto y explica cómo habilitar el permiso; no vuelve a solicitarlo en bucle. |
| Sin permiso de notificaciones | Puede preparar la acción, pero advierte antes de confirmar que el aviso del sistema no está garantizado. |
| Respuesta ambigua o inválida | No ejecuta nada. Solicita una aclaración o muestra los campos que faltan. |

La #27 decidirá qué intenciones pueden resolverse de forma determinista sin proveedor. El requisito funcional es que el fallo del Asistente nunca degrade las funciones manuales existentes.

## 7. Sugerencias proactivas

Las sugerencias están desactivadas por defecto. Si el usuario las activa:

- como máximo se muestra una tarjeta proactiva al día;
- no se reproduce voz ni se abre una pantalla automáticamente;
- se respetan las horas de modo nocturno y no se muestran entre las 22:30 y las 07:00;
- solo pueden resumir datos ya visibles, avisar de un conflicto claro o proponer abrir un módulo;
- no crean, modifican ni eliminan datos;
- cada tarjeta puede descartarse y permite desactivar futuras sugerencias.

Las automatizaciones, recomendaciones sensibles y aprendizaje de hábitos quedan aplazados.

## 8. Accesibilidad y lenguaje

- controles táctiles de al menos 48 × 48 dp;
- contraste compatible con los temas y estados comprensibles sin depender solo del color;
- texto escalable, líneas breves y español sencillo, evitando jerga técnica;
- transcripción siempre visible durante y después del dictado;
- ninguna función depende exclusivamente de voz, sonido, gesto o animación;
- estados claros: escuchando, procesando, esperando confirmación, ejecutando, completado y error;
- botones explícitos **Confirmar**, **Editar** y **Cancelar** en las tarjetas de acción;
- posibilidad de detener inmediatamente grabación, procesamiento o lectura;
- errores con una alternativa manual concreta.

## 9. Alcance del primer incremento

Incluido:

- widget y pantalla **Asistente** compatibles con la cuadrícula 3 × 4;
- entrada de texto y voz bajo demanda, si #27 valida la opción técnica;
- resumen diario;
- consultas de agenda y tiempo;
- creación confirmada de notas, recordatorios, alarmas y temporizadores;
- ayuda local y lectura en voz alta;
- interruptor general, información de privacidad y estado de conexión;
- modo degradado, cancelación y errores recuperables.

Aplazado:

- escucha permanente o palabra de activación;
- cambios autónomos o confirmaciones implícitas;
- acceso general a todas las notas o fotografías;
- búsqueda semántica de galería;
- control directo de ajustes del dispositivo;
- sugerencias complejas basadas en hábitos;
- historial sincronizado o memoria personal persistente;
- calendario externo hasta que avance la #19;
- consejo médico, emergencias, compras, autenticación o decisiones sensibles;
- acceso desde la administración móvil.

## 10. Decisiones para arquitectura e implementación

La #27 debe convertir estas reglas en una arquitectura con proveedor intercambiable, secretos fuera del APK, comandos tipados y pruebas con proveedor simulado. La #28 debe implementar únicamente las capacidades incluidas y tratar este documento como contrato funcional.

Antes de considerar instalado el Asistente deberán verificarse en navegador, Android y Teclast T65: texto, voz, permisos, confirmación, cancelación, falta de red, ausencia de secretos, accesibilidad y conservación de la cuadrícula 3 × 4.
