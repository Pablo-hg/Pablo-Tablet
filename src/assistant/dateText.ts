import { addDaysToDateKey, dateKeyToDayNumber } from '../calendarRecurrence'
import { activeLocale, txFor, type SupportedLanguage } from '../i18n'

/** Describe una fecha civil sin convertirla a la zona horaria del motor de voz. */
export function assistantDateText(date: string, now: Date, timeZone: string, language: SupportedLanguage = 'es') {
  const tx = (key: Parameters<typeof txFor>[1], options?: Parameters<typeof txFor>[2]) => txFor(language, key, options)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const value = new Date(`${date}T12:00:00Z`)
  const formatter = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(activeLocale(language), { ...options, timeZone: 'UTC' }).format(value)
  const day = tx('{{weekday}}, día {{day}}', { weekday: formatter({ weekday: 'long' }), day: value.getUTCDate() })
  const delta = dateKeyToDayNumber(date) - dateKeyToDayNumber(today)
  if (delta >= 0 && delta <= 2) return `${tx(delta === 0 ? 'hoy' : delta === 1 ? 'mañana' : 'pasado mañana')}, ${day}`
  const monthDelta = (Number(date.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(today.slice(5, 7))
  if (monthDelta === 1) return `${tx('el mes que viene')}, ${formatter({ month: 'long' })}, ${day}${date.slice(0, 4) !== today.slice(0, 4) ? `, ${value.getUTCFullYear()}` : ''}`
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  const nextMonday = addDaysToDateKey(today, 7 - ((weekday + 6) % 7))
  if (date >= nextMonday && date < addDaysToDateKey(nextMonday, 7)) return `${tx('la semana que viene')}, ${day}`
  return `${day}, ${formatter({ month: 'long' })}${date.slice(0, 4) !== today.slice(0, 4) ? `, ${value.getUTCFullYear()}` : ''}`
}
