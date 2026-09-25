export type DashboardPageId = 'dashboard' | 'clock' | 'weather' | 'notes'

export type DashboardPageKind = 'grid' | 'fullscreen'

export type NoteColor = 'coral' | 'blue' | 'green' | 'amber'

export interface DashboardPageDefinition {
  id: DashboardPageId
  kind: DashboardPageKind
  label: string
  rotationEligible: boolean
}

export interface Note {
  id: string
  title: string
  content: string
  color: NoteColor
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Alarm {
  id: string
  label: string
  time: string
  enabled: boolean
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface CountdownTimer {
  id: string
  label: string
  durationSeconds: number
  remainingSeconds: number
  status: TimerStatus
  endsAt: string | null
}

export interface DashboardPreferences {
  rotationEnabled: boolean
  rotationSeconds: number
  navigationSeconds: number
  enabledPageIds: DashboardPageId[]
}

export interface DashboardState {
  notes: Note[]
  activeNoteId: string | null
  alarms: Alarm[]
  timers: CountdownTimer[]
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
  activeNoteId: null,
  alarms: [],
  timers: [],
  preferences: {
    rotationEnabled: true,
    rotationSeconds: 30,
    navigationSeconds: 5,
    enabledPageIds: DASHBOARD_PAGES.map((page) => page.id),
  },
}

const STORAGE_KEY = 'pablo-tablet.dashboard.v4'
const WEATHER_STORAGE_KEY = 'pablo-tablet.dashboard.v3'
const PREVIOUS_STORAGE_KEY = 'pablo-tablet.dashboard.v2'
const LEGACY_STORAGE_KEY = 'pablo-tablet.dashboard.v1'
const ROTATION_OPTIONS = new Set([15, 30, 60])
const NAVIGATION_OPTIONS = new Set([3, 5, 8])
const NOTE_COLORS = new Set<NoteColor>(['coral', 'blue', 'green', 'amber'])

function isPageId(value: unknown): value is DashboardPageId {
  return DASHBOARD_PAGES.some((page) => page.id === value)
}

function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && NOTE_COLORS.has(value as NoteColor)
}

function normalizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null
  const note = value as Partial<Note>
  if (typeof note.id !== 'string') return null
  const now = new Date().toISOString()
  return {
    id: note.id,
    title: typeof note.title === 'string' ? note.title.slice(0, 80) : '',
    content: typeof note.content === 'string' ? note.content.slice(0, 2000) : '',
    color: isNoteColor(note.color) ? note.color : 'coral',
    pinned: note.pinned === true,
    archived: note.archived === true,
    createdAt: typeof note.createdAt === 'string' ? note.createdAt : now,
    updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : now,
  }
}

function normalizeAlarm(value: unknown): Alarm | null {
  if (!value || typeof value !== 'object') return null
  const alarm = value as Partial<Alarm>
  if (typeof alarm.id !== 'string' || typeof alarm.time !== 'string' || !/^\d{2}:\d{2}$/.test(alarm.time)) return null
  return {
    id: alarm.id,
    label: typeof alarm.label === 'string' ? alarm.label.slice(0, 50) : '',
    time: alarm.time,
    enabled: alarm.enabled !== false,
  }
}

function normalizeTimer(value: unknown): CountdownTimer | null {
  if (!value || typeof value !== 'object') return null
  const timer = value as Partial<CountdownTimer>
  if (typeof timer.id !== 'string' || typeof timer.durationSeconds !== 'number' || timer.durationSeconds <= 0) return null
  const status: TimerStatus = timer.status === 'running' || timer.status === 'paused' || timer.status === 'finished'
    ? timer.status
    : 'idle'
  const remainingSeconds = typeof timer.remainingSeconds === 'number'
    ? Math.max(0, Math.min(timer.remainingSeconds, timer.durationSeconds))
    : timer.durationSeconds
  return {
    id: timer.id,
    label: typeof timer.label === 'string' ? timer.label.slice(0, 50) : '',
    durationSeconds: timer.durationSeconds,
    remainingSeconds,
    status,
    endsAt: status === 'running' && typeof timer.endsAt === 'string' ? timer.endsAt : null,
  }
}

function migrateLegacyNote(value: unknown): Note[] {
  if (!value || typeof value !== 'object') return []
  const legacyNote = (value as { note?: unknown }).note
  if (typeof legacyNote !== 'string' || !legacyNote.trim()) return []
  const now = new Date().toISOString()
  return [{
    id: 'migrated-quick-note',
    title: 'Nota rápida',
    content: legacyNote,
    color: 'coral',
    pinned: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }]
}

export function createNote(): Note {
  const now = new Date().toISOString()
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
    title: '',
    content: '',
    color: 'coral',
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function createAlarm(): Alarm {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000)
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `alarm-${Date.now()}`,
    label: 'Alarma',
    time: `${String(nextHour.getHours()).padStart(2, '0')}:00`,
    enabled: true,
  }
}

export function createCountdownTimer(durationSeconds: number, label = ''): CountdownTimer {
  const safeDuration = Math.max(60, Math.round(durationSeconds))
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `timer-${Date.now()}`,
    label: label.trim().slice(0, 50) || `Temporizador de ${Math.round(safeDuration / 60)} min`,
    durationSeconds: safeDuration,
    remainingSeconds: safeDuration,
    status: 'idle',
    endsAt: null,
  }
}

export function getDashboardNote(notes: Note[]): Note | null {
  const availableNotes = notes.filter((note) => !note.archived)
  return availableNotes.sort((first, second) => {
    if (first.pinned !== second.pinned) return first.pinned ? -1 : 1
    return second.updatedAt.localeCompare(first.updatedAt)
  })[0] ?? null
}

export function loadDashboardState(): DashboardState {
  try {
    const currentRawState = window.localStorage.getItem(STORAGE_KEY)
    const weatherRawState = window.localStorage.getItem(WEATHER_STORAGE_KEY)
    const previousRawState = window.localStorage.getItem(PREVIOUS_STORAGE_KEY)
    const legacyRawState = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    const rawState = currentRawState ?? weatherRawState ?? previousRawState ?? legacyRawState
    if (!rawState) return DEFAULT_DASHBOARD_STATE

    const parsed = JSON.parse(rawState) as Partial<DashboardState>
    const parsedPreferences: Partial<DashboardPreferences> = parsed.preferences ?? {}
    const parsedEnabledPageIds = Array.isArray(parsedPreferences.enabledPageIds)
      ? parsedPreferences.enabledPageIds.filter(isPageId)
      : DEFAULT_DASHBOARD_STATE.preferences.enabledPageIds
    const enabledPageIds: DashboardPageId[] = !currentRawState && !weatherRawState && !parsedEnabledPageIds.includes('weather')
      ? [...parsedEnabledPageIds, 'weather']
      : parsedEnabledPageIds
    const notes = Array.isArray(parsed.notes)
      ? parsed.notes.map(normalizeNote).filter((note): note is Note => note !== null)
      : migrateLegacyNote(parsed)
    const requestedActiveNoteId = typeof parsed.activeNoteId === 'string' ? parsed.activeNoteId : null
    const alarms = Array.isArray(parsed.alarms)
      ? parsed.alarms.map(normalizeAlarm).filter((alarm): alarm is Alarm => alarm !== null)
      : []
    const timers = Array.isArray(parsed.timers)
      ? parsed.timers.map(normalizeTimer).filter((timer): timer is CountdownTimer => timer !== null)
      : []

    return {
      notes,
      activeNoteId: notes.some((note) => note.id === requestedActiveNoteId)
        ? requestedActiveNoteId
        : notes.find((note) => !note.archived)?.id ?? notes[0]?.id ?? null,
      alarms,
      timers,
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
