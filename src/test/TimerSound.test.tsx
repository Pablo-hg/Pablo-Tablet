import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

const sounds = vi.hoisted(() => ({ preview: vi.fn(), stop: vi.fn() }))
vi.mock('../alarmSounds', () => ({
  DEFAULT_ALARM_SOUND: { name: 'Sonido predeterminado', uri: '' },
  getDeviceAlarmSounds: async () => [{ name: 'Sonido predeterminado', uri: '' }, { name: 'Campanas', uri: 'content://sounds/7' }],
  previewAlarmSound: sounds.preview,
  stopAlarmSoundPreview: sounds.stop,
}))

describe('sonido del temporizador', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    sounds.preview.mockResolvedValue(true)
    sounds.stop.mockResolvedValue(undefined)
  })

  it('permite elegir y probar el tono, y lo conserva al cerrar y volver a abrir', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ir a Reloj' }))
    await user.click(screen.getByRole('button', { name: 'Nuevo' }))
    const select = await screen.findByRole('combobox', { name: 'Sonido' })
    await user.selectOptions(select, 'content://sounds/7')
    await user.click(screen.getByRole('button', { name: 'Probar' }))
    expect(sounds.preview).toHaveBeenCalledWith('content://sounds/7')
    await user.click(screen.getByRole('button', { name: 'Hecho' }))
    expect(sounds.stop).toHaveBeenCalled()
    await waitFor(() => expect(loadDashboardState().timers[0]).toMatchObject({ soundName: 'Campanas', soundUri: 'content://sounds/7' }))
    unmount()

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ir a Reloj' }))
    await user.click(document.querySelector('.timer-summary')!)
    expect(await screen.findByRole('combobox', { name: 'Sonido' })).toHaveValue('content://sounds/7')
  })

  it('usa el tono guardado cuando termina y permite detener el aviso', async () => {
    const state = loadDashboardState()
    state.timers = [{ id: 'finished', label: 'Horno', durationSeconds: 60, remainingSeconds: 60, endsAt: new Date(Date.now() - 1000).toISOString(), soundName: 'Campanas', soundUri: 'content://sounds/7', createdAt: '' }]
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Horno')
    expect(sounds.preview).toHaveBeenCalledWith('content://sounds/7', true)
    await user.click(screen.getByRole('button', { name: 'Detener' }))
    expect(sounds.stop).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
