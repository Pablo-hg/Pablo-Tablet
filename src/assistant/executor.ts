import type { AssistantCommand } from './contracts'
import { DEFAULT_ALARM_SOUND } from '../alarmSounds'
import { calendarOccurrenceForDate, eventForOccurrence, toLocalDateKey } from '../calendarRecurrence'
import type { AlarmWeekday, DashboardPageId, DashboardState, Note } from '../dashboardState'
import { weatherDescription, type WeatherForecast, type WeatherLocation } from '../weather'
import { activeLocale, tx } from '../i18n'

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

const formatDateTime = (value: string) => new Intl.DateTimeFormat(activeLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

function helpForTopic(topic: string) {
  const normalized = topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (normalized.includes('brillo') || normalized.includes('brightness')) return tx('Abre Ajustes y, en Pantalla y sonido, desactiva Brillo automático si quieres mover el control manual.')
  if (normalized.includes('nota') || normalized.includes('note')) return tx('Abre Notas y pulsa Nueva nota. También puedes pedirme «Guarda una nota: …» y confirmar la tarjeta.')
  if (normalized.includes('alarma') || normalized.includes('temporizador') || normalized.includes('alarm') || normalized.includes('timer')) return tx('Abre Reloj para ver, editar o detener alarmas y temporizadores.')
  if (normalized.includes('tiempo') || normalized.includes('weather')) return tx('Abre Tiempo, añade una ubicación y márcala como Casa para verla en el dashboard y el resumen.')
  if (normalized.includes('calendario') || normalized.includes('agenda') || normalized.includes('calendar') || normalized.includes('schedule')) return tx('Abre Calendario para crear eventos y tareas, configurar repeticiones y añadir recordatorios.')
  return tx('Puedo ayudarte con el resumen del día, tiempo, agenda, notas, alarmas, temporizadores y funciones básicas de la tablet.')
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
        : tx('sin previsión disponible')
      const eventSummary = events.length ? tx(events.length === 1 ? '{{count}} elemento en la agenda' : '{{count}} elementos en la agenda', { count: events.length }) : tx('ningún elemento en la agenda')
      const alarmSummary = tx(alarms === 1 ? '{{count}} alarma activa' : '{{count}} alarmas activas', { count: alarms })
      return unchanged(state, tx('Hoy tienes {{events}}, {{alarms}} y {{weather}}.', { events: eventSummary, alarms: alarmSummary, weather }))
    }
    case 'get_weather': {
      if (!homeWeatherLocation || !homeWeatherForecast) return unchanged(state, tx('No hay una previsión de Casa disponible. Añade o actualiza una ubicación en Tiempo.'), 'weather')
      const forecast = command.args.period === 'tomorrow' ? homeWeatherForecast.daily[1] : homeWeatherForecast.daily[0]
      if (!forecast) return unchanged(state, tx('La previsión solicitada todavía no está disponible.'), 'weather')
      if (command.args.period === 'now') {
        return unchanged(state, tx('Ahora hay {{temperature}}° y {{description}} en {{location}}.', { temperature: Math.round(homeWeatherForecast.current.temperature), description: weatherDescription(homeWeatherForecast.current.weatherCode).toLowerCase(), location: homeWeatherLocation.name }), 'weather')
      }
      const label = command.args.period === 'tomorrow' ? tx('Mañana') : tx('Hoy')
      return unchanged(state, tx('{{day}} en {{location}}: {{description}}, máxima de {{maximum}}° y mínima de {{minimum}}°.', { day: label, location: homeWeatherLocation.name, description: weatherDescription(forecast.weatherCode).toLowerCase(), maximum: Math.round(forecast.temperatureMax), minimum: Math.round(forecast.temperatureMin) }), 'weather')
    }
    case 'get_calendar': {
      const from = command.args.from.slice(0, 10)
      const to = command.args.to.slice(0, 10)
      const events = state.calendarEvents.filter((event) => event.endDate >= from && event.date <= to && !event.completed).slice(0, 5)
      if (!events.length) return unchanged(state, tx('No hay eventos ni tareas pendientes en ese intervalo.'), 'calendar')
      return unchanged(state, tx('Agenda: {{events}}.', { events: events.map((event) => `${event.title || tx('Sin título')} (${event.date}${event.allDay ? '' : `, ${event.startTime}`})`).join('; ') }), 'calendar')
    }
    case 'get_notes': {
      const notes = [...state.notes].filter((note) => !note.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, command.args.limit)
      if (!notes.length) return unchanged(state, tx('No hay notas activas guardadas.'), 'notes')
      return unchanged(state, tx('Notas recientes: {{notes}}.', { notes: notes.map((note) => note.title || note.content.slice(0, 50) || tx('Sin título')).join('; ') }), 'notes')
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
      return { state: { ...state, notes: [note, ...state.notes] }, response: tx('Nota «{{title}}» creada.', { title: note.title }), openPage: 'notes' }
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
      return { state: { ...state, alarms: [...state.alarms, alarm] }, response: tx('Alarma diaria creada a las {{time}}.', { time: alarm.time }), openPage: 'clock' }
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
      return { state: { ...state, timers: [...state.timers, timer] }, response: tx(minutes === 1 ? 'Temporizador iniciado durante {{count}} minuto.' : 'Temporizador iniciado durante {{count}} minutos.', { count: minutes }), openPage: 'clock' }
    }
  }
}

export function assistantCommandSummary(command: AssistantCommand) {
  switch (command.type) {
    case 'create_note':
      return { title: tx('Crear nota'), details: [tx('Título: {{value}}', { value: command.args.title }), tx('Contenido: {{value}}', { value: command.args.content }), command.args.reminderAt ? tx('Aviso: {{value}}', { value: formatDateTime(command.args.reminderAt) }) : tx('Sin aviso')] }
    case 'create_alarm':
      return { title: tx('Crear alarma diaria'), details: [tx('Hora: {{value}}', { value: formatDateTime(command.args.at).split(', ').at(-1) ?? command.args.at }), tx('Etiqueta: {{value}}', { value: command.args.label })] }
    case 'start_timer':
      return { title: tx('Iniciar temporizador'), details: [tx('Duración: {{value}} min', { value: Math.round(command.args.durationSeconds / 60) }), tx('Etiqueta: {{value}}', { value: command.args.label })] }
    default:
      return { title: tx('Consulta'), details: [] }
  }
}

export function assistantTodayKey(now: Date) {
  return toLocalDateKey(now)
}
