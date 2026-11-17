import { describe, expect, it } from 'vitest'
import { executeAssistantCommand } from '../assistant/executor'
import { DEFAULT_DASHBOARD_STATE, type DashboardState } from '../dashboardState'
import { validateAssistantCommand } from '../assistant/contracts'

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

  it('las consultas de datos no modifican el estado ni crean identificadores', () => {
    const current = state()
    const created = executeAssistantCommand(current, { type: 'create_note', args: { title: 'Compra', content: 'leche', reminderAt: null } }, environment).state
    const before = structuredClone(created)
    const commands = [
      { type: 'get_current_datetime', args: { part: 'time' } },
      { type: 'get_daily_summary', args: { date: '2026-10-11' } },
      { type: 'get_calendar', args: { from: '2026-10-11T00:00:00', to: '2026-10-11T23:59:59' } },
      { type: 'search_tasks', args: { query: 'compra' } },
      { type: 'get_notes', args: { limit: 5 } },
      { type: 'search_notes', args: { query: 'compra', limit: 5 } },
      { type: 'read_note', args: { query: 'compra' } },
      { type: 'read_note_id', args: { id: 'assistant-id' } },
      { type: 'get_clock_status', args: { include: 'both' } },
    ]
    for (const value of commands) {
      const result = executeAssistantCommand(created, validateAssistantCommand(value), { ...environment, createId: () => { throw new Error('una lectura no debe generar identificadores') } })
      expect(result.state).toBe(created)
      expect(created).toEqual(before)
    }
  })

  it('avisa si la búsqueda o lectura ambigua omite coincidencias', () => {
    const current = state()
    const note = executeAssistantCommand(current, { type: 'create_note', args: { title: 'Compra', content: 'leche', reminderAt: null } }, environment).state.notes[0]
    current.notes = Array.from({ length: 7 }, (_, index) => ({ ...note, id: String(index), title: `Compra ${index}` }))
    const search = executeAssistantCommand(current, { type: 'search_notes', args: { query: 'compra', limit: 5 } }, environment)
    const read = executeAssistantCommand(current, { type: 'read_note', args: { query: 'compra' } }, environment)
    expect(search.response).toContain('Hay más coincidencias')
    expect(read.response).toContain('Hay más coincidencias')
    expect(search.noteCandidates).toHaveLength(5)
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
