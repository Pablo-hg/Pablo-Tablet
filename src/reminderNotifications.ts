import { Capacitor } from '@capacitor/core'
import { LocalNotifications, Weekday } from '@capacitor/local-notifications'
import { alarmChannelId, configureAlarmChannel, configureAlertChannel } from './alarmSounds'
import type { Alarm, CalendarEvent, Note, Timer } from './dashboardState'

const REMINDER_SOURCE = 'pablo-tablet-note'
const ALARM_SOURCE = 'pablo-tablet-alarm'
const ALARM_SNOOZE_SOURCE = 'pablo-tablet-alarm-snooze'
const TIMER_SOURCE = 'pablo-tablet-timer'
const CALENDAR_EVENT_SOURCE = 'pablo-tablet-calendar-event'
const CALENDAR_SNOOZE_SOURCE = 'pablo-tablet-calendar-snooze'
const TIMER_CHANNEL = 'pablo_timer_alerts'
const CALENDAR_EVENT_CHANNEL = 'pablo_calendar_reminders_silent'

function notificationId(noteId: string) {
  let hash = 0
  for (let index = 0; index < noteId.length; index += 1) {
    hash = ((hash << 5) - hash + noteId.charCodeAt(index)) | 0
  }
  return Math.abs(hash) || 1
}

export async function syncReminderNotifications(notes: Note[]) {
  if (!Capacitor.isNativePlatform()) return

  try {
    let permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return

    const pending = await LocalNotifications.getPending()
    const scheduledByPabloTablet = pending.notifications
      .filter((notification) => notification.extra?.source === REMINDER_SOURCE)
      .map((notification) => ({ id: notification.id }))

    if (scheduledByPabloTablet.length > 0) {
      await LocalNotifications.cancel({ notifications: scheduledByPabloTablet })
    }

    const now = Date.now()
    const notifications = notes
      .filter((note) => !note.archived && note.reminderAt && new Date(note.reminderAt).getTime() > now)
      .map((note) => ({
        id: notificationId(note.id),
        title: note.title.trim() || 'Recordatorio',
        body: note.content.trim() || 'Tienes un recordatorio en Pablo Tablet.',
        schedule: { at: new Date(note.reminderAt as string), allowWhileIdle: true },
        extra: { source: REMINDER_SOURCE, noteId: note.id },
      }))

    if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
  } catch (error) {
    console.warn('No se han podido sincronizar los recordatorios locales.', error)
  }
}

export async function syncAlarmNotifications(alarms: Alarm[]) {
  if (!Capacitor.isNativePlatform()) return

  try {
    let permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return

    const pending = await LocalNotifications.getPending()
    const scheduledAlarms = pending.notifications
      .filter((notification) => notification.extra?.source === ALARM_SOURCE)
      .map((notification) => ({ id: notification.id }))
    if (scheduledAlarms.length > 0) await LocalNotifications.cancel({ notifications: scheduledAlarms })

    const activeAlarms = alarms.filter((alarm) => alarm.enabled)
    const channels = new Map<string, string | undefined>()
    for (const alarm of activeAlarms) channels.set(alarm.id, await configureAlarmChannel(alarm))

    const notifications = activeAlarms.flatMap((alarm) => {
      const [hour, minute] = alarm.time.split(':').map(Number)
      return alarm.weekdays.map((weekday) => ({
        id: notificationId(`alarm:${alarm.id}:${weekday}`),
        title: alarm.label.trim() || 'Alarma',
        body: `Alarma programada para las ${alarm.time}.`,
        channelId: channels.get(alarm.id),
        schedule: { on: { weekday: weekday as Weekday, hour, minute }, allowWhileIdle: true },
        extra: { source: ALARM_SOURCE, kind: 'alarm', alarmId: alarm.id, weekday },
      }))
    })
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
  } catch (error) {
    console.warn('No se han podido sincronizar las alarmas locales.', error)
  }
}

function recurringDate(date: string, recurrence: CalendarEvent['recurrence'], index: number) {
  if (recurrence === 'none' || index === 0) return date
  const [year, month, day] = date.split('-').map(Number)
  if (recurrence === 'daily' || recurrence === 'weekly') {
    const value = new Date(year, month - 1, day + index * (recurrence === 'daily' ? 1 : 7), 12)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const targetYear = recurrence === 'monthly' ? year + Math.floor((month - 1 + index) / 12) : year + index
  const targetMonth = recurrence === 'monthly' ? ((month - 1 + index) % 12) + 1 : month
  const safeDay = Math.min(day, new Date(targetYear, targetMonth, 0).getDate())
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function calendarReminderOccurrences(event: CalendarEvent, reminder: CalendarEvent['reminders'][number]) {
  const count = event.recurrence === 'daily' || event.recurrence === 'weekly' ? 40 : event.recurrence === 'monthly' ? 24 : event.recurrence === 'yearly' ? 10 : 1
  const eventStart = new Date(`${event.date}T${event.startTime}:00`).getTime()
  const reminderOffset = new Date(`${reminder.date}T${reminder.time}:00`).getTime() - eventStart
  return Array.from({ length: count }, (_, index) => {
    const occurrenceDate = recurringDate(event.date, event.recurrence, index)
    const occurrenceStart = new Date(`${occurrenceDate}T${event.startTime}:00`)
    return { index, occurrenceDate, at: new Date(occurrenceStart.getTime() + reminderOffset) }
  })
}

export async function syncCalendarEventNotifications(events: CalendarEvent[]) {
  if (!Capacitor.isNativePlatform()) return

  try {
    let permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return

    const pending = await LocalNotifications.getPending()
    const scheduledEvents = pending.notifications
      .filter((notification) => notification.extra?.source === CALENDAR_EVENT_SOURCE)
      .map((notification) => ({ id: notification.id }))
    if (scheduledEvents.length > 0) await LocalNotifications.cancel({ notifications: scheduledEvents })

    await configureAlertChannel(CALENDAR_EVENT_CHANNEL, 'Recordatorios del calendario', null, true)
    const now = Date.now()
    const notifications = events.flatMap((event) => event.reminders.flatMap((reminder) => calendarReminderOccurrences(event, reminder).flatMap(({ index, occurrenceDate, at }) => {
      if (at.getTime() <= now) return []
      const eventDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date(`${occurrenceDate}T12:00:00`))
      return [{
        id: notificationId(`calendar:${event.id}:${reminder.id}:${index}`),
        title: event.title.trim() || 'Evento del calendario',
        body: event.allDay ? `Empieza el ${eventDate}.` : `Empieza el ${eventDate} a las ${event.startTime}.`,
        channelId: CALENDAR_EVENT_CHANNEL,
        schedule: { at, allowWhileIdle: true },
        extra: { source: CALENDAR_EVENT_SOURCE, kind: 'calendar', calendarEventId: event.id, calendarReminderId: reminder.id, recurrenceIndex: index },
      }]
    })))
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
  } catch (error) {
    console.warn('No se han podido sincronizar los recordatorios del calendario.', error)
  }
}

export async function snoozeAlarmNotification(alarm: Alarm, minutes: number) {
  if (!Capacitor.isNativePlatform()) return
  const channelId = await configureAlarmChannel(alarm) ?? alarmChannelId(alarm.id)
  await LocalNotifications.schedule({ notifications: [{
    id: notificationId(`snooze:${alarm.id}:${Date.now()}`),
    title: alarm.label.trim() || 'Alarma',
    body: `Alarma pospuesta ${minutes} min.`,
    channelId,
    schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
    extra: { source: ALARM_SNOOZE_SOURCE, kind: 'alarm', alarmId: alarm.id, snoozed: true },
  }] })
}

export async function snoozeCalendarEventNotification(event: CalendarEvent, minutes: number) {
  if (!Capacitor.isNativePlatform()) return
  await configureAlertChannel(CALENDAR_EVENT_CHANNEL, 'Recordatorios del calendario', null, true)
  const eventDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date(`${event.date}T12:00:00`))
  await LocalNotifications.schedule({ notifications: [{
    id: notificationId(`calendar-snooze:${event.id}:${Date.now()}`),
    title: event.title.trim() || 'Recordatorio del calendario',
    body: event.allDay ? `Empieza el ${eventDate}.` : `Empieza el ${eventDate} a las ${event.startTime}.`,
    channelId: CALENDAR_EVENT_CHANNEL,
    schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
    extra: { source: CALENDAR_SNOOZE_SOURCE, kind: 'calendar', calendarEventId: event.id, snoozed: true },
  }] })
}

export async function syncTimerNotifications(timers: Timer[]) {
  if (!Capacitor.isNativePlatform()) return
  try {
    let permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return

    const pending = await LocalNotifications.getPending()
    const scheduledTimers = pending.notifications
      .filter((notification) => notification.extra?.source === TIMER_SOURCE)
      .map((notification) => ({ id: notification.id }))
    if (scheduledTimers.length > 0) await LocalNotifications.cancel({ notifications: scheduledTimers })

    await configureAlertChannel(TIMER_CHANNEL, 'Temporizadores', null)
    const now = Date.now()
    const notifications = timers
      .filter((timer) => timer.endsAt && new Date(timer.endsAt).getTime() > now)
      .map((timer) => ({
        id: notificationId(`timer:${timer.id}`),
        title: timer.label.trim() || 'Temporizador',
        body: 'El temporizador ha terminado.',
        channelId: TIMER_CHANNEL,
        schedule: { at: new Date(timer.endsAt as string), allowWhileIdle: true },
        extra: { source: TIMER_SOURCE, kind: 'timer', timerId: timer.id },
      }))
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
  } catch (error) {
    console.warn('No se han podido sincronizar los temporizadores.', error)
  }
}
