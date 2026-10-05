import { describe, expect, it } from 'vitest'
import { calendarEventTiming } from '../../public/mobile/calendarTiming.js'

const baseEvent = {
  type: 'event',
  recurrence: 'none',
  completed: false,
  date: '2026-10-01',
  endDate: '2026-10-03',
  startTime: '09:00',
  endTime: '18:00',
  allDay: false,
}

describe('estado de eventos en la administración móvil', () => {
  it('calcula la duración inclusiva y marca un evento terminado', () => {
    expect(calendarEventTiming(baseEvent, new Date(2026, 9, 4, 10, 0))).toMatchObject({
      durationDays: 3,
      durationLabel: '3 días',
      ended: true,
      status: 'Finalizado',
    })
  })

  it('mantiene activo un evento de todo el día hasta que termine la fecha actual', () => {
    const event = { ...baseEvent, date: '2026-10-04', endDate: '2026-10-04', allDay: true }
    expect(calendarEventTiming(event, new Date(2026, 9, 4, 23, 50))).toMatchObject({ ended: false, status: 'En curso' })
  })

  it('marca como finalizado un evento cuando pasa su hora de fin', () => {
    const event = { ...baseEvent, date: '2026-10-04', endDate: '2026-10-04', endTime: '10:30' }
    expect(calendarEventTiming(event, new Date(2026, 9, 4, 10, 31))).toMatchObject({ ended: true, status: 'Finalizado' })
  })

  it('distingue una tarea vencida de una tarea completada', () => {
    const task = { ...baseEvent, type: 'task', date: '2026-10-01', endDate: '2026-10-01' }
    expect(calendarEventTiming(task, new Date(2026, 9, 4, 10, 0))).toMatchObject({ ended: false, status: 'Vencida' })
    expect(calendarEventTiming({ ...task, completed: true }, new Date(2026, 9, 4, 10, 0))).toMatchObject({ ended: true, status: 'Finalizado' })
  })

  it('no da por finalizada una serie recurrente por la fecha de su primera aparición', () => {
    const recurring = { ...baseEvent, recurrence: 'weekly' }
    expect(calendarEventTiming(recurring, new Date(2026, 9, 20, 10, 0))).toMatchObject({ ended: false, status: 'Se repite' })
  })
})
