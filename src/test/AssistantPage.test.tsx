import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantPage } from '../pages/AssistantPage'
import { recognizeAssistantSpeech } from '../assistant/voice'

vi.mock('../assistant/voice', () => ({
  recognizeAssistantSpeech: vi.fn(),
  speakAssistantText: vi.fn().mockResolvedValue(undefined),
  stopAssistantSpeech: vi.fn().mockResolvedValue(undefined),
  stopAssistantSpeechRecognition: vi.fn().mockResolvedValue(undefined),
}))

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
})

const executionResult = {
  state: {} as never,
  response: 'Nota «Comprar pilas» creada.',
  openPage: 'notes' as const,
}

describe('pantalla del asistente', () => {
  it('desplaza la conversación sin animación cuando se solicita movimiento reducido', () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')!
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true } as MediaQueryList) })
    const scroll = vi.mocked(HTMLElement.prototype.scrollTo)
    scroll.mockClear()
    try {
      render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date()} onExecute={vi.fn()} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
      expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    } finally {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia)
    }
  })

  it('muestra el estado de escucha y procesa una petición dictada', async () => {
    let finish!: (text: string) => void
    vi.mocked(recognizeAssistantSpeech).mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve }))
    const onVoiceModeStart = vi.fn()
    const onVoiceResponseReady = vi.fn()
    const onExecute = vi.fn().mockResolvedValue({ state: {} as never, response: 'Hoy tienes una alarma activa.' })
    render(<AssistantPage enabled voiceEnabled readAloud={false} voiceMode onVoiceModeStart={onVoiceModeStart} onVoiceResponseReady={onVoiceResponseReady} now={new Date('2026-10-11T09:00:00.000Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    expect(onVoiceModeStart).toHaveBeenCalledOnce()
    expect(screen.getByRole('status', { name: 'Escuchando' })).toBeInTheDocument()
    finish('¿Qué tengo hoy?')
    expect(await screen.findByText('Hoy tienes una alarma activa.')).toBeInTheDocument()
    expect(onExecute).toHaveBeenCalledOnce()
    expect(onVoiceResponseReady).toHaveBeenCalledOnce()
    expect(screen.getByRole('status', { name: 'Lumi preparada' })).toBeInTheDocument()
  })
  it('no ejecuta una escritura antes de la confirmación explícita', async () => {
    const onExecute = vi.fn().mockResolvedValue(executionResult)
    render(<AssistantPage
      enabled
      voiceEnabled={false}
      readAloud={false}
      now={new Date('2026-10-11T09:00:00.000Z')}
      onExecute={onExecute}
      onOpenPage={vi.fn()}
      onEditingChange={vi.fn()}
    />)

    fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: 'Guarda una nota: comprar pilas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))

    expect(await screen.findByRole('heading', { name: 'Crear nota' })).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(onExecute).toHaveBeenCalledOnce())
    expect(onExecute).toHaveBeenCalledWith({
      type: 'create_note',
      args: { title: 'comprar pilas', content: 'comprar pilas', reminderAt: null },
    })
    expect(await screen.findByText('Nota «Comprar pilas» creada.')).toBeInTheDocument()
  })

  it('cancela la propuesta sin modificar datos', async () => {
    const onExecute = vi.fn().mockResolvedValue(executionResult)
    render(<AssistantPage
      enabled
      voiceEnabled={false}
      readAloud={false}
      now={new Date('2026-10-11T09:00:00.000Z')}
      onExecute={onExecute}
      onOpenPage={vi.fn()}
      onEditingChange={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Temporizador de 20 minutos' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar temporizador' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Acción cancelada. No se ha modificado ningún dato.')).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('una doble confirmación ejecuta la acción una sola vez', async () => {
    let complete!: (value: typeof executionResult) => void
    const onExecute = vi.fn(() => new Promise<typeof executionResult>((resolve) => { complete = resolve }))
    render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date('2026-10-11T09:00:00.000Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Guarda una nota: comprar pilas' }))
    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(onExecute).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    complete(executionResult)
    expect(await screen.findByText('Nota «Comprar pilas» creada.')).toBeInTheDocument()
  })

  it('separa título y contenido y los muestra antes de guardar la nota', async () => {
    const onExecute = vi.fn().mockResolvedValue(executionResult)
    render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date('2026-10-11T09:00:00.000Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: 'crea una nota de que se llame lista de la compra y el contenido es leche fruta y pan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    expect(await screen.findByText('Título: lista de la compra')).toBeInTheDocument()
    expect(screen.getByText('Contenido: leche fruta y pan')).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith({ type: 'create_note', args: { title: 'lista de la compra', content: 'leche fruta y pan', reminderAt: null } }))
  })
})
