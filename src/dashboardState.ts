import { DEFAULT_WIDGETS, readWidgets, type DashboardWidget } from './widgetLayout'

export type DashboardPageId = 'dashboard' | 'clock' | 'notes'

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

const STORAGE_KEY = 'pablo-tablet.dashboard.v1'
const ROTATION_OPTIONS = new Set([15, 30, 60])
const NAVIGATION_OPTIONS = new Set([3, 5, 8])

function isPageId(value: unknown): value is DashboardPageId {
  return DASHBOARD_PAGES.some((page) => page.id === value)
}

function isNoteColor(value: unknown): value is NoteColor {
  return value === 'coral' || value === 'violet' || value === 'mint' || value === 'sun'
}

function readNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item): Note[] => {
    if (!item || typeof item !== 'object') return []
    const note = item as Partial<Note>
    if (typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.content !== 'string') return []
    if (typeof note.createdAt !== 'string' || typeof note.updatedAt !== 'string') return []
    return [{
      id: note.id,
      title: note.title.slice(0, 80),
      content: note.content.slice(0, 600),
      color: isNoteColor(note.color) ? note.color : 'coral',
      pinned: Boolean(note.pinned),
      reminderAt: typeof note.reminderAt === 'string' ? note.reminderAt : null,
      archived: Boolean(note.archived),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }]
  })
}

function readAlarms(value: unknown): Alarm[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): Alarm[] => {
    if (!item || typeof item !== 'object') return []
    const alarm = item as Partial<Alarm>
    if (typeof alarm.id !== 'string' || typeof alarm.label !== 'string' || typeof alarm.createdAt !== 'string') return []
    if (typeof alarm.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(alarm.time)) return []
    return [{ id: alarm.id, label: alarm.label.slice(0, 60), time: alarm.time, enabled: Boolean(alarm.enabled), createdAt: alarm.createdAt }]
  })
}

function readTimers(value: unknown): Timer[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): Timer[] => {
    if (!item || typeof item !== 'object') return []
    const timer = item as Partial<Timer>
    if (typeof timer.id !== 'string' || typeof timer.label !== 'string' || typeof timer.createdAt !== 'string') return []
    const durationSeconds = timer.durationSeconds
    const remainingSeconds = timer.remainingSeconds
    if (typeof durationSeconds !== 'number' || typeof remainingSeconds !== 'number' || !Number.isInteger(durationSeconds) || !Number.isInteger(remainingSeconds) || durationSeconds < 1 || remainingSeconds < 0) return []
    return [{ id: timer.id, label: timer.label.slice(0, 60), durationSeconds, remainingSeconds: Math.min(remainingSeconds, durationSeconds), endsAt: typeof timer.endsAt === 'string' ? timer.endsAt : null, createdAt: timer.createdAt }]
  })
}

export function loadDashboardState(): DashboardState {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY)
    if (!rawState) return DEFAULT_DASHBOARD_STATE

    const parsed = JSON.parse(rawState) as Partial<DashboardState> & { note?: unknown }
    const parsedPreferences: Partial<DashboardPreferences> = parsed.preferences ?? {}
    const notes = readNotes(parsed.notes)
    const alarms = readAlarms(parsed.alarms)
    const timers = readTimers(parsed.timers)
    const widgets = readWidgets(parsed.widgets)
    const enabledPageIds = Array.isArray(parsedPreferences.enabledPageIds)
      ? parsedPreferences.enabledPageIds.filter(isPageId)
      : DEFAULT_DASHBOARD_STATE.preferences.enabledPageIds

    return {
      notes: notes.length > 0
        ? notes
        : typeof parsed.note === 'string' && parsed.note.trim()
          ? [{
              id: 'legacy-note',
              title: 'Nota rápida',
              content: parsed.note.slice(0, 600),
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
