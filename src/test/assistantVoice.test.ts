import { afterEach, describe, expect, it, vi } from 'vitest'
import { recognizeAssistantSpeech } from '../assistant/voice'

class MockRecognition {
  static instance: MockRecognition
  lang = ''
  interimResults = false
  continuous = false
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn()
  constructor() { MockRecognition.instance = this }
}

describe('dictado del asistente en navegador', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('recoge la frase reconocida para que se pueda revisar', async () => {
    vi.stubGlobal('SpeechRecognition', MockRecognition)
    const result = recognizeAssistantSpeech()
    expect(MockRecognition.instance.start).toHaveBeenCalledOnce()
    MockRecognition.instance.onresult?.({ results: [[{ transcript: '  crea una nota  ' }]] })
    await expect(result).resolves.toBe('crea una nota')
  })

  it.each([
    ['not-allowed', 'permisos'],
    ['audio-capture', 'micrófono disponible'],
    ['network', 'conexión'],
    ['no-speech', 'No se ha detectado voz'],
  ])('explica el fallo %s', async (error, message) => {
    vi.stubGlobal('SpeechRecognition', MockRecognition)
    const result = recognizeAssistantSpeech()
    MockRecognition.instance.onerror?.({ error })
    MockRecognition.instance.onend?.()
    await expect(result).rejects.toThrow(message)
  })
})
