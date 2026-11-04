import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

class MockRecognition {
  static instances: MockRecognition[] = []
  lang = ''
  interimResults = false
  continuous = false
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn(() => this.onend?.())
  constructor() { MockRecognition.instances.push(this) }
}

describe('primer clic del asistente', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); MockRecognition.instances = [] })

  it('abre y escucha al primer clic en StrictMode y detiene el micro al cerrar', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
    const state = loadDashboardState()
    state.widgets.find((widget) => widget.id === 'assistant')!.visible = true
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    vi.stubGlobal('SpeechRecognition', MockRecognition)
    const user = userEvent.setup()
    render(<StrictMode><App /></StrictMode>)

    await user.click(await screen.findByRole('button', { name: 'Hablar con Lumi' }))
    expect(screen.getByRole('dialog', { name: 'Asistente' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'Escuchando' })).toBeVisible()
    expect(MockRecognition.instances).toHaveLength(1)
    expect(MockRecognition.instances[0].start).toHaveBeenCalledOnce()
    expect(MockRecognition.instances[0].abort).not.toHaveBeenCalled()

    await user.click(screen.getByRole('dialog', { name: 'Asistente' }).querySelector('.assistant-popup-close')!)
    await waitFor(() => expect(MockRecognition.instances[0].abort).toHaveBeenCalledOnce())
    expect(screen.queryByRole('dialog', { name: 'Asistente' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hablar con Lumi' }))
    expect(MockRecognition.instances).toHaveLength(2)
    expect(MockRecognition.instances[1].start).toHaveBeenCalledOnce()
  })
})
