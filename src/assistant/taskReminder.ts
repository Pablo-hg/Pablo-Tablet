import { AssistantTimeRequired, InvalidAssistantCommandError, type AssistantRequest, type AssistantProposal, type AssistantTimeContext } from './contracts'
import { addDaysToDateKey } from '../calendarRecurrence'
import { txFor, type SupportedLanguage } from '../i18n'

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.!?]$/g, '')
const HOURS: Record<string, number> = { cero: 0, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuna: 21, veintidos: 22, veintitres: 23 }

function proposalForTime(text: string, context: AssistantTimeContext, language: SupportedLanguage): AssistantProposal {
  const tx = (key: Parameters<typeof txFor>[1]) => txFor(language, key)
  const value = normalize(text)
  const halfOnly = /^(?:(?:de|por) la\s+)?(manana|tarde|noche)$/.exec(value)
  const match = /^(?:a las?\s+)?(\d{1,2}|[a-z]+)(?::(\d{2})|\s+y\s+(media|cuarto))?(?:\s+(?:de|por) la\s+(manana|tarde|noche))?$/.exec(value)
  const half = halfOnly?.[1] ?? match?.[4]
  let hour = halfOnly && context.hour !== undefined ? context.hour : match ? /^\d+$/.test(match[1]) ? Number(match[1]) : HOURS[match[1]] : undefined
  const minute = halfOnly ? context.minute ?? 0 : Number(match?.[2] ?? (match?.[3] === 'media' ? 30 : match?.[3] === 'cuarto' ? 15 : 0))
  if (hour === undefined || hour > 23 || minute > 59 || (half && (hour < 1 || hour > 12))) throw new AssistantTimeRequired(tx('¿A qué hora? Indica también si es por la mañana o por la tarde, o di cancelar.'), context)
  if (!half && hour >= 1 && hour <= 12 && !match?.[1].startsWith('0')) throw new AssistantTimeRequired(tx('¿Por la mañana o por la tarde? También puedes indicar la hora en formato de 24 horas.'), { ...context, hour, minute })
  if (half === 'tarde') hour = hour % 12 + 12
  if (half === 'noche') hour = hour === 12 ? 0 : hour <= 5 ? hour : hour + 12
  return { command: { type: 'create_task_reminder', args: { title: context.title, date: context.date, timeZone: context.timeZone, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` } }, explanation: tx('Preparar una tarea local con aviso. No se guardará hasta confirmarla.') }
}

/** Solo solicita aclaraciones: nunca guarda datos ni programa notificaciones. */
export function interpretTaskReminder(request: AssistantRequest): AssistantProposal | null {
  const language = request.locale.startsWith('en') ? 'en' : 'es'
  const tx = (key: Parameters<typeof txFor>[1]) => txFor(language, key)
  if (request.timeClarification && !/^recu[eé]rdame\b/i.test(request.text)) return proposalForTime(request.text, request.timeClarification, language)
  if (!/^recu[eé]rdame\b/i.test(request.text)) return null
  const parsed = request.text.trim().match(/^recu[eé]rdame\s+(?:el\s+)?(?:pr[oó]ximo\s+)?(pasado ma[ñn]ana|hoy|ma[ñn]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{4}-\d{2}-\d{2})\s+(?:(a las?\s+.*?)\s+)?que\s+(?:vaya\s+a\s+)?(.+)$/i)
  if (!parsed) throw new InvalidAssistantCommandError(tx('Indica el día y qué quieres recordar. Por ejemplo: «Recuérdame el próximo viernes que vaya a comprar pilas».'))
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: request.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(request.now))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const day = normalize(parsed[1])
  const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const weekday = weekdays.indexOf(day)
  const delta = weekday < 0 ? 0 : (weekday - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7 || 7
  const date = weekday >= 0 ? addDaysToDateKey(today, delta) : day === 'hoy' ? today : day === 'manana' ? addDaysToDateKey(today, 1) : day === 'pasado manana' ? addDaysToDateKey(today, 2) : day
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || !parsed[3].trim() || parsed[3].trim().length > 120) throw new InvalidAssistantCommandError(tx('Esa fecha no es válida. Comprueba el día, mes y año.'))
  const context = { title: parsed[3].trim(), date, timeZone: request.timeZone }
  if (!parsed[2]) throw new AssistantTimeRequired(tx('¿A qué hora? Indica también si es por la mañana o por la tarde, o di cancelar.'), context)
  return proposalForTime(parsed[2], context, language)
}

/** El calendario actual guarda avisos en fecha/hora civiles de la tablet. */
export function taskReminderTime(date: string, time: string, minutesBefore = 60) {
  const value = new Date(`${date}T${time}:00Z`)
  value.setUTCMinutes(value.getUTCMinutes() - minutesBefore)
  return { date: value.toISOString().slice(0, 10), time: value.toISOString().slice(11, 16) }
}
