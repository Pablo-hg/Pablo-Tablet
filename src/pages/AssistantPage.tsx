import { useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from 'react'
import type { TOptions } from 'i18next'
import { Bot, Check, Edit3, Mic, MicOff, Send, Volume2, X } from 'lucide-react'
import type { AssistantCommand, ValidatedAssistantPlan } from '../assistant/contracts'
import { assistantCommandSummary, type AssistantExecutionResult } from '../assistant/executor'
import { LocalAssistantProvider } from '../assistant/localProvider'
import { executeAssistantPlan, planAssistantRequest } from '../assistant/prototype'
import { recognizeAssistantSpeech, speakAssistantText, stopAssistantSpeech, stopAssistantSpeechRecognition } from '../assistant/voice'
import type { DashboardPageId } from '../dashboardState'
import { PageHeader } from '../components/PageHeader'
import { activeLocale, txFor, type SupportedLanguage } from '../i18n'
import type { TranslationKey } from '../i18n/translations'

type AssistantMessage = { id: string; role: 'assistant' | 'user'; text: string; openPage?: DashboardPageId }

export interface AssistantPageProps {
  ref?: Ref<AssistantPageHandle>
  enabled: boolean
  voiceEnabled: boolean
  readAloud: boolean
  speechVoice?: string
  assistantLanguage?: SupportedLanguage
  now: Date
  onExecute: (command: AssistantCommand) => Promise<AssistantExecutionResult>
  onOpenPage: (pageId: DashboardPageId) => void
  onEditingChange: (isEditing: boolean) => void
  visible?: boolean
  compact?: boolean
  voiceMode?: boolean
  onVoiceModeStart?: () => void
  onVoiceResponseReady?: () => void
}

export interface AssistantPageHandle {
  startListening: () => void
}

const provider = new LocalAssistantProvider()
const SESSION_LIMIT = 30
const SUGGESTIONS: TranslationKey[] = ['¿Qué tengo hoy?', '¿Va a llover hoy?', 'Guarda una nota: comprar pilas', 'Temporizador de 20 minutos']

const newMessage = (role: AssistantMessage['role'], text: string, openPage?: DashboardPageId): AssistantMessage => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  openPage,
})

export function AssistantPage({ ref, enabled, voiceEnabled, readAloud, speechVoice = '', assistantLanguage = 'es', now, onExecute, onOpenPage, onEditingChange, visible = true, compact = false, voiceMode = false, onVoiceModeStart, onVoiceResponseReady }: AssistantPageProps) {
  const tx = (key: TranslationKey, options?: TOptions) => txFor(assistantLanguage, key, options)
  const inputId = useId()
  const [messages, setMessages] = useState<AssistantMessage[]>([
    newMessage('assistant', tx('Hola, Pablo. Puedo consultar tu día, el tiempo, la agenda y tus notas, o preparar una nota, alarma o temporizador.')),
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<{ plan: ValidatedAssistantPlan; sourceText: string } | null>(null)
  const pendingRef = useRef<{ plan: ValidatedAssistantPlan; sourceText: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [requestCount, setRequestCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const confirmingRef = useRef(false)
  const logRef = useRef<HTMLDivElement | null>(null)
  const confirmationRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onEditingChange(visible && (processing || listening || pending !== null))
    return () => onEditingChange(false)
  }, [listening, onEditingChange, pending, processing, visible])

  useEffect(() => {
    if (!visible) abortRef.current?.abort()
    if (!visible) void stopAssistantSpeech().catch(() => undefined)
  }, [visible, listening, voiceMode])

  useEffect(() => {
    const log = logRef.current
    if (!log) return
    const top = pending && confirmationRef.current
      ? log.scrollTop + confirmationRef.current.getBoundingClientRect().top - log.getBoundingClientRect().top
      : log.scrollHeight
    log.scrollTo({ top, behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => () => {
    abortRef.current?.abort()
    void stopAssistantSpeechRecognition().catch(() => undefined)
    void stopAssistantSpeech().catch(() => undefined)
  }, [])

  const addAssistantResponse = async (result: AssistantExecutionResult, voiceRequest = false) => {
    setMessages((current) => [...current, newMessage('assistant', result.response, result.openPage)])
    if (voiceRequest) onVoiceResponseReady?.()
    if (readAloud || voiceRequest) await speakResponse(result.response)
  }

  const speakResponse = async (text: string) => {
    setSpeaking(true)
    try { await speakAssistantText(text, speechVoice, assistantLanguage) } catch { /* Voice output can be unavailable on the device. */ }
    finally { setSpeaking(false) }
  }

  const submit = async (text: string, voiceRequest = false) => {
    const trimmed = text.trim()
    if (!trimmed || processing || pendingRef.current) return
    if (!enabled) {
      setMessages((current) => [...current, newMessage('assistant', tx('El Asistente está desactivado. Actívalo en Ajustes para utilizarlo.'))])
      if (voiceRequest) onVoiceResponseReady?.()
      return
    }
    if (requestCount >= SESSION_LIMIT) {
      setMessages((current) => [...current, newMessage('assistant', tx('Has alcanzado el límite de 30 peticiones de esta sesión. Cierra y vuelve a abrir la pantalla para continuar.'))])
      if (voiceRequest) onVoiceResponseReady?.()
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
        locale: activeLocale(assistantLanguage),
        now: now.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
      }, controller.signal)
      if (controller.signal.aborted) return
      if (plan.requiresConfirmation) {
        const proposal = { plan, sourceText: trimmed }
        pendingRef.current = proposal
        setPending(proposal)
        if (voiceRequest) {
          onVoiceResponseReady?.()
          await speakResponse(`${plan.explanation} ${tx('Puedes decir confirmar, editar o cancelar.')}`)
          if (!controller.signal.aborted && pendingRef.current === proposal) await listenForPendingDecision(proposal)
        }
      } else {
        const result = await executeAssistantPlan(plan, { execute: onExecute }) as AssistantExecutionResult
        await addAssistantResponse(result, voiceRequest)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : tx('No se ha podido procesar la petición.')
        setMessages((current) => [...current, newMessage('assistant', message)])
        if (voiceRequest) { onVoiceResponseReady?.(); await speakResponse(message) }
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

  const confirmPending = async (proposal = pendingRef.current, fromVoice = false) => {
    if (!proposal || pendingRef.current !== proposal || confirmingRef.current) return
    confirmingRef.current = true
    abortRef.current?.abort()
    const plan = proposal.plan
    pendingRef.current = null
    setPending(null)
    setProcessing(true)
    try {
      const result = await executeAssistantPlan(plan, { execute: onExecute }, true) as AssistantExecutionResult
      await addAssistantResponse(result, fromVoice)
    } catch (error) {
      setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : tx('La acción no se ha podido completar.'))])
    } finally {
      confirmingRef.current = false
      setProcessing(false)
    }
  }

  const cancelPending = () => {
    abortRef.current?.abort()
    pendingRef.current = null
    setPending(null)
    setMessages((current) => [...current, newMessage('assistant', tx('Acción cancelada. No se ha modificado ningún dato.'))])
  }

  const editPending = () => {
    const proposal = pendingRef.current
    if (!proposal) return
    abortRef.current?.abort()
    pendingRef.current = null
    setInput(proposal.sourceText)
    setPending(null)
  }

  const listenForPendingDecision = async (proposal: { plan: ValidatedAssistantPlan; sourceText: string }) => {
    if (pendingRef.current !== proposal) return
    const controller = new AbortController()
    abortRef.current = controller
    setListening(true)
    try {
      const answer = await recognizeAssistantSpeech(controller.signal, assistantLanguage)
      if (controller.signal.aborted || pendingRef.current !== proposal) return
      setListening(false)
      const normalized = answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ')
      if (/^(si|si confirmo|confirmo|confirmar|confirma|confirm|yes|yes confirm)$/.test(normalized)) {
        await confirmPending(proposal, true)
      } else if (/^(cancelo|cancelar|cancela|cancel|no|no gracias)$/.test(normalized)) {
        cancelPending()
        await speakResponse(tx('Acción cancelada. No se ha modificado ningún dato.'))
      } else if (/^(edito|editar|edita|edit|modificar|modifico)$/.test(normalized)) {
        pendingRef.current = null
        setPending(null)
        setInput(proposal.sourceText)
        const prompt = tx('Dime la petición completa de nuevo.')
        setMessages((current) => [...current, newMessage('assistant', prompt)])
        await speakResponse(prompt)
        if (controller.signal.aborted) return
        setListening(true)
        const revised = await recognizeAssistantSpeech(controller.signal, assistantLanguage)
        if (controller.signal.aborted || !revised.trim()) return
        setListening(false)
        setInput('')
        await submit(revised, true)
      } else {
        const prompt = tx('No he entendido. Pulsa el micrófono y di confirmar, editar o cancelar.')
        setMessages((current) => [...current, newMessage('assistant', prompt)])
        await speakResponse(prompt)
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : tx('No se ha podido utilizar el micrófono.'))])
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setListening(false)
    }
  }

  const toggleListening = async () => {
    if (listening) {
      abortRef.current?.abort()
      await stopAssistantSpeechRecognition().catch(() => undefined)
      setListening(false)
      return
    }
    if (pendingRef.current) {
      await listenForPendingDecision(pendingRef.current)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    onVoiceModeStart?.()
    setListening(true)
    try {
      const text = await recognizeAssistantSpeech(controller.signal, assistantLanguage)
      if (controller.signal.aborted) return
      setListening(false)
      if (text && onVoiceModeStart) await submit(text, true)
      else if (text) setInput(text)
      else onVoiceResponseReady?.()
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : tx('No se ha podido utilizar el micrófono.'))])
        onVoiceResponseReady?.()
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setListening(false)
    }
  }

  useImperativeHandle(ref, () => ({
    startListening: () => {
      if (!enabled || !voiceEnabled || pending || processing || listening) {
        onVoiceResponseReady?.()
        return
      }
      void toggleListening()
    },
  }))

  const summary = pending ? assistantCommandSummary(pending.plan.command, assistantLanguage) : null

  return <div className={`assistant-page fullscreen-page page-enter ${pending ? 'has-pending' : ''}`}>
    {!compact ? <PageHeader pageLabel="¿En qué te ayudo?" /> : null}
    {voiceMode ? <div className={`lumi-voice-indicator ${listening ? 'is-listening' : speaking ? 'is-speaking' : ''}`} role="status" aria-label={listening ? tx('Escuchando') : speaking ? tx('Hablando') : tx('Lumi preparada')}><span aria-hidden="true"><i /><i /><i /><i /><i /></span><small>{listening ? tx('Escuchando') : speaking ? tx('Hablando') : tx('Lumi preparada')}</small></div> : null}
    {!compact ? <div className="assistant-status" role="status">
      <span className={enabled ? 'is-ready' : 'is-disabled'}><i />{enabled ? tx('Peticiones locales · voz según el dispositivo') : tx('Desactivado')}</span>
      <small>{tx('{{count}}/30 peticiones en esta sesión · el historial no se guarda', { count: requestCount })}</small>
    </div> : null}

    <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-label={tx('Conversación del Asistente')}>
      {messages.map((message) => <article key={message.id} className={`assistant-message is-${message.role}`}>
        {message.role === 'assistant' ? <span className="assistant-avatar"><Bot size={18} /></span> : null}
        <div><p>{message.text}</p>{message.role === 'assistant' ? <footer>
          <button type="button" onClick={() => void speakResponse(message.text)} aria-label={tx('Leer respuesta')}><Volume2 size={15} />{tx('Leer')}</button>
          {message.openPage ? <button type="button" onClick={() => onOpenPage(message.openPage as DashboardPageId)}>{tx('Abrir módulo')}</button> : null}
        </footer> : null}</div>
      </article>)}
      {pending && summary ? <section ref={confirmationRef} className="assistant-confirmation" aria-label={tx('Acción pendiente de confirmación')}>
        <header><span><Check size={18} /></span><div><small>{tx('Revisa antes de ejecutar')}</small><h2>{summary.title}</h2></div></header>
        <ul>{summary.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        <p>{pending.plan.explanation}</p>
        <div className="assistant-confirmation-actions">
          <button type="button" className="assistant-confirm" onClick={() => void confirmPending()}><Check size={17} />{tx('Confirmar')}</button>
          <button type="button" onClick={editPending}><Edit3 size={17} />{tx('Editar petición')}</button>
          <button type="button" onClick={cancelPending}><X size={17} />{tx('Cancelar')}</button>
        </div>
      </section> : null}
    </div>

    {messages.length <= 1 ? <div className="assistant-suggestions" aria-label={tx('Sugerencias')} data-swipe-block>
      {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void submit(tx(suggestion))}>{tx(suggestion)}</button>)}
    </div> : null}

    <form className="assistant-composer" data-swipe-block onSubmit={onSubmit}>
      <label htmlFor={inputId}>{tx('Escribe o dicta una petición')}</label>
      <div>
        <textarea id={inputId} value={input} onChange={(event) => setInput(event.target.value)} placeholder={tx('Ej.: Temporizador de 20 minutos')} rows={2} disabled={!enabled || processing || pending !== null} />
        {voiceEnabled ? <button type="button" className={listening ? 'is-listening' : ''} onClick={() => void toggleListening()} disabled={!enabled || (processing && pending === null)} aria-label={listening ? tx('Detener dictado') : tx('Iniciar dictado')}>{listening ? <MicOff size={21} /> : <Mic size={21} />}</button> : null}
        <button type="submit" className="assistant-send" disabled={!input.trim() || !enabled || processing || pending !== null} aria-label={tx('Enviar petición')}><Send size={21} /></button>
      </div>
      {listening ? <p className="assistant-listening"><i />{tx('Escuchando… toca el micrófono para cancelar')}</p> : null}
    </form>
  </div>
}
