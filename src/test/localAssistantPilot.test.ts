import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'
import { validateAssistantCommand } from '../assistant/contracts'
import { executeAssistantCommand } from '../assistant/executor'
import { DEFAULT_DASHBOARD_STATE, loadDashboardState, saveDashboardState } from '../dashboardState'

const provider = new LocalAssistantProvider()
const request = (text: string) => ({ text, locale: 'es-ES' as const, now: '2026-11-12T23:30:00Z', timeZone: 'Europe/Madrid' })
const environment = { now: new Date('2026-11-12T23:30:00Z'), homeWeatherLocation: null, homeWeatherForecast: null, createId: () => 'pilot-task' }

beforeEach(() => localStorage.clear())

describe('piloto local de Lumi', () => {
  it('crea con confirmación, persiste y consulta la tarea sin acceso a red', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Sin red'))
    try {
      let state = structuredClone(DEFAULT_DASHBOARD_STATE)
      const plan = await planAssistantRequest(provider, request('Crea una tarea para mañana: comprar pilas'))
      expect(plan.requiresConfirmation).toBe(true)
      expect(plan.command).toMatchObject({ type: 'create_task', args: { date: '2026-11-14' } })
      const execute = vi.fn(async (command) => {
        const result = executeAssistantCommand(state, command, environment)
        saveDashboardState(result.state)
        state = loadDashboardState()
        return result
      })
      await expect(executeAssistantPlan(plan, { execute })).rejects.toThrow('confirmación explícita')
      expect(state.calendarEvents).toHaveLength(0)
      await executeAssistantPlan(plan, { execute }, true)
      await expect(executeAssistantPlan(plan, { execute }, true)).rejects.toThrow('ya se ha procesado')
      expect(execute).toHaveBeenCalledOnce()
      expect(state.calendarEvents).toHaveLength(1)
      expect(state.calendarEvents[0]).toMatchObject({ type: 'task', source: 'local', accountId: null, calendarId: null, syncStatus: 'local', allDay: true, reminders: [], title: 'comprar pilas' })
      expect(state.calendarOutbox).toHaveLength(0)
      const query = await planAssistantRequest(provider, request('¿Qué tengo mañana?'))
      const result = executeAssistantCommand(state, query.command, environment)
      expect(result.state).toBe(state)
      expect(result.response).toContain('comprar pilas')
      expect(network).not.toHaveBeenCalled()
    } finally { network.mockRestore() }
  })

  it.each(['Crea una tarea: comprar pilas', 'Crea una tarea para el viernes: comprar pilas', 'Crea una tarea para 2026-02-30: comprar pilas', `Crea una tarea para hoy: ${'a'.repeat(121)}`])('rechaza peticiones incompletas o inválidas: %s', async (text) => {
    await expect(planAssistantRequest(provider, request(text))).rejects.toThrow()
  })

  it('admite inglés y una fecha explícita', async () => {
    const plan = await planAssistantRequest(provider, { ...request('Create a task for 2026-12-01: buy batteries'), locale: 'en-GB' })
    expect(plan.command).toEqual({ type: 'create_task', args: { title: 'buy batteries', date: '2026-12-01', timeZone: 'Europe/Madrid' } })
  })

  it('rechaza destinos externos y zonas inválidas en el contrato', () => {
    const args = { title: 'Comprar pilas', date: '2026-11-14', timeZone: 'Europe/Madrid' }
    expect(() => validateAssistantCommand({ type: 'create_task', args: { ...args, accountId: 'google' } })).toThrow()
    expect(() => validateAssistantCommand({ type: 'create_task', args: { ...args, timeZone: 'wrong' } })).toThrow()
  })
})
