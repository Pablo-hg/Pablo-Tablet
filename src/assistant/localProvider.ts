import { InvalidAssistantCommandError, type AssistantProposal, type AssistantRequest } from './contracts'
import type { AssistantProvider } from './provider'
import { tx } from '../i18n'

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  diez: 10,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cuarentaicinco: 45,
  sesenta: 60,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  sixty: 60,
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const dateInTimeZone = (now: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const addLocalDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

const proposal = (command: unknown, explanation: string): AssistantProposal => ({ command, explanation })

function readNumber(value: string | undefined) {
  if (!value) return null
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  return NUMBER_WORDS[normalize(value)] ?? null
}

/** Intérprete local deliberadamente acotado; nunca ejecuta acciones. */
export class LocalAssistantProvider implements AssistantProvider {
  readonly id = 'local-safe'

  async interpret(request: AssistantRequest): Promise<AssistantProposal> {
    const text = normalize(request.text)
    const today = dateInTimeZone(request.now, request.timeZone)
    const tomorrow = addLocalDays(today, 1)

    if (text.includes('resumen') || text.includes('que tengo hoy') || text.includes('summary') || text.includes('what do i have today')) {
      return proposal({ type: 'get_daily_summary', args: { date: today } }, tx('Preparar el resumen con datos guardados en esta tablet.'))
    }

    if (text.includes('tiempo') || text.includes('llover') || text.includes('temperatura') || text.includes('weather') || text.includes('rain') || text.includes('temperature')) {
      const period = text.includes('manana') || text.includes('tomorrow') ? 'tomorrow' : text.includes('ahora') || text.includes('now') ? 'now' : 'today'
      return proposal({ type: 'get_weather', args: { period } }, tx('Consultar la previsión disponible para Casa.'))
    }

    if (text.includes('agenda') || text.includes('proxima cita') || text.includes('eventos') || text.includes('schedule') || text.includes('next appointment') || text.includes('events')) {
      return proposal(
        { type: 'get_calendar', args: { from: `${today}T00:00:00`, to: `${tomorrow}T23:59:59` } },
        tx('Consultar la agenda local de hoy y mañana.'),
      )
    }

    const notePrefix = /^(?:(?:guarda|crea|apunta)(?: una)? nota(?: que diga)?|(?:save|create|write)(?: a)? note(?: saying)?)\s*:?\s*/i
    if (notePrefix.test(request.text.trim())) {
      const content = request.text.trim().replace(notePrefix, '').trim()
      if (!content) throw new InvalidAssistantCommandError(tx('Indica qué contenido debe tener la nota.'))
      return proposal(
        { type: 'create_note', args: { title: content.slice(0, 60), content, reminderAt: null } },
        tx('Preparar una nota nueva. Revisa sus datos antes de confirmar.'),
      )
    }

    if (text.includes('mis notas') || text.includes('notas recientes') || text.includes('recordatorios recientes') || text.includes('my notes') || text.includes('recent notes') || text.includes('recent reminders')) {
      return proposal({ type: 'get_notes', args: { limit: 5 } }, tx('Consultar las notas recientes guardadas localmente.'))
    }

    const timerMatch = text.match(/(?:temporizador(?: de)?|timer(?: for)?)\s+(\d+|[a-z]+)\s*(segundos?|minutos?|horas?|seconds?|minutes?|hours?)/)
    if (timerMatch) {
      const amount = readNumber(timerMatch[1])
      if (!amount || amount <= 0) throw new InvalidAssistantCommandError(tx('Indica una duración válida para el temporizador.'))
      const unit = timerMatch[2]
      const multiplier = unit.startsWith('hora') || unit.startsWith('hour') ? 3_600 : unit.startsWith('minuto') || unit.startsWith('minute') ? 60 : 1
      return proposal(
        { type: 'start_timer', args: { label: tx('Temporizador'), durationSeconds: amount * multiplier } },
        tx('Preparar un temporizador. No empezará hasta que lo confirmes.'),
      )
    }

    const alarmMatch = text.match(/(?:alarma(?: todos los dias)?(?: a las| para las)?|alarm(?: every day)?(?: at| for)?)\s+(\d{1,2})(?::(\d{2}))?/)
    if (alarmMatch) {
      const hour = Number(alarmMatch[1])
      const minute = Number(alarmMatch[2] ?? 0)
      if (hour > 23 || minute > 59) throw new InvalidAssistantCommandError(tx('La hora de la alarma no es válida.'))
      const at = `${tomorrow}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
      return proposal(
        { type: 'create_alarm', args: { label: tx('Alarma'), at, repeatDays: [1, 2, 3, 4, 5, 6, 7] } },
        tx('Preparar una alarma diaria. No se guardará hasta que la confirmes.'),
      )
    }

    if (text.includes('como') || text.includes('ayuda') || text.includes('donde') || text.includes('how') || text.includes('help') || text.includes('where')) {
      return proposal({ type: 'get_local_help', args: { topic: request.text.trim().slice(0, 200) } }, tx('Buscar instrucciones incluidas en la aplicación.'))
    }

    throw new InvalidAssistantCommandError(tx('No he entendido la petición en modo local. Prueba una de las sugerencias o abre el módulo manual.'))
  }
}
