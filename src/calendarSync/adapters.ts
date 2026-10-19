import type { CalendarEventColor, CalendarEventRecurrence } from '../dashboardState'
import type { CalendarProviderId, RemoteCalendarEvent, SyncedCalendar } from './contracts'

type JsonObject = Record<string, unknown>

const object = (value: unknown): JsonObject => value && typeof value === 'object' ? value as JsonObject : {}
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const datePart = (value: string) => value.slice(0, 10)
const timePart = (value: string) => value.includes('T') ? value.slice(11, 16) : '00:00'
const holidayCalendarPattern = /(holiday|holidays|festiv|festivo|festivos|bank[ _-]?holiday|feiertag|f[eé]ri[eé])/i
const isHolidayCalendar = (calendarId: string) => holidayCalendarPattern.test(calendarId) || calendarId.toLowerCase().includes('holiday@group.v.calendar.google.com')
const reminderBefore = (date: string, time: string, minutes: number, id: string) => {
  const value = new Date(`${date}T${time || '00:00'}:00`)
  value.setMinutes(value.getMinutes() - minutes)
  const localDate = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  return { id, date: localDate, time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` }
}
const recurrence = (value: unknown): CalendarEventRecurrence => {
  const raw = JSON.stringify(value ?? '').toLowerCase()
  if (raw.includes('daily')) return 'daily'
  if (raw.includes('weekly')) return 'weekly'
  if (raw.includes('monthly')) return 'monthly'
  if (raw.includes('yearly') || raw.includes('absoluteyearly')) return 'yearly'
  return 'none'
}

function colorFor(raw: unknown): CalendarEventColor {
  const value = text(raw).toLowerCase()
  if (value.includes('green') || value === '2' || value === '10') return 'mint'
  if (value.includes('red') || value.includes('orange') || value === '4' || value === '6') return 'coral'
  if (value.includes('yellow') || value === '5') return 'sun'
  return 'blue'
}

export function mapGoogleEvent(accountId: string, calendarId: string, value: unknown): RemoteCalendarEvent | null {
  const raw = object(value)
  const id = text(raw.id)
  if (!id) return null
  const start = object(raw.start)
  const end = object(raw.end)
  const allDay = Boolean(start.date)
  const startValue = text(start.dateTime, text(start.date))
  const endValue = text(end.dateTime, text(end.date, startValue))
  const exclusiveEnd = allDay && endValue ? new Date(`${endValue}T12:00:00`) : null
  const reminderConfig = object(raw.reminders)
  const reminders = Array.isArray(reminderConfig.overrides) ? reminderConfig.overrides.flatMap((value, index) => {
    const override = object(value)
    return typeof override.minutes === 'number' ? [reminderBefore(datePart(startValue), allDay ? '09:00' : timePart(startValue), override.minutes, `google-${id}-${index}`)] : []
  }) : []
  if (exclusiveEnd) exclusiveEnd.setDate(exclusiveEnd.getDate() - 1)
  return {
    provider: 'google', accountId, calendarId, externalId: id,
    externalVersion: text(raw.etag) || text(raw.updated) || null,
    deleted: raw.status === 'cancelled', type: 'event', recurrence: recurrence(raw.recurrence), completed: false,
    title: text(raw.summary, 'Sin título'), date: datePart(startValue),
    endDate: exclusiveEnd ? exclusiveEnd.toISOString().slice(0, 10) : datePart(endValue || startValue),
    startTime: allDay ? '00:00' : timePart(startValue), endTime: allDay ? '23:59' : timePart(endValue), allDay,
    isHoliday: allDay && (isHolidayCalendar(calendarId) || raw.eventType === 'holiday' || raw.isHoliday === true),
    timeZone: text(start.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'),
    location: text(raw.location), notes: text(raw.description), color: colorFor(raw.colorId),
    reminders,
    updatedAt: text(raw.updated, new Date().toISOString()),
  }
}

export function mapOutlookEvent(accountId: string, calendarId: string, value: unknown): RemoteCalendarEvent | null {
  const raw = object(value)
  const id = text(raw.id)
  if (!id) return null
  const removed = object(raw['@removed'])
  const start = object(raw.start)
  const end = object(raw.end)
  const startValue = text(start.dateTime)
  const endValue = text(end.dateTime, startValue)
  const location = object(raw.location)
  const body = object(raw.body)
  const reminders = raw.isReminderOn && typeof raw.reminderMinutesBeforeStart === 'number' ? [reminderBefore(datePart(startValue), raw.isAllDay ? '09:00' : timePart(startValue), raw.reminderMinutesBeforeStart, `outlook-${id}`)] : []
  return {
    provider: 'outlook', accountId, calendarId, externalId: id,
    externalVersion: text(raw.changeKey) || text(raw['@odata.etag']) || null,
    deleted: Boolean(raw.isCancelled) || Object.keys(removed).length > 0, type: 'event', recurrence: recurrence(raw.recurrence), completed: false,
    title: text(raw.subject, 'Sin título'), date: datePart(startValue), endDate: datePart(endValue || startValue),
    startTime: raw.isAllDay ? '00:00' : timePart(startValue), endTime: raw.isAllDay ? '23:59' : timePart(endValue), allDay: Boolean(raw.isAllDay),
    isHoliday: Boolean(raw.isAllDay) && (isHolidayCalendar(calendarId) || holidayCalendarPattern.test(JSON.stringify(raw.categories ?? [])) || raw.isHoliday === true),
    timeZone: text(start.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'),
    location: text(location.displayName), notes: text(body.contentPreview, text(raw.bodyPreview)), color: colorFor(raw.categories),
    reminders,
    updatedAt: text(raw.lastModifiedDateTime, new Date().toISOString()),
  }
}

export function mapRemoteCalendar(provider: CalendarProviderId, accountId: string, value: unknown): SyncedCalendar | null {
  const raw = object(value)
  const remoteId = text(raw.id)
  if (!remoteId) return null
  return {
    id: `${provider}:${encodeURIComponent(accountId)}:${encodeURIComponent(remoteId)}`,
    accountId, provider, remoteId,
    name: text(raw.summary, text(raw.name, 'Calendario')),
    color: colorFor(raw.backgroundColor ?? raw.color),
    visible: true,
    readOnly: provider === 'google' ? text(raw.accessRole) === 'reader' : Boolean(raw.canEdit === false),
  }
}
