import { describe, expect, it } from 'vitest'
import { assistantDateText } from '../assistant/dateText'
import { executeAssistantCommand } from '../assistant/executor'
import { DEFAULT_DASHBOARD_STATE } from '../dashboardState'

const now = new Date('2026-11-12T09:00:00Z')
describe('fechas de Lumi para lectura natural', () => {
  it.each([
    ['2026-11-12', 'hoy, jueves, día 12'],
    ['2026-11-13', 'mañana, viernes, día 13'],
    ['2026-11-14', 'pasado mañana, sábado, día 14'],
    ['2026-11-16', 'la semana que viene, lunes, día 16'],
    ['2026-12-13', 'el mes que viene, diciembre, domingo, día 13'],
    ['2027-01-13', 'miércoles, día 13, enero, 2027'],
  ])('describe %s como %s', (date, expected) => {
    expect(assistantDateText(date, now, 'Europe/Madrid')).toBe(expected)
  })
  it('utiliza el día civil en la zona de la tarea, incluso con cambio de horario', () => {
    expect(assistantDateText('2026-11-14', new Date('2026-11-12T23:30:00Z'), 'Europe/Madrid')).toBe('mañana, sábado, día 14')
    expect(assistantDateText('2026-03-30', new Date('2026-03-28T23:30:00Z'), 'Europe/Madrid')).toBe('mañana, lunes, día 30')
  })
  it('traduce las referencias relativas', () => {
    expect(assistantDateText('2026-11-13', now, 'Europe/Madrid', 'en')).toBe('tomorrow, Friday, day 13')
  })
  it('utiliza la fecha natural en la confirmación de creación', () => {
    const result = executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), { type: 'create_task', args: { title: 'comprar pilas', date: '2026-11-13', timeZone: 'Europe/Madrid' } }, { now, createId: () => 'task-id', homeWeatherLocation: null, homeWeatherForecast: null, language: 'es' })
    expect(result.response).toBe('Tarea «comprar pilas» creada en el calendario local para mañana, viernes, día 13.')
    expect(result.state.calendarEvents[0].date).toBe('2026-11-13')
  })
})
