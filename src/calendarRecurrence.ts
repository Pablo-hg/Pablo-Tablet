import type { CalendarEvent } from './dashboardState'

export type CalendarOccurrence = { startDate: string; endDate: string }

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateKeyToDayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function addDaysToDateKey(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
}

export function calendarOccurrenceStart(event: CalendarEvent, index: number) {
  if (event.recurrence === 'none' || index <= 0) return event.date
  const [year, month, day] = event.date.split('-').map(Number)
  if (event.recurrence === 'daily') return addDaysToDateKey(event.date, index)
  if (event.recurrence === 'weekly') return addDaysToDateKey(event.date, index * 7)
  const targetYear = event.recurrence === 'monthly' ? year + Math.floor((month - 1 + index) / 12) : year + index
  const targetMonth = event.recurrence === 'monthly' ? ((month - 1 + index) % 12) + 1 : month
  const safeDay = Math.min(day, new Date(targetYear, targetMonth, 0).getDate())
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function calendarOccurrenceIndexNear(event: CalendarEvent, date: string) {
  if (event.recurrence === 'none') return 0
  const dayDifference = dateKeyToDayNumber(date) - dateKeyToDayNumber(event.date)
  if (event.recurrence === 'daily') return Math.max(0, dayDifference)
  if (event.recurrence === 'weekly') return Math.max(0, Math.floor(dayDifference / 7))
  const [eventYear, eventMonth] = event.date.split('-').map(Number)
  const [dateYear, dateMonth] = date.split('-').map(Number)
  return Math.max(0, event.recurrence === 'monthly' ? (dateYear - eventYear) * 12 + dateMonth - eventMonth : dateYear - eventYear)
}

export function calendarOccurrenceForDate(event: CalendarEvent, date: string): CalendarOccurrence | null {
  if (date < event.date) return null
  const durationDays = dateKeyToDayNumber(event.endDate) - dateKeyToDayNumber(event.date)
  let index = calendarOccurrenceIndexNear(event, date)
  let startDate = calendarOccurrenceStart(event, index)
  if (startDate > date && index > 0) startDate = calendarOccurrenceStart(event, --index)
  const endDate = addDaysToDateKey(startDate, durationDays)
  return date <= endDate ? { startDate, endDate } : null
}

export function nextCalendarOccurrence(event: CalendarEvent, date: string): CalendarOccurrence | null {
  const activeOccurrence = calendarOccurrenceForDate(event, date)
  if (activeOccurrence) return activeOccurrence
  if (event.recurrence === 'none') return event.endDate >= date ? { startDate: event.date, endDate: event.endDate } : null
  let index = calendarOccurrenceIndexNear(event, date)
  let startDate = calendarOccurrenceStart(event, index)
  while (startDate < date) startDate = calendarOccurrenceStart(event, ++index)
  const durationDays = dateKeyToDayNumber(event.endDate) - dateKeyToDayNumber(event.date)
  return { startDate, endDate: addDaysToDateKey(startDate, durationDays) }
}

export function eventForOccurrence(event: CalendarEvent, occurrence: CalendarOccurrence) {
  return { ...event, date: occurrence.startDate, endDate: occurrence.endDate }
}

export function offsetDateKey(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return toLocalDateKey(value)
}
