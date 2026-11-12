import { taskReminderTime } from './taskReminder'
import { assistantDateText } from './dateText'
import type { AssistantCommand } from './contracts'
import { DEFAULT_ALARM_SOUND } from '../alarmSounds'
import { addDaysToDateKey, calendarOccurrenceForDate, eventForOccurrence, toLocalDateKey } from '../calendarRecurrence'
import type { AlarmWeekday, DashboardPageId, DashboardState, Note } from '../dashboardState'
import { weatherDescription, type WeatherForecast, type WeatherLocation } from '../weather'
import type { TOptions } from 'i18next'
import { activeLocale, tx as appTx, txFor, type SupportedLanguage } from '../i18n'
import type { TranslationKey } from '../i18n/translations'

export interface AssistantExecutionEnvironment {
  now: Date
  homeWeatherLocation: WeatherLocation | null
  homeWeatherForecast: WeatherForecast | null
  createId: () => string
  language?: SupportedLanguage
}

export interface AssistantExecutionResult {
  state: DashboardState
  response: string
  spokenResponse?: string
  openPage?: DashboardPageId
}

const unchanged = (state: DashboardState, response: string, openPage?: DashboardPageId): AssistantExecutionResult => ({ state, response, openPage })

const formatDateTime = (value: string, language?: SupportedLanguage) => new Intl.DateTimeFormat(activeLocale(language), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const translateFor = (language?: SupportedLanguage) => (key: TranslationKey, options?: TOptions) => language ? txFor(language, key, options) : appTx(key, options)

function formatTimerDuration(totalSeconds: number, language?: SupportedLanguage) {
  const tx = translateFor(language)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours) parts.push(tx(hours === 1 ? '{{count}} hora' : '{{count}} horas', { count: hours }))
  if (minutes) parts.push(tx(minutes === 1 ? '{{count}} minuto' : '{{count}} minutos', { count: minutes }))
  if (seconds) parts.push(tx(seconds === 1 ? '{{count}} segundo' : '{{count}} segundos', { count: seconds }))
  return new Intl.ListFormat(activeLocale(language), { style: 'long', type: 'conjunction' }).format(parts)
}

function helpForTopic(topic: string, language?: SupportedLanguage) {
  const tx = translateFor(language)
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
  const language = environment.language
  const tx = translateFor(language)

  switch (command.type) {
    case 'get_daily_summary': {
      const events = state.calendarEvents.flatMap((event) => {
        const occurrence = calendarOccurrenceForDate(event, command.args.date)
        return occurrence ? [eventForOccurrence(event, occurrence)] : []
      }).filter((event) => !event.completed)
      const alarms = state.alarms.filter((alarm) => alarm.enabled).length
      const weather = homeWeatherForecast
        ? tx('{{temperature}}°, {{description}} en {{location}}', { temperature: Math.round(homeWeatherForecast.current.temperature), description: weatherDescription(homeWeatherForecast.current.weatherCode, language).toLowerCase(), location: homeWeatherLocation?.name ?? 'Casa' })
        : tx('sin previsión disponible')
      const eventSummary = events.length ? tx(events.length === 1 ? '{{count}} elemento en la agenda' : '{{count}} elementos en la agenda', { count: events.length }) : tx('ningún elemento en la agenda')
      const alarmSummary = tx(alarms === 1 ? '{{count}} alarma activa' : '{{count}} alarmas activas', { count: alarms })
      return unchanged(state, tx('Hoy tienes {{events}}, {{alarms}} y {{weather}}.', { events: eventSummary, alarms: alarmSummary, weather }))
    }
    case 'get_weather': {
      if (!homeWeatherLocation || !homeWeatherForecast) return unchanged(state, tx('No hay una previsión de Casa disponible. Añade o actualiza una ubicación en Tiempo.'), 'weather')
      if (command.args.period === 'next_week') {
        const zone = homeWeatherLocation.timezone === 'auto' ? Intl.DateTimeFormat().resolvedOptions().timeZone : homeWeatherLocation.timezone
        let today: string
        try {
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
          const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
          today = `${part('year')}-${part('month')}-${part('day')}`
        } catch { today = toLocalDateKey(now) }
        const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
        const start = addDaysToDateKey(today, 7 - ((weekday + 6) % 7))
        const end = addDaysToDateKey(start, 6)
        const days = homeWeatherForecast.daily.filter((day) => day.date >= start && day.date <= end).sort((a, b) => a.date.localeCompare(b.date))
        if (!days.length) return unchanged(state, tx('No tengo datos de la previsión para la semana que viene. Actualiza el tiempo y vuelve a intentarlo.'), 'weather')
        const details = days.map((day) => {
          const date = new Intl.DateTimeFormat(activeLocale(language), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))
          return tx('El {{date}}: {{description}}, máxima de {{maximum}}° y mínima de {{minimum}}°.', { date, description: weatherDescription(day.weatherCode, language).toLowerCase(), maximum: Math.round(day.temperatureMax), minimum: Math.round(day.temperatureMin) })
        }).join('\n')
        const partial = days.length < 7 ? ` ${tx('Solo tengo previsión para {{count}} de los 7 días; los demás no están disponibles.', { count: days.length })}` : ''
        return unchanged(state, tx('Previsión de la semana que viene en {{location}}:', { location: homeWeatherLocation.name }) + `\n${details}` + partial, 'weather')
      }
      const forecast = command.args.period === 'tomorrow' ? homeWeatherForecast.daily[1] : homeWeatherForecast.daily[0]
      if (!forecast) return unchanged(state, tx('La previsión solicitada todavía no está disponible.'), 'weather')
      if (command.args.period === 'now') {
        return unchanged(state, tx('Ahora hay {{temperature}}° y {{description}} en {{location}}.', { temperature: Math.round(homeWeatherForecast.current.temperature), description: weatherDescription(homeWeatherForecast.current.weatherCode, language).toLowerCase(), location: homeWeatherLocation.name }), 'weather')
      }
      const label = command.args.period === 'tomorrow' ? tx('Mañana') : tx('Hoy')
      return unchanged(state, tx('{{day}} en {{location}}: {{description}}, máxima de {{maximum}}° y mínima de {{minimum}}°.', { day: label, location: homeWeatherLocation.name, description: weatherDescription(forecast.weatherCode, language).toLowerCase(), maximum: Math.round(forecast.temperatureMax), minimum: Math.round(forecast.temperatureMin) }), 'weather')
    }
    case 'get_calendar': {
      const from = command.args.from.slice(0, 10)
      const to = command.args.to.slice(0, 10)
      const occurrences = new Map<string, typeof state.calendarEvents[number]>()
      for (let date = from; date <= to; date = addDaysToDateKey(date, 1)) {
        for (const event of state.calendarEvents) {
          if (event.completed || event.syncStatus === 'pending-delete') continue
          const occurrence = calendarOccurrenceForDate(event, date)
          if (occurrence) occurrences.set(`${event.id}:${occurrence.startDate}`, eventForOccurrence(event, occurrence))
        }
      }
      const events = [...occurrences.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.allDay ? '' : a.startTime).localeCompare(b.allDay ? '' : b.startTime) || a.title.localeCompare(b.title))
      const syncWarning = state.calendarAccounts.some((account) => account.enabled && account.status !== 'connected')
        ? ` ${tx('Alguna cuenta no está sincronizada; los datos podrían no estar actualizados.')}` : ''
      if (!events.length) {
        const formatDate = (date: string) => new Intl.DateTimeFormat(activeLocale(language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
        const message = from === to
          ? tx('No hay eventos ni tareas pendientes el {{date}}.', { date: formatDate(from) })
          : tx('No hay eventos ni tareas pendientes entre el {{from}} y el {{to}}.', { from: formatDate(from), to: formatDate(to) })
        return unchanged(state, message + syncWarning, 'calendar')
      }
      const details = events.map((event) => {
        const calendar = state.externalCalendars.find((item) => item.provider === event.source && item.accountId === event.accountId && item.remoteId === event.calendarId)
        const formatDay = (date: string) => new Intl.DateTimeFormat(activeLocale(language), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC', ...(date.slice(0, 4) !== toLocalDateKey(now).slice(0, 4) ? { year: 'numeric' } : {}) }).format(new Date(`${date}T12:00:00Z`))
        const date = formatDay(event.date)
        const endDate = formatDay(event.endDate)
        const title = event.title || tx('Sin título')
        const multiDay = event.date !== event.endDate
        const sentence = event.allDay
          ? multiDay
            ? tx('Del {{date}} al {{endDate}} tienes {{title}} durante todo el día.', { date, endDate, title })
            : tx('El {{date}} tienes {{title}} durante todo el día.', { date, title })
          : multiDay
            ? tx('El {{date}} a las {{start}} empieza {{title}} y termina el {{endDate}} a las {{end}}.', { date, start: event.startTime, title, endDate, end: event.endTime })
            : tx('El {{date}} tienes {{title}} de {{start}} a {{end}}.', { date, title, start: event.startTime, end: event.endTime })
        const source = event.source !== 'local' && event.source !== 'native' ? ` ${tx('Calendario: {{calendar}}.', { calendar: calendar?.name ?? event.source })}` : ''
        const status = event.syncStatus !== 'local' && event.syncStatus !== 'synced' ? ` ${tx('Sincronización pendiente o con error.')}` : ''
        return sentence + source + status
      }).join('\n')
      const response = details + syncWarning
      if (response.length > 2_000) return { state, response, spokenResponse: tx('Hay {{count}} elementos en ese periodo. La lista completa está en la conversación.', { count: events.length }) + syncWarning, openPage: 'calendar' }
      return unchanged(state, response, 'calendar')
    }
    case 'get_notes': {
      const notes = [...state.notes].filter((note) => !note.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, command.args.limit)
      if (!notes.length) return unchanged(state, tx('No hay notas activas guardadas.'), 'notes')
      return unchanged(state, tx('Notas recientes: {{notes}}.', { notes: notes.map((note) => note.title || note.content.slice(0, 50) || tx('Sin título')).join('; ') }), 'notes')
    }
    case 'get_clock_status': {
      const sections: string[] = []
      if (command.args.include !== 'timers') {
        const days: TranslationKey[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        const alarms = [...state.alarms].sort((a, b) => a.time.localeCompare(b.time))
        if (!alarms.length) sections.push(tx('No tienes alarmas configuradas.'))
        else for (const alarm of alarms) {
          const repetition = alarm.weekdays.length === 7 ? tx('todos los días') : new Intl.ListFormat(activeLocale(language), { style: 'long', type: 'conjunction' }).format(alarm.weekdays.map((day) => tx(days[day - 1]).toLocaleLowerCase(activeLocale(language))))
          sections.push(tx(alarm.enabled ? 'Alarma «{{name}}» a las {{time}}, {{days}}; está activada.' : 'Alarma «{{name}}» a las {{time}}, {{days}}; está desactivada.', { name: alarm.label, time: alarm.time, days: repetition }))
        }
      }
      if (command.args.include !== 'alarms') {
        if (!state.timers.length) sections.push(tx('No tienes temporizadores configurados.'))
        else for (const timer of state.timers) {
          const remaining = timer.endsAt ? Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - now.getTime()) / 1_000)) : timer.remainingSeconds
          if (!Number.isFinite(remaining)) sections.push(tx('No puedo determinar el estado del temporizador «{{name}}».', { name: timer.label }))
          else if (remaining <= 0) sections.push(tx('El temporizador «{{name}}» ha terminado.', { name: timer.label }))
          else sections.push(tx(timer.endsAt ? 'Al temporizador «{{name}}» le quedan {{duration}}.' : 'El temporizador «{{name}}» está pausado con {{duration}} restantes.', { name: timer.label, duration: formatTimerDuration(remaining, language) }))
        }
      }
      const response = sections.join('\n')
      if (response.length > 2_000) return { state, response, spokenResponse: tx('La lista completa está en la conversación.'), openPage: 'clock' }
      return unchanged(state, response, 'clock')
    }
    case 'get_local_help':
      return unchanged(state, helpForTopic(command.args.topic, language))
    case 'create_task_reminder':
    case 'create_task': {
      const timestamp = now.toISOString()
      const timed = command.type === 'create_task_reminder'
      const time = timed ? command.args.time : '00:00'
      const reminder = timed ? taskReminderTime(command.args.date, time) : null
      if (reminder && new Date(`${reminder.date}T${reminder.time}:00`).getTime() <= now.getTime()) throw new Error(tx('El aviso de 30 minutos antes ya ha pasado. Elige una hora posterior.'))
      const task: DashboardState['calendarEvents'][number] = {
        id: createId(), source: 'local', accountId: null, calendarId: null,
        externalId: null, externalVersion: null, syncStatus: 'local',
        type: 'task', recurrence: 'none', completed: false,
        title: command.args.title, date: command.args.date, endDate: command.args.date,
        startTime: time, endTime: timed ? time : '23:59', allDay: !timed, timeZone: command.args.timeZone,
        location: '', notes: '', color: 'mint', reminders: reminder ? [{ id: createId(), ...reminder }] : [], createdAt: timestamp, updatedAt: timestamp,
      }
      return { state: { ...state, calendarEvents: [...state.calendarEvents, task] }, response: reminder ? tx('Tarea «{{title}}» creada para {{date}} a las {{time}}. Aviso configurado 30 minutos antes, a las {{reminder}}.', { title: task.title, date: assistantDateText(task.date, now, task.timeZone, language), time, reminder: reminder.time }) : tx('Tarea «{{title}}» creada en el calendario local para {{date}}.', { title: task.title, date: assistantDateText(task.date, now, task.timeZone, language) }), openPage: 'calendar' }
    }
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
        soundName: DEFAULT_ALARM_SOUND.name,
        soundUri: null,
        createdAt: now.toISOString(),
      }
      return { state: { ...state, timers: [...state.timers, timer] }, response: tx('Temporizador iniciado durante {{duration}}.', { duration: formatTimerDuration(command.args.durationSeconds, language) }), openPage: 'clock' }
    }
  }
}

export function assistantCommandSummary(command: AssistantCommand, language?: SupportedLanguage, now = new Date()) {
  const tx = translateFor(language)
  switch (command.type) {
    case 'create_task_reminder': {
      const reminder = taskReminderTime(command.args.date, command.args.time)
      return { title: tx('Crear tarea local'), details: [tx('Título: {{value}}', { value: command.args.title }), tx('Fecha: {{value}}', { value: assistantDateText(command.args.date, now, command.args.timeZone, language) }), tx('Hora: {{value}}', { value: command.args.time }), tx('Aviso 30 minutos antes: {{date}} a las {{time}}', { date: assistantDateText(reminder.date, now, command.args.timeZone, language), time: reminder.time }), tx('Destino: calendario local de esta tablet')] }
    }
    case 'create_task':
      return { title: tx('Crear tarea local'), details: [tx('Título: {{value}}', { value: command.args.title }), tx('Fecha: {{value}}', { value: assistantDateText(command.args.date, now, command.args.timeZone, language) }), tx('Todo el día · sin aviso'), tx('Destino: calendario local de esta tablet')] }
    case 'create_note':
      return { title: tx('Crear nota'), details: [tx('Título: {{value}}', { value: command.args.title }), tx('Contenido: {{value}}', { value: command.args.content }), command.args.reminderAt ? tx('Aviso: {{value}}', { value: formatDateTime(command.args.reminderAt, language) }) : tx('Sin aviso')] }
    case 'create_alarm':
      return { title: tx('Crear alarma diaria'), details: [tx('Hora: {{value}}', { value: formatDateTime(command.args.at, language).split(', ').at(-1) ?? command.args.at }), tx('Etiqueta: {{value}}', { value: command.args.label })] }
    case 'start_timer':
      return { title: tx('Iniciar temporizador'), details: [tx('Duración: {{value}}', { value: formatTimerDuration(command.args.durationSeconds, language) }), tx('Etiqueta: {{value}}', { value: command.args.label })] }
    default:
      return { title: tx('Consulta'), details: [] }
  }
}

export function assistantTodayKey(now: Date) {
  return toLocalDateKey(now)
}
