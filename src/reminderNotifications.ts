import { Capacitor } from '@capacitor/core'
import { calendarOccurrenceIndexNear, calendarOccurrenceStart, toLocalDateKey } from './calendarRecurrence'
import { LocalNotifications, Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { alarmChannelId, configureAlarmChannel, configureAlertChannel, configureTimerChannel } from './alarmSounds'
import type { Alarm, CalendarEvent, Note, Timer } from './dashboardState'
import { checkNotificationPermissionStatus } from './notificationPermissions'
import { activeLocale, tx } from './i18n'

const REMINDER_SOURCE = 'pablo-tablet-note'
const ALARM_SOURCE = 'pablo-tablet-alarm'
const ALARM_SNOOZE_SOURCE = 'pablo-tablet-alarm-snooze'
const TIMER_SOURCE = 'pablo-tablet-timer'
const CALENDAR_EVENT_SOURCE = 'pablo-tablet-calendar-event'
const CALENDAR_SNOOZE_SOURCE = 'pablo-tablet-calendar-snooze'
const CALENDAR_EVENT_CHANNEL = 'pablo_calendar_reminders_silent'
// Android limits the number of alarms a single application can own (500 on the
// Teclast T65). Keep enough headroom for alarms, timers and snoozed reminders.
export const MAX_SCHEDULED_CALENDAR_NOTIFICATIONS = 128
const NOTIFICATION_CANCELLATION_BATCH_SIZE = 128

function notificationId(noteId: string) {
  let hash = 0
  for (let index = 0; index < noteId.length; index += 1) {
    hash = ((hash << 5) - hash + noteId.charCodeAt(index)) | 0
  }
  return Math.abs(hash) || 1
}

type KnownNotification = { id: number; extra?: Record<string, unknown> }

async function cancelNotificationIds(ids: number[]) {
  const uniqueIds = [...new Set(ids)]
  for (let index = 0; index < uniqueIds.length; index += NOTIFICATION_CANCELLATION_BATCH_SIZE) {
    await LocalNotifications.cancel({
      notifications: uniqueIds
        .slice(index, index + NOTIFICATION_CANCELLATION_BATCH_SIZE)
        .map((id) => ({ id })),
    })
  }
}

async function schedulingAccess() {
  const status = await checkNotificationPermissionStatus()
  if (!status.supported || status.display !== 'granted') return null
  return { exact: status.exactAlarm === 'granted' || status.exactAlarm === 'not-required' }
}

async function reconcileNotifications(
  source: string,
  notifications: LocalNotificationSchema[],
  isOrphan: (notification: KnownNotification) => boolean = () => false,
) {
  const access = await schedulingAccess()
  const desired = notifications.map((notification) => ({
    ...notification,
    isExactNotification: access?.exact ?? false,
  }))
  const desiredIds = new Set(desired.map((notification) => notification.id))
  const pending = await LocalNotifications.getPending()
  const managedPending = pending.notifications.filter((notification) => notification.extra?.source === source)
  const existingIds = new Set(managedPending.map((notification) => notification.id))
  const staleIds = pending.notifications
    .filter((notification) => (notification.extra?.source === source && !desiredIds.has(notification.id)) || isOrphan(notification))
    .map((notification) => notification.id)
  const stale = [...new Set(staleIds)].map((id) => ({ id }))

  if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale })

  const delivered = await LocalNotifications.getDeliveredNotifications()
  const orphanedDeliveredIds = delivered.notifications.filter(isOrphan).map((notification) => notification.id)
  if (orphanedDeliveredIds.length > 0) {
    await LocalNotifications.removeDeliveredNotificationsById({ ids: orphanedDeliveredIds })
  }

  if (!access) return

  const updates = desired.filter((notification) => existingIds.has(notification.id))
  if (updates.length > 0) await LocalNotifications.update({ notifications: updates })

  const additions = desired.filter((notification) => !existingIds.has(notification.id))
  if (additions.length > 0) await LocalNotifications.schedule({ notifications: additions })
}

export async function syncReminderNotifications(notes: Note[]) {
  if (!Capacitor.isNativePlatform()) return

  try {
    const now = Date.now()
    const validNoteIds = new Set(notes.filter((note) => !note.archived).map((note) => note.id))
    const notifications = notes
      .filter((note) => !note.archived && note.reminderAt && new Date(note.reminderAt).getTime() > now)
      .map((note) => ({
        id: notificationId(note.id),
        title: note.title.trim() || tx('Recordatorio'),
        body: note.content.trim() || tx('Tienes un recordatorio en Pablo Tablet.'),
        schedule: { at: new Date(note.reminderAt as string), allowWhileIdle: true },
        extra: { source: REMINDER_SOURCE, noteId: note.id },
      }))

    await reconcileNotifications(REMINDER_SOURCE, notifications, (notification) => (
      notification.extra?.source === REMINDER_SOURCE
      && typeof notification.extra.noteId === 'string'
      && !validNoteIds.has(notification.extra.noteId)
    ))
  } catch (error) {
    console.warn('No se han podido sincronizar los recordatorios locales.', error)
  }
}

export async function syncAlarmNotifications(alarms: Alarm[]) {
  if (!Capacitor.isNativePlatform()) return

  try {
    const activeAlarms = alarms.filter((alarm) => alarm.enabled)
    const activeAlarmIds = new Set(activeAlarms.map((alarm) => alarm.id))
    const channels = new Map<string, string | undefined>()
    for (const alarm of activeAlarms) channels.set(alarm.id, await configureAlarmChannel(alarm))

    const notifications = activeAlarms.flatMap((alarm) => {
      const [hour, minute] = alarm.time.split(':').map(Number)
      return alarm.weekdays.map((weekday) => ({
        id: notificationId(`alarm:${alarm.id}:${weekday}`),
        title: alarm.label.trim() || tx('Alarma'),
        body: tx('Alarma programada para las {{time}}.', { time: alarm.time }),
        channelId: channels.get(alarm.id),
        schedule: { on: { weekday: weekday as Weekday, hour, minute, second: 0 }, allowWhileIdle: true },
        extra: { source: ALARM_SOURCE, kind: 'alarm', alarmId: alarm.id, weekday },
      }))
    })
    await reconcileNotifications(ALARM_SOURCE, notifications, (notification) => (
      (notification.extra?.source === ALARM_SOURCE || notification.extra?.source === ALARM_SNOOZE_SOURCE)
      && typeof notification.extra.alarmId === 'string'
      && !activeAlarmIds.has(notification.extra.alarmId)
    ))
  } catch (error) {
    console.warn('No se han podido sincronizar las alarmas locales.', error)
  }
}

function calendarReminderOccurrences(event: CalendarEvent, reminder: CalendarEvent['reminders'][number], now: number) {
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
  return Array.from({ length: count }, (_, offset) => occurrence(firstIndex + offset))
}

export async function syncCalendarEventNotifications(events: CalendarEvent[]) {
  if (!Capacitor.isNativePlatform()) return

  try {
    await configureAlertChannel(CALENDAR_EVENT_CHANNEL, tx('Recordatorios del calendario'), null, true)
    const now = Date.now()
    const activeEvents = events.filter((event) => event.type !== 'task' || !event.completed)
    const activeEventIds = new Set(activeEvents.map((event) => event.id))
    const candidates = activeEvents.flatMap((event) => event.reminders.flatMap((reminder) => calendarReminderOccurrences(event, reminder, now).flatMap(({ index, occurrenceDate, at }) => {
      if (at.getTime() <= now) return []
      const eventDate = new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'long' }).format(new Date(`${occurrenceDate}T12:00:00`))
      return [{
        id: notificationId(`calendar:${event.id}:${reminder.id}:${index}`),
        title: event.title.trim() || tx('Evento del calendario'),
        body: event.allDay ? tx('Empieza el {{date}}.', { date: eventDate }) : tx('Empieza el {{date}} a las {{time}}.', { date: eventDate, time: event.startTime }),
        channelId: CALENDAR_EVENT_CHANNEL,
        schedule: { at, allowWhileIdle: true },
        extra: { source: CALENDAR_EVENT_SOURCE, kind: 'calendar', calendarEventId: event.id, calendarReminderId: reminder.id, recurrenceIndex: index },
      }]
    })))
      .sort((left, right) => left.schedule.at.getTime() - right.schedule.at.getTime())
    const notifications = candidates.slice(0, MAX_SCHEDULED_CALENDAR_NOTIFICATIONS)

    // A failed oversized schedule can leave alarms registered in Android before
    // the Capacitor plugin persists them. getPending() cannot see those orphaned
    // alarms, so proactively cancel every deterministic candidate id before
    // rebuilding the bounded set.
    if (candidates.length > MAX_SCHEDULED_CALENDAR_NOTIFICATIONS) {
      await cancelNotificationIds(candidates.map((notification) => notification.id))
    }
    await reconcileNotifications(CALENDAR_EVENT_SOURCE, notifications, (notification) => (
      (notification.extra?.source === CALENDAR_EVENT_SOURCE || notification.extra?.source === CALENDAR_SNOOZE_SOURCE)
      && typeof notification.extra.calendarEventId === 'string'
      && !activeEventIds.has(notification.extra.calendarEventId)
    ))
  } catch (error) {
    console.warn('No se han podido sincronizar los recordatorios del calendario.', error)
  }
}

export async function snoozeAlarmNotification(alarm: Alarm, minutes: number) {
  if (!Capacitor.isNativePlatform()) return
  const access = await schedulingAccess()
  if (!access) return
  const channelId = await configureAlarmChannel(alarm) ?? alarmChannelId(alarm.id, alarm.soundUri)
  await LocalNotifications.schedule({ notifications: [{
    id: notificationId(`snooze:${alarm.id}:${Date.now()}`),
    title: alarm.label.trim() || tx('Alarma'),
    body: tx('Alarma pospuesta {{count}} min.', { count: minutes }),
    channelId,
    isExactNotification: access.exact,
    schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
    extra: { source: ALARM_SNOOZE_SOURCE, kind: 'alarm', alarmId: alarm.id, snoozed: true },
  }] })
}

export async function snoozeCalendarEventNotification(event: CalendarEvent, minutes: number) {
  if (!Capacitor.isNativePlatform()) return
  const access = await schedulingAccess()
  if (!access) return
  await configureAlertChannel(CALENDAR_EVENT_CHANNEL, tx('Recordatorios del calendario'), null, true)
  const eventDate = new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'long' }).format(new Date(`${event.date}T12:00:00`))
  await LocalNotifications.schedule({ notifications: [{
    id: notificationId(`calendar-snooze:${event.id}:${Date.now()}`),
    title: event.title.trim() || tx('Recordatorio del calendario'),
    body: event.allDay ? tx('Empieza el {{date}}.', { date: eventDate }) : tx('Empieza el {{date}} a las {{time}}.', { date: eventDate, time: event.startTime }),
    channelId: CALENDAR_EVENT_CHANNEL,
    isExactNotification: access.exact,
    schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
    extra: { source: CALENDAR_SNOOZE_SOURCE, kind: 'calendar', calendarEventId: event.id, snoozed: true },
  }] })
}

export async function syncTimerNotifications(timers: Timer[]) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const now = Date.now()
    const activeTimers = timers.filter((timer) => timer.endsAt && new Date(timer.endsAt).getTime() > now)
    const notifications = await Promise.all(activeTimers.map(async (timer) => ({
      id: notificationId(`timer:${timer.id}`),
      title: timer.label.trim() || tx('Temporizador'),
      body: tx('El temporizador ha terminado.'),
      channelId: await configureTimerChannel(timer),
      schedule: { at: new Date(timer.endsAt as string), allowWhileIdle: true },
      extra: { source: TIMER_SOURCE, kind: 'timer', timerId: timer.id },
    })))
    const timerIds = new Set(timers.map((timer) => timer.id))
    await reconcileNotifications(TIMER_SOURCE, notifications, (notification) => (
      notification.extra?.source === TIMER_SOURCE
      && typeof notification.extra.timerId === 'string'
      && !timerIds.has(notification.extra.timerId)
    ))
  } catch (error) {
    console.warn('No se han podido sincronizar los temporizadores.', error)
  }
}
