import { reminderLeadTimeMinutes } from '../assistant/taskReminder'
import { useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from 'react'
import type { TOptions } from 'i18next'
import { Bot, Check, Edit3, Mic, MicOff, MessageSquarePlus, Send, Volume2, X } from 'lucide-react'
import { AssistantTimeRequired, type AssistantTimeContext, validateAssistantCommand, type AssistantCommand, type ValidatedAssistantPlan } from '../assistant/contracts'
import { addDaysToDateKey, dateKeyToDayNumber } from '../calendarRecurrence'
import { assistantCommandSummary, type AssistantExecutionResult } from '../assistant/executor'
import { assistantDateText, assistantSpokenDateText } from '../assistant/dateText'
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
  onPrepare?: (command: AssistantCommand) => AssistantCommand
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
const SUGGESTIONS: TranslationKey[] = ['¿Qué tengo hoy?', 'Crea una tarea para mañana: comprar pilas', 'Guarda una nota: comprar pilas', 'Temporizador de 20 minutos']

const newMessage = (role: AssistantMessage['role'], text: string, openPage?: DashboardPageId): AssistantMessage => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  openPage,
})

export function AssistantPage({ ref, enabled, voiceEnabled, readAloud, speechVoice = '', assistantLanguage = 'es', now, onPrepare, onExecute, onOpenPage, onEditingChange, visible = true, compact = false, voiceMode = false, onVoiceModeStart, onVoiceResponseReady }: AssistantPageProps) {
  const tx = (key: TranslationKey, options?: TOptions) => txFor(assistantLanguage, key, options)
  const inputId = useId()
  const [messages, setMessages] = useState<AssistantMessage[]>([
    newMessage('assistant', tx('Hola, Pablo. Puedo consultar tu día, el tiempo, la agenda y tus notas, o preparar una nota, alarma o temporizador.')),
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<{ plan: ValidatedAssistantPlan; sourceText: string } | null>(null)
  const pendingRef = useRef<{ plan: ValidatedAssistantPlan; sourceText: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const processingRef = useRef(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [requestCount, setRequestCount] = useState(0)
  const timeContextRef = useRef<AssistantTimeContext | null>(null)
  const timeSourceRef = useRef('')
  const [awaitingTime, setAwaitingTime] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listeningControllerRef = useRef<AbortController | null>(null)
  const confirmingRef = useRef(false)
  const logRef = useRef<HTMLDivElement | null>(null)
  const confirmationRef = useRef<HTMLElement | null>(null)
  const lastTopicRef = useRef<{ type: 'calendar'; weekStart: string } | { type: 'weather' } | null>(null)
  const lastQueryTopicRef = useRef<'calendar' | 'weather' | null>(null)
  const lastCalendarTypeRef = useRef<'task' | 'event' | 'birthday' | undefined>(undefined)
  const lastTaskStatusRef = useRef<'completed' | 'pending' | undefined>(undefined)
  const noteCandidatesRef = useRef<{ id: string; title: string }[]>([])
  const speechSequenceRef = useRef(0)

  useEffect(() => {
    onEditingChange(visible && (processing || listening || pending !== null || awaitingTime))
    return () => onEditingChange(false)
  }, [awaitingTime, listening, onEditingChange, pending, processing, visible])

  useEffect(() => {
    if (!visible || !enabled) {
      abortRef.current?.abort()
      listeningControllerRef.current?.abort()
      listeningControllerRef.current = null
      setListening(false)
      speechSequenceRef.current += 1
      setSpeaking(false)
      void stopAssistantSpeechRecognition().catch(() => undefined)
      void stopAssistantSpeech().catch(() => undefined)
      if (!confirmingRef.current) {
        processingRef.current = false
        setProcessing(false)
      }
      if (!enabled) {
        timeContextRef.current = null
        timeSourceRef.current = ''
        setAwaitingTime(false)
      }
    }
  }, [visible, enabled])

  useEffect(() => {
    const log = logRef.current
    if (!log) return
    const card = pending ? confirmationRef.current : null
    const top = card
      ? log.scrollTop + card.getBoundingClientRect().top - log.getBoundingClientRect().top + Math.min(0, card.getBoundingClientRect().height - log.clientHeight + 20)
      : log.scrollHeight
    if (typeof log.scrollTo === 'function') log.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    else log.scrollTop = top
  }, [messages, pending])

  useEffect(() => () => {
    abortRef.current?.abort()
    void stopAssistantSpeechRecognition().catch(() => undefined)
    void stopAssistantSpeech().catch(() => undefined)
  }, [])

  const addAssistantResponse = async (result: AssistantExecutionResult, voiceRequest = false) => {
    setMessages((current) => [...current, newMessage('assistant', result.response, result.openPage)])
    if (voiceRequest) onVoiceResponseReady?.()
    if (readAloud || voiceRequest) await speakResponse(result.spokenResponse ?? result.response)
  }

  const speakResponse = async (text: string) => {
    const sequence = ++speechSequenceRef.current
    setSpeaking(true)
    try { await speakAssistantText(text, speechVoice, assistantLanguage) } catch { /* Voice output can be unavailable on the device. */ }
    finally { if (speechSequenceRef.current === sequence) setSpeaking(false) }
  }

  const spokenProposal = (command: AssistantCommand) => {
    if (command.type === 'create_note') return tx('Voy a crear la nota {{title}} con el contenido: {{content}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, content: command.args.content })
    if (command.type === 'rename_local_note') return tx('Voy a cambiar el nombre de la nota {{title}} a {{newTitle}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, newTitle: command.args.newTitle })
    if (command.type === 'update_local_event') return tx('Voy a cambiar el nombre del evento {{title}} para {{date}} a {{newTitle}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, date: assistantSpokenDateText(command.args.date, now, command.args.timeZone, assistantLanguage), newTitle: command.args.newTitle })
    if (command.type === 'update_local_task') {
      const date = assistantSpokenDateText(command.args.date, now, command.args.timeZone, assistantLanguage)
      return command.args.action === 'complete'
        ? tx('Voy a completar la tarea {{title}} para {{date}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, date })
        : tx('Voy a cambiar el nombre de la tarea {{title}} para {{date}} a {{newTitle}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, date, newTitle: command.args.newTitle })
    }
    if (command.type === 'create_birthday' || command.type === 'create_event' || command.type === 'create_task' || command.type === 'create_task_reminder') {
      const date = assistantDateText(command.args.date, now, command.args.timeZone, assistantLanguage)
      if (command.type === 'create_birthday') return tx('Voy a apuntar {{title}} para {{date}} y se repetirá cada año. ¿Te parece bien o lo modificamos?', { title: command.args.title, date })
      if (command.type === 'create_event') return tx('Voy a apuntar {{title}} para {{date}}, de {{start}} a {{end}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, date, start: command.args.startTime, end: command.args.endTime })
      if (command.type === 'create_task_reminder') return tx('Voy a apuntar {{title}} para {{date}} a las {{time}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, date, time: command.args.time })
      return tx('Voy a apuntar {{title}} para {{date}}. ¿Te parece bien o lo modificamos?', { title: command.args.title, date })
    }
    const review = assistantCommandSummary(command, assistantLanguage, now)
    return `${review.title}. ${review.details.join('. ')}. ${tx('Puedes decir confirmar, editar o cancelar.')}`
  }

  const submit = async (text: string, voiceRequest = false) => {
    const trimmed = text.trim()
    if (!trimmed || processingRef.current || pendingRef.current) return
    if (!enabled) {
      setMessages((current) => [...current, newMessage('assistant', tx('El Asistente está desactivado. Actívalo en Ajustes para utilizarlo.'))])
      if (voiceRequest) onVoiceResponseReady?.()
      return
    }
    if (timeContextRef.current && /^(cancelar|cancela|cancel|no)$/i.test(trimmed)) {
      timeContextRef.current = null
      timeSourceRef.current = ''
      setAwaitingTime(false)
      setInput('')
      const message = tx('Acción cancelada. No se ha modificado ningún dato.')
      setMessages(current => [...current, newMessage('assistant', message)])
      if (voiceRequest) onVoiceResponseReady?.()
      if (voiceRequest || readAloud) await speakResponse(message)
      return
    }
    if (requestCount >= SESSION_LIMIT) {
      setMessages((current) => [...current, newMessage('assistant', tx('Has alcanzado el límite de 30 peticiones de este chat. Pulsa Nuevo chat para continuar.'))])
      if (voiceRequest) onVoiceResponseReady?.()
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    processingRef.current = true
    setInput('')
    setProcessing(true)
    setRequestCount((count) => count + 1)
    setMessages((current) => [...current, newMessage('user', trimmed)])
    try {
      const normalized = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿?¡!.,]/g, '').trim().replace(/\s+/g, ' ')
      // Una petición nueva sustituye una aclaración pendiente de una petición anterior.
      if (timeContextRef.current && /^(?:crea|crear|anade|agrega|apunta|recuerdame|create|add|que era un evento|queda un evento)\b/.test(normalized)) {
        timeContextRef.current = null
        timeSourceRef.current = ''
        setAwaitingTime(false)
      }
      const candidates = noteCandidatesRef.current
      const readReference = /^(?:lee|leeme|leer) (?:esa|esta|la) nota$|^(?:lee|leeme)la$/.test(normalized)
      const choice = /^(?:la|el) (?:de|del) (.+)$/.exec(normalized)
      const noteFollowup = candidates.length > 0 && (readReference || Boolean(choice))
      let selectedNoteId: string | undefined
      if (noteFollowup) {
        const selected = readReference ? candidates : candidates.filter(note => note.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(choice![1]))
        if (selected.length !== 1) throw new Error(tx('Indica cuál de las notas quieres leer.'))
        selectedNoteId = selected[0].id
      } else {
        noteCandidatesRef.current = []
      }
      const nextWeekFollowup = /^(?:y\s+)?(?:la\s+)?(?:semana que viene|semana siguiente|proxima semana)$|^(?:and\s+)?next week$|^what about next week$/.test(normalized)
      const dayFollowup = /^(?:y\s+)?(hoy|manana|pasado manana)$|^(?:and\s+|what about\s+)?(today|tomorrow|the day after tomorrow)$/.exec(normalized)
      const queryTopic = lastQueryTopicRef.current
      if (dayFollowup && !queryTopic) throw new Error(tx('¿Te refieres al tiempo o a la agenda?'))
      const previousTopic = lastTopicRef.current
      if (!nextWeekFollowup) lastTopicRef.current = null
      if (!nextWeekFollowup && !dayFollowup) lastQueryTopicRef.current = null
      if (nextWeekFollowup && !previousTopic && !queryTopic) throw new Error(tx('¿Te refieres al tiempo o a la agenda de la semana que viene?'))
      const nextStart = nextWeekFollowup && previousTopic?.type === 'calendar' ? addDaysToDateKey(previousTopic.weekStart, 7) : null
      const plan = selectedNoteId
        ? { command: validateAssistantCommand({ type: 'read_note_id', args: { id: selectedNoteId } }), explanation: tx('Leer una nota guardada localmente.'), requiresConfirmation: false }
        : nextWeekFollowup && previousTopic?.type === 'weather'
        ? { command: validateAssistantCommand({ type: 'get_weather', args: { period: 'next_week' } }), explanation: tx('Consultar la previsión disponible para Casa.'), requiresConfirmation: false }
        : nextStart
        ? { command: validateAssistantCommand({ type: 'get_calendar', args: { from: `${nextStart}T00:00:00`, to: `${addDaysToDateKey(nextStart, 6)}T23:59:59`, ...(lastCalendarTypeRef.current ? { type: lastCalendarTypeRef.current } : {}), ...(lastCalendarTypeRef.current === 'task' && lastTaskStatusRef.current ? { taskStatus: lastTaskStatusRef.current } : {}) } }), explanation: tx('Consultar la agenda del intervalo solicitado.'), requiresConfirmation: false }
        : await planAssistantRequest(provider, {
          text: dayFollowup ? `${queryTopic === 'calendar' ? (lastCalendarTypeRef.current === 'task' ? (lastTaskStatusRef.current === 'completed' ? 'tareas completadas' : 'tareas') : lastCalendarTypeRef.current === 'event' ? 'eventos' : lastCalendarTypeRef.current === 'birthday' ? 'cumpleaños' : 'agenda') : 'tiempo'} ${dayFollowup[1] ?? dayFollowup[2]}` : nextWeekFollowup && queryTopic === 'calendar' ? `${lastCalendarTypeRef.current === 'task' ? (lastTaskStatusRef.current === 'completed' ? 'tareas completadas' : 'tareas') : lastCalendarTypeRef.current === 'event' ? 'eventos' : lastCalendarTypeRef.current === 'birthday' ? 'cumpleaños' : 'agenda'} la semana que viene` : trimmed,
          locale: activeLocale(assistantLanguage),
          now: now.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
          timeClarification: timeContextRef.current ?? undefined,
        }, controller.signal)
      if (controller.signal.aborted) return
      if (plan.requiresConfirmation) {
        if ((plan.command.type === 'request_task_change' || plan.command.type === 'request_event_change' || plan.command.type === 'request_note_rename') && !onPrepare) throw new Error(tx('Primero hay que identificar la tarea.'))
        const prepared = onPrepare ? { ...plan, command: validateAssistantCommand(onPrepare(plan.command)) } : plan
        const proposal = { plan: prepared, sourceText: timeSourceRef.current || trimmed }
        timeContextRef.current = null
        timeSourceRef.current = ''
        setAwaitingTime(false)
        pendingRef.current = proposal
        setPending(proposal)
        processingRef.current = false
        setProcessing(false)
        if (voiceRequest || readAloud) {
          if (voiceRequest) onVoiceResponseReady?.()
          await speakResponse(spokenProposal(prepared.command))
          if (voiceRequest && !controller.signal.aborted && pendingRef.current === proposal) await listenForPendingDecision(proposal)
        }
      } else {
        const result = await executeAssistantPlan(plan, { execute: onExecute }) as AssistantExecutionResult
        if (controller.signal.aborted) return
        noteCandidatesRef.current = result.noteCandidates ?? []
        if (plan.command.type === 'get_calendar') {
          lastQueryTopicRef.current = 'calendar'
          lastCalendarTypeRef.current = plan.command.args.type
          lastTaskStatusRef.current = plan.command.args.taskStatus
          const from = plan.command.args.from.slice(0, 10)
          const to = plan.command.args.to.slice(0, 10)
          lastTopicRef.current = dateKeyToDayNumber(to) - dateKeyToDayNumber(from) === 6 && new Date(`${from}T12:00:00Z`).getUTCDay() === 1 ? { type: 'calendar', weekStart: from } : null
        } else if (plan.command.type === 'get_weather') {
          lastQueryTopicRef.current = 'weather'
          lastTopicRef.current = { type: 'weather' }
        }
        await addAssistantResponse(result, voiceRequest)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof AssistantTimeRequired) {
          if (!timeSourceRef.current) timeSourceRef.current = trimmed
          timeContextRef.current = error.context
          setAwaitingTime(true)
        }
        const message = error instanceof Error ? error.message : tx('No se ha podido procesar la petición.')
        setMessages((current) => [...current, newMessage('assistant', message)])
        if (voiceRequest || readAloud) {
          if (voiceRequest) onVoiceResponseReady?.()
          await speakResponse(message)
        }
        if (error instanceof AssistantTimeRequired && voiceRequest && !controller.signal.aborted) {
          processingRef.current = false
          setProcessing(false)
          await toggleListening()
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        processingRef.current = false
        setProcessing(false)
      }
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
    listeningControllerRef.current = controller
    setListening(true)
    try {
      const answer = await recognizeAssistantSpeech(controller.signal, assistantLanguage)
      if (controller.signal.aborted || pendingRef.current !== proposal) return
      if (listeningControllerRef.current === controller) { listeningControllerRef.current = null; setListening(false) }
      const reminderMinutes = reminderLeadTimeMinutes(answer)
      if (proposal.plan.command.type === 'create_task_reminder' && reminderMinutes !== null) {
        const command = validateAssistantCommand({ ...proposal.plan.command, args: { ...proposal.plan.command.args, reminderMinutesBefore: reminderMinutes } })
        const updated = { ...proposal, plan: { ...proposal.plan, command } }
        pendingRef.current = updated
        setPending(updated)
        setMessages(current => [...current, newMessage('assistant', tx('Aviso actualizado. Revisa la propuesta y confirma cuando esté correcta.'))])
        await speakResponse(spokenProposal(command))
        if (!controller.signal.aborted && pendingRef.current === updated) await listenForPendingDecision(updated)
        return
      }
      const normalized = answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ')
      if (/^(si|si confirmo|confirmo|confirmar|confirma|me parece bien|esta bien|de acuerdo|confirm|yes|yes confirm|sounds good)$/.test(normalized)) {
        await confirmPending(proposal, true)
      } else if (/^(cancelo|cancelar|cancela|cancel|no|no gracias)$/.test(normalized)) {
        cancelPending()
        await speakResponse(tx('Acción cancelada. No se ha modificado ningún dato.'))
      } else if (/^(edito|editar|edita|edit|modificar|modifico|modificamos|lo modificamos|quiero modificarlo|cambiar|cambialo)$/.test(normalized)) {
        pendingRef.current = null
        setPending(null)
        setInput(proposal.sourceText)
        const prompt = tx('Dime la petición completa de nuevo.')
        setMessages((current) => [...current, newMessage('assistant', prompt)])
        await speakResponse(prompt)
        if (controller.signal.aborted) return
        listeningControllerRef.current = controller
        setListening(true)
        const revised = await recognizeAssistantSpeech(controller.signal, assistantLanguage)
        if (controller.signal.aborted || !revised.trim()) return
        if (listeningControllerRef.current === controller) { listeningControllerRef.current = null; setListening(false) }
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
      if (listeningControllerRef.current === controller) { listeningControllerRef.current = null; setListening(false) }
    }
  }

  const toggleListening = async () => {
    if (listeningControllerRef.current) {
      const controller = listeningControllerRef.current
      listeningControllerRef.current = null
      controller?.abort()
      setListening(false)
      return
    }
    if (speaking) {
      // Prevent the interrupted response from starting its own follow-up listener.
      abortRef.current?.abort()
      abortRef.current = null
      processingRef.current = false
      setProcessing(false)
      speechSequenceRef.current += 1
      setSpeaking(false)
      await stopAssistantSpeech().catch(() => undefined)
    }
    if (pendingRef.current) {
      await listenForPendingDecision(pendingRef.current)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    listeningControllerRef.current = controller
    onVoiceModeStart?.()
    setListening(true)
    try {
      const text = await recognizeAssistantSpeech(controller.signal, assistantLanguage)
      if (controller.signal.aborted) return
      if (listeningControllerRef.current === controller) { listeningControllerRef.current = null; setListening(false) }
      if (text) await submit(text, true)
      else onVoiceResponseReady?.()
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((current) => [...current, newMessage('assistant', error instanceof Error ? error.message : tx('No se ha podido utilizar el micrófono.'))])
        onVoiceResponseReady?.()
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      if (listeningControllerRef.current === controller) { listeningControllerRef.current = null; setListening(false) }
    }
  }

  useImperativeHandle(ref, () => ({
    startListening: () => {
      if (!enabled || !voiceEnabled) {
        onVoiceResponseReady?.()
        return
      }
      if (listeningControllerRef.current) {
        void toggleListening()
        return
      }
      abortRef.current?.abort()
      abortRef.current = null
      processingRef.current = false
      setProcessing(false)
      speechSequenceRef.current += 1
      setSpeaking(false)
      void stopAssistantSpeech().catch(() => undefined)
      void toggleListening()
    },
  }))

  const startNewChat = () => {
    abortRef.current?.abort()
    listeningControllerRef.current?.abort()
    listeningControllerRef.current = null
    speechSequenceRef.current += 1
    void stopAssistantSpeechRecognition().catch(() => undefined)
    void stopAssistantSpeech().catch(() => undefined)
    setSpeaking(false)
    setListening(false)
    pendingRef.current = null
    setPending(null)
    timeContextRef.current = null
    timeSourceRef.current = ''
    setAwaitingTime(false)
    lastTopicRef.current = null
    lastQueryTopicRef.current = null
    lastCalendarTypeRef.current = undefined
    lastTaskStatusRef.current = undefined
    noteCandidatesRef.current = []
    setInput('')
    setRequestCount(0)
    setMessages([newMessage('assistant', tx('Hola, Pablo. Puedo consultar tu día, el tiempo, la agenda y tus notas, o preparar una nota, alarma o temporizador.'))])
  }

  const summary = pending ? assistantCommandSummary(pending.plan.command, assistantLanguage, now) : null

  return <div hidden={!visible} className={`assistant-page fullscreen-page page-enter ${pending ? 'has-pending' : ''}`}>
    <div className="assistant-chat-header" data-swipe-block>
      {!compact ? <PageHeader pageLabel="¿En qué te ayudo?" /> : null}
      <button type="button" className="assistant-new-chat" onClick={startNewChat} disabled={processing} title={tx('Nuevo chat')}><MessageSquarePlus size={18} aria-hidden="true" />{tx('Nuevo chat')}</button>
    </div>
    {voiceMode ? <div className={`lumi-voice-indicator ${listening ? 'is-listening' : speaking ? 'is-speaking' : ''}`} role="status" aria-label={listening ? tx('Escuchando') : speaking ? tx('Hablando') : tx('Lumi preparada')}><span aria-hidden="true"><i /><i /><i /><i /><i /></span><small>{listening ? tx('Escuchando') : speaking ? tx('Hablando') : tx('Lumi preparada')}</small></div> : null}
    {!compact ? <div className="assistant-status" role="status">
      <span className={enabled ? 'is-ready' : 'is-disabled'}><i />{enabled ? tx('Peticiones locales · voz según el dispositivo') : tx('Desactivado')}</span>
      <small>{tx('{{count}}/30 peticiones · el chat se conserva al cambiar de página', { count: requestCount })}</small>
    </div> : null}

    <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-label={tx('Conversación del Asistente')}>
      {messages.map((message) => <article key={message.id} className={`assistant-message is-${message.role}`}>
        {message.role === 'assistant' ? <span className="assistant-avatar"><Bot size={18} /></span> : null}
        <div><p>{message.text}</p>{!compact && message.role === 'assistant' ? <footer>
          <button type="button" onClick={() => void speakResponse(message.text)} aria-label={tx('Leer respuesta')}><Volume2 size={15} />{tx('Leer')}</button>
          {message.openPage ? <button type="button" onClick={() => onOpenPage(message.openPage as DashboardPageId)}>{tx('Abrir módulo')}</button> : null}
        </footer> : null}</div>
      </article>)}
      {pending && summary ? <section ref={confirmationRef} className="assistant-confirmation" aria-label={tx('Acción pendiente de confirmación')}>
        <header><span><Check size={18} /></span><div><small>{tx('Revisa antes de ejecutar')}</small><h2>{summary.title}</h2></div></header>
        <ul>{summary.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        {!compact && pending.plan.command.type === 'create_task_reminder' ? <label className="settings-select-row">
          <span>{tx('Antelación del aviso')}</span>
          <select aria-label={tx('Antelación del aviso')} value={pending.plan.command.args.reminderMinutesBefore ?? 60} onChange={event => {
            const current = pendingRef.current
            if (!current || current.plan.command.type !== 'create_task_reminder') return
            abortRef.current?.abort()
            listeningControllerRef.current?.abort()
            listeningControllerRef.current = null
            setListening(false)
            const command = validateAssistantCommand({ ...current.plan.command, args: { ...current.plan.command.args, reminderMinutesBefore: Number(event.target.value) } })
            const updated = { ...current, plan: { ...current.plan, command } }
            pendingRef.current = updated
            setPending(updated)
          }}>
            {![15, 30, 60, 120, 1440].includes(pending.plan.command.args.reminderMinutesBefore ?? 60) ? <option value={pending.plan.command.args.reminderMinutesBefore}>{tx('{{count}} minutos antes', { count: pending.plan.command.args.reminderMinutesBefore })}</option> : null}
            {([15, 30, 60, 120, 1440] as const).map(minutes => <option key={minutes} value={minutes}>{tx(minutes === 15 ? '15 minutos antes' : minutes === 30 ? '30 minutos antes' : minutes === 60 ? '1 hora antes' : minutes === 120 ? '2 horas antes' : '1 día antes')}</option>)}
          </select>
        </label> : null}
        <p>{pending.plan.explanation}</p>
        {!compact ? <div className="assistant-confirmation-actions">
          <button type="button" className="assistant-confirm" onClick={() => void confirmPending()}><Check size={17} />{tx('Confirmar')}</button>
          <button type="button" onClick={editPending}><Edit3 size={17} />{tx('Editar petición')}</button>
          <button type="button" onClick={cancelPending}><X size={17} />{tx('Cancelar')}</button>
        </div> : null}
      </section> : null}
    </div>

    {!compact && messages.length <= 1 ? <div className="assistant-suggestions" aria-label={tx('Sugerencias')} data-swipe-block>
      {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void submit(tx(suggestion))}>{tx(suggestion)}</button>)}
    </div> : null}

    {!compact ? <form className="assistant-composer" data-swipe-block onSubmit={onSubmit}>
      <div>
        <textarea id={inputId} aria-label={tx('Escribe o dicta una petición')} value={input} onChange={(event) => setInput(event.target.value)} placeholder={tx('Escribe o dicta una petición')} rows={2} disabled={!enabled || processing || pending !== null} />
        {voiceEnabled ? <button type="button" className={listening ? 'is-listening' : ''} onClick={() => void toggleListening()} disabled={!enabled || (processing && pending === null && !listening && !speaking)} aria-label={listening ? tx('Detener dictado') : tx('Iniciar dictado')}>{listening ? <MicOff size={21} /> : <Mic size={21} />}</button> : null}
        <button type="submit" className="assistant-send" disabled={!input.trim() || !enabled || processing || pending !== null} aria-label={tx('Enviar petición')}><Send size={21} /></button>
      </div>
      {listening ? <p className="assistant-listening"><i />{tx('Escuchando… toca el micrófono para cancelar')}</p> : null}
    </form> : null}
  </div>
}
