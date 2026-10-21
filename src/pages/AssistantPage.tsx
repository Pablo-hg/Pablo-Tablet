import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, Check, Edit3, LoaderCircle, Mic, MicOff, Send, Square, Volume2, X } from 'lucide-react'
import type { AssistantCommand, ValidatedAssistantPlan } from '../assistant/contracts'
import { assistantCommandSummary, type AssistantExecutionResult } from '../assistant/executor'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'
import { recognizeAssistantSpeech, speakAssistantText, stopAssistantSpeech, stopAssistantSpeechRecognition } from '../assistant/voice'
import type { DashboardPageId } from '../dashboardState'
import { PageHeader } from '../components/PageHeader'

type AssistantMessage = { id: string; role: 'assistant' | 'user'; text: string; openPage?: DashboardPageId }

export interface AssistantPageProps {
  enabled: boolean
  voiceEnabled: boolean
  readAloud: boolean
  now: Date
  onExecute: (command: AssistantCommand) => Promise<AssistantExecutionResult>
  onOpenPage: (pageId: DashboardPageId) => void
  onEditingChange: (isEditing: boolean) => void
}

const provider = new LocalAssistantProvider()
const SESSION_LIMIT = 30
const SUGGESTIONS = ['¿Qué tengo hoy?', '¿Va a llover hoy?', 'Guarda una nota: comprar pilas', 'Temporizador de 20 minutos']

const newMessage = (role: AssistantMessage['role'], text: string, openPage?: DashboardPageId): AssistantMessage => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  openPage,
})

export function AssistantPage({ enabled, voiceEnabled, readAloud, now, onExecute, onOpenPage, onEditingChange }: AssistantPageProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    newMessage('assistant', 'Hola, Pablo. Puedo consultar tu día, el tiempo, la agenda y tus notas, o preparar una nota, alarma o temporizador.'),
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<{ plan: ValidatedAssistantPlan; sourceText: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [listening, setListening] = useState(false)
  const [requestCount, setRequestCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    onEditingChange(processing || listening || pending !== null)
    return () => onEditingChange(false)
  }, [listening, onEditingChange, pending, processing])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => () => {
    abortRef.current?.abort()
    void stopAssistantSpeechRecognition()
    void stopAssistantSpeech()
  }, [])

  const addAssistantResponse = async (result: AssistantExecutionResult) => {
    setMessages((current) => [...current, newMessage('assistant', result.response, result.openPage)])
    if (readAloud) await speakAssistantText(result.response).catch(() => undefined)
  }

  const submit = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || processing || pending) return
    if (!enabled) {
      setMessages((current) => [...current, newMessage('assistant', 'El Asistente está desactivado. Actívalo en Ajustes para utilizarlo.')])
      return
    }
    if (requestCount >= SESSION_LIMIT) {
      setMessages((current) => [...current, newMessage('assistant', 'Has alcanzado el límite de 30 peticiones de esta sesión. Cierra y vuelve a abrir la pantalla para continuar.')])
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setInput('')
    setProcessing(true)
    setRequestCount((count) => count + 1)
    setMessages((current) => [...current, newMessage('user', trimmed)])
    try {
      const plan = await planAssistantRequest(provider, {
        text: trimmed,
        locale: 'es-ES',
        now: now.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
      }, controller.signal)
      if (controller.signal.aborted) return
      if (plan.requiresConfirmation) {
        setPending({ plan, sourceText: trimmed })
      } else {
        const result = await executeAssistantPlan(plan, { execute: onExecute }) as AssistantExecutionResult
        await addAssistantResponse(result)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : 'No se ha podido procesar la petición.')])
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setProcessing(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(input)
  }

  const confirmPending = async () => {
    if (!pending) return
    setProcessing(true)
    try {
      const result = await executeAssistantPlan(pending.plan, { execute: onExecute }, true) as AssistantExecutionResult
      setPending(null)
      await addAssistantResponse(result)
    } catch (error) {
      setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : 'La acción no se ha podido completar.')])
    } finally {
      setProcessing(false)
    }
  }

  const cancelPending = () => {
    setPending(null)
    setMessages((current) => [...current, newMessage('assistant', 'Acción cancelada. No se ha modificado ningún dato.')])
  }

  const editPending = () => {
    if (!pending) return
    setInput(pending.sourceText)
    setPending(null)
  }

  const cancelProcessing = () => {
    abortRef.current?.abort()
    setProcessing(false)
    setMessages((current) => [...current, newMessage('assistant', 'Petición cancelada.')])
  }

  const toggleListening = async () => {
    if (listening) {
      abortRef.current?.abort()
      await stopAssistantSpeechRecognition().catch(() => undefined)
      setListening(false)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setListening(true)
    try {
      const text = await recognizeAssistantSpeech(controller.signal)
      if (text) setInput(text)
    } catch (error) {
      if (!controller.signal.aborted) setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : 'No se ha podido utilizar el micrófono.')])
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setListening(false)
    }
  }

  const summary = pending ? assistantCommandSummary(pending.plan.command) : null

  return <div className="assistant-page fullscreen-page page-enter">
    <PageHeader pageLabel="¿En qué te ayudo?" />
    <div className="assistant-status" role="status">
      <span className={enabled ? 'is-ready' : 'is-disabled'}><i />{enabled ? 'Modo local · sin enviar datos' : 'Desactivado'}</span>
      <small>{requestCount}/{SESSION_LIMIT} peticiones en esta sesión · el historial no se guarda</small>
    </div>

    <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversación del Asistente">
      {messages.map((message) => <article key={message.id} className={`assistant-message is-${message.role}`}>
        {message.role === 'assistant' ? <span className="assistant-avatar"><Bot size={18} /></span> : null}
        <div><p>{message.text}</p>{message.role === 'assistant' ? <footer>
          <button type="button" onClick={() => void speakAssistantText(message.text)} aria-label="Leer respuesta"><Volume2 size={15} />Leer</button>
          {message.openPage ? <button type="button" onClick={() => onOpenPage(message.openPage as DashboardPageId)}>Abrir módulo</button> : null}
        </footer> : null}</div>
      </article>)}
      {processing ? <article className="assistant-message is-assistant is-processing"><span className="assistant-avatar"><Bot size={18} /></span><div><p><LoaderCircle className="is-spinning" size={17} />Procesando de forma segura…</p><button type="button" onClick={cancelProcessing}><Square size={14} />Cancelar</button></div></article> : null}
      {pending && summary ? <section className="assistant-confirmation" aria-label="Acción pendiente de confirmación">
        <header><span><Check size={18} /></span><div><small>Revisa antes de ejecutar</small><h2>{summary.title}</h2></div></header>
        <ul>{summary.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        <p>{pending.plan.explanation}</p>
        <div className="assistant-confirmation-actions">
          <button type="button" className="assistant-confirm" onClick={() => void confirmPending()}><Check size={17} />Confirmar</button>
          <button type="button" onClick={editPending}><Edit3 size={17} />Editar petición</button>
          <button type="button" onClick={cancelPending}><X size={17} />Cancelar</button>
        </div>
      </section> : null}
    </div>

    {messages.length <= 1 ? <div className="assistant-suggestions" aria-label="Sugerencias" data-swipe-block>
      {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void submit(suggestion)}>{suggestion}</button>)}
    </div> : null}

    <form className="assistant-composer" data-swipe-block onSubmit={onSubmit}>
      <label htmlFor="assistant-input">Escribe o dicta una petición</label>
      <div>
        <textarea id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ej.: Temporizador de 20 minutos" rows={2} disabled={!enabled || processing || pending !== null} />
        {voiceEnabled ? <button type="button" className={listening ? 'is-listening' : ''} onClick={() => void toggleListening()} aria-label={listening ? 'Detener dictado' : 'Iniciar dictado'}>{listening ? <MicOff size={21} /> : <Mic size={21} />}</button> : null}
        <button type="submit" className="assistant-send" disabled={!input.trim() || !enabled || processing || pending !== null} aria-label="Enviar petición"><Send size={21} /></button>
      </div>
      {listening ? <p className="assistant-listening"><i />Escuchando… toca el micrófono para cancelar</p> : null}
    </form>
  </div>
}
