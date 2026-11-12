import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CLOCK_WIDGET_STYLES } from '../clockStyles'
import { ClockFace } from '../components/ClockFace'
import { loadDashboardState } from '../dashboardState'
import { setAppLanguage } from '../i18n'

afterEach(() => vi.useRealTimers())

describe('estilos del widget de reloj', () => {
  it.each(CLOCK_WIDGET_STYLES)('elige $label desde Reloj y lo conserva al reabrir sin alterar datos ni layout', ({ id, label }) => {
    const initial = structuredClone(loadDashboardState())
    initial.widgets = initial.widgets.map(widget => ({ ...widget, visible: widget.id === 'clock' }))
    initial.alarms = [{ id: 'morning', label: 'Despertar', time: '07:30', enabled: true, weekdays: [1, 2, 3, 4, 5, 6, 7], soundName: 'Sonido predeterminado', soundUri: null, createdAt: '2026-11-11T06:00:00Z' }]
    initial.timers = [{ id: 'paused', label: 'Lectura', durationSeconds: 600, remainingSeconds: 245, endsAt: null, soundName: 'Sonido predeterminado', soundUri: null, createdAt: '2026-11-11T06:00:00Z' }]
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(initial))
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Reloj' }))
    const picker = screen.getByRole('group', { name: 'Estilo del widget de reloj' })
    expect(within(picker).getAllByRole('radio')).toHaveLength(4)
    fireEvent.click(within(picker).getByRole('radio', { name: label }))
    expect(within(picker).getByRole('radio', { name: label })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Inicio' }))
    expect(document.querySelector('.responsive-clock-widget')).toHaveClass(`clock-style-${id}`)
    expect(document.querySelector('.responsive-clock-widget .clock-face')).toHaveClass(`clock-face--${id}`)
    const stored = loadDashboardState()
    expect(stored.preferences.clockWidgetStyle).toBe(id)
    expect(stored.widgets).toEqual(initial.widgets)
    expect(stored.alarms).toEqual(initial.alarms)
    expect(stored.timers).toEqual(initial.timers)
    expect(document.querySelector('.clock-widget-alarms')).toHaveTextContent('07:30')
    first.unmount()
    render(<App />)
    expect(document.querySelector('.responsive-clock-widget')).toHaveClass(`clock-style-${id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Reloj' }))
    expect(screen.getByRole('radio', { name: label })).toBeChecked()
  })

  it('ofrece nombres y ayuda en inglés', async () => {
    await setAppLanguage('en')
    const initial = structuredClone(loadDashboardState())
    initial.preferences.language = 'en'
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(initial))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Clock' }))
    const picker = screen.getByRole('group', { name: 'Clock widget style' })
    expect(within(picker).getByRole('radio', { name: 'Minimal analog' })).toBeInTheDocument()
    expect(within(picker).getByText('Choose how the clock looks on Home. Saved automatically.')).toBeInTheDocument()
  })

  it('actualiza las agujas con el mismo tick de la app y mantiene la hora accesible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 11, 13, 30, 30))
    const initial = structuredClone(loadDashboardState())
    initial.preferences.clockWidgetStyle = 'analog'
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(initial))
    render(<App />)
    const face = document.querySelector('.responsive-clock-widget .clock-face')!
    expect(face).toHaveAttribute('aria-label', '13:30:30')
    expect(face.querySelector('.clock-hand-hour')).toHaveAttribute('transform', 'rotate(45 100 100)')
    expect(face.querySelector('.clock-hand-minute')).toHaveAttribute('transform', 'rotate(183 100 100)')
    expect(face.querySelector('.clock-hand-second')).toHaveAttribute('transform', 'rotate(180 100 100)')
    act(() => vi.advanceTimersByTime(1000))
    expect(face).toHaveAttribute('dateTime', '13:30:31')
    expect(face.querySelector('.clock-hand-second')).toHaveAttribute('transform', 'rotate(186 100 100)')
  })

  it('representa medianoche sin segundero en el widget compacto', () => {
    const { container } = render(<ClockFace now={new Date(2026, 10, 11, 0, 0, 0)} style="analog-minimal" />)
    expect(container.querySelector('time')).toHaveAttribute('aria-label', '00:00')
    expect(container.querySelector('.clock-hand-hour')).toHaveAttribute('transform', 'rotate(0 100 100)')
    expect(container.querySelector('.clock-hand-second')).not.toBeInTheDocument()
    expect(container.querySelector('.clock-numeral')).not.toBeInTheDocument()
  })
})
