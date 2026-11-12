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
