import { InvalidAssistantCommandError, type AssistantProposal, type AssistantRequest } from './contracts'
import type { AssistantProvider } from './provider'
import { txFor } from '../i18n'
import type { TranslationKey } from '../i18n/translations'
import { addDaysToDateKey } from '../calendarRecurrence'

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cuarentaicinco: 45,
  sesenta: 60,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  sixty: 60,
}

const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }

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
  const word = normalize(value)
  if (NUMBER_WORDS[word] !== undefined) return NUMBER_WORDS[word]
  const parts = word.split(/\s+(?:y|and)\s+/)
  if (parts.length === 2 && NUMBER_WORDS[parts[0]] >= 20 && NUMBER_WORDS[parts[1]] >= 1 && NUMBER_WORDS[parts[1]] <= 9) return NUMBER_WORDS[parts[0]] + NUMBER_WORDS[parts[1]]
  return null
}

/** Intérprete local deliberadamente acotado; nunca ejecuta acciones. */
export class LocalAssistantProvider implements AssistantProvider {
  readonly id = 'local-safe'

  async interpret(request: AssistantRequest): Promise<AssistantProposal> {
    const tx = (key: TranslationKey) => txFor(request.locale.startsWith('en') ? 'en' : 'es', key)
    const text = normalize(request.text)
    const today = dateInTimeZone(request.now, request.timeZone)
    const tomorrow = addLocalDays(today, 1)

    const notePrefix = /^(?:(?:guarda|crea|apunta)(?: una)? nota(?: que diga)?|(?:save|create|write)(?: a)? note(?: saying)?)\s*:?\s*/i
    if (notePrefix.test(request.text.trim())) {
      const noteText = request.text.trim().replace(notePrefix, '').trim()
      if (!noteText) throw new InvalidAssistantCommandError(tx('Indica qué contenido debe tener la nota.'))
      const structured = noteText.match(/^(?:(?:de\s+)?que\s+se\s+llame|que\s+se\s+llama|llamada|(?:(?:con\s+)?(?:el\s+)?)?(?:t[ií]tulo|titulada|title|titled))\s*:?\s*(.*?)\s*(?:[,;]\s*|\s+(?:y\s+)?)(?:(?:con\s+)?(?:el\s+)?)?(?:contenido(?:\s+(?:es|sea))?|que\s+(?:diga|contenga)|content(?:\s+is)?|saying)\s*:?\s*([\s\S]*)$/i)
      const hasTitleMarker = /^(?:(?:de\s+)?que\s+se\s+llam[ae]|llamada|(?:(?:con\s+)?(?:el\s+)?)?(?:t[ií]tulo|titulada|title|titled))\b/i.test(noteText)
      if (hasTitleMarker && (!structured || !structured[1].trim() || !structured[2].trim())) {
        throw new InvalidAssistantCommandError(tx('Indica el título y el contenido. Por ejemplo: «Crea una nota: título Compra, contenido leche y pan».'))
      }
      const title = structured ? structured[1].trim() : noteText.slice(0, 60)
      const content = structured ? structured[2].trim() : noteText
      return proposal(
        { type: 'create_note', args: { title, content, reminderAt: null } },
        tx('Preparar una nota nueva. Revisa sus datos antes de confirmar.'),
      )
    }

    const alarmQuery = /\b(?:mis alarmas|(?:que|cuales|cuantas)\s+(?:son\s+)?(?:mis\s+)?alarmas?|tengo\s+(?:alguna\s+)?alarmas?|my alarms|(?:what|which|how many)\s+(?:are\s+)?(?:my\s+)?alarms?|do i have (?:any )?alarms?)\b/.test(text)
    const timerQuery = /\b(?:mis temporizadores|(?:que|cuales|cuantos)\s+(?:son\s+)?(?:mis\s+)?temporizadores?|tengo\s+(?:algun\s+)?temporizadores?|cuanto (?:tiempo )?(?:(?:me|le) )?queda.*temporizador|(?:que|cuales)\s+alarmas?\s+y\s+(?:mis\s+)?temporizadores?|my timers|(?:what|which|how many)\s+(?:are\s+)?(?:my\s+)?timers?|do i have (?:any )?timers?|how much time.*timer)\b/.test(text)
    if (alarmQuery || timerQuery) {
      return proposal({ type: 'get_clock_status', args: { include: alarmQuery && timerQuery ? 'both' : alarmQuery ? 'alarms' : 'timers' } }, tx('Consultar las alarmas y los temporizadores de esta tablet.'))
    }

    if ((text.includes('resumen') || text.includes('que tengo hoy') || text.includes('summary') || text.includes('what do i have today')) && !/semana|\bweek\b/.test(text)) {
      return proposal({ type: 'get_daily_summary', args: { date: today } }, tx('Preparar el resumen con datos guardados en esta tablet.'))
    }

    const timerPrefix = /(?:temporizador(?:\s+(?:de|para))?|timer(?:\s+for)?)\s+/.exec(text)
    if (timerPrefix) {
      let remaining = text.slice(timerPrefix.index + timerPrefix[0].length)
      let durationSeconds = 0
      let found = false
      const units = new Set<number>()
      while (true) {
        const part = /^(\d+|[a-z]+(?:\s+(?:y|and)\s+[a-z]+)?)\s*(segundos?|minutos?|horas?|seconds?|minutes?|hours?)\b/.exec(remaining)
        if (!part) {
          if (found) throw new InvalidAssistantCommandError(tx('Indica una duración válida para el temporizador.'))
          break
        }
        found = true
        const amount = readNumber(part[1])
        const unit = part[2]
        const multiplier = unit.startsWith('hora') || unit.startsWith('hour') ? 3_600 : unit.startsWith('minuto') || unit.startsWith('minute') ? 60 : 1
        if (!amount || amount <= 0 || units.has(multiplier)) throw new InvalidAssistantCommandError(tx('Indica una duración válida para el temporizador.'))
        units.add(multiplier)
        durationSeconds += amount * multiplier
        remaining = remaining.slice(part[0].length)
        const next = /^\s+(?:y|and)\s+/.exec(remaining)
        if (!next) break
        remaining = remaining.slice(next[0].length)
      }
      if (found) {
        if (durationSeconds > 86_400) throw new InvalidAssistantCommandError(tx('El temporizador no puede superar 24 horas.'))
        return proposal(
          { type: 'start_timer', args: { label: tx('Temporizador'), durationSeconds } },
          tx('Preparar un temporizador. No empezará hasta que lo confirmes.'),
        )
      }
    }

    if (text.includes('tiempo') || text.includes('llover') || text.includes('temperatura') || text.includes('weather') || text.includes('rain') || text.includes('temperature')) {
      if (/\bpasado manana\b|\bday after tomorrow\b/.test(text)) throw new InvalidAssistantCommandError(tx('Por ahora puedo consultar el tiempo de hoy, mañana o la semana que viene.'))
      const nextWeek = /semana (?:que viene|proxima|siguiente)|proxima semana|next week/.test(text)
      if (!nextWeek && /\bsemana\b|\bweek\b/.test(text)) throw new InvalidAssistantCommandError(tx('Por ahora puedo consultar el tiempo de hoy, mañana o la semana que viene.'))
      const period = nextWeek ? 'next_week' : text.includes('manana') || text.includes('tomorrow') ? 'tomorrow' : text.includes('ahora') || text.includes('now') ? 'now' : 'today'
      return proposal({ type: 'get_weather', args: { period } }, tx('Consultar la previsión disponible para Casa.'))
    }

    if (text.includes('agenda') || text.includes('calendario') || text.includes('proxima cita') || text.includes('eventos') || text.includes('tareas') || text.includes('que tengo esta semana') || text.includes('que tengo la semana que viene') || text.includes('que tengo la proxima semana') || text.includes('que tengo el ') || text.includes('que tengo pasado manana') || text.includes('schedule') || text.includes('calendar') || text.includes('next appointment') || text.includes('events') || text.includes('tasks') || text.includes('what do i have this week') || text.includes('what do i have next week') || text.includes('what do i have on ') || text.includes('what do i have the day after tomorrow')) {
      if (/\b(ayer|yesterday)\b|semana pasada|last week/.test(text)) {
        throw new InvalidAssistantCommandError(tx('Todavía no puedo consultar esa fecha. Prueba con hoy, mañana, esta semana o la semana que viene.'))
      }
      let from = today
      let to = tomorrow
      const nextWeek = /semana (?:que viene|proxima|siguiente)|proxima semana|next week/.test(text)
      const thisWeek = /esta semana|semana actual|this week/.test(text)
      const weekdayMatches = [...text.matchAll(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)]
      const isoDate = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text)
      const slashDate = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/.exec(text)
      const namedDate = /\b(\d{1,2}|[a-z]+(?:\s+y\s+[a-z]+)?)\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/.exec(text)
      if ((nextWeek && thisWeek) || weekdayMatches.length > 1 || (weekdayMatches.length > 0 && (isoDate || slashDate || namedDate)) || Number(Boolean(isoDate)) + Number(Boolean(slashDate)) + Number(Boolean(namedDate)) > 1) throw new InvalidAssistantCommandError(tx('Indica un solo día para consultar la agenda.'))
      if (isoDate || slashDate || namedDate) {
        const day = namedDate ? readNumber(namedDate[1]) : slashDate ? Number(slashDate[1]) : null
        const year = namedDate?.[3] ?? slashDate?.[3] ?? today.slice(0, 4)
        const date = isoDate ? isoDate[1] : namedDate ? `${year}-${String(MONTHS[namedDate[2]]).padStart(2, '0')}-${String(day).padStart(2, '0')}` : `${year}-${slashDate![2].padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const parsed = new Date(`${date}T12:00:00Z`)
        if (((namedDate || slashDate) && (!day || day < 1 || day > 31)) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new InvalidAssistantCommandError(tx('Esa fecha no es válida. Comprueba el día, mes y año.'))
        from = date
        to = date
      } else if (weekdayMatches.length === 1) {
        if (!nextWeek && !thisWeek && /\b(proximo|proxima|siguiente|que viene|next)\b/.test(text)) throw new InvalidAssistantCommandError(tx('Indica si te refieres a esta semana o a la semana que viene.'))
        const currentWeekday = new Date(`${today}T12:00:00Z`).getUTCDay()
        const targetWeekday = WEEKDAYS[weekdayMatches[0][1]]
        const startOfWeek = addDaysToDateKey(today, -((currentWeekday + 6) % 7))
        from = nextWeek || thisWeek
          ? addDaysToDateKey(startOfWeek, ((targetWeekday + 6) % 7) + (nextWeek ? 7 : 0))
          : addDaysToDateKey(today, (targetWeekday - currentWeekday + 7) % 7)
        to = from
      } else if (/\b(?:el|dia|on)\s+\d{1,2}\b/.test(text)) {
        throw new InvalidAssistantCommandError(tx('Indica el día, el mes y el año que quieres consultar.'))
      } else if (nextWeek || thisWeek) {
        const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
        from = addDaysToDateKey(today, -((weekday + 6) % 7) + (nextWeek ? 7 : 0))
        to = addDaysToDateKey(from, 6)
      } else if (/\bpasado manana\b|\bday after tomorrow\b/.test(text)) {
        from = addDaysToDateKey(today, 2)
        to = from
      } else if (/\b(manana|tomorrow)\b/.test(text)) {
        from = tomorrow
        to = tomorrow
      } else if (/\b(hoy|today)\b/.test(text)) {
        to = today
      }
      return proposal(
        { type: 'get_calendar', args: { from: `${from}T00:00:00`, to: `${to}T23:59:59` } },
        tx('Consultar la agenda del intervalo solicitado.'),
      )
    }

    if (text.includes('mis notas') || text.includes('notas recientes') || text.includes('recordatorios recientes') || text.includes('my notes') || text.includes('recent notes') || text.includes('recent reminders')) {
      return proposal({ type: 'get_notes', args: { limit: 5 } }, tx('Consultar las notas recientes guardadas localmente.'))
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
