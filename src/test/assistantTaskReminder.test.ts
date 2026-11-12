import { describe, expect, it, vi } from 'vitest'
import { AssistantTimeRequired, validateAssistantCommand } from '../assistant/contracts'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'
import { executeAssistantCommand, assistantCommandSummary } from '../assistant/executor'
import { taskReminderTime } from '../assistant/taskReminder'
import { DEFAULT_DASHBOARD_STATE, loadDashboardState, saveDashboardState } from '../dashboardState'

const provider = new LocalAssistantProvider()
const now = new Date('2026-11-12T09:00:00Z')
const request = (text: string) => ({ text, locale: 'es-ES' as const, now: now.toISOString(), timeZone: 'Europe/Madrid' })
const environment = { now, homeWeatherLocation: null, homeWeatherForecast: null, createId: () => crypto.randomUUID(), language: 'es' as const }

async function clarification(text: string, context?: AssistantTimeRequired['context']) {
  try { await planAssistantRequest(provider, { ...request(text), timeClarification: context }) } catch (error) {
    expect(error).toBeInstanceOf(AssistantTimeRequired)
    return (error as AssistantTimeRequired).context
  }
  throw new Error('Expected clarification')
}

describe('tarea con recordatorio conversacional', () => {
  it('pregunta la hora y el tramo del día, guarda solo al confirmar y conserva el aviso', async () => {
    const context = await clarification('Recuérdame el próximo viernes que vaya a comprar pilas')
    expect(context).toEqual({ title: 'comprar pilas', date: '2026-11-13', timeZone: 'Europe/Madrid' })
    const ambiguous = await clarification('a las siete', context)
    expect(ambiguous.hour).toBe(7)
    const plan = await planAssistantRequest(provider, { ...request('por la tarde'), timeClarification: ambiguous })
    expect(plan.command).toMatchObject({ type: 'create_task_reminder', args: { title: 'comprar pilas', date: '2026-11-13', time: '19:00' } })
    const execute = vi.fn(async command => executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), command, environment))
    await expect(executeAssistantPlan(plan, { execute })).rejects.toThrow('confirmación explícita')
    expect(execute).not.toHaveBeenCalled()
    const result = await executeAssistantPlan(plan, { execute }, true) as ReturnType<typeof executeAssistantCommand>
    saveDashboardState(result.state)
    const task = loadDashboardState().calendarEvents[0]
    expect(task).toMatchObject({ title: 'comprar pilas', date: '2026-11-13', startTime: '19:00', allDay: false, type: 'task', source: 'local', reminders: [{ date: '2026-11-13', time: '18:30' }] })
    expect(task.id).not.toBe(task.reminders[0].id)
    expect(assistantCommandSummary(plan.command, 'es', now).details.join(' ')).toContain('18:30')
    await expect(executeAssistantPlan(plan, { execute }, true)).rejects.toThrow('ya se ha procesado')
  })

  it.each([['a las siete de la mañana', '07:00'], ['a las 19:00', '19:00'], ['a las 07:00', '07:00'], ['a las siete y media de la tarde', '19:30']])('acepta hora explícita %s', async (time, expected) => {
    const plan = await planAssistantRequest(provider, request(`Recuérdame el próximo viernes ${time} que vaya a comprar pilas`))
    expect(plan.command).toMatchObject({ type: 'create_task_reminder', args: { time: expected } })
  })

  it('no inventa las siete para una petición sin hora y rechaza las horas inválidas', async () => {
    const context = await clarification('Recuérdame mañana que vaya a comprar pilas')
    expect(context.hour).toBeUndefined()
    await clarification('a las 25:70', context)
    expect(() => validateAssistantCommand({ type: 'create_task_reminder', args: { ...context, time: '25:00' } })).toThrow()
  })

  it('calcula el aviso del día anterior y rechaza avisos pasados antes de guardar', () => {
    expect(taskReminderTime('2027-01-01', '00:15')).toEqual({ date: '2026-12-31', time: '23:45' })
    expect(() => executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), { type: 'create_task_reminder', args: { title: 'prueba', date: '2026-11-11', timeZone: 'Europe/Madrid', time: '19:00' } }, environment)).toThrow('ya ha pasado')
  })
})
