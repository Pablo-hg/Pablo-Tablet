import type { CalendarEvent } from './dashboardState'
import { calendarOccurrenceForDate, calendarOccurrenceIndexNear, calendarOccurrenceStart, eventForOccurrence, toLocalDateKey } from './calendarRecurrence'

export function calendarReminderOccurrences(event: CalendarEvent, reminder: CalendarEvent['reminders'][number], now: number, countLimit?: number) {
  const count = event.recurrence === 'daily' || event.recurrence === 'weekly' ? 40 : event.recurrence === 'monthly' ? 24 : event.recurrence === 'yearly' ? 10 : 1
  const eventStart = new Date(`${event.date}T${event.startTime}:00`).getTime()
  const reminderOffset = new Date(`${reminder.date}T${reminder.time}:00`).getTime() - eventStart
  const occurrence = (index: number) => {
    const occurrenceDate = calendarOccurrenceStart(event, index)
    const occurrenceStart = new Date(`${occurrenceDate}T${event.startTime}:00`)
    return { index, occurrenceDate, at: new Date(occurrenceStart.getTime() + reminderOffset) }
  }
  // Keep the original recurrence index in notification IDs as the window moves.
  let firstIndex = calendarOccurrenceIndexNear(event, toLocalDateKey(new Date(now - reminderOffset)))
  if (event.recurrence !== 'none') {
    while (occurrence(firstIndex).at.getTime() <= now) firstIndex += 1
  }
  return Array.from({ length: countLimit === undefined ? count : Math.min(count, countLimit) }, (_, offset) => occurrence(firstIndex + offset))
}


export function calendarReminderKey(eventId: string, reminderId: string, index: number) {
  return `calendar:${eventId}:${reminderId}:${index}`
}

export function dueCalendarReminders(events: CalendarEvent[], now: Date, windowMs = 35_000) {
  const cutoff = now.getTime() - windowMs
  return events.filter(event => event.type !== 'task' || !event.completed).flatMap(event =>
    event.reminders.flatMap(reminder => calendarReminderOccurrences(event, reminder, cutoff, 1).filter(occurrence => occurrence.at.getTime() > cutoff && occurrence.at.getTime() <= now.getTime()).map(occurrence => ({
      key: calendarReminderKey(event.id, reminder.id, occurrence.index), event: eventForOccurrence(event, calendarOccurrenceForDate(event, occurrence.occurrenceDate)!), occurrence,
    }))),
  ).sort((a, b) => a.occurrence.at.getTime() - b.occurrence.at.getTime())
}
