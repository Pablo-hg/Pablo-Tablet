import type { Alarm } from './dashboardState'

export function getUpcomingWidgetAlarms(alarms: Alarm[], now: Date) {
  return alarms.filter(alarm => alarm.enabled).flatMap(alarm => {
    const [hours, minutes] = alarm.time.split(':').map(Number)
    for (let offset = 0; offset <= 7; offset++) {
      const nextAt = new Date(now)
      nextAt.setDate(now.getDate() + offset)
      nextAt.setHours(hours, minutes, 0, 0)
      if (nextAt > now && alarm.weekdays.includes((nextAt.getDay() + 1) as Alarm['weekdays'][number])) return [{ alarm, nextAt }]
    }
    return []
  }).sort((a, b) => a.nextAt.getTime() - b.nextAt.getTime() || a.alarm.id.localeCompare(b.alarm.id))
}
