import { describe, expect, it } from 'vitest'
import { getUpcomingWidgetAlarms } from '../clockWidgetAlarms'
import type { Alarm } from '../dashboardState'

const alarm = (id: string, time: string, weekdays: Alarm['weekdays'], enabled = true): Alarm => ({ id, time, weekdays, enabled, label: id, soundName: 'Predeterminado', soundUri: null, createdAt: '2026-10-29T00:00:00Z' })

describe('próximas alarmas del widget', () => {
  it('ordena por el siguiente disparo semanal, no solo por la hora', () => {
    const now = new Date(2026, 9, 29, 10, 0)
    const result = getUpcomingWidgetAlarms([alarm('mañana', '08:00', [6]), alarm('hoy', '11:00', [5]), alarm('próxima semana', '09:00', [5])], now)
    expect(result.map(item => item.alarm.id)).toEqual(['hoy', 'mañana', 'próxima semana'])
    expect(result.map(item => item.nextAt.getDate())).toEqual([29, 30, 5])
  })

  it('excluye las desactivadas y no repite cada día la misma alarma', () => {
    const now = new Date(2026, 9, 29, 10, 0)
    const result = getUpcomingWidgetAlarms([alarm('apagada', '11:00', [5], false), alarm('diaria', '12:00', [1, 2, 3, 4, 5, 6, 7])], now)
    expect(result).toHaveLength(1)
    expect(result[0].alarm.id).toBe('diaria')
    expect(result[0].nextAt.getHours()).toBe(12)
  })

  it('respeta el domingo de Android y descarta el minuto ya pasado', () => {
    const now = new Date(2026, 9, 31, 23, 59, 30)
    const result = getUpcomingWidgetAlarms([alarm('domingo', '00:01', [1]), alarm('sábado', '23:59', [7])], now)
    expect(result.map(item => item.alarm.id)).toEqual(['domingo', 'sábado'])
    expect(result[0].nextAt.getDay()).toBe(0)
    expect(result[0].nextAt.getMonth()).toBe(10)
    expect(result[1].nextAt.getDate()).toBe(7)
  })
})
