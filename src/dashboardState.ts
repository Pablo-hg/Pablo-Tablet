import { DEFAULT_WIDGETS, readWidgets, type DashboardWidget } from './widgetLayout'

export type DashboardPageId = 'dashboard' | 'calendar' | 'clock' | 'weather' | 'notes' | 'gallery'

export type DashboardPageKind = 'grid' | 'fullscreen'

export interface DashboardPageDefinition {
  id: DashboardPageId
  kind: DashboardPageKind
  label: string
  rotationEligible: boolean
}

export interface DashboardPreferences {
  rotationEnabled: boolean
  rotationSeconds: number
  navigationSeconds: number
  enabledPageIds: DashboardPageId[]
  brightness: number
  alarmVolume: number
  mediaVolume: number
  interactionSoundsEnabled: boolean
  keepScreenAwake: boolean
  screenTimeoutSeconds: number
  hideCompletedCalendarTasks: boolean
  screensaverEnabled: boolean
  screensaverDelaySeconds: number
}

export type NoteColor = 'coral' | 'violet' | 'mint' | 'sun'
export type AlarmWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const EVERY_ALARM_WEEKDAY: AlarmWeekday[] = [1, 2, 3, 4, 5, 6, 7]

export interface Note {
  id: string
  title: string
  content: string
  color: NoteColor
  pinned: boolean
  reminderAt: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Alarm {
  id: string
  label: string
  time: string
  enabled: boolean
  weekdays: AlarmWeekday[]
  soundName: string
  soundUri: string | null
  createdAt: string
}

export interface Timer {
  id: string
  label: string
  durationSeconds: number
  remainingSeconds: number
  endsAt: string | null
  createdAt: string
}

export interface StopwatchState {
  elapsedMilliseconds: number
  startedAt: string | null
}

export type CalendarEventColor = 'blue' | 'mint' | 'coral' | 'sun'
export type CalendarEventType = 'event' | 'task' | 'birthday'
export type CalendarEventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface CalendarEventReminder {
  id: string
  date: string
  time: string
}

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  recurrence: CalendarEventRecurrence
  completed: boolean
  title: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  allDay: boolean
  location: string
  notes: string
  color: CalendarEventColor
  reminders: CalendarEventReminder[]
  createdAt: string
}

export interface GalleryPhoto {
  id: string
  name: string
  uri: string
  createdAt: string
  deletedAt: string | null
}

export interface DashboardState {
  notes: Note[]
  alarms: Alarm[]
  timers: Timer[]
  stopwatch: StopwatchState
  calendarEvents: CalendarEvent[]
  galleryPhotos: GalleryPhoto[]
  widgets: DashboardWidget[]
  preferences: DashboardPreferences
}

export const DASHBOARD_PAGES: DashboardPageDefinition[] = [
  { id: 'dashboard', kind: 'grid', label: 'Inicio', rotationEligible: true },
  { id: 'calendar', kind: 'fullscreen', label: 'Calendario', rotationEligible: true },
  { id: 'clock', kind: 'fullscreen', label: 'Reloj', rotationEligible: true },
  { id: 'weather', kind: 'fullscreen', label: 'Tiempo', rotationEligible: true },
  { id: 'notes', kind: 'fullscreen', label: 'Notas', rotationEligible: true },
  { id: 'gallery', kind: 'fullscreen', label: 'Galería', rotationEligible: true },
]

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  notes: [],
  alarms: [],
  timers: [],
  stopwatch: { elapsedMilliseconds: 0, startedAt: null },
  calendarEvents: [],
  galleryPhotos: [],
  widgets: DEFAULT_WIDGETS,
  preferences: {
    rotationEnabled: true,
    rotationSeconds: 30,
    navigationSeconds: 5,
    enabledPageIds: DASHBOARD_PAGES.map((page) => page.id),
    brightness: 75,
    alarmVolume: 80,
    mediaVolume: 60,
    interactionSoundsEnabled: true,
    keepScreenAwake: true,
    screenTimeoutSeconds: 60,
    hideCompletedCalendarTasks: false,
    screensaverEnabled: true,
    screensaverDelaySeconds: 180,
  },
}

const STORAGE_KEY = 'pablo-tablet.dashboard.v14'
const PREVIOUS_STORAGE_KEYS = [
  'pablo-tablet.dashboard.v13',
  'pablo-tablet.dashboard.v12',
  'pablo-tablet.dashboard.v11',
  'pablo-tablet.dashboard.v10',
  'pablo-tablet.dashboard.v9',
  'pablo-tablet.dashboard.v8',
  'pablo-tablet.dashboard.v7',
  'pablo-tablet.dashboard.v6',
  'pablo-tablet.dashboard.v5',
  'pablo-tablet.dashboard.v4',
  'pablo-tablet.dashboard.v3',
  'pablo-tablet.dashboard.v2',
  'pablo-tablet.dashboard.v1',
] as const
const ROTATION_OPTIONS = new Set([15, 30, 60])
const NAVIGATION_OPTIONS = new Set([3, 5, 8])

function isPageId(value: unknown): value is DashboardPageId {
  return DASHBOARD_PAGES.some((page) => page.id === value)
}

function readNoteColor(value: unknown): NoteColor {
  if (value === 'violet' || value === 'mint' || value === 'sun' || value === 'coral') return value
  if (value === 'blue') return 'violet'
  if (value === 'green') return 'mint'
  if (value === 'amber') return 'sun'
  return 'coral'
}

function readNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item): Note[] => {
    if (!item || typeof item !== 'object') return []
    const note = item as Partial<Note>
    if (typeof note.id !== 'string') return []
    const now = new Date().toISOString()
    return [{
      id: note.id,
      title: typeof note.title === 'string' ? note.title.slice(0, 80) : '',
      content: typeof note.content === 'string' ? note.content.slice(0, 2000) : '',
      color: readNoteColor(note.color),
      pinned: Boolean(note.pinned),
      reminderAt: typeof note.reminderAt === 'string' ? note.reminderAt : null,
      archived: Boolean(note.archived),
      createdAt: typeof note.createdAt === 'string' ? note.createdAt : now,
      updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : now,
    }]
  })
}

function readAlarms(value: unknown): Alarm[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): Alarm[] => {
    if (!item || typeof item !== 'object') return []
    const alarm = item as Partial<Alarm>
    if (typeof alarm.id !== 'string') return []
    if (typeof alarm.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(alarm.time)) return []
    const weekdays = Array.isArray(alarm.weekdays)
      ? [...new Set(alarm.weekdays.filter((day): day is AlarmWeekday => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7))].sort((a, b) => a - b)
      : EVERY_ALARM_WEEKDAY
    return [{
      id: alarm.id,
      label: typeof alarm.label === 'string' ? alarm.label.slice(0, 60) : 'Alarma',
      time: alarm.time,
      enabled: alarm.enabled !== false,
      weekdays: weekdays.length > 0 ? weekdays : EVERY_ALARM_WEEKDAY,
      soundName: typeof alarm.soundName === 'string' ? alarm.soundName.slice(0, 80) : 'Sonido predeterminado',
      soundUri: typeof alarm.soundUri === 'string' ? alarm.soundUri : null,
      createdAt: typeof alarm.createdAt === 'string' ? alarm.createdAt : new Date().toISOString(),
    }]
  })
}

function readTimers(value: unknown): Timer[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): Timer[] => {
    if (!item || typeof item !== 'object') return []
    const timer = item as Partial<Timer>
    if (typeof timer.id !== 'string') return []
    const durationSeconds = timer.durationSeconds
    const remainingSeconds = timer.remainingSeconds
    if (typeof durationSeconds !== 'number' || typeof remainingSeconds !== 'number' || !Number.isInteger(durationSeconds) || !Number.isInteger(remainingSeconds) || durationSeconds < 1 || remainingSeconds < 0) return []
    return [{
      id: timer.id,
      label: typeof timer.label === 'string' ? timer.label.slice(0, 60) : 'Temporizador',
      durationSeconds,
      remainingSeconds: Math.min(remainingSeconds, durationSeconds),
      endsAt: typeof timer.endsAt === 'string' ? timer.endsAt : null,
      createdAt: typeof timer.createdAt === 'string' ? timer.createdAt : new Date().toISOString(),
    }]
  })
}

function readStopwatch(value: unknown): StopwatchState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_DASHBOARD_STATE.stopwatch }
  const stopwatch = value as Partial<StopwatchState>
  return {
    elapsedMilliseconds: typeof stopwatch.elapsedMilliseconds === 'number' && Number.isFinite(stopwatch.elapsedMilliseconds) && stopwatch.elapsedMilliseconds >= 0 ? stopwatch.elapsedMilliseconds : 0,
    startedAt: typeof stopwatch.startedAt === 'string' && !Number.isNaN(new Date(stopwatch.startedAt).getTime()) ? stopwatch.startedAt : null,
  }
}

function readCalendarEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): CalendarEvent[] => {
    if (!item || typeof item !== 'object') return []
    const event = item as Partial<CalendarEvent>
    if (typeof event.id !== 'string' || typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return []
    if (typeof event.startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime)) return []
    if (typeof event.endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime)) return []
    const color: CalendarEventColor = event.color === 'mint' || event.color === 'coral' || event.color === 'sun' ? event.color : 'blue'
    const type: CalendarEventType = event.type === 'task' || event.type === 'birthday' ? event.type : 'event'
    const recurrence: CalendarEventRecurrence = event.recurrence === 'daily' || event.recurrence === 'weekly' || event.recurrence === 'monthly' || event.recurrence === 'yearly' ? event.recurrence : 'none'
    const storedEndDate = typeof event.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.endDate) ? event.endDate : event.date
    const endDate = storedEndDate < event.date ? event.date : storedEndDate
    const reminders = Array.isArray(event.reminders) ? event.reminders.flatMap((value): CalendarEventReminder[] => {
      if (!value || typeof value !== 'object') return []
      const reminder = value as Partial<CalendarEventReminder>
      if (typeof reminder.id !== 'string' || typeof reminder.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) return []
      if (typeof reminder.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) return []
      return [{ id: reminder.id, date: reminder.date, time: reminder.time }]
    }) : []
    return [{
      id: event.id,
      type,
      recurrence,
      completed: type === 'task' && Boolean(event.completed),
      title: typeof event.title === 'string' ? event.title.slice(0, 80) : 'Evento',
      date: event.date,
      endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: Boolean(event.allDay),
      location: typeof event.location === 'string' ? event.location.slice(0, 100) : '',
      notes: typeof event.notes === 'string' ? event.notes.slice(0, 500) : '',
      color,
      reminders,
      createdAt: typeof event.createdAt === 'string' ? event.createdAt : new Date().toISOString(),
    }]
  })
}

function readGalleryPhotos(value: unknown): GalleryPhoto[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): GalleryPhoto[] => {
    if (!item || typeof item !== 'object') return []
    const photo = item as Partial<GalleryPhoto>
    if (typeof photo.id !== 'string' || typeof photo.uri !== 'string' || !photo.uri) return []
    return [{
      id: photo.id,
      name: typeof photo.name === 'string' && photo.name.trim() ? photo.name.slice(0, 160) : 'Foto',
      uri: photo.uri,
      createdAt: typeof photo.createdAt === 'string' ? photo.createdAt : new Date().toISOString(),
      deletedAt: typeof photo.deletedAt === 'string' ? photo.deletedAt : null,
    }]
  })
}

export function loadDashboardState(): DashboardState {
  try {
    const storedState = [STORAGE_KEY, ...PREVIOUS_STORAGE_KEYS]
      .map((key) => ({ key, value: window.localStorage.getItem(key) }))
      .find((entry) => entry.value !== null)
    const rawState = storedState?.value
    if (!rawState) return DEFAULT_DASHBOARD_STATE

    const parsed = JSON.parse(rawState) as Partial<DashboardState> & { note?: unknown }
    const parsedPreferences: Partial<DashboardPreferences> = parsed.preferences ?? {}
    const notes = readNotes(parsed.notes)
    const alarms = readAlarms(parsed.alarms)
    const timers = readTimers(parsed.timers)
    const stopwatch = readStopwatch(parsed.stopwatch)
    const calendarEvents = readCalendarEvents(parsed.calendarEvents)
    const galleryPhotos = readGalleryPhotos(parsed.galleryPhotos)
    const savedWidgets = readWidgets(parsed.widgets)
    const widgets = storedState?.key === STORAGE_KEY
      ? savedWidgets
      : DEFAULT_WIDGETS.map((fallback) => ({ ...fallback, visible: savedWidgets.find((widget) => widget.id === fallback.id)?.visible ?? true, layouts: { landscape: { ...fallback.layouts.landscape }, portrait: { ...fallback.layouts.portrait } } }))
    const parsedPageIds = Array.isArray(parsedPreferences.enabledPageIds)
      ? parsedPreferences.enabledPageIds.filter(isPageId)
      : DEFAULT_DASHBOARD_STATE.preferences.enabledPageIds
    const shouldAddWeather = storedState?.key === 'pablo-tablet.dashboard.v1'
      || storedState?.key === 'pablo-tablet.dashboard.v2'
    const pageIdsWithWeather = shouldAddWeather && !parsedPageIds.includes('weather')
      ? [...parsedPageIds, 'weather' as const]
      : parsedPageIds
    const pageIdsWithCalendar = storedState?.key !== STORAGE_KEY && !pageIdsWithWeather.includes('calendar')
      ? [...pageIdsWithWeather, 'calendar' as const]
      : pageIdsWithWeather
    const enabledPageIds = storedState?.key !== STORAGE_KEY && !pageIdsWithCalendar.includes('gallery')
      ? [...pageIdsWithCalendar, 'gallery' as const]
      : pageIdsWithCalendar

    return {
      notes: notes.length > 0
        ? notes
        : typeof parsed.note === 'string' && parsed.note.trim()
          ? [{
              id: 'legacy-note',
              title: 'Nota rápida',
              content: parsed.note.slice(0, 2000),
              color: 'coral',
              pinned: false,
              reminderAt: null,
              archived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }]
          : [],
      alarms,
      timers,
      stopwatch,
      calendarEvents,
      galleryPhotos,
      widgets,
      preferences: {
        rotationEnabled: typeof parsedPreferences.rotationEnabled === 'boolean'
          ? parsedPreferences.rotationEnabled
          : DEFAULT_DASHBOARD_STATE.preferences.rotationEnabled,
        rotationSeconds: ROTATION_OPTIONS.has(parsedPreferences.rotationSeconds ?? 0)
          ? parsedPreferences.rotationSeconds as number
          : DEFAULT_DASHBOARD_STATE.preferences.rotationSeconds,
        navigationSeconds: NAVIGATION_OPTIONS.has(parsedPreferences.navigationSeconds ?? 0)
          ? parsedPreferences.navigationSeconds as number
          : DEFAULT_DASHBOARD_STATE.preferences.navigationSeconds,
        brightness: typeof parsedPreferences.brightness === 'number' && Number.isFinite(parsedPreferences.brightness)
          ? Math.min(100, Math.max(10, Math.round(parsedPreferences.brightness)))
          : DEFAULT_DASHBOARD_STATE.preferences.brightness,
        alarmVolume: typeof parsedPreferences.alarmVolume === 'number' && Number.isFinite(parsedPreferences.alarmVolume)
          ? Math.min(100, Math.max(0, Math.round(parsedPreferences.alarmVolume)))
          : DEFAULT_DASHBOARD_STATE.preferences.alarmVolume,
        mediaVolume: typeof parsedPreferences.mediaVolume === 'number' && Number.isFinite(parsedPreferences.mediaVolume)
          ? Math.min(100, Math.max(0, Math.round(parsedPreferences.mediaVolume)))
          : DEFAULT_DASHBOARD_STATE.preferences.mediaVolume,
        interactionSoundsEnabled: typeof parsedPreferences.interactionSoundsEnabled === 'boolean'
          ? parsedPreferences.interactionSoundsEnabled
          : DEFAULT_DASHBOARD_STATE.preferences.interactionSoundsEnabled,
        keepScreenAwake: typeof parsedPreferences.keepScreenAwake === 'boolean'
          ? parsedPreferences.keepScreenAwake
          : DEFAULT_DASHBOARD_STATE.preferences.keepScreenAwake,
        screenTimeoutSeconds: [30, 60, 120, 300, 600].includes(parsedPreferences.screenTimeoutSeconds ?? 0)
          ? parsedPreferences.screenTimeoutSeconds as number
          : DEFAULT_DASHBOARD_STATE.preferences.screenTimeoutSeconds,
        hideCompletedCalendarTasks: typeof parsedPreferences.hideCompletedCalendarTasks === 'boolean'
          ? parsedPreferences.hideCompletedCalendarTasks
          : DEFAULT_DASHBOARD_STATE.preferences.hideCompletedCalendarTasks,
        screensaverEnabled: typeof parsedPreferences.screensaverEnabled === 'boolean'
          ? parsedPreferences.screensaverEnabled
          : DEFAULT_DASHBOARD_STATE.preferences.screensaverEnabled,
        screensaverDelaySeconds: [30, 60, 180, 300, 600].includes(parsedPreferences.screensaverDelaySeconds ?? 0)
          ? parsedPreferences.screensaverDelaySeconds as number
          : DEFAULT_DASHBOARD_STATE.preferences.screensaverDelaySeconds,
        enabledPageIds: enabledPageIds.includes('dashboard')
          ? enabledPageIds
          : ['dashboard', ...enabledPageIds],
      },
    }
  } catch {
    return DEFAULT_DASHBOARD_STATE
  }
}

export function saveDashboardState(state: DashboardState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
