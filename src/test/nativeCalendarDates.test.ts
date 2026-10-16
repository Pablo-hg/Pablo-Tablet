import { describe, expect, it } from 'vitest'
import { nativeCalendarEventsForYears } from '../nativeCalendarDates'

describe('calendario nativo de la tablet', () => {
  it('incluye festivos nacionales y fechas señaladas de 2026', () => {
    const events = nativeCalendarEventsForYears([2026])
    const byTitle = new Map(events.map((event) => [event.title, event]))

    expect(byTitle.get('Navidad')).toMatchObject({ date: '2026-12-25', source: 'native', nativeCategory: 'holiday', allDay: true })
    expect(byTitle.get('Viernes Santo')).toMatchObject({ date: '2026-04-03', nativeCategory: 'holiday' })
    expect(byTitle.get('Día del Padre')).toMatchObject({ date: '2026-03-19', nativeCategory: 'observance' })
    expect(byTitle.get('Día de la Madre')).toMatchObject({ date: '2026-05-03', nativeCategory: 'observance' })
    expect(new Set(events.map((event) => event.color))).toEqual(new Set(['mint']))
  })

  it('calcula automáticamente los dos cambios de hora de cada año', () => {
    const events = nativeCalendarEventsForYears([2026, 2027])
    const matches = (title: string) => events.filter((event) => event.title === title).map((event) => event.date)

    expect(matches('Cambio al horario de verano')).toEqual(['2026-03-29', '2027-03-28'])
    expect(matches('Cambio al horario de invierno')).toEqual(['2026-10-25', '2027-10-31'])
  })

  it('no duplica años solicitados más de una vez', () => {
    const events = nativeCalendarEventsForYears([2026, 2026])
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length)
    expect(events).toHaveLength(14)
  })
})
