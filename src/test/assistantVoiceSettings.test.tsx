import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantVoiceSettings } from '../pages/SettingsPage'
import { speakAssistantText } from '../assistant/voice'
import type { SupportedLanguage } from '../i18n'

vi.mock('../assistant/voice', () => ({
  getAssistantVoices: vi.fn(async (language: SupportedLanguage) => language === 'es'
    ? [{ name: 'Google español', lang: 'es-ES', voiceURI: 'google-es', localService: false, default: false }]
    : [{ name: 'Google English', lang: 'en-GB', voiceURI: 'google-en', localService: false, default: false }]),
  speakAssistantText: vi.fn().mockResolvedValue(undefined),
}))

function SettingsHarness() {
  const [language, setLanguage] = useState<SupportedLanguage>('es')
  const [voices, setVoices] = useState({ es: '', en: '' })
  return <AssistantVoiceSettings language={language} voiceId={voices[language]} onLanguageChange={setLanguage} onChange={(voice) => setVoices((current) => ({ ...current, [language]: voice }))} />
}

describe('ajustes de voz de Lumi', () => {
  it('permite elegir y conservar una voz por idioma, y escuchar la muestra correcta', async () => {
    const user = userEvent.setup()
    render(<SettingsHarness />)
    await screen.findByRole('option', { name: /Google español/ })
    await user.selectOptions(screen.getByLabelText(/Voz del asistente/), 'google-es')
    await user.selectOptions(screen.getByLabelText(/Idioma de Lumi/), 'en')
    await screen.findByRole('option', { name: /Google English/ })
    await user.selectOptions(screen.getByLabelText(/Voz del asistente/), 'google-en')
    await user.click(screen.getByRole('button', { name: 'Escuchar muestra' }))
    expect(speakAssistantText).toHaveBeenCalledWith('Hello, I am Lumi. This is how my voice sounds.', 'google-en', 'en')
    await user.selectOptions(screen.getByLabelText(/Idioma de Lumi/), 'es')
    await waitFor(() => expect(screen.getByLabelText(/Voz del asistente/)).toHaveValue('google-es'))
    expect(screen.queryByText(/femenina|masculina/i)).not.toBeInTheDocument()
  })
})
