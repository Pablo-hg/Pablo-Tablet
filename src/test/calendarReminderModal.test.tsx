import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { DEFAULT_DASHBOARD_STATE, type CalendarEvent } from '../dashboardState'
import { dueCalendarReminders } from '../calendarReminderSchedule'

afterEach(() => vi.useRealTimers())
const event = (id: string, patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, title: id, type: 'task', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local', recurrence: 'none', completed: false,
  date: '2026-11-13', endDate: '2026-11-13', startTime: '19:00', endTime: '19:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'mint', reminders: [{ id: `reminder-${id}`, date: '2026-11-13', time: '18:00' }], createdAt: '', updatedAt: '', ...patch,
})

it('abre el modal al vencer el aviso sin necesitar una notificación Android y conserva los simultáneos', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 13, 17, 59, 59))
  const state = structuredClone(DEFAULT_DASHBOARD_STATE)
  state.calendarEvents = [event('Comprar pilas'), event('Llamar al taller')]
  localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
  render(<App />)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  await act(async () => { vi.advanceTimersByTime(1100) })
  await act(async () => { vi.advanceTimersByTime(1) })
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Comprar pilas')
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Recordatorio del calendario')
  expect(screen.getByRole('button', { name: 'Volver a recordar' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Llamar al taller')
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
  await act(async () => { vi.advanceTimersByTime(5000) })
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

it('comparte el índice de recurrencia del planificador y excluye tareas terminadas y avisos futuros', () => {
  const now = new Date(2026, 10, 14, 18)
  const daily = event('diaria', { recurrence: 'daily' })
  const due = dueCalendarReminders([daily, event('terminada', { completed: true }), event('futura', { reminders: [{ id: 'future', date: '2026-11-14', time: '19:00' }] })], now)
  expect(due.map(item => item.key)).toEqual(['calendar:diaria:reminder-diaria:1'])
  expect(dueCalendarReminders([event('antigua')], now)).toHaveLength(0)
})
