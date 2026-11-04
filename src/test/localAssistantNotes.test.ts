import { describe, expect, it } from 'vitest'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { planAssistantRequest } from '../assistant/prototype'

const provider = new LocalAssistantProvider()
const request = (text: string) => ({ text, locale: 'es-ES' as const, now: '2026-11-03T10:00:00Z', timeZone: 'Europe/Madrid' })

describe('creación de notas del asistente local', () => {
  it.each([
    ['Crea una nota: título Compra, contenido leche y pan', 'Compra', 'leche y pan'],
    ['Guarda una nota con título Plan y contenido consultar el tiempo y la agenda', 'Plan', 'consultar el tiempo y la agenda'],
    ['Crea una nota titulada Viaje que diga llevar paraguas', 'Viaje', 'llevar paraguas'],
    ['crea una nota de que se llame lista de la compra y el contenido es leche fruta y pan', 'lista de la compra', 'leche fruta y pan'],
    ['Crea una nota que se llame Viaje y el contenido sea llevar paraguas', 'Viaje', 'llevar paraguas'],
    ['Crea una nota llamada Casa que contenga revisar el tiempo', 'Casa', 'revisar el tiempo'],
    ['Create a note: title Shopping, content milk and bread', 'Shopping', 'milk and bread'],
    ['Guarda una nota: consultar el tiempo', 'consultar el tiempo', 'consultar el tiempo'],
  ])('interpreta %s', async (text, title, content) => {
    const plan = await planAssistantRequest(provider, request(text))
    expect(plan.command).toEqual({ type: 'create_note', args: { title, content, reminderAt: null } })
    expect(plan.requiresConfirmation).toBe(true)
  })

  it.each(['Crea una nota: título Compra', 'Crea una nota: título Compra, contenido', 'Crea una nota: título , contenido leche', 'Crea una nota que se llame Compra', 'Crea una nota que se llame Compra y el contenido es'])('pide completar los datos: %s', async (text) => {
    await expect(planAssistantRequest(provider, request(text))).rejects.toThrow('Indica el título y el contenido')
  })
})
