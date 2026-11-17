import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantPage } from '../pages/AssistantPage'
import { executeAssistantCommand } from '../assistant/executor'
import { recognizeAssistantSpeech, speakAssistantText } from '../assistant/voice'
import { DEFAULT_DASHBOARD_STATE } from '../dashboardState'
import type { AssistantCommand } from '../assistant/contracts'

vi.mock('../assistant/voice', () => ({
  recognizeAssistantSpeech: vi.fn(),
  speakAssistantText: vi.fn().mockResolvedValue(undefined),
  stopAssistantSpeech: vi.fn().mockResolvedValue(undefined),
  stopAssistantSpeechRecognition: vi.fn().mockResolvedValue(undefined),
}))
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })

const now = new Date('2026-11-17T12:00:00Z')
let nextId = 0
const environment = { now, homeWeatherLocation: null, homeWeatherForecast: null, createId: () => String(++nextId), language: 'es' as const }

function setup() {
  nextId = 0
  let state = structuredClone(DEFAULT_DASHBOARD_STATE)
  for (let i = 0; i < 15; i++) {
    state = executeAssistantCommand(state, { type: 'create_task', args: { title: `Compra ${String(i).padStart(2, '0')}`, date: '2026-11-17', timeZone: 'Europe/Madrid' } }, environment).state
  }
  for (let i = 0; i < 7; i++) {
    state = executeAssistantCommand(state, { type: 'create_note', args: { title: `Receta ${i}`, content: `ingrediente ${i}`, reminderAt: null } }, environment).state
  }
  const before = structuredClone(state)
  const execute = vi.fn(async (command: AssistantCommand) => {
    const result = executeAssistantCommand(state, command, environment)
    state = result.state
    return result
  })
  render(<AssistantPage enabled voiceEnabled readAloud={false} now={now} onExecute={execute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
  return { execute, before, getState: () => state }
}

async function send(text: string) {
  fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
}

describe('consultas locales de Lumi desde la pantalla', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca tareas en plural, muestra todas y comunica resultados vacíos sin alterar datos', async () => {
    const test = setup()
    await send('Busca tareas compra')
    const answer = await screen.findByText(/He encontrado 15 tareas:/)
    expect(answer.textContent).toContain('Compra 00')
    expect(answer.textContent).toContain('Compra 14')
    await send('Busca tareas inexistente')
    expect(await screen.findByText(/No he encontrado tareas con el título/)).toBeInTheDocument()
    expect(test.getState()).toEqual(test.before)
    expect(test.execute).toHaveBeenCalledTimes(2)
  })

  it('muestra el límite de notas, permite afinar y leer una coincidencia sin alterar datos', async () => {
    const test = setup()
    await send('Busca notas receta')
    expect(await screen.findByText(/He encontrado 7 notas/)).toHaveTextContent('Hay más coincidencias')
    await send('Lee la nota receta')
    expect(await screen.findByText(/He encontrado varias notas/)).toHaveTextContent('Hay más coincidencias')
    await send('Lee la nota receta 0')
    expect(await screen.findByText('Nota «Receta 0»: ingrediente 0')).toBeInTheDocument()
    expect(test.getState()).toEqual(test.before)
  })

  it('usa el mismo buscador con voz simulada y lee el resumen de la lista larga', async () => {
    const test = setup()
    vi.mocked(recognizeAssistantSpeech).mockResolvedValueOnce('Busca tareas compra')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    expect(await screen.findByText(/He encontrado 15 tareas:/)).toHaveTextContent('Compra 14')
    await waitFor(() => expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('15 tareas. La lista completa'), '', 'es'))
    expect(test.getState()).toEqual(test.before)
  })

  it('consulta la agenda local y comunica un día vacío sin modificarla', async () => {
    const test = setup()
    await send('Agenda hoy')
    const result = await screen.findByText(/Compra 14/)
    expect(result).toHaveTextContent('Compra 00')
    await send('¿Y mañana?')
    expect(await screen.findByText(/No hay eventos ni tareas pendientes/)).toBeInTheDocument()
    expect(test.getState()).toEqual(test.before)
  })
})
