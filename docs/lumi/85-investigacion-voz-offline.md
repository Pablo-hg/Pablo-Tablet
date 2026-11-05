# Lumi · Issue #85 — estudio inicial de voz local multidispositivo

**Fecha:** 05/11/2026 · **Estado:** investigación bibliográfica iniciada; **sin benchmarks de hardware ni motores elegidos**.  
**Rama experimental:** `research/85-lumi-voz-multidispositivo`.  
**Referencias:** [issue #85](https://github.com/Pablo-hg/Pablo-Tablet/issues/85) · [épica #92](https://github.com/Pablo-hg/Pablo-Tablet/issues/92).

## 1. Objetivo y límites
- Un solo launcher Android; **no** vincular requisitos globales a la Teclast T65.
- La T65 (T7280; variante 6 GB RAM física, 128 GB de almacenamiento) es **objetivo de rendimiento de referencia**, no mínimo de instalación.
- Lumi por texto debe funcionar en dispositivos compatibles con el launcher aunque no puedan ejecutar voz neuronal.
- Selección de STT y TTS **independiente**: niveles texto / voz ligera / voz avanzada, con degradación y sin instalación automática de modelos.
- Voz y comandos locales no envían audio/texto a la nube; la descarga inicial de modelos sí puede requerir internet.
- Esta rama añade **documentación y herramientas para reportar mediciones**; no modifica la app ni integra SDKs de voz.

## 2. Inventario técnico comprobado en fuentes
| Opción | Uso | Soporte/documentación contrastada | Riesgo o pregunta antes de elegir |
|---|---|---|---|
| whisper.cpp | STT offline | Ejemplo Android, inferencia CPU, cuantización, soporte en C/C++ | Latencia y RAM de tiny/base multilingüe en T7280; licencia concreta de pesos y variantes |
| sherpa-onnx | STT/TTS offline | Android arm64/arm32/x86, ASR streaming y no streaming, TTS | Modelo ES/EN concreto, soporte de Piper/VITS, tamaños/licencias |
| MediaPipe TTS + Kokoro-82M | TTS neuronal | Bundle LiteRT-LM ~295 MB, voces `es` y `en-GB`, guía Android con `minSdk 26` y `arm64-v8a` | Launcher minSdk 24: **NO elevar requisito global**; rendimiento GPU/CPU y acento es-ES no demostrados |
| Piper vía sherpa-onnx | TTS neuronal ligero a evaluar | Catálogo de voces con identificadores `es_ES` y `en_GB`; tarjetas de licencia por voz | Calidad por voz, permisos de redistribución y rendimiento en tablet |

**Dato del proyecto:** `android/variables.gradle`: `minSdkVersion = 24`, `targetSdkVersion = 36`.  
**Diferencia relevante:** MediaPipe Android TTS documenta mínimo API 26 y ARM64. **No intentar incluirlo indiscriminadamente** en el módulo base antes de comprobar empaquetado opcional y restricciones del manifiesto/Gradle.

### Fuentes primarias a mantener versionadas
1. Teclast T65: https://teclast.jp/T/T65
2. sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx
3. whisper.cpp: https://github.com/ggml-org/whisper.cpp ; ejemplo https://github.com/ggml-org/whisper.cpp/tree/master/examples/whisper.android
4. MediaPipe Android TTS: https://developers.google.com/edge/mediapipe/solutions/audio/text_to_speech/android
5. Bundle Kokoro y voces: https://developers.google.com/edge/mediapipe/solutions/audio/text_to_speech/index ; https://huggingface.co/litert-community/Kokoro-82M
6. Voces Piper: https://github.com/rhasspy/piper/blob/master/VOICES.md

**Nota de licencias:** licencia de runtime ≠ licencia de los pesos ≠ licencia de una voz/fonemizador. Revisar y conservar evidencias del identificador exacto antes de redistribuir.

## 3. Perfiles objetivo, a confirmar con dispositivos reales
| Perfil | Propósito | Hipótesis de compatibilidad |
|---|---|---|
| Android API 24–25 | Proteger el mínimo de instalación del launcher | Lumi texto; voz solo con motor que lo soporte |
| ARM64, 4 GB RAM física | Tablet económica | Explorar STT/TTS ligero; **no prometer** |
| Teclast T65, T7280, 6 GB física | Referencia principal | Medir voz ligera y avanzada, frío/caliente |
| ARM64 más potente | Escalado | Verificar beneficios de modelos avanzados |
| Chrome/Web | Paridad de interfaz | No asumir que las Web Speech APIs son offline |

No usar RAM virtual/publicitaria para decidir soporte; consultar RAM física, memoria libre/umbral low-memory y probar inferencia real. Medir CPU, delegados GPU, almacenamiento libre y calentamiento. **Un perfil compatible no sustituye pruebas de motor/modelo**.

## 4. Protocolo de benchmark
1. Anotar fabricante/modelo, Android API, ABI, RAM real/libre, SoC, batería, estado de carga, micrófono y fecha.
2. Fijar versiones y huellas de motor/modelos/voces; descargar por Wi-Fi solo para la preparación.
3. Usar **el mismo conjunto de frases grabadas** en 16 kHz mono PCM o el formato que exija el motor, sin añadir datos privados reales.
4. Ejecutar cada combinación en arranque frío y caliente, **≥10 repeticiones por condición**, medir:
   - `loadMs`: creación/inicialización del motor desde estado declarado.
   - `latencyMs`: transcripción desde **fin del audio** hasta texto final (solo STT).
   - `firstAudioMs`: desde invocar TTS hasta primer fragmento reproducible (solo TTS).
   - `totalAudioMs`: síntesis completa de la misma frase (solo TTS).
   - `peakRssMiB`: pico de memoria del proceso en la condición, si se puede medir.
5. Estimar WER de STT sobre la transcripción humana de referencia; anotar pronunciación/calidad percibida de TTS, no dar una nota automática a voces.
6. Repetir con ruido de cocina, distancias cercanas/lejos, interrupciones, rotación e interacciones sucesivas. Medir temperatura y estabilidad.
7. Activar **modo avión** después de preparar los modelos. Probar ausencia de acceso a red; registrar si hay adaptadores del sistema que recurren a un proveedor remoto.
8. Calcular mediana/p95 de cada magnitud; **p95 por nearest-rank**. No comparar métricas de dispositivos diferentes como si fueran equivalentes.
9. Informe por modelo/ABI/API/idioma con estado **sin medir / pruebas incompletas / aprobado / descartado**; documentar errores y capturas de log sin audio privado.

**Umbrales provisionales a debatir antes de #86:** transcripción de orden corta en ≤3 s tras terminar de hablar y primer fragmento TTS en ≤1,5 s (mediana). No se conocen todavía p95 ni límites de RAM/temperatura aceptables.

### Ejemplos de frases de prueba (NO datos del usuario)
| ID | Idioma | Referencia |
|---|---|---|
| es-01 | es-ES | ¿Qué eventos tengo esta semana? |
| es-02 | es-ES | Crea una tarea para comprar pilas mañana a las seis de la tarde. |
| es-03 | es-ES | Pon un temporizador de veinte minutos. |
| es-04 | es-ES | ¿Qué tengo el próximo martes? |
| es-05 | es-ES | Apunta una nota que diga comprar leche y pan. |
| en-01 | en-GB | What events do I have this week? |
| en-02 | en-GB | Create a task to buy batteries tomorrow at six pm. |
| en-03 | en-GB | Set a timer for twenty minutes. |
| en-04 | en-GB | What's on my calendar next Tuesday? |
| en-05 | en-GB | Write a note to buy milk and bread. |

Ampliar a ≥20–30 frases únicas (números, nombres, fechas ambiguas, 2 órdenes, ruido); separar calidad de STT de capacidad del intérprete local.

### Voces de contraste
- Kokoro: `ef_dora`, `em_alex` (es; acento es-ES **por verificar**), `bf_emma`, `bm_george` (en-GB). Identidades distintas por idioma.
- Piper: escoger identificadores `es_ES` y `en_GB` después de escuchar muestras y consultar la tarjeta `MODEL_CARD` y licencia **de cada voz**, incluido su género real si está documentado.

## 5. Herramienta de resultados
`node scripts/lumi-benchmark/report.mjs <mediciones.json>`

- El fichero `scripts/lumi-benchmark/plantilla.json` está vacío intencionadamente: **no contiene resultados físicos**.
- Un reporte con menos de 10 mediciones válidas por grupo se presenta como **INCOMPLETO**, nunca como aprobado.
- Las pruebas automatizadas del reporte son sintéticas y no se deben comunicar como pruebas en hardware.

## 6. Próximo trabajo físico pendiente
- Ejecutar demos Android aisladas de sherpa-onnx y whisper.cpp en la T65; seleccionar STT ES/EN.
- Probar Piper y, solo cuando sea compatible, MediaPipe Kokoro; escuchar voces y medir respuesta.
- Comprobar con Android API 24/25 si el launcher sigue instalando y si el componente opcional puede aislarse.
- Probar al menos un segundo perfil físico (por ejemplo tablet ARM64 4 GB), cuando se disponga de él.
- Registrar licencias y decisión argumentada antes de implementar #86.

**No se ha instalado APK, ejecutado un motor real, medido latencia en la T65 ni elegido ganador.**
