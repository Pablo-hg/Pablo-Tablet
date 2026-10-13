import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantPage } from '../pages/AssistantPage'

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
})
