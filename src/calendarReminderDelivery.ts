import { LocalNotifications } from '@capacitor/local-notifications'

/** Android's delivered list has no app `extra`; recover stored payloads by ID. */
export async function deliveredCalendarReminders() {
  const delivered = await LocalNotifications.getDeliveredNotifications()
  if (!delivered.notifications.length) return []
  const stored = await LocalNotifications.getByIds({ ids: delivered.notifications.map(notification => notification.id) })
  return stored.notifications.filter(notification => notification.extra?.kind === 'calendar')
}
