import type { CalendarEvent, CalendarEventColor, NativeCalendarEventCategory } from './dashboardState'
import { addDaysToDateKey, toLocalDateKey } from './calendarRecurrence'

type NativeDateDefinition = {
  title: string
  date: string
  category: NativeCalendarEventCategory
  detail: string
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return dateKey(year, month, day)
}

function firstSunday(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  return toLocalDateKey(new Date(year, month - 1, 1 + ((7 - first.getDay()) % 7)))
}

function lastSunday(year: number, month: number) {
  const last = new Date(year, month, 0)
  return toLocalDateKey(new Date(year, month - 1, last.getDate() - last.getDay()))
}

function definitionsForYear(year: number): NativeDateDefinition[] {
  const summerTime = lastSunday(year, 3)
  const winterTime = lastSunday(year, 10)
  return [
    { title: 'Año Nuevo', date: dateKey(year, 1, 1), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Día de Reyes', date: dateKey(year, 1, 6), category: 'holiday', detail: 'Festivo nacional · Epifanía del Señor' },
    { title: 'Día del Padre', date: dateKey(year, 3, 19), category: 'observance', detail: 'Fecha señalada' },
    { title: 'Cambio al horario de verano', date: summerTime, category: 'clock-change', detail: 'Cambio de hora · A las 02:00 serán las 03:00' },
    { title: 'Viernes Santo', date: addDaysToDateKey(easterSunday(year), -2), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Día del Trabajo', date: dateKey(year, 5, 1), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Día de la Madre', date: firstSunday(year, 5), category: 'observance', detail: 'Fecha señalada · Primer domingo de mayo' },
    { title: 'Asunción de la Virgen', date: dateKey(year, 8, 15), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Fiesta Nacional de España', date: dateKey(year, 10, 12), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Cambio al horario de invierno', date: winterTime, category: 'clock-change', detail: 'Cambio de hora · A las 03:00 serán las 02:00' },
    { title: 'Todos los Santos', date: dateKey(year, 11, 1), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Día de la Constitución', date: dateKey(year, 12, 6), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Inmaculada Concepción', date: dateKey(year, 12, 8), category: 'holiday', detail: 'Festivo nacional' },
    { title: 'Navidad', date: dateKey(year, 12, 25), category: 'holiday', detail: 'Festivo nacional' },
  ]
}

const categoryColor: Record<NativeCalendarEventCategory, CalendarEventColor> = {
  holiday: 'mint',
  observance: 'mint',
  'clock-change': 'mint',
}

function nativeEvent(definition: NativeDateDefinition): CalendarEvent {
  const timestamp = `${definition.date}T00:00:00.000Z`
  return {
    id: `native:${definition.category}:${definition.date}:${definition.title}`,
    source: 'native',
    nativeCategory: definition.category,
    accountId: null,
    calendarId: null,
    externalId: null,
    externalVersion: null,
    syncStatus: 'local',
    type: 'event',
    recurrence: 'none',
    completed: false,
    title: definition.title,
    date: definition.date,
    endDate: definition.date,
    startTime: '00:00',
    endTime: '23:59',
    allDay: true,
    timeZone: 'Europe/Madrid',
    location: '',
    notes: definition.detail,
    color: categoryColor[definition.category],
    reminders: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function nativeCalendarEventsForYears(years: number[]) {
  return [...new Set(years)]
    .flatMap(definitionsForYear)
    .map(nativeEvent)
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title))
}
