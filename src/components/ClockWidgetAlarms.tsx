import type { Alarm } from '../dashboardState'
import { getUpcomingWidgetAlarms } from '../clockWidgetAlarms'
import { activeLocale, tx } from '../i18n'
import { toLocalDateKey } from '../calendarRecurrence'

export function ClockWidgetAlarms({ alarms, now }: { alarms: Alarm[]; now: Date }) {
  const upcoming = getUpcomingWidgetAlarms(alarms, now).slice(0, 4)
  if (!upcoming.length) return null
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  return <section className="clock-widget-alarms" aria-label={tx('Próximas alarmas')}>
    <h2>{tx('Próximas alarmas')}</h2>
    <ul>{upcoming.map(({ alarm, nextAt }) => <li key={alarm.id}>
      <time dateTime={nextAt.toISOString()}>{alarm.time}</time>
      <span><strong>{alarm.label || tx('Alarma')}</strong><small>{toLocalDateKey(nextAt) === toLocalDateKey(now) ? tx('Hoy') : toLocalDateKey(nextAt) === toLocalDateKey(tomorrow) ? tx('Mañana') : new Intl.DateTimeFormat(activeLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(nextAt)}</small></span>
    </li>)}</ul>
  </section>
}
