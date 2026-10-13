import type { AssistantCommand } from './contracts'
import { DEFAULT_ALARM_SOUND } from '../alarmSounds'
import { calendarOccurrenceForDate, eventForOccurrence, toLocalDateKey } from '../calendarRecurrence'
import type { AlarmWeekday, DashboardPageId, DashboardState, Note } from '../dashboardState'
import { weatherDescription, type WeatherForecast, type WeatherLocation } from '../weather'

export interface AssistantExecutionEnvironment {
  now: Date
  homeWeatherLocation: WeatherLocation | null
  homeWeatherForecast: WeatherForecast | null
  createId: () => string
}

export interface AssistantExecutionResult {
  state: DashboardState
  response: string
  openPage?: DashboardPageId
}

const unchanged = (state: DashboardState, response: string, openPage?: DashboardPageId): AssistantExecutionResult => ({ state, response, openPage })

const formatDateTime = (value: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

function helpForTopic(topic: string) {
  const normalized = topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (normalized.includes('brillo')) return 'Abre Ajustes y, en Pantalla y sonido, desactiva Brillo automático si quieres mover el control manual.'
  if (normalized.includes('nota')) return 'Abre Notas y pulsa Nueva nota. También puedes pedirme «Guarda una nota: …» y confirmar la tarjeta.'
  if (normalized.includes('alarma') || normalized.includes('temporizador')) return 'Abre Reloj para ver, editar o detener alarmas y temporizadores.'
  if (normalized.includes('tiempo')) return 'Abre Tiempo, añade una ubicación y márcala como Casa para verla en el dashboard y el resumen.'
  if (normalized.includes('calendario') || normalized.includes('agenda')) return 'Abre Calendario para crear eventos y tareas, configurar repeticiones y añadir recordatorios.'
  return 'Puedo ayudarte con el resumen del día, tiempo, agenda, notas, alarmas, temporizadores y funciones básicas de la tablet.'
}

export function executeAssistantCommand(
  state: DashboardState,
  command: AssistantCommand,
  environment: AssistantExecutionEnvironment,
): AssistantExecutionResult {
  const { now, homeWeatherForecast, homeWeatherLocation, createId } = environment

  switch (command.type) {
    case 'get_daily_summary': {
      const events = state.calendarEvents.flatMap((event) => {
        const occurrence = calendarOccurrenceForDate(event, command.args.date)
        return occurrence ? [eventForOccurrence(event, occurrence)] : []
      }).filter((event) => !event.completed)
      const alarms = state.alarms.filter((alarm) => alarm.enabled).length
      const weather = homeWeatherForecast
        ? `${Math.round(homeWeatherForecast.current.temperature)}°, ${weatherDescription(homeWeatherForecast.current.weatherCode).toLowerCase()} en ${homeWeatherLocation?.name ?? 'Casa'}`
        : 'sin previsión disponible'
      const eventSummary = events.length ? `${events.length} ${events.length === 1 ? 'elemento' : 'elementos'} en la agenda` : 'ningún elemento en la agenda'
      return unchanged(state, `Hoy tienes ${eventSummary}, ${alarms} ${alarms === 1 ? 'alarma activa' : 'alarmas activas'} y ${weather}.`)
    }
    case 'get_weather': {
      if (!homeWeatherLocation || !homeWeatherForecast) return unchanged(state, 'No hay una previsión de Casa disponible. Añade o actualiza una ubicación en Tiempo.', 'weather')
      const forecast = command.args.period === 'tomorrow' ? homeWeatherForecast.daily[1] : homeWeatherForecast.daily[0]
      if (!forecast) return unchanged(state, 'La previsión solicitada todavía no está disponible.', 'weather')
      if (command.args.period === 'now') {
        return unchanged(state, `Ahora hay ${Math.round(homeWeatherForecast.current.temperature)}° y ${weatherDescription(homeWeatherForecast.current.weatherCode).toLowerCase()} en ${homeWeatherLocation.name}.`, 'weather')
      }
      const label = command.args.period === 'tomorrow' ? 'Mañana' : 'Hoy'
      return unchanged(state, `${label} en ${homeWeatherLocation.name}: ${weatherDescription(forecast.weatherCode).toLowerCase()}, máxima de ${Math.round(forecast.temperatureMax)}° y mínima de ${Math.round(forecast.temperatureMin)}°.`, 'weather')
    }
    case 'get_calendar': {
      const from = command.args.from.slice(0, 10)
      const to = command.args.to.slice(0, 10)
      const events = state.calendarEvents.filter((event) => event.endDate >= from && event.date <= to && !event.completed).slice(0, 5)
      if (!events.length) return unchanged(state, 'No hay eventos ni tareas pendientes en ese intervalo.', 'calendar')
      return unchanged(state, `Agenda: ${events.map((event) => `${event.title || 'Sin título'} (${event.date}${event.allDay ? '' : `, ${event.startTime}`})`).join('; ')}.`, 'calendar')
    }
    case 'get_notes': {
      const notes = [...state.notes].filter((note) => !note.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, command.args.limit)
      if (!notes.length) return unchanged(state, 'No hay notas activas guardadas.', 'notes')
      return unchanged(state, `Notas recientes: ${notes.map((note) => note.title || note.content.slice(0, 50) || 'Sin título').join('; ')}.`, 'notes')
    }
    case 'get_local_help':
      return unchanged(state, helpForTopic(command.args.topic))
    case 'create_note': {
      const timestamp = now.toISOString()
      const note: Note = {
        id: createId(),
        type: 'text',
        title: command.args.title,
        content: command.args.content,
        drawing: [],
        drawingPosition: 'below',
        drawingVisible: true,
        color: 'coral',
        pinned: false,
        reminderAt: command.args.reminderAt,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return { state: { ...state, notes: [note, ...state.notes] }, response: `Nota «${note.title}» creada.`, openPage: 'notes' }
    }
    case 'create_alarm': {
      const at = new Date(command.args.at)
      const alarm = {
        id: createId(),
        label: command.args.label,
        time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
        enabled: true,
        weekdays: command.args.repeatDays as AlarmWeekday[],
        soundName: DEFAULT_ALARM_SOUND.name,
        soundUri: null,
        createdAt: now.toISOString(),
      }
      return { state: { ...state, alarms: [...state.alarms, alarm] }, response: `Alarma diaria creada a las ${alarm.time}.`, openPage: 'clock' }
    }
    case 'start_timer': {
      const endsAt = new Date(now.getTime() + command.args.durationSeconds * 1_000).toISOString()
      const timer = {
        id: createId(),
        label: command.args.label,
        durationSeconds: command.args.durationSeconds,
        remainingSeconds: command.args.durationSeconds,
        endsAt,
        createdAt: now.toISOString(),
      }
      const minutes = Math.round(command.args.durationSeconds / 60)
      return { state: { ...state, timers: [...state.timers, timer] }, response: `Temporizador iniciado durante ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`, openPage: 'clock' }
    }
  }
}

export function assistantCommandSummary(command: AssistantCommand) {
  switch (command.type) {
    case 'create_note':
      return { title: 'Crear nota', details: [`Título: ${command.args.title}`, `Contenido: ${command.args.content}`, command.args.reminderAt ? `Aviso: ${formatDateTime(command.args.reminderAt)}` : 'Sin aviso'] }
    case 'create_alarm':
      return { title: 'Crear alarma diaria', details: [`Hora: ${formatDateTime(command.args.at).split(', ').at(-1) ?? command.args.at}`, `Etiqueta: ${command.args.label}`] }
    case 'start_timer':
      return { title: 'Iniciar temporizador', details: [`Duración: ${Math.round(command.args.durationSeconds / 60)} min`, `Etiqueta: ${command.args.label}`] }
    default:
      return { title: 'Consulta', details: [] }
  }
}

export function assistantTodayKey(now: Date) {
  return toLocalDateKey(now)
}
