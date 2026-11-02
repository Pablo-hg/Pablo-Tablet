# Issue #28: análisis previo y preparación del desarrollo

Fecha de corte: 30/10/2026, Europe/Madrid. Preparación local; no es una auditoría completa ni una aceptación del asistente.

## 1. Conclusión para retomar

Existe un asistente local integrado y distribuido como parte de la aplicación. La implementación no satisface todavía todo el contrato funcional ni la arquitectura híbrida documentada. Hay defectos reproducidos además de validación física pendiente. No abordar #28 como una simple instalación o cierre administrativo.

En esta preparación solo se ha añadido documentación y un diagnóstico local fuera del código de producto. No se han cambiado funcionalidades, ramas, etiquetas, Issues, PR, versiones ni datos del dispositivo.

Modelo recomendado para la siguiente sesión: **GPT-6.1 Sol, razonamiento extra alto**, con acceso al checkout y pruebas. Esta recomendación se refiere al agente que revisará/desarrollará el proyecto; el proveedor del asistente que se ejecutará en la tablet requiere una decisión distinta.

## 2. Estado y referencias verificadas

| Elemento | Evidencia al corte |
| --- | --- |
| Repositorio canónico | `C:\Users\Pablo\Desktop\Pablo-Tablet` |
| Rama local analizada | `hotfix/33-tiempo-responsive` |
| HEAD | `8ad3f3d2f20df910b011b5cbbc3f673079916793` |
| `main` remoto, consultado por API | `48aa3abb6393fc152c6ccf5acb92f308a816206f` |
| `dev` remoto, consultado por API | `5e356fb623b9e0c1e181234bbd772be8f4b44b2e` |
| Referencias locales `origin/main`, `origin/dev` | Coinciden con esos SHA remotos al corte; no se ha ejecutado fetch |
| Divergencia HEAD frente a `origin/main` | 17 commits exclusivos de HEAD, 0 exclusivos de main |
| Rama local `dev` | Desfasada: 3 commits propios y 90 remotos; no resetearla ni partir de ella sin revisión |
| Última release publicada consultada por API | [v0.4.8](https://github.com/Pablo-hg/Pablo-Tablet/releases/tag/v0.4.8), publicada el 30/10/2026 a las 18:16:26 UTC |
| Commit del tag `v0.4.8`, resuelto por API | `01cbdb860e84a162a5fbb55e5fe18ba68399e133` |
| Estado inicial del checkout | Limpio antes de añadir este documento |
| Instalación y validación en la Teclast | No verificadas en esta preparación |

La pantalla, proveedor local, voz y plugin nativo existen en la versión del tag y en HEAD. La comparación de esos archivos frente al tag solo muestra dos campos de sonido añadidos al temporizador en `src/assistant/executor.ts`: `soundName` y `soundUri`. Conservar esta diferencia al escoger base; no incorporar todos los cambios de otra incidencia para recuperarla.

La incidencia antigua señala `feature/28-ai-assistant-mvp` y `e18175c`. No usar solo `git branch --contains e18175c` para decidir si falta integrar: el contenido puede haber llegado mediante squash o preparación de release. Comparar archivos y comportamiento.

Fuentes consultadas en GitHub durante esta conversación:

- [#28](https://github.com/Pablo-hg/Pablo-Tablet/issues/28): abierta, etiquetas `enhancement` e `IA`, sin comentarios. Marca gran parte de la implementación y automatización como hecha, con permisos/APK y prueba completa T65 pendientes. Su informe de 60 pruebas corresponde al 11/10, no a la ejecución de hoy.
- [#26](https://github.com/Pablo-hg/Pablo-Tablet/issues/26): cerrada; definición funcional en `ASISTENTE-IA.md`.
- [#27](https://github.com/Pablo-hg/Pablo-Tablet/issues/27): cerrada; quedan casillas sin marcar sobre voz en español y prototipo en tablet. Su cierre no acredita esas pruebas físicas.

## 3. Mapa de código para empezar

| Archivo | Responsabilidad y punto de revisión |
| --- | --- |
| `ASISTENTE-IA.md` | Contrato funcional: recordatorios, ambigüedad, tarjetas, privacidad, voz, accesibilidad y 3 × 4 |
| `ARQUITECTURA-ASISTENTE-IA.md` | ADR híbrido, relay, límites de confianza, idempotencia y cancelación |
| `src/assistant/contracts.ts:71` | Validación del comando y catálogo permitido |
| `src/assistant/provider.ts` | Interfaz sustituible; devuelve una propuesta, sin ejecutar |
| `src/assistant/localProvider.ts:57` | Proveedor realmente usado: expresiones y coincidencias locales |
| `src/assistant/prototype.ts:66` | Planificación y ejecución; contiene también un proveedor de prototipo distinto al real |
| `src/assistant/executor.ts:29` | Consultas y construcción del estado de notas, alarmas y temporizadores |
| `src/assistant/executor.ts:131` | Contenido exacto de las tarjetas de confirmación |
| `src/pages/AssistantPage.tsx:25` | Instancia fija del proveedor y límite por montaje de pantalla |
| `src/pages/AssistantPage.tsx:115` | Confirmar, editar y cancelar propuestas |
| `src/assistant/voice.ts:45` | Voz web/nativa, permisos, cancelación y TTS |
| `android/app/src/main/java/com/pablohorcajada/tablet/AssistantVoicePlugin.java` | `SpeechRecognizer`, resultados parciales, errores y destrucción |
| `src/App.tsx:914` | Ejecución sobre estado actual; actualiza ref y estado React |
| `src/App.tsx:1821` | Widget: acceso a la pantalla del asistente |
| `src/dashboardState.ts:245` | Valores iniciales y migración de preferencias |
| `src/pages/SettingsPage.tsx:148` | Activación, voz, lectura automática e información de datos |
| `src/hooks/useDashboardPersistence.ts` | Hidratación y persistencia; preservar protecciones de arranque |
| `src/hooks/useDeviceEffects.ts` | Reconciliación diferida de avisos tras cambiar el estado |
| `src/reminderNotifications.ts`, `src/notificationPermissions.ts` | Avisos reales y permisos; no confundir crear datos con programar con éxito |
| `src/calendarRecurrence.ts` | Resolver recurrencias de forma coherente con el calendario |
| `src/test/AssistantPage.test.tsx` | Dos pruebas de confirmación/cancelación del flujo sencillo |
| `src/test/assistantPrototype.test.ts` | Ocho pruebas del prototipo; no cubren exhaustivamente `LocalAssistantProvider` |
| `src/test/assistantExecutor.test.ts` | Cuatro pruebas del ejecutor |
| `src/test/App.navigation.test.tsx` | Navegación y configuración; no sustituye una prueba E2E de acciones |

Las líneas son orientativas del HEAD analizado y cambiarán durante el desarrollo.

## 4. Defectos y debilidades reproducidos

Se ejecutaron nueve pruebas de diagnóstico, con datos sintéticos y servicios de voz simulados. Cada prueba confirma el comportamiento **actual problemático**; que pasen no significa que el comportamiento sea correcto. El ejecutor real y el planificador reales se usan salvo donde se indica un mock.

| ID | Reproducción y resultado observado | Trabajo necesario |
| --- | --- | --- |
| F01 | `Guarda una nota: mirar el tiempo mañana` produce `get_weather`, sin propuesta de nota. Las coincidencias de consultas preceden al prefijo de creación. | Resolver intención explícita antes de analizar el contenido libre; cubrir también palabras como resumen/agenda en notas. |
| F02 | `Recuérdame llamar a Ana mañana a las seis`, ejemplo del contrato, se rechaza. Las notas del proveedor local siempre llevan `reminderAt: null`. | Implementar extracción de recordatorio y aclaración de fecha/hora o acotar formalmente el alcance; conservar aviso visible antes de confirmar. |
| F03 | `Pon una alarma a las 8` propone mañana a las 08:00 y los siete días de la semana. `Pon una alarma mañana a las ocho` se rechaza. | Resolver fecha, hora y repetición sin inventar recurrencia. El modelo `Alarm` actual guarda hora/días, sin fecha absoluta: revisar Reloj, normalización, persistencia y scheduler antes de prometer alarma única. |
| F04 | `Temporizador de 20 segundos` se valida como 20 s, pero la tarjeta muestra `Duración: 0 min`. | Mostrar duración precisa y hora final; usar los mismos valores en tarjeta, ejecución y respuesta. |
| F05 | El validador acepta `{ type: 'get_daily_summary', args: { date: '2026-02-30' }, extra: true }`. Devuelve el comando con la fecha inexistente y descarta `extra`. | Validación real de calendario y formato temporal; definir zona horaria, límites de intervalo y rechazo de campos extra también en raíz. No se ha demostrado ejecución arbitraria por este caso. |
| F06 | Un plan construido con `create_note` y `requiresConfirmation: false` llega al ejecutor sin confirmar. | Revalidar y derivar confirmación del comando en la frontera de ejecución. El planificador normal ya la deriva correctamente: es una debilidad de defensa interna, no un bypass demostrado desde el proveedor/UI actuales. |
| F07 | Una serie diaria con inicio 01/10 y consulta 30–31/10 no aparece en `get_calendar`; el resumen del 30/10 sí cuenta una ocurrencia. | Unificar resolución de ocurrencias, ordenar por instante y acotar resultados; revisar también calendarios visibles, tareas y eventos externos sincronizados. |
| F08 | Con `enabled=false` y `voiceEnabled=true`, pulsar el micrófono invoca el reconocimiento simulado. | Hacer efectivo el interruptor general en todas las entradas y al desactivar con trabajo pendiente; cubrir voz, lectura y propuestas. |
| F09 | Con ejecutor simulado que tarda en resolver, dos clics de Confirmar producen dos llamadas de escritura. | Bloqueo inmediato de ejecución, propuesta consumible una vez e idempotencia; prueba de reintento tras error. No se ha demostrado duplicación en hardware con el ejecutor actual rápido. |

Orden recomendado: asegurar ejecución/activación y fidelidad de tarjetas antes de ampliar la interpretación o conectar un proveedor remoto. La prioridad final debe ajustarse tras la auditoría completa.

## 5. Diferencias de alcance y comprobaciones pendientes

1. **Arquitectura híbrida:** `AssistantPage` instancia directamente `LocalAssistantProvider`. La búsqueda del repositorio no encontró adaptador remoto ni relay específico del asistente. Los relays existentes de calendario/feedback no acreditan esa pieza. El ADR prevé un relay autenticado; no marcarlo implementado por existir la interfaz `AssistantProvider`.
2. **Decisión de producto pendiente para el siguiente incremento:** confirmar si se endurece y completa primero el asistente local o si se desarrolla además la interpretación remota prevista. Propuesta de trabajo: corregir primero lo local y dejar la integración remota como fase diferenciada. No reescribir el contrato para ocultar carencias.
3. **Cancelación y ciclo de vida:** `cancelProcessing` aborta la interpretación, pero la ejecución no recibe señal y puede haber producido cambios. Los botones de propuesta permanecen activos durante la ejecución. Definir el momento de compromiso: antes, cancelar sin cambios; después, informar del resultado real sin prometer deshacer. Revisar desmontaje, respuesta tardía y rechazo de limpieza.
4. **Voz y privacidad:** el plugin solicita resultados parciales, pero el puente TypeScript no los expone a la pantalla. No se encontró selección explícita del reconocedor on-device. No dar por garantizado que el motor de dictado o TTS nunca use red a partir del texto `Modo local · sin enviar datos`; verificar motor y comportamiento en dispositivo.
5. **Parada de voz:** falta un control visible de detener TTS en la conversación. El botón Leer no captura errores. Revisar aborto antes/durante permisos, listeners web y parada al cerrar, bloquear o ir al fondo. El desmontaje actual llama a las promesas de parada sin capturar rechazos.
6. **Activación y retención:** el estado inicial habilita asistente y voz. El contrato pide activación tras explicación de datos. No se encontró preferencia de historial en la pantalla de Ajustes, aunque #28 la marca hecha. El historial activo vive en memoria de la pantalla. Resolver consentimiento para el proveedor efectivo y evitar borrar preferencias existentes al migrar.
7. **Cuota:** `30` es un límite local por montaje; se reinicia al cerrar/reabrir. No representa créditos, coste ni rate limiting remoto. Decidir si aporta valor local y distinguirlo de límites reales del relay si se incorpora.
8. **Datos y fuentes:** las respuestas meteorológicas no muestran `fetchedAt`, aunque existe en `WeatherForecast`; el contrato pide fuente/antigüedad. La agenda usa hoy/mañana fijos, filtra fechas base y toma los primeros cinco elementos sin ordenar. El resumen no incluye explícitamente los recordatorios recientes de notas.
9. **Edición y confirmación:** Editar petición vuelve al texto original, sin edición de campos de la tarjeta. Revisar todos los valores relevantes, repetición, avisos y caducidad. `submit` actualmente bloquea otra petición mientras hay propuesta, en lugar de invalidarla según el contrato.
10. **Notificaciones y persistencia:** el ejecutor añade datos y devuelve éxito; los efectos programan avisos después. Antes de confirmar alarmas/recordatorios/temporizadores, informar si faltan permisos o alarmas exactas. Probar persistencia y reinicio con el flujo nativo actual; no modificar protecciones de hidratación de #33.
11. **Navegación y diseño:** el log actual tiene `role=log` y ya no lleva `data-swipe-block`. No tratar como pendiente el antiguo arreglo de swipe basándose en notas históricas. Revisar el flujo actual, incluida cuadrícula 3 × 4, bloqueo durante interacción, teclado, escala, temas y orientación.

No se han actualizado precios ni elegido un modelo de inferencia para la tablet. Las cifras y modelos del ADR del 11/10 son referencias históricas: contrastarlos con documentación oficial antes de una integración real.

## 6. Validación realizada en esta preparación

| Comprobación | Resultado y límite |
| --- | --- |
| `npm test -- src/test/assistantPrototype.test.ts src/test/assistantExecutor.test.ts src/test/AssistantPage.test.tsx src/test/App.navigation.test.tsx` | **33/33**, cuatro archivos, 11,60 s. Sobre HEAD, sin modificar código. |
| Diagnóstico de F01–F09 | **9/9 observaciones reproducidas**, 3,41 s. No son nueve criterios de aceptación satisfechos. |
| `npm run lint` | Correcto. |
| Lectura de GitHub | Issues #26/#27/#28, SHA de main/dev, última release y commit del tag. |
| Web build, suite completa, Capacitor, Android/JVM/APK | No ejecutados en esta preparación. La evidencia antigua de #28 no se renueva por estos tests. |
| Navegador interactivo y hardware | No ejecutados. No se ha instalado por ADB ni utilizado la base de datos real. |

El primer arranque de Vitest falló por `spawn EPERM` al cargar Vite dentro del sandbox. El mismo comando, ejecutado en el entorno permitido, pasó. Se trata de una restricción de ejecución de esta sesión, no de un fallo demostrado de las pruebas del producto.

Se conserva el diagnóstico local en `output/playwright/issue-28/assistant-preflight.test.tsx.txt`, ruta ignorada por Git. Se renombró a `.txt` para que `npm test` no lo descubra como una suite de aceptación. No se publica ni forma parte del cambio de producto.

Para reproducirlo, desde el checkout canónico y sin sobrescribir un archivo ya existente:

```powershell
$probeSource = 'output/playwright/issue-28/assistant-preflight.test.tsx.txt'
$probeTest = 'output/playwright/issue-28/assistant-preflight.test.tsx'
if (Test-Path -LiteralPath $probeTest) { throw 'Ya existe la prueba temporal: revisarla antes de continuar.' }
Copy-Item -LiteralPath $probeSource -Destination $probeTest
try {
    npm test -- $probeTest
    if ($LASTEXITCODE -ne 0) { throw 'El diagnóstico no terminó correctamente.' }
} finally {
    Remove-Item -LiteralPath $probeTest
}
```

Al corregir cada defecto, escribir pruebas permanentes del comportamiento **deseado** en `src/test`. No copiar sin invertir expectativas estas observaciones del fallo.

## 7. Desarrollo por fases propuesto

### Fase A: auditoría y decisión del incremento

- Volver a leer este documento, Issue #28 y contratos; refrescar remotos y estado del checkout.
- Construir matriz completa de criterios: implementación, prueba automatizada, navegador, Android, release, instalación y aceptación física.
- Auditar proveedor real, validación, permisos, ejecución y persistencia. Añadir pruebas de caracterización/regresión que cubran huecos reales.
- Resolver alcance local/híbrido y representación de alarmas únicas. Si se requiere migración compartida con Reloj, detallar compatibilidad antes de cambiarla.
- Entregable: alcance concreto del incremento y defectos priorizados con reproducciones. El informe inicial de esta sesión no sustituye esa revisión.

### Fase B: ejecución segura y control del usuario

- Extraer orquestación de la página e inyectar proveedor/ejecutor para probar fallos y latencias sin red.
- Estados explícitos para entrada, dictado, interpretación, propuesta, ejecución, finalización y error; una sola operación activa.
- Validación final y confirmación derivada del tipo; propuesta identificada y consumible una vez, idempotencia de reintentos.
- Cancelación y desmontaje coherentes con el momento de escritura; rechazos controlados, resultados tardíos ignorados cuando proceda.
- Aplicar activación general a todas las entradas; mostrar limitaciones de notificaciones antes de confirmar y resultado real de guardado/programación.
- Pruebas mínimas: F06/F08/F09, doble clic, error y reintento, cancelar antes/después del compromiso, desmontar y desactivar durante operación.

### Fase C: capacidades locales correctas

- Corregir precedencia de intención y contenidos de notas (F01).
- Implementar recordatorios con aclaraciones de fecha/hora, sin inventar campos (F02/F05).
- Definir alarmas únicas y repetidas de extremo a extremo y coherencia con Reloj (F03).
- Mostrar segundos, minutos, hora final y repetición con fidelidad (F04).
- Consultar ocurrencias reales de agenda y fuentes del tiempo, reflejando fecha de actualización (F07).
- Pruebas en español/inglés y límites: palabras de consulta dentro de notas, fechas inexistentes, cambio de día, DST, segundos, máximos, ambigüedad y tipos desconocidos.

### Fase D: voz, interfaz y accesibilidad

- Probar puente y plugin de voz: permiso denegado/permanente, ausencia de motor, parcial/final, error, abortar antes de obtener permiso, llamadas concurrentes y lifecycle.
- Añadir parada visible de lectura, estados comprensibles y errores con alternativa manual.
- Hacer veraz la información sobre proveedor, audio, conexión e historial.
- Validar 3 × 4, teclado, orientación, escala, contraste y controles táctiles sin tocar datos reales.

### Fase E: integración remota, si forma parte del incremento acordado

- Consultar documentación oficial vigente antes de escribir la integración API. No reutilizar precios/modelos históricos sin verificarlos.
- Relay específico autenticado, TLS, secretos de proveedor fuera del APK, límites de tamaño/tiempo/uso y salida estructurada validada también en la tablet.
- Minimizar contexto: sin base completa, fotos, audio, credenciales móviles ni historial general; consentimiento específico para contenido de notas.
- Simular 401/403/429/5xx, timeout, JSON inválido y contenido que intenta ampliar herramientas o eliminar confirmación.
- Separar cuota remota del contador de pantalla; definir retención efectiva y degradación local.
- Despliegue y gasto requieren autorización concreta; esta preparación no los autoriza.

### Fase F: validación y entrega

1. Pruebas dirigidas y luego suite completa, lint y build de la rama final.
2. Sincronización Capacitor, Android Lint, JVM y ensamblado. Inspeccionar APK y tráfico con configuración de prueba sin volcar secretos.
3. Navegador real: voz simulada cuando falte soporte, éxito, cancelación, error, orientación, teclado y ausencia de red.
4. Preparar PR hacia `dev`, vinculado con `Refs #28`, cuando se autorice ese paso.
5. Publicación como paso separado con versión y selección expresas. Actualización en T65 mediante el flujo visible **Buscar actualizaciones**, nunca instalación por ADB.
6. Confirmación de Pablo y registro de pruebas físicas antes de marcar instalado o cerrar. No convertir compilación o publicación en aceptación física.

## 8. Rama y límites de actuación

- Trabajar en el checkout canónico. No crear worktrees externos por defecto ni tocar los ya existentes.
- No continuar implementación sobre `hotfix/33-tiempo-responsive`: contiene trabajo de otras incidencias.
- Para desarrollo nuevo, preparar `feat/28-asistente-integrado` o `fix/28-asistente-seguro` desde `dev` actualizado y verificado, según alcance. Seguir `FLUJO-DE-RAMAS-Y-VERSIONES.md`; evitar prefijo `codex/*`.
- Antes de cambiar de rama, conservar este documento y revisar cualquier cambio local ajeno. La rama local `dev` diverge: no usar reset/force push para resolverlo.
- No fusionar todo dev en main ni mezclar una release con la revisión de #28.
- No publicar comentarios, cambiar etiquetas, abrir/fusionar PR, crear tags, desplegar, instalar o cerrar incidencias durante una sesión autorizada solo para análisis/preparación.
- No hay autorización en esta preparación para proveedor de pago, infraestructura o cambios de producción.

## 9. Prompt de continuidad para la próxima sesión

> Continúa la preparación de la Issue #28 desde `docs/ISSUE-28-ANALISIS-Y-PLAN.md` en `C:\Users\Pablo\Desktop\Pablo-Tablet`. Usa GPT-6.1 Sol con razonamiento extra alto si está disponible. Realiza primero la auditoría profunda del estado actual: Issue #28 y dependencias #26/#27/#19, main/dev, release publicada, contrato funcional, ADR, proveedor realmente activo, ejecución/confirmación/cancelación, permisos, voz, persistencia y pruebas. Revalida F01–F09 y completa una matriz de aceptación con evidencias. Distingue carencias de código de validación pendiente y de instalación física. Propón el alcance local/híbrido y el tratamiento de alarmas únicas antes de iniciar su implementación. Conserva cuadrícula 3 × 4, compatibilidad de datos y módulos manuales. Revisa el estado del checkout y la divergencia de dev antes de preparar una rama feat/28-* o fix/28-*. No publiques, despliegues, instales ni cambies estados de GitHub con esta instrucción de auditoría. Si después autorizo el desarrollo, continúa con las fases de este documento y pruebas permanentes del comportamiento correcto.

## 10. Arranque rápido de verificación

```powershell
git status -sb
git remote -v
git branch -vv
git rev-parse HEAD origin/main origin/dev
git rev-list --left-right --count dev...origin/dev
npm test -- src/test/assistantPrototype.test.ts src/test/assistantExecutor.test.ts src/test/AssistantPage.test.tsx src/test/App.navigation.test.tsx
npm run lint
```

Refrescar GitHub y las referencias antes de dar por vigentes los SHA de esta nota. Para compilar una implementación posterior: `npm run build`, `npm run android:sync` y `android\gradlew.bat -p android lintDebug testDebugUnitTest assembleDebug`; revisar cambios generados de Capacitor antes de incluirlos en el commit. Ninguno de estos comandos acredita instalación o prueba física.
