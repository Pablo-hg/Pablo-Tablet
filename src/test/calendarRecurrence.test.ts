import { describe, expect, it } from 'vitest'
import { calendarOccurrenceForDate, calendarOccurrenceStart, nextCalendarOccurrence } from '../calendarRecurrence'
import type { CalendarEvent, CalendarEventRecurrence } from '../dashboardState'

function event(recurrence: CalendarEventRecurrence, date = '2026-01-31', endDate = date): CalendarEvent {
  return {
    id: 'event-1',
    type: 'event',
    recurrence,
    completed: false,
    title: 'Evento',
    date,
    endDate,
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    location: '',
    notes: '',
    color: 'blue',
    reminders: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('repeticiones del calendario', () => {
  it('repite diariamente y semanalmente en la fecha correcta', () => {
    expect(calendarOccurrenceStart(event('daily', '2026-03-01'), 9)).toBe('2026-03-10')
    expect(calendarOccurrenceStart(event('weekly', '2026-03-01'), 3)).toBe('2026-03-22')
  })

  it('ajusta el día al final de mes y respeta los años bisiestos', () => {
    expect(calendarOccurrenceStart(event('monthly'), 1)).toBe('2026-02-28')
    expect(calendarOccurrenceStart(event('yearly', '2024-02-29'), 1)).toBe('2025-02-28')
    expect(calendarOccurrenceStart(event('yearly', '2024-02-29'), 4)).toBe('2028-02-29')
  })

  it('mantiene la duración de eventos recurrentes de varios días', () => {
    const recurring = event('weekly', '2026-04-06', '2026-04-08')
    expect(calendarOccurrenceForDate(recurring, '2026-04-14')).toEqual({ startDate: '2026-04-13', endDate: '2026-04-15' })
  })

  it('encuentra la siguiente repetición y descarta eventos únicos pasados', () => {
    expect(nextCalendarOccurrence(event('monthly'), '2026-03-15')).toEqual({ startDate: '2026-03-31', endDate: '2026-03-31' })
    expect(nextCalendarOccurrence(event('none', '2026-01-10'), '2026-01-11')).toBeNull()
  })
})
