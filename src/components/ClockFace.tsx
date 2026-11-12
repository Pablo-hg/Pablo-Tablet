import type { ClockWidgetStyle } from '../clockStyles'
import { activeLocale } from '../i18n'

interface ClockFaceProps {
  now: Date
  style: ClockWidgetStyle
  showSeconds?: boolean
}

/** Uses the application's clock tick; no animation loop or additional timer. */
export function ClockFace({ now, style, showSeconds = false }: ClockFaceProps) {
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const time = `${hours}:${minutes}`
  const spokenTime = new Intl.DateTimeFormat(activeLocale(), {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(showSeconds ? { second: '2-digit' } : {}),
  }).format(now)
  const analog = style === 'analog' || style === 'analog-minimal'

  return <time className={`time clock-face clock-face--${style}`} dateTime={`${time}${showSeconds ? `:${seconds}` : ''}`} aria-label={spokenTime}>
    {analog ? <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle className="clock-dial" cx="100" cy="100" r="94" />
      {Array.from({ length: 60 }, (_, index) => <line key={index}
        className={index % 5 === 0 ? 'clock-tick is-hour' : 'clock-tick'}
        x1="100" y1={index % 5 === 0 ? 14 : 18} x2="100" y2="22"
        transform={`rotate(${index * 6} 100 100)`} />)}
      {style === 'analog' ? Array.from({ length: 12 }, (_, index) => {
        const hour = index + 1
        const angle = hour * Math.PI / 6
        return <text key={hour} className="clock-numeral" x={100 + Math.sin(angle) * 65} y={100 - Math.cos(angle) * 65}>{hour}</text>
      }) : null}
      <line className="clock-hand clock-hand-hour" x1="100" y1="105" x2="100" y2="56" transform={`rotate(${(now.getHours() % 12) * 30 + now.getMinutes() * .5} 100 100)`} />
      <line className="clock-hand clock-hand-minute" x1="100" y1="108" x2="100" y2="30" transform={`rotate(${now.getMinutes() * 6 + now.getSeconds() * .1} 100 100)`} />
      {showSeconds ? <line className="clock-hand clock-hand-second" x1="100" y1="115" x2="100" y2="27" transform={`rotate(${now.getSeconds() * 6} 100 100)`} /> : null}
      <circle className="clock-pivot" cx="100" cy="100" r="4" />
    </svg> : style === 'digital-blocks' ? <span className="clock-digit-blocks" aria-hidden="true"><span>{hours}</span><b>:</b><span>{minutes}</span>{showSeconds ? <small>:{seconds}</small> : null}</span>
      : <>{time}{showSeconds ? <small>:{seconds}</small> : null}</>}
  </time>
}
