import { Capacitor, registerPlugin } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { activeLocale, tx, type SupportedLanguage } from '../i18n'

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'

interface AssistantVoicePlugin {
  checkPermissions(): Promise<{ microphone: PermissionState }>
  requestPermissions(): Promise<{ microphone: PermissionState }>
  available(): Promise<{ available: boolean }>
  startListening(options: { language: string }): Promise<{ text: string }>
  stopListening(): Promise<void>
}

const AssistantVoice = registerPlugin<AssistantVoicePlugin>('AssistantVoice')

interface BrowserSpeechRecognitionResult {
  0: { transcript: string }
}

interface BrowserSpeechRecognitionEvent extends Event {
  results: ArrayLike<BrowserSpeechRecognitionResult>
}

interface BrowserSpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance

function browserSpeechRecognition() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export async function recognizeAssistantSpeech(signal?: AbortSignal, language?: SupportedLanguage): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { available } = await AssistantVoice.available()
    if (!available) throw new Error(tx('El reconocimiento de voz no está disponible en este dispositivo.'))
    let permission = await AssistantVoice.checkPermissions()
    if (permission.microphone === 'prompt' || permission.microphone === 'prompt-with-rationale') permission = await AssistantVoice.requestPermissions()
    if (permission.microphone !== 'granted') throw new Error(tx('Activa el permiso de micrófono en Android para utilizar el dictado.'))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const stop = () => { void AssistantVoice.stopListening().catch(() => undefined) }
    signal?.addEventListener('abort', stop, { once: true })
    try {
      const { text } = await AssistantVoice.startListening({ language: activeLocale(language) })
      return text.trim()
    } finally {
      signal?.removeEventListener('abort', stop)
    }
  }

  const Recognition = browserSpeechRecognition()
  if (!Recognition) throw new Error(tx('Este navegador no ofrece reconocimiento de voz. Puedes seguir escribiendo.'))
  return new Promise((resolve, reject) => {
    const recognition = new Recognition()
    let settled = false
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      recognition.abort()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    recognition.lang = activeLocale(language)
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(event.results[0]?.[0]?.transcript?.trim() ?? '')
    }
    recognition.onerror = (event) => {
      if (settled) return
      settled = true
      cleanup()
      const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? tx('El navegador ha bloqueado el micrófono o el servicio de voz. Revisa los permisos de este sitio y del sistema.')
        : event.error === 'audio-capture'
          ? tx('No se encuentra un micrófono disponible. Revisa la entrada de audio del equipo.')
          : event.error === 'network'
            ? tx('El servicio de reconocimiento de voz no tiene conexión. Revisa Internet y vuelve a intentarlo.')
            : event.error === 'no-speech'
              ? tx('No se ha detectado voz. Acércate al micrófono y vuelve a intentarlo.')
              : event.error === 'language-not-supported'
                ? tx('El servicio de voz no admite el idioma seleccionado.')
                : tx('No se ha podido reconocer la voz. Prueba de nuevo o escribe la petición.')
      reject(new Error(message))
    }
    recognition.onend = () => {
      if (!settled) {
        settled = true
        cleanup()
        reject(new Error(tx('No se ha detectado voz.')))
      }
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) { onAbort(); return }
    try { recognition.start() } catch (error) { cleanup(); reject(error) }
  })
}

export async function stopAssistantSpeechRecognition() {
  if (Capacitor.isNativePlatform()) await AssistantVoice.stopListening()
}

export async function getAssistantVoices(selectedLanguage?: SupportedLanguage) {
  const { voices } = await TextToSpeech.getSupportedVoices()
  const language = activeLocale(selectedLanguage).split('-')[0].toLowerCase()
  return voices.filter((voice) => voice.lang.toLowerCase().split('-')[0] === language)
}

let speechGeneration = 0

export async function speakAssistantText(text: string, voiceId = '', language?: SupportedLanguage) {
  const generation = ++speechGeneration
  await TextToSpeech.stop()
  let voice: number | undefined
  if (voiceId) {
    try {
      const available = await TextToSpeech.getSupportedVoices()
      const index = available.voices.findIndex((item) => item.voiceURI === voiceId && item.lang.toLowerCase().split('-')[0] === activeLocale(language).split('-')[0].toLowerCase())
      if (index >= 0) voice = index
    } catch { /* The system default remains available if voice enumeration fails. */ }
  }
  if (generation !== speechGeneration) return
  await TextToSpeech.speak({ text: text.slice(0, 2_000), lang: activeLocale(language), rate: 0.92, pitch: 1, volume: 1, queueStrategy: 0, ...(voice === undefined ? {} : { voice }) })
}

export async function stopAssistantSpeech() {
  speechGeneration += 1
  await TextToSpeech.stop()
}
