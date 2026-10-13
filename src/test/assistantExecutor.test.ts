import { describe, expect, it } from 'vitest'
import { executeAssistantCommand } from '../assistant/executor'
import { DEFAULT_DASHBOARD_STATE, type DashboardState } from '../dashboardState'

const now = new Date('2026-10-11T09:00:00.000Z')

function state(): DashboardState {
  return structuredClone(DEFAULT_DASHBOARD_STATE)
}

const environment = {
  now,
  homeWeatherLocation: null,
  homeWeatherForecast: null,
  createId: () => 'assistant-id',
}

describe('ejecutor seguro del asistente', () => {
  it('responde a una consulta sin modificar el estado', () => {
    const current = state()
    const result = executeAssistantCommand(current, { type: 'get_local_help', args: { topic: 'Cómo cambio el brillo' } }, environment)

    expect(result.state).toBe(current)
    expect(result.response).toContain('Brillo automático')
  })

  it('crea una nota con los datos confirmados', () => {
    const current = state()
    const result = executeAssistantCommand(current, {
      type: 'create_note',
      args: { title: 'Comprar pilas', content: 'Comprar pilas', reminderAt: null },
    }, environment)

    expect(current.notes).toEqual([])
    expect(result.state.notes[0]).toMatchObject({ id: 'assistant-id', title: 'Comprar pilas', content: 'Comprar pilas' })
    expect(result.openPage).toBe('notes')
  })

  it('inicia un temporizador con una hora de fin calculada', () => {
    const result = executeAssistantCommand(state(), {
      type: 'start_timer',
      args: { label: 'Horno', durationSeconds: 1_200 },
    }, environment)

    expect(result.state.timers[0]).toMatchObject({
      id: 'assistant-id',
      label: 'Horno',
      durationSeconds: 1_200,
      remainingSeconds: 1_200,
      endsAt: '2026-10-11T09:20:00.000Z',
    })
  })

  it('crea una alarma únicamente para los días validados', () => {
    const result = executeAssistantCommand(state(), {
      type: 'create_alarm',
      args: { label: 'Despertar', at: '2026-10-12T07:30:00', repeatDays: [1, 2, 3, 4, 5] },
    }, environment)

    expect(result.state.alarms[0]).toMatchObject({ label: 'Despertar', time: '07:30', weekdays: [1, 2, 3, 4, 5], enabled: true })
    expect(result.openPage).toBe('clock')
  })
})
