import { describe, expect, it, vi } from 'vitest'
import { InvalidAssistantCommandError, validateAssistantCommand } from '../assistant/contracts'
import { executeAssistantPlan, planAssistantRequest, PrototypeAssistantProvider } from '../assistant/prototype'

const request = (text: string) => ({
  text,
  locale: 'es-ES' as const,
  now: '2026-10-11T09:00:00.000Z',
  timeZone: 'Europe/Madrid',
})

describe('prototipo del asistente', () => {
  const provider = new PrototypeAssistantProvider()

  it.each([
    ['¿Qué tengo hoy?', 'get_daily_summary', false],
    ['¿Va a llover hoy?', 'get_weather', false],
    ['Guarda una nota: comprar pilas', 'create_note', true],
    ['Temporizador de 20 minutos', 'start_timer', true],
    ['¿Cómo cambio el brillo?', 'get_local_help', false],
  ])('interpreta %s como %s', async (text, commandType, requiresConfirmation) => {
    const plan = await planAssistantRequest(provider, request(text))
    expect(plan.command.type).toBe(commandType)
    expect(plan.requiresConfirmation).toBe(requiresConfirmation)
  })

  it('bloquea una escritura hasta recibir confirmación explícita', async () => {
    const plan = await planAssistantRequest(provider, request('Guarda una nota: comprar pilas'))
    const execute = vi.fn().mockResolvedValue({ ok: true })

    await expect(executeAssistantPlan(plan, { execute })).rejects.toThrow('confirmación explícita')
    expect(execute).not.toHaveBeenCalled()

    await expect(executeAssistantPlan(plan, { execute }, true)).resolves.toEqual({ ok: true })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('rechaza tipos, campos extra y valores fuera de límites', () => {
    expect(() => validateAssistantCommand({ type: 'delete_all', args: {} })).toThrow(InvalidAssistantCommandError)
    expect(() =>
      validateAssistantCommand({ type: 'start_timer', args: { label: 'Horno', durationSeconds: 60, hidden: true } }),
    ).toThrow(InvalidAssistantCommandError)
    expect(() =>
      validateAssistantCommand({ type: 'start_timer', args: { label: 'Horno', durationSeconds: 100_000 } }),
    ).toThrow(InvalidAssistantCommandError)
  })

  it('permite ejecutar una consulta validada sin confirmación', async () => {
    const plan = await planAssistantRequest(provider, request('¿Qué tengo hoy?'))
    const execute = vi.fn().mockResolvedValue({ events: [] })

    await expect(executeAssistantPlan(plan, { execute })).resolves.toEqual({ events: [] })
    expect(execute).toHaveBeenCalledWith({ type: 'get_daily_summary', args: { date: '2026-10-11' } })
  })
})
