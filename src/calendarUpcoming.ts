import type { CalendarEvent } from './dashboardState'
import type { SyncedCalendar } from './calendarSync/contracts'
import { toLocalDateKey, nextCalendarOccurrence, addDaysToDateKey, eventForOccurrence } from './calendarRecurrence'

const HOLIDAY_CALENDAR_PATTERN = /(holiday|holidays|festiv|festivo|festivos|bank[ _-]?holiday|feiertag|f[eé]ri[eé])/i

export function isCalendarHoliday(event: CalendarEvent, calendars: SyncedCalendar[] = []) {
  if (event.source === 'native') return true
  if (event.isHoliday) return true
  if (!event.allDay || event.source === 'local' || !event.accountId || !event.calendarId) return false
  const calendar = calendars.find((candidate) => candidate.provider === event.source && candidate.accountId === event.accountId && candidate.remoteId === event.calendarId)
  return Boolean(calendar && HOLIDAY_CALENDAR_PATTERN.test(`${calendar.name} ${calendar.remoteId}`))
}

function getUpcomingCalendarItems(calendarEvents: CalendarEvent[], now: Date, time: string, limit: number, calendars: SyncedCalendar[], holidaysOnly: boolean) {
  const todayKey = toLocalDateKey(now)
  return calendarEvents
    .filter((event) => event.type !== 'task' || !event.completed)
    .filter((event) => isCalendarHoliday(event, calendars) === holidaysOnly)
    .map((event) => {
      let occurrence = nextCalendarOccurrence(event, todayKey)
      if (occurrence?.endDate === todayKey && !event.allDay && event.endTime < time && event.recurrence !== 'none') occurrence = nextCalendarOccurrence(event, addDaysToDateKey(todayKey, 1))
      if (!occurrence || (occurrence.endDate === todayKey && !event.allDay && event.endTime < time)) return null
      return eventForOccurrence(event, occurrence)
    })
    .filter((event): event is CalendarEvent => event !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, limit)
}

export function getUpcomingCalendarEvents(calendarEvents: CalendarEvent[], now: Date, time: string, limit = 3, calendars: SyncedCalendar[] = []) {
  return getUpcomingCalendarItems(calendarEvents, now, time, limit, calendars, false)
}

export function getUpcomingCalendarHolidays(calendarEvents: CalendarEvent[], now: Date, time: string, limit = 3, calendars: SyncedCalendar[] = []) {
  return getUpcomingCalendarItems(calendarEvents, now, time, limit, calendars, true)
}

export const CALENDAR_CATEGORY_ORDER = ['event', 'task', 'birthday', 'holiday'] as const

export const CALENDAR_CATEGORY_LABELS = {
  event: 'Próximos eventos', task: 'Próximas tareas', birthday: 'Próximos cumpleaños', holiday: 'Próximos festivos',
} as const

export function getUpcomingCalendarGroups(events: CalendarEvent[], now: Date, time: string, limit: number, calendars: SyncedCalendar[] = []) {
  const regular = getUpcomingCalendarItems(events, now, time, events.length, calendars, false)
  return {
    event: regular.filter(event => event.type === 'event').slice(0, limit),
    task: regular.filter(event => event.type === 'task').slice(0, limit),
    birthday: regular.filter(event => event.type === 'birthday').slice(0, limit),
    holiday: getUpcomingCalendarHolidays(events, now, time, limit, calendars),
  }
}
