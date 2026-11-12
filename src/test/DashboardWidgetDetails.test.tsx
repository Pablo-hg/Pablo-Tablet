import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState, type CalendarEvent } from '../dashboardState'
import { setAppLanguage } from '../i18n'

afterEach(() => vi.useRealTimers())

describe('detalles de los widgets del dashboard', () => {
  it.each([
    { width: 1, height: 2, language: 'es' as const, label: '3 eventos más' },
    { width: 2, height: 3, language: 'es' as const, label: '3 eventos más' },
    { width: 2, height: 3, language: 'en' as const, label: '3 more events' },
  ])('conserva hoy y el acceso a los eventos restantes en $width×$height / $language', async ({ width, height, language, label }) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 10, 8, 30))
    await setAppLanguage(language)
    const state = structuredClone(loadDashboardState())
    state.preferences.language = language
    state.widgets = state.widgets.map(widget => ({ ...widget, visible: widget.id === 'agenda', layouts: {
      landscape: { x: 0, y: 0, width, height }, portrait: { x: 0, y: 0, width, height },
    } }))
    state.calendarEvents = Array.from({ length: 4 }, (_, index): CalendarEvent => ({
      id: `colored-event-${index}`, source: 'local', accountId: null, calendarId: null,
      externalId: null, externalVersion: null, syncStatus: 'local', type: 'event',
      recurrence: 'none', completed: false, title: `Evento ${index + 1}`,
      date: '2026-11-10', endDate: '2026-11-10', startTime: `${18 + index}:00`, endTime: `${19 + index}:00`,
      allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '',
      color: (['blue', 'mint', 'coral', 'sun'] as const)[index], reminders: [],
      createdAt: '2026-11-10T06:30:00Z', updatedAt: '2026-11-10T06:30:00Z',
    }))
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)
    const days = document.querySelectorAll('.calendar-widget-month-grid > button')
    const today = document.querySelector<HTMLButtonElement>('.calendar-widget-month-grid > button[aria-current="date"]')!
    expect(Array.from(days).filter(day => day.getAttribute('aria-current') === 'date')).toHaveLength(1)
    expect(today.querySelector('.calendar-widget-event')).toHaveClass('event-blue')
    expect(today.querySelectorAll('.calendar-widget-event')).toHaveLength(1)
    const more = within(today).getByLabelText(label)
    expect(more).toHaveTextContent('+3')
    expect(loadDashboardState().calendarEvents).toHaveLength(4)
    fireEvent.click(more)
    expect(document.querySelector('.tablet-content')).toHaveClass('is-calendar')
    expect(loadDashboardState().calendarEvents).toHaveLength(4)
  })

  it('traduce las iniciales de los días del widget al seleccionar inglés', async () => {
    const state = structuredClone(loadDashboardState())
    state.preferences = { ...state.preferences, language: 'en' }
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)
    await waitFor(() => {
      expect(Array.from(document.querySelectorAll('.calendar-widget-weekdays > span'), day => day.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    })
  })

  it('permite consultar la agenda desplazable sin activar edición ni navegar por accidente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 8, 30))
    const state = structuredClone(loadDashboardState())
    state.widgets = state.widgets.map(widget => ({ ...widget, visible: widget.id === 'agenda' }))
    state.calendarEvents = [{
      id: 'reading-review', source: 'local', accountId: null, calendarId: null,
      externalId: null, externalVersion: null, syncStatus: 'local', type: 'event',
      recurrence: 'none', completed: false, title: 'Revisar la agenda',
      date: '2026-10-30', endDate: '2026-10-30', startTime: '10:00', endTime: '11:00',
      allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'blue',
      reminders: [], createdAt: '2026-10-29T06:30:00Z', updatedAt: '2026-10-29T06:30:00Z',
    }]
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)
    const agenda = screen.getByRole('complementary', { name: 'Calendario' })
    agenda.focus()
    expect(agenda).toHaveFocus()
    fireEvent.pointerDown(agenda, { pointerType: 'touch', button: 0, isPrimary: true, pointerId: 1, clientX: 500, clientY: 200 })
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.pointerUp(agenda, { pointerId: 1, clientX: 500, clientY: 200 })
    expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
    const contact = (clientX: number) => ({ identifier: 1, clientX, clientY: 200 })
    fireEvent.touchStart(agenda, { touches: [contact(500)], changedTouches: [contact(500)] })
    fireEvent.touchEnd(agenda, { touches: [], changedTouches: [contact(350)] })
    expect(screen.getByText('Buenos días, Pablo')).toBeVisible()
    fireEvent.click(within(agenda).getByRole('button', { name: /Revisar la agenda/ }))
    expect(document.querySelector('.tablet-content')).toHaveClass('is-calendar')
    expect(screen.getByRole('button', { name: 'Ir a Calendario' })).toHaveAttribute('aria-current', 'page')
  })

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
