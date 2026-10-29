import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

afterEach(() => vi.useRealTimers())

describe('detalles de los widgets del dashboard', () => {
  it('actualiza el resumen del reloj al desactivar la última alarma desde Reloj', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 8, 30))
    const state = loadDashboardState()
    state.widgets = state.widgets.map(widget => ({ ...widget, visible: widget.id === 'clock' }))
    state.alarms = [{ id: 'test-alarm', time: '10:00', weekdays: [5], enabled: true, label: 'Reunión', soundName: 'Predeterminado', soundUri: null, createdAt: '2026-10-29T00:00:00Z' }]
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)
    const summary = screen.getByRole('region', { name: 'Próximas alarmas', hidden: true })
    expect(within(summary).getByText('Reunión')).toBeInTheDocument()
    expect(within(summary).getByText('Hoy')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Reloj' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Activar Reunión' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Inicio' }))
    expect(document.querySelector('.clock-widget-alarms')).not.toBeInTheDocument()
  })

  it('muestra dos semanas alineadas con lunes en el calendario 1×2', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 8, 30))
    const state = loadDashboardState()
    state.widgets = state.widgets.map(widget => ({ ...widget, visible: widget.id === 'agenda', layouts: { landscape: { x: 0, y: 0, width: 1, height: 2 }, portrait: { x: 0, y: 0, width: 1, height: 2 } } }))
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)
    expect(screen.getByText('2 semanas')).toBeInTheDocument()
    const days = document.querySelectorAll('.calendar-widget-month-grid > button')
    expect(days).toHaveLength(14)
    expect(days[0]).toHaveAttribute('aria-label', expect.stringMatching(/lunes, 26/))
    fireEvent.click(days[3])
    expect(document.querySelector('.tablet-content')).toHaveClass('is-calendar')
  })
})
