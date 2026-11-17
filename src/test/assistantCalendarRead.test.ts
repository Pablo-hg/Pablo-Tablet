import { describe, expect, it } from 'vitest'
import { executeAssistantCommand } from '../assistant/executor'
import { DEFAULT_DASHBOARD_STATE, type CalendarEvent } from '../dashboardState'
import { validateAssistantCommand } from '../assistant/contracts'

const environment = { now: new Date('2026-11-16T12:00:00Z'), homeWeatherLocation: null, homeWeatherForecast: null, createId: () => 'id' }
const event = (id: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
  type: 'event', recurrence: 'none', completed: false, title: id, date: '2026-11-16', endDate: '2026-11-16',
  startTime: '10:00', endTime: '11:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'blue', reminders: [],
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...overrides,
})
const args = { from: '2026-11-16T00:00:00', to: '2026-11-22T23:59:59' }

describe('consultas de calendario de Lumi', () => {
  it('filtra tareas, repeticiones y estados sin modificar datos', () => {
    const state = structuredClone(DEFAULT_DASHBOARD_STATE)
    state.calendarEvents = [event('evento'), event('serie', { recurrence: 'weekly', date: '2026-11-09', endDate: '2026-11-09' }), event('pendiente', { type: 'task' }), event('hecha', { type: 'task', completed: true })]
    const result = executeAssistantCommand(state, { type: 'get_calendar', args: { ...args, type: 'task', taskStatus: 'completed' } }, environment)
    expect(result.state).toBe(state)
    expect(result.response).toContain('hecha')
    expect(result.response).not.toContain('pendiente')
    const events = executeAssistantCommand(state, { type: 'get_calendar', args: { ...args, type: 'event' } }, environment)
    expect(events.response).toContain('serie')
    expect(events.response).not.toContain('hecha')
  })
  it('avisa de sincronización y atribuye el calendario externo', () => {
    const state = structuredClone(DEFAULT_DASHBOARD_STATE)
    state.calendarAccounts = [{ id: 'g', provider: 'google', email: '', displayName: '', status: 'offline', enabled: true, lastSyncedAt: null, error: null }]
    state.externalCalendars = [{ id: 'cal', accountId: 'g', provider: 'google', remoteId: 'remote', name: 'Trabajo', color: 'blue', visible: true, readOnly: true }]
    state.calendarEvents = [event('externo', { source: 'google', accountId: 'g', calendarId: 'remote', syncStatus: 'pending-update' })]
    const result = executeAssistantCommand(state, { type: 'get_calendar', args }, environment)
    expect(result.response).toContain('Trabajo')
    expect(result.response).toContain('Sincronización pendiente')
    expect(result.response).toContain('podrían no estar actualizados')
  })
  it('conserva la lista escrita cuando hay muchos resultados', () => {
    const state = structuredClone(DEFAULT_DASHBOARD_STATE)
    state.calendarEvents = Array.from({ length: 80 }, (_, i) => event(`Evento número ${i} con un nombre largo`))
    const result = executeAssistantCommand(state, { type: 'get_calendar', args }, environment)
    expect(result.response).toContain('Evento número 79')
    expect(result.spokenResponse).toContain('80')
  })
  it('muestra todas las tareas encontradas y resume las listas largas por voz', () => {
    const state = structuredClone(DEFAULT_DASHBOARD_STATE)
    state.calendarEvents = Array.from({ length: 25 }, (_, i) => event(`Compra ${String(i).padStart(2, '0')}`, { type: 'task' }))
    const before = structuredClone(state)
    const result = executeAssistantCommand(state, { type: 'search_tasks', args: { query: 'compra' } }, environment)
    expect(result.response).toContain('Compra 24')
    expect(result.spokenResponse).toContain('25 tareas')
    expect(result.state).toBe(state)
    expect(state).toEqual(before)
  })
  it('advierte de la incertidumbre externa incluso sin resultados o con cuenta conectada', () => {
    const state = structuredClone(DEFAULT_DASHBOARD_STATE)
    state.calendarAccounts = [{ id: 'g', provider: 'google', email: '', displayName: '', status: 'connected', enabled: true, lastSyncedAt: null, error: null }]
    for (const command of [{ type: 'get_calendar', args }, { type: 'search_tasks', args: { query: 'ausente' } }, { type: 'get_daily_summary', args: { date: '2026-11-16' } }]) {
      const result = executeAssistantCommand(state, validateAssistantCommand(command), environment)
      expect(result.response).toContain('cancelaciones individuales')
      expect(result.state).toBe(state)
    }
  })
  it('no incluye eliminaciones pendientes en el resumen diario', () => {
    const state = structuredClone(DEFAULT_DASHBOARD_STATE)
    state.calendarEvents = [event('borrado', { syncStatus: 'pending-delete' })]
    const result = executeAssistantCommand(state, { type: 'get_daily_summary', args: { date: '2026-11-16' } }, environment)
    expect(result.response).toContain('ningún elemento')
  })
  it('rechaza rangos y consultas inválidos antes de ejecutarlos', () => {
    expect(() => validateAssistantCommand({ type: 'get_calendar', args: { from: '2026-01-01T00:00:00', to: '2026-03-01T23:59:59' } })).toThrow()
    expect(() => validateAssistantCommand({ type: 'search_tasks', args: { query: ' ' } })).toThrow()
    expect(() => validateAssistantCommand({ type: 'search_tasks', args: { query: 'x', extra: true } })).toThrow()
  })
})
