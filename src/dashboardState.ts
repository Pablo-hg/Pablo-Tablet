import { DEFAULT_WIDGETS, readWidgets, type DashboardWidget } from './widgetLayout'

export type DashboardPageId = 'dashboard' | 'clock' | 'weather' | 'notes'

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
}

export type NoteColor = 'coral' | 'violet' | 'mint' | 'sun'

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

export interface DashboardState {
  notes: Note[]
  alarms: Alarm[]
  timers: Timer[]
  widgets: DashboardWidget[]
  preferences: DashboardPreferences
}

export const DASHBOARD_PAGES: DashboardPageDefinition[] = [
  { id: 'dashboard', kind: 'grid', label: 'Inicio', rotationEligible: true },
  { id: 'clock', kind: 'fullscreen', label: 'Reloj', rotationEligible: true },
  { id: 'weather', kind: 'fullscreen', label: 'Tiempo', rotationEligible: true },
  { id: 'notes', kind: 'fullscreen', label: 'Notas', rotationEligible: true },
]

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  notes: [],
  alarms: [],
  timers: [],
  widgets: DEFAULT_WIDGETS,
  preferences: {
    rotationEnabled: true,
    rotationSeconds: 30,
    navigationSeconds: 5,
    enabledPageIds: DASHBOARD_PAGES.map((page) => page.id),
  },
}

const STORAGE_KEY = 'pablo-tablet.dashboard.v5'
const PREVIOUS_STORAGE_KEYS = [
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
    return [{
      id: alarm.id,
      label: typeof alarm.label === 'string' ? alarm.label.slice(0, 60) : 'Alarma',
      time: alarm.time,
      enabled: alarm.enabled !== false,
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
    const widgets = readWidgets(parsed.widgets)
    const parsedPageIds = Array.isArray(parsedPreferences.enabledPageIds)
      ? parsedPreferences.enabledPageIds.filter(isPageId)
      : DEFAULT_DASHBOARD_STATE.preferences.enabledPageIds
    const shouldAddWeather = storedState?.key === 'pablo-tablet.dashboard.v1'
      || storedState?.key === 'pablo-tablet.dashboard.v2'
    const enabledPageIds = shouldAddWeather && !parsedPageIds.includes('weather')
      ? [...parsedPageIds, 'weather' as const]
      : parsedPageIds

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
