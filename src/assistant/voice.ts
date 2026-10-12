import { Capacitor, registerPlugin } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

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
  onerror: (() => void) | null
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

export async function recognizeAssistantSpeech(signal?: AbortSignal): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { available } = await AssistantVoice.available()
    if (!available) throw new Error('El reconocimiento de voz no está disponible en este dispositivo.')
    let permission = await AssistantVoice.checkPermissions()
    if (permission.microphone === 'prompt' || permission.microphone === 'prompt-with-rationale') permission = await AssistantVoice.requestPermissions()
    if (permission.microphone !== 'granted') throw new Error('Activa el permiso de micrófono en Android para utilizar el dictado.')
    const stop = () => { void AssistantVoice.stopListening() }
    signal?.addEventListener('abort', stop, { once: true })
    try {
      const { text } = await AssistantVoice.startListening({ language: 'es-ES' })
      return text.trim()
    } finally {
      signal?.removeEventListener('abort', stop)
    }
  }

  const Recognition = browserSpeechRecognition()
  if (!Recognition) throw new Error('Este navegador no ofrece reconocimiento de voz. Puedes seguir escribiendo.')
  return new Promise((resolve, reject) => {
    const recognition = new Recognition()
    let settled = false
    recognition.lang = 'es-ES'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      settled = true
      resolve(event.results[0]?.[0]?.transcript?.trim() ?? '')
    }
    recognition.onerror = () => {
      if (!settled) reject(new Error('No se ha podido reconocer la voz. Prueba de nuevo o escribe la petición.'))
    }
    recognition.onend = () => {
      if (!settled) reject(new Error('No se ha detectado voz.'))
    }
    signal?.addEventListener('abort', () => recognition.abort(), { once: true })
    recognition.start()
  })
}

export async function stopAssistantSpeechRecognition() {
  if (Capacitor.isNativePlatform()) await AssistantVoice.stopListening()
}

export async function speakAssistantText(text: string) {
  await TextToSpeech.stop()
  await TextToSpeech.speak({ text: text.slice(0, 2_000), lang: 'es-ES', rate: 0.92, pitch: 1, volume: 1, queueStrategy: 0 })
}

export async function stopAssistantSpeech() {
  await TextToSpeech.stop()
}
