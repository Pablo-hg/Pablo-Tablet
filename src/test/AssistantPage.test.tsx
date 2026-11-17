import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantPage } from '../pages/AssistantPage'
import { recognizeAssistantSpeech, speakAssistantText } from '../assistant/voice'

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
  it.each([false, true])('dicta una tarea y espera confirmación hablada (flotante: %s)', async (floating) => {
    let decide!: (text: string) => void
    vi.mocked(recognizeAssistantSpeech)
      .mockResolvedValueOnce('Crea una tarea para mañana comprar pilas')
      .mockImplementationOnce(() => new Promise<string>((resolve) => { decide = resolve }))
    const onExecute = vi.fn().mockResolvedValue({ state: {} as never, response: 'Tarea creada.' })
    render(<AssistantPage enabled voiceEnabled readAloud={false} voiceMode={floating} onVoiceModeStart={floating ? vi.fn() : undefined} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    await waitFor(() => expect(recognizeAssistantSpeech).toHaveBeenCalledTimes(2))
    expect(onExecute).not.toHaveBeenCalled()
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('Voy a apuntar comprar pilas'), '', 'es')
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('mañana, viernes, día 13'), '', 'es')
    expect(speakAssistantText).not.toHaveBeenCalledWith(expect.stringContaining('Zona horaria:'), expect.anything(), expect.anything())
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('¿Te parece bien o lo modificamos?'), '', 'es')
    decide('me parece bien')
    expect(await screen.findByText('Tarea creada.')).toBeInTheDocument()
    expect(onExecute).toHaveBeenCalledOnce()
  })

  it('lee la fecha natural al proponer modificar una tarea', async () => {
    vi.mocked(recognizeAssistantSpeech).mockResolvedValueOnce('Completa la tarea comprar pilas').mockImplementationOnce(() => new Promise<string>(() => {}))
    const onPrepare = () => ({ type: 'update_local_task' as const, args: { id: 'task', expected: '{}', title: 'comprar pilas', date: '2026-11-13', timeZone: 'Europe/Madrid', action: 'complete' as const, newTitle: '' } })
    render(<AssistantPage enabled voiceEnabled readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onPrepare={onPrepare} onExecute={vi.fn()} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    await waitFor(() => expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('mañana, viernes, día 13'), '', 'es'))
    expect(speakAssistantText).not.toHaveBeenCalledWith(expect.stringContaining('2026-11-13'), '', 'es')
  })

  it('resume la nota con su contenido y confirma antes de crearla', async () => {
    let decide!: (text: string) => void
    vi.mocked(recognizeAssistantSpeech).mockResolvedValueOnce('Crea una nota: título Receta, contenido leche y pan').mockImplementationOnce(() => new Promise<string>(resolve => { decide = resolve }))
    const onExecute = vi.fn().mockResolvedValue({ state: {} as never, response: 'Nota «Receta» creada.' })
    render(<AssistantPage enabled voiceEnabled readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    await waitFor(() => expect(recognizeAssistantSpeech).toHaveBeenCalledTimes(2))
    expect(speakAssistantText).toHaveBeenCalledWith('Voy a crear la nota Receta con el contenido: leche y pan. ¿Te parece bien o lo modificamos?', '', 'es')
    expect(onExecute).not.toHaveBeenCalled()
    decide('sí')
    expect(await screen.findByText('Nota «Receta» creada.')).toBeInTheDocument()
    await waitFor(() => expect(speakAssistantText).toHaveBeenCalledWith('Nota «Receta» creada.', '', 'es'))
  })

  it('resume el evento por voz y permite pedir modificarlo sin guardarlo', async () => {
    let decide!: (text: string) => void
    vi.mocked(recognizeAssistantSpeech)
      .mockResolvedValueOnce('crea un evento para mañana de 7 a 8 pm fútbol')
      .mockImplementationOnce(() => new Promise<string>(resolve => { decide = resolve }))
      .mockImplementationOnce(() => new Promise<string>(() => {}))
    const onExecute = vi.fn()
    render(<AssistantPage enabled voiceEnabled readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    await waitFor(() => expect(recognizeAssistantSpeech).toHaveBeenCalledTimes(2))
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('Voy a apuntar fútbol para mañana, viernes, día 13, de 19:00 a 20:00. ¿Te parece bien o lo modificamos?'), '', 'es')
    expect(speakAssistantText).not.toHaveBeenCalledWith(expect.stringContaining('Crear evento local'), '', 'es')
    expect(onExecute).not.toHaveBeenCalled()
    decide('lo modificamos')
    expect(await screen.findByText('Dime la petición completa de nuevo.')).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('lee también la propuesta escrita cuando la lectura automática está activada', async () => {
    render(<AssistantPage enabled voiceEnabled={false} readAloud now={new Date('2026-11-12T09:00:00Z')} onExecute={vi.fn()} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: 'Crea una tarea para mañana comprar pilas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    await waitFor(() => expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('mañana, viernes, día 13'), '', 'es'))
    expect(recognizeAssistantSpeech).not.toHaveBeenCalled()
  })

  it('aclara por voz la hora y el tramo del día antes de proponer el recordatorio', async () => {
    let confirm!: (text: string) => void
    vi.mocked(recognizeAssistantSpeech)
      .mockResolvedValueOnce('Recuérdame el próximo viernes que vaya a comprar pilas')
      .mockResolvedValueOnce('a las siete')
      .mockResolvedValueOnce('por la tarde')
      .mockImplementationOnce(() => new Promise<string>(resolve => { confirm = resolve }))
    const onExecute = vi.fn().mockResolvedValue({ state: {} as never, response: 'Tarea guardada con aviso.' })
    render(<AssistantPage enabled voiceEnabled readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dictado' }))
    await waitFor(() => expect(recognizeAssistantSpeech).toHaveBeenCalledTimes(4))
    expect(onExecute).not.toHaveBeenCalled()
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('¿A qué hora?'), '', 'es')
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('¿Por la mañana o por la tarde?'), '', 'es')
    expect(screen.getByText('Hora: 19:00')).toBeInTheDocument()
    expect(speakAssistantText).toHaveBeenCalledWith(expect.stringContaining('a las 19:00'), '', 'es')
    expect(speakAssistantText).not.toHaveBeenCalledWith(expect.stringContaining('Aviso: 1 hora antes'), '', 'es')
    confirm('confirmar')
    expect(await screen.findByText('Tarea guardada con aviso.')).toBeInTheDocument()
    expect(onExecute).toHaveBeenCalledOnce()
  })

  it('abandona la pregunta de hora anterior al recibir una petición nueva', async () => {
    const onExecute = vi.fn()
    render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    const input = screen.getByLabelText('Escribe o dicta una petición')
    fireEvent.change(input, { target: { value: 'Recuérdame mañana que compre pilas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    expect(await screen.findByText(/¿A qué hora\?/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'crea un evento para mañana de 7 a 8 de la tarde fútbol' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    expect(await screen.findByText('Crear evento local')).toBeInTheDocument()
    expect(screen.getByText('Título: fútbol')).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('muestra solo la antelación y permite editarla antes de confirmar', async () => {
    const onExecute = vi.fn().mockResolvedValue({ state: {} as never, response: 'Tarea creada.' })
    render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: 'Recuérdame el próximo viernes a las 19:00 que vaya a comprar pilas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    expect(await screen.findByText('Aviso: 1 hora antes')).toBeInTheDocument()
    expect(screen.getByText('Destino: calendario local')).toBeInTheDocument()
    expect(screen.queryByText(/Aviso.*18:00/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Antelación del aviso' }), { target: { value: '30' } })
    expect(screen.getByText('Aviso: 30 minutos antes')).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ args: expect.objectContaining({ reminderMinutesBefore: 30 }) })))
  })

  it('permite cancelar mientras falta la hora sin crear nada', async () => {
    const onExecute = vi.fn()
    render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    const send = (text: string) => {
      fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    }
    send('Recuérdame el próximo viernes que vaya a comprar pilas')
    expect(await screen.findByText(/¿A qué hora/)).toBeInTheDocument()
    send('cancelar')
    expect(await screen.findByText('Acción cancelada. No se ha modificado ningún dato.')).toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
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

  it('muestra destino y fecha de la tarea, permite cancelar y confirmar sin duplicar', async () => {
    const onExecute = vi.fn().mockResolvedValue({ state: {} as never, response: 'Tarea creada.', openPage: 'calendar' })
    render(<AssistantPage enabled voiceEnabled={false} readAloud={false} now={new Date('2026-11-12T09:00:00Z')} onExecute={onExecute} onOpenPage={vi.fn()} onEditingChange={vi.fn()} />)
    const send = () => {
      fireEvent.change(screen.getByLabelText('Escribe o dicta una petición'), { target: { value: 'Crea una tarea para mañana: comprar pilas' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar petición' }))
    }
    send()
    expect(await screen.findByRole('heading', { name: 'Crear tarea local' })).toBeInTheDocument()
    expect(screen.getByText('Destino: calendario local')).toBeInTheDocument()
    expect(screen.getByText('Fecha: mañana, viernes, día 13')).toBeInTheDocument()
    expect(screen.queryByText(/Zona horaria:/)).not.toBeInTheDocument()
    expect(onExecute).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onExecute).not.toHaveBeenCalled()
    send()
    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(await screen.findByText('Tarea creada.')).toBeInTheDocument()
    expect(onExecute).toHaveBeenCalledOnce()
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
