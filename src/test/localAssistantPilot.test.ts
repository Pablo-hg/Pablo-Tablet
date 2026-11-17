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

  it.each(['Crea una tarea para mañana comprar pilas', 'Añade una tarea para hoy llamar al taller'])('admite dictado sin puntuación: %s', async (text) => {
    const plan = await planAssistantRequest(provider, request(text))
    expect(plan.command.type).toBe('create_task')
    expect(plan.requiresConfirmation).toBe(true)
  })

  it.each(['Crea una tarea para pasado mañana comprar pilas', 'Create a task for the day after tomorrow buy batteries'])('interpreta pasado mañana sin inventar la fecha: %s', async (text) => {
    const plan = await planAssistantRequest(provider, request(text))
    expect(plan.command).toMatchObject({ type: 'create_task', args: { date: '2026-11-15' } })
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

describe('eventos locales de Lumi', () => {
  it('pide confirmación, crea un evento local y permite consultarlo tras recargar', async () => {
    let state = structuredClone(DEFAULT_DASHBOARD_STATE)
    const plan = await planAssistantRequest(provider, request('Crea un evento para mañana de 19:00 a 20:00: Fútbol'))
    expect(plan.requiresConfirmation).toBe(true)
    const execute = vi.fn(async (command) => {
      const result = executeAssistantCommand(state, command, environment)
      saveDashboardState(result.state)
      state = loadDashboardState()
      return result
    })
    await expect(executeAssistantPlan(plan, { execute })).rejects.toThrow('confirmación')
    expect(state.calendarEvents).toHaveLength(0)
    await executeAssistantPlan(plan, { execute }, true)
    await expect(executeAssistantPlan(plan, { execute }, true)).rejects.toThrow('ya se ha procesado')
    expect(state.calendarEvents).toHaveLength(1)
    expect(state.calendarEvents[0]).toMatchObject({ title: 'Fútbol', type: 'event', date: '2026-11-14', startTime: '19:00', endTime: '20:00', source: 'local' })
    const query = await planAssistantRequest(provider, request('¿Qué tengo mañana?'))
    expect(executeAssistantCommand(state, query.command, environment).response).toContain('Fútbol')
  })

  it.each(['Crea un evento para mañana: Fútbol', 'Crea un evento para 2026-02-30 de 19:00 a 20:00: Fútbol', 'Crea un evento para mañana de 20:00 a 19:00: Fútbol'])('rechaza fechas y horas incompletas o inválidas: %s', async (text) => {
    await expect(planAssistantRequest(provider, request(text))).rejects.toThrow()
  })
})


describe('horas de eventos dictadas', () => {
  it.each([
    'crea un evento para mañana de diecinueve a veinte fútbol',
    'crea un evento para mañana desde diecinueve a veinte fútbol',
    'crea un evento para mañana de 7 a 8 pm fútbol',
    'crea un evento para mañana de siete a ocho de la tarde fútbol',
    'añade al calendario que mañana tengo fútbol de siete a ocho  de la tarde',
    'añade que mañana tengo fútbol de siete a ocho de la tarde',
    'añade a calendario que mañana de 7 a 8 de la tarde hay fútbol',
    'que era un evento para mañana de siete a ocho de la tarde fútbol',
    'crea añade al calendario que mañana de 7 a 8 de la tarde tengo fútbol',
  ])('interpreta %s sin ejecutar la propuesta', async (text) => {
    const plan = await planAssistantRequest(provider, request(text))
    expect(plan.requiresConfirmation).toBe(true)
    expect(plan.command).toMatchObject({ type: 'create_event', args: { title: 'fútbol', startTime: '19:00', endTime: '20:00' } })
  })
  it('solicita aclaración para horas ambiguas', async () => {
    await expect(planAssistantRequest(provider, request('crea un evento para mañana de siete a ocho fútbol'))).rejects.toThrow('mañana o de la tarde')
  })
  it('no convierte una transcripción numérica dudosa en un título', async () => {
    await expect(planAssistantRequest(provider, request('crea un evento para mañana de 19:00 a 20 000 fútbol'))).rejects.toThrow()
  })
})


it('no trata una solicitud incompleta de escritura como consulta de calendario', async () => {
  await expect(planAssistantRequest(provider, request('añade al calendario que'))).rejects.toThrow('Indica fecha')
})


it('pide aclaración para un evento sin tramo horario incluso si la frase menciona calendario', async () => {
  await expect(planAssistantRequest(provider, request('añade al calendario un evento de que mañana de siete a ocho hay fútbol'))).rejects.toThrow('mañana o de la tarde')
})


describe('tipo de acción según el contexto', () => {
  it('interpreta una obligación como tarea local', async () => {
    const plan = await planAssistantRequest(provider, request('añade al calendario que mañana tengo que comprar pilas'))
    expect(plan.command).toMatchObject({ type: 'create_task', args: { title: 'comprar pilas' } })
    expect(plan.requiresConfirmation).toBe(true)
  })
  it('crea un cumpleaños anual solo después de confirmar', async () => {
    const plan = await planAssistantRequest(provider, request('añade al calendario que mañana es el cumpleaños de Ana'))
    expect(plan.command).toMatchObject({ type: 'create_birthday', args: { title: 'Cumpleaños de Ana', date: '2026-11-14' } })
    const execute = vi.fn(async command => executeAssistantCommand(structuredClone(DEFAULT_DASHBOARD_STATE), command, environment))
    await expect(executeAssistantPlan(plan, { execute })).rejects.toThrow('confirmación')
    const result = await executeAssistantPlan(plan, { execute }, true) as ReturnType<typeof executeAssistantCommand>
    expect(result.state.calendarEvents[0]).toMatchObject({ type: 'birthday', recurrence: 'yearly', allDay: true, source: 'local' })
  })
  it('no confunde una obligación con hora con una tarea de día completo', async () => {
    await expect(planAssistantRequest(provider, request('añade al calendario que mañana tengo que comprar pilas a las 19:00'))).rejects.toThrow('tarea con hora')
  })
})


it('interpreta la transcripción «añade el calendario» antes de proponer un cumpleaños', async () => {
  const plan = await planAssistantRequest(provider, request('añade el calendario que mañana es el cumpleaños de Julián'))
  expect(plan.requiresConfirmation).toBe(true)
  expect(plan.command).toMatchObject({ type: 'create_birthday', args: { title: 'Cumpleaños de Julián', date: '2026-11-14' } })
})
