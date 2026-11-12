import { describe, expect, it } from 'vitest'
import { getUpcomingCalendarGroups } from '../calendarUpcoming'
import { type CalendarEvent } from '../dashboardState'

const now = new Date(2026, 10, 12, 10)
const event = (id: string, patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null,
  syncStatus: 'local', type: 'event', recurrence: 'none', completed: false, title: id,
  date: '2026-11-13', endDate: '2026-11-13', startTime: '10:00', endTime: '11:00',
  allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'coral', reminders: [], createdAt: now.toISOString(), updatedAt: now.toISOString(), ...patch,
})

describe('categorías próximas del calendario', () => {
  it('limita cada tipo por separado y conserva colores, orden y recurrencia', () => {
    const events = (['event', 'task', 'birthday'] as const).flatMap(type => Array.from({ length: 4 }, (_, i) => event(`${type}-${i}`, { type, date: `2026-11-${13 + i}`, endDate: `2026-11-${13 + i}` })))
    events.push(event('done', { type: 'task', completed: true }), event('past', { date: '2026-11-11', endDate: '2026-11-11' }), event('holiday', { isHoliday: true, allDay: true }))
    const snapshot = structuredClone(events)
    const groups = getUpcomingCalendarGroups(events, now, '10:00', 3)
    for (const type of ['event', 'task', 'birthday'] as const) {
      expect(groups[type].map(item => item.id)).toEqual([`${type}-0`, `${type}-1`, `${type}-2`])
      expect(groups[type][0].color).toBe('coral')
    }
    expect(groups.holiday.map(item => item.id)).toEqual(['holiday'])
    expect(events).toEqual(snapshot)
    const recurring = getUpcomingCalendarGroups([event('birthday', { type: 'birthday', recurrence: 'yearly', date: '2000-11-14', endDate: '2000-11-14' })], now, '10:00', 3)
    expect(recurring.birthday[0].date).toBe('2026-11-14')
  })

})
