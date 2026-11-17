import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_STATE } from '../dashboardState'
import { executeAssistantCommand } from '../assistant/executor'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { prepareAssistantCommand } from '../assistant/prepare'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'

const env = { now: new Date('2026-11-17T09:00:00Z'), homeWeatherLocation: null, homeWeatherForecast: null, createId: () => 'event-id' }
const request = (text: string) => ({ text, locale: 'es-ES' as const, now: env.now.toISOString(), timeZone: 'Europe/Madrid' })
const initial = () => executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), { type: 'create_event', args: { title: 'fútbol', date: '2026-11-18', timeZone: 'Europe/Madrid', startTime: '19:00', endTime: '20:00' } }, env).state

describe('modificar evento local', () => {
  it('exige confirmación y renombra el evento elegido', async () => {
    const state = initial()
    const raw = await planAssistantRequest(new LocalAssistantProvider(), request('Renombra el evento fútbol a entrenamiento'))
    const plan = { ...raw, command: prepareAssistantCommand(state, raw.command, env.now) }
    const executor = { execute: async (command: typeof plan.command) => executeAssistantCommand(state, command, env) }
    await expect(executeAssistantPlan(plan, executor)).rejects.toThrow('confirmación')
    const result = await executeAssistantPlan(plan, executor, true) as ReturnType<typeof executeAssistantCommand>
    expect(result.state.calendarEvents[0]).toMatchObject({ title: 'entrenamiento', startTime: '19:00', endTime: '20:00' })
    expect(state.calendarEvents[0].title).toBe('fútbol')
  })
  it('rechaza coincidencias múltiples, eventos externos y cambios posteriores', async () => {
    const state = initial()
    const raw = await planAssistantRequest(new LocalAssistantProvider(), request('Renombra el evento fútbol a entrenamiento'))
    const event = state.calendarEvents[0]
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [event, { ...event, id: 'second' }] }, raw.command, env.now)).toThrow('2 eventos')
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [{ ...event, source: 'google' }] }, raw.command, env.now)).toThrow('locales')
    const command = prepareAssistantCommand(state, raw.command, env.now)
    expect(() => executeAssistantCommand({ ...state, calendarEvents: [{ ...event, startTime: '18:00' }] }, command, env)).toThrow('ha cambiado')
  })
})
