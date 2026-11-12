import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { DEFAULT_DASHBOARD_STATE, loadDashboardState, type CalendarEvent } from '../dashboardState'

afterEach(() => vi.useRealTimers())

it('muestra tres por tipo en Tu agenda y persiste las dos categorías elegidas del widget', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 12, 9))
  const state = structuredClone(DEFAULT_DASHBOARD_STATE)
  state.preferences.calendarWidgetCategories = ['birthday', 'task']
  state.widgets = state.widgets.map(widget => ({ ...widget, visible: widget.id === 'agenda', layouts: { landscape: { x: 0, y: 0, width: 3, height: 3 }, portrait: { x: 0, y: 0, width: 3, height: 3 } } }))
  state.calendarEvents = (['event', 'task', 'birthday'] as const).flatMap(type => Array.from({ length: 4 }, (_, i): CalendarEvent => ({
    id: `${type}-${i}`, title: `${type}-${i}`, type, source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local', recurrence: 'none', completed: false,
    date: `2026-11-${13+i}`, endDate: `2026-11-${13+i}`, startTime: '10:00', endTime: '11:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'sun', reminders: [], createdAt: '', updatedAt: '',
  })))
  localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
  const view = render(<App />)
  const widget = document.querySelector('.calendar-widget-agenda')!
  expect(within(widget as HTMLElement).getByRole('region', { name: 'Próximos cumpleaños' })).toBeInTheDocument()
  expect(within(widget as HTMLElement).getByRole('region', { name: 'Próximas tareas' })).toBeInTheDocument()
  expect(widget).not.toHaveTextContent('Próximos eventos')
  fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
  const panel = document.querySelector('.calendar-upcoming-panel')!
  expect(panel.querySelectorAll('.calendar-upcoming-category')).toHaveLength(3)
  for (const section of panel.querySelectorAll('.calendar-upcoming-category')) {
    expect(section.querySelectorAll('button')).toHaveLength(3)
    expect(section.querySelector('button')).toHaveClass('event-sun')
  }
  expect(panel).not.toHaveTextContent('event-3')
  fireEvent.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Primera sección del calendario' }), { target: { value: 'event' } })
  expect(loadDashboardState().preferences.calendarWidgetCategories).toEqual(['event', 'task'])
  view.unmount()
  render(<App />)
  expect(document.querySelector('.calendar-widget-agenda')).toHaveTextContent('Próximos eventos')
  expect(document.querySelector('.calendar-widget-agenda')).not.toHaveTextContent('Próximos cumpleaños')
})

it('omite categorías vacías en Tu agenda', () => {
  localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(DEFAULT_DASHBOARD_STATE))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
  expect(document.querySelectorAll('.calendar-upcoming-category')).toHaveLength(0)
})
