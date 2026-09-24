import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Alarm, Note } from './dashboardState'

const REMINDER_SOURCE = 'pablo-tablet-note'
const ALARM_SOURCE = 'pablo-tablet-alarm'

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

    const notifications = alarms.filter((alarm) => alarm.enabled).map((alarm) => {
      const [hour, minute] = alarm.time.split(':').map(Number)
      return {
        id: notificationId(`alarm:${alarm.id}`),
        title: alarm.label.trim() || 'Alarma',
        body: `Alarma programada para las ${alarm.time}.`,
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        extra: { source: ALARM_SOURCE, alarmId: alarm.id },
      }
    })
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
  } catch (error) {
    console.warn('No se han podido sincronizar las alarmas locales.', error)
  }
}
