import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_STATE } from '../dashboardState'
import { executeAssistantCommand } from '../assistant/executor'
import { prepareAssistantCommand } from '../assistant/prepare'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'

const env = { now: new Date('2026-11-17T09:00:00Z'), homeWeatherLocation: null, homeWeatherForecast: null, createId: () => 'task-id' }
const request = (text: string) => ({ text, locale: 'es-ES' as const, now: env.now.toISOString(), timeZone: 'Europe/Madrid' })
const initial = () => executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), { type: 'create_task', args: { title: 'comprar pilas', date: '2026-11-18', timeZone: 'Europe/Madrid' } }, env).state

describe('modificación segura de tareas', () => {
  it('propone cambiar el nombre y exige confirmación', async () => {
    const state = initial()
    const raw = await planAssistantRequest(new LocalAssistantProvider(), request('Renombra la tarea comprar pilas a comprar pan'))
    const plan = { ...raw, command: prepareAssistantCommand(state, raw.command, env.now) }
    const executor = { execute: async (command: typeof plan.command) => executeAssistantCommand(state, command, env) }
    await expect(executeAssistantPlan(plan, executor)).rejects.toThrow('confirmación')
    const result = await executeAssistantPlan(plan, executor, true) as ReturnType<typeof executeAssistantCommand>
    expect(result.state.calendarEvents[0].title).toBe('comprar pan')
    expect(state.calendarEvents[0].title).toBe('comprar pilas')
  })
  it.each(['Completa la tarea de comprar pilas', 'Renombra la tarea de comprar pilas a comprar pan'])('entiende «tarea de» en %s', async text => {
    const state = initial()
    const plan = await planAssistantRequest(new LocalAssistantProvider(), request(text))
    expect(prepareAssistantCommand(state, plan.command, env.now)).toMatchObject({ type: 'update_local_task', args: { title: 'comprar pilas' } })
  })
  it('rechaza tareas ambiguas, externas o repetitivas', async () => {
    const state = initial()
    const plan = await planAssistantRequest(new LocalAssistantProvider(), request('Completa la tarea comprar pilas'))
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [...state.calendarEvents, { ...state.calendarEvents[0], id: 'other' }] }, plan.command)).toThrow('2 tareas pendientes')
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [{ ...state.calendarEvents[0], source: 'google' }] }, plan.command)).toThrow('locales')
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [{ ...state.calendarEvents[0], recurrence: 'weekly' }] }, plan.command)).toThrow('repetición')
  })
  it('ignora tareas completadas o pendientes de borrado y elige la única pendiente', async () => {
    const state = initial()
    const original = state.calendarEvents[0]
    const plan = await planAssistantRequest(new LocalAssistantProvider(), request('Completa la tarea comprar pilas'))
    const mixed = { ...state, calendarEvents: [original, { ...original, id: 'completed', completed: true }, { ...original, id: 'deleted', syncStatus: 'pending-delete' as const }] }
    expect(prepareAssistantCommand(mixed, plan.command)).toMatchObject({ type: 'update_local_task', args: { id: original.id } })
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [{ ...original, completed: true }] }, plan.command)).toThrow('ninguna tarea pendiente')
  })
  it('muestra fechas al haber coincidencias y acepta elegir una fecha', async () => {
    const state = initial()
    const duplicate = { ...state.calendarEvents[0], id: 'otra', date: '2026-11-20', endDate: '2026-11-20' }
    const multiple = { ...state, calendarEvents: [...state.calendarEvents, duplicate] }
    const provider = new LocalAssistantProvider()
    const ambiguous = await planAssistantRequest(provider, request('Completa la tarea comprar pilas'))
    expect(() => prepareAssistantCommand(multiple, ambiguous.command, env.now)).toThrow('2026-11-18, 2026-11-20')
    const precise = await planAssistantRequest(provider, request('Completa la tarea comprar pilas para mañana'))
    expect(prepareAssistantCommand(multiple, precise.command, env.now)).toMatchObject({ type: 'update_local_task', args: { id: 'task-id' } })
  })
  it('prioriza una tarea futura sobre otra pendiente en el pasado, salvo fecha explícita', async () => {
    const state = initial()
    const past = { ...state.calendarEvents[0], id: 'anterior', date: '2026-11-14', endDate: '2026-11-14' }
    const multiple = { ...state, calendarEvents: [past, ...state.calendarEvents] }
    const provider = new LocalAssistantProvider()
    const plan = await planAssistantRequest(provider, request('Renombra la tarea comprar pilas a comprar pan'))
    expect(prepareAssistantCommand(multiple, plan.command, env.now)).toMatchObject({ args: { id: 'task-id' } })
    const dated = await planAssistantRequest(provider, request('Completa la tarea comprar pilas del 2026-11-14'))
    expect(prepareAssistantCommand(multiple, dated.command, env.now)).toMatchObject({ args: { id: 'anterior' } })
  })
  it('elige la más reciente cuando todas las tareas pendientes son pasadas', async () => {
    const state = initial()
    const old = { ...state.calendarEvents[0], id: 'antigua', date: '2026-11-10', endDate: '2026-11-10' }
    const recent = { ...state.calendarEvents[0], id: 'reciente', date: '2026-11-14', endDate: '2026-11-14' }
    const plan = await planAssistantRequest(new LocalAssistantProvider(), request('Completa la tarea comprar pilas'))
    expect(prepareAssistantCommand({ ...state, calendarEvents: [old, recent] }, plan.command, env.now)).toMatchObject({ args: { id: 'reciente' } })
    expect(() => prepareAssistantCommand({ ...state, calendarEvents: [recent, { ...recent, id: 'misma-fecha' }] }, plan.command, env.now)).toThrow('2 tareas pendientes')
  })
  it('rechaza confirmar si la tarea cambió después de la propuesta', async () => {
    const state = initial()
    const plan = await planAssistantRequest(new LocalAssistantProvider(), request('Completa la tarea comprar pilas'))
    const command = prepareAssistantCommand(state, plan.command, env.now)
    const changed = { ...state, calendarEvents: [{ ...state.calendarEvents[0], title: 'otro título' }] }
    expect(() => executeAssistantCommand(changed, command, env)).toThrow('ha cambiado')
    expect(executeAssistantCommand(state, command, env).state.calendarEvents[0].completed).toBe(true)
  })
})
