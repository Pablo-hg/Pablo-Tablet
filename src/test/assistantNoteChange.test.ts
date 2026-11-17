import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_STATE } from '../dashboardState'
import { executeAssistantCommand } from '../assistant/executor'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { prepareAssistantCommand } from '../assistant/prepare'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'

const env = { now: new Date('2026-11-17T09:00:00Z'), homeWeatherLocation: null, homeWeatherForecast: null, createId: () => 'note-id' }
const request = (text: string) => ({ text, locale: 'es-ES' as const, now: env.now.toISOString(), timeZone: 'Europe/Madrid' })
const initial = () => executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), { type: 'create_note', args: { title: 'Compra', content: 'Leche y pan', reminderAt: null } }, env).state

describe('modificar nota local', () => {
  it('exige confirmación y cambia el título sin alterar el contenido', async () => {
    const state = initial()
    const raw = await planAssistantRequest(new LocalAssistantProvider(), request('Renombra la nota Compra a Lista'))
    const plan = { ...raw, command: prepareAssistantCommand(state, raw.command, env.now) }
    const executor = { execute: async (command: typeof plan.command) => executeAssistantCommand(state, command, env) }
    await expect(executeAssistantPlan(plan, executor)).rejects.toThrow('confirmación')
    const result = await executeAssistantPlan(plan, executor, true) as ReturnType<typeof executeAssistantCommand>
    expect(result.state.notes[0]).toMatchObject({ title: 'Lista', content: 'Leche y pan' })
    expect(state.notes[0].title).toBe('Compra')
  })
  it('rechaza duplicados, notas archivadas y cambios posteriores', async () => {
    const state = initial()
    const raw = await planAssistantRequest(new LocalAssistantProvider(), request('Renombra la nota Compra a Lista'))
    const note = state.notes[0]
    expect(() => prepareAssistantCommand({ ...state, notes: [note, { ...note, id: 'second' }] }, raw.command, env.now)).toThrow('varias notas')
    expect(() => prepareAssistantCommand({ ...state, notes: [{ ...note, archived: true }] }, raw.command, env.now)).toThrow('nota activa')
    const command = prepareAssistantCommand(state, raw.command, env.now)
    expect(() => executeAssistantCommand({ ...state, notes: [{ ...note, content: 'Contenido actualizado' }] }, command, env)).toThrow('ha cambiado')
  })
})
