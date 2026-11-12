# Evaluación de utilidad de Lumi en Dev

Alcance acordado con el usuario el 12/11/2026: avanzar hasta evaluar consultas de datos locales, acciones confirmadas y comodidad frente a los menús. Se empieza por el intérprete local existente para medir el flujo. Esto no valida Gemini ni representa conversación generativa. Sin búsquedas web nuevas. La rama de desarrollo no se ha publicado, fusionado ni instalado.

## Entrega inicial

- Reutilizar consulta de agenda, notas y reloj, creación de notas y temporizadores de #28.
- Añadir `create_task` local con fecha, título y zona horaria validados; propuesta con destino explícito, todo el día y sin avisos. Confirmar o cancelar antes de guardar. El contrato no admite cuentas externas.
- Frases admitidas: «Crea una tarea para mañana: comprar pilas», «Añade una tarea para hoy: llamar al taller», «Crea una tarea para 2026-12-01: revisar el coche». También `Create a task for tomorrow: buy batteries`. Si falta fecha o título, pedir una nueva petición completa; no interpretar fechas ambiguas ni prometer comprensión libre.
- Añadir «¿Qué tengo mañana?» como consulta directa; reutilizar fechas y consultas de agenda existentes. La sugerencia de crear tarea queda visible en la conversación vacía.

## Prueba física pendiente

Usar datos ficticios en Dev. No instalar APK sin autorización. Hacer cada escenario mediante Lumi y mediante los menús, con el mismo estado inicial; alternar el orden para reducir el efecto del aprendizaje. Medir segundos y toques desde la misma pantalla, registrar errores y anotar si hubo que aprender una frase rígida. No registrar el contenido de datos privados.

| Escenario | Resultado esperado | Lumi: tiempo/toques/errores | Menús: tiempo/toques/errores | Preferencia |
|---|---|---|---|---|
| Consultar qué hay mañana | Coincide con Calendario | Pendiente | Pendiente | Pendiente |
| Crear una tarea para mañana y consultarla | Propuesta correcta; una tarea tras confirmar | Pendiente | Pendiente | Pendiente |
| Cancelar la creación de una tarea | Ningún dato nuevo | Pendiente | Pendiente | Pendiente |
| Crear una nota breve | Confirmación y nota en Notas | Pendiente | Pendiente | Pendiente |
| Iniciar un temporizador | Duración revisable; resultado visible en Reloj | Pendiente | Pendiente | Pendiente |

Además: reiniciar Dev y comprobar persistencia; doble toque de confirmación; petición incompleta; probar sin red y con Lumi desactivada desde Ajustes. La voz existente es opcional y su procesamiento offline no se garantiza. Gemini y su consentimiento/cuotas todavía no están implementados.

## Decisión después de probar

Continuar solo si las consultas son correctas, ninguna acción se ejecuta sin confirmación y el usuario aprecia ahorro de pasos o esfuerzo en escenarios repetidos. La medición humana de comodidad no se da por superada con tests automatizados. Si el flujo local resulta útil pero las frases rígidas molestan, esa evidencia ayudará a decidir si compensa añadir el motor conversacional; si no aporta utilidad, pausar Lumi.

## Evidencia automatizada

`src/test/localAssistantPilot.test.ts` ejercita interpretación → validación → confirmación → ejecución → guardado y carga con las funciones reales de almacenamiento → consulta; bloquea duplicados del mismo plan y comprueba ausencia de llamadas fetch en ese flujo. También cubre fecha inválida, título largo, fecha ambigua, inglés y rechazo de destinos externos. `AssistantPage.test.tsx` cubre revisión, cancelación y doble confirmación desde la UI. No son pruebas reales de Android ni sustituyen comprobar el guardado desde la aplicación completa.

Validación del 12/11/2026: suite completa con `npm test -- --maxWorkers=2`: 44 archivos y 263 pruebas aprobadas con Node 22.13.0. Compilación web correcta; lint sin errores y con avisos existentes en CalendarConnectionsPanel. La ejecución con paralelismo por defecto agotó el tiempo del test de apariencias ya observado en la base; se redujeron los procesos sin modificar los límites de tiempo de los tests. Capacitor sync correcto. La prueba física y la comparación de comodidad siguen pendientes.

APK Dev compilada correctamente con `npm run android:dev:build`: paquete verificado `com.pablohorcajada.tablet.debug`, versión `0.5.2-dev`, etiqueta `Pablo Tablet DEV`. Artefacto: `android/app/build/outputs/apk/debug/app-debug.apk`. El primer intento quedó bloqueado por permisos de la caché de Gradle; el reintento con acceso a esa caché completó la compilación. No instalada. No se ha publicado ningún artefacto.

Seguimiento por voz (12/11/2026): el usuario confirma que el flujo escrito funciona en la tablet y pide priorizar voz. Se admite «Crea una tarea para mañana comprar pilas» sin puntuación. En el flujo de voz de la ventana flotante se leen título, fecha y destino antes de escuchar «confirmar» o «cancelar». Pruebas automatizadas relacionadas: 22 aprobadas (contrato local, UI y adaptador de voz); incluyen dictado, lectura de datos y confirmación hablada simulados. La prueba real de voz y su comodidad siguen pendientes. Usar Ajustes → Asistente → Entrada por voz y el botón flotante; el servicio de reconocimiento Android puede requerir red, no se afirma procesamiento offline.

## Aclaración de hora y recordatorios de tareas

Añadido el 12/11/2026. «Recuérdame el próximo viernes que vaya a comprar pilas» inicia una propuesta sin guardar nada. Lumi pregunta la hora; «a las siete» exige otra aclaración («por la mañana o por la tarde»). Una hora explícita como «19:00» o «siete de la tarde» permite mostrar fecha, título, hora y aviso 30 minutos antes. Se guarda únicamente tras confirmar. Se puede decir «cancelar» durante las preguntas. El contexto es temporal y se descarta al ocultar o desactivar Lumi. Para esta primera versión se admiten hoy, mañana, pasado mañana, fecha ISO o día de la semana; un día de semana significa su siguiente aparición estrictamente futura. No se afirma comprensión libre de cualquier expresión temporal.

La operación tipada `create_task_reminder` genera una tarea local con hora y un recordatorio en el formato del calendario existente. La programación de notificaciones reutiliza `syncCalendarEventNotifications`; no requiere servicios externos. Se comprueban los permisos disponibles y se informa si Android puede impedir o retrasar los avisos. Un aviso ya pasado bloquea la operación. Las notificaciones siguen usando el calendario civil de la tablet como el módulo actual.

Validación automatizada: suite completa de 48 archivos / 292 pruebas aprobadas con dos procesos; incluye diálogo de voz simulado, aclaración de mañana/tarde, cancelación, confirmación, persistencia/recarga, bloqueo de duplicados, aviso del día anterior y llamada al planificador nativo simulado a las 18:30 para una tarea de las 19:00. Compilación web/Capacitor/APK Dev correcta. La recepción real de la notificación y la calidad del reconocimiento en la T65 siguen pendientes de prueba física.
