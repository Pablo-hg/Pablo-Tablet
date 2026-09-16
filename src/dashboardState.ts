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

export interface DashboardState {
  note: string
  preferences: DashboardPreferences
}

export const DASHBOARD_PAGES: DashboardPageDefinition[] = [
  { id: 'dashboard', kind: 'grid', label: 'Inicio', rotationEligible: true },
  { id: 'clock', kind: 'fullscreen', label: 'Reloj', rotationEligible: true },
  { id: 'notes', kind: 'fullscreen', label: 'Notas', rotationEligible: true },
]

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  note: '',
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

export function loadDashboardState(): DashboardState {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY)
    if (!rawState) return DEFAULT_DASHBOARD_STATE

    const parsed = JSON.parse(rawState) as Partial<DashboardState>
    const parsedPreferences: Partial<DashboardPreferences> = parsed.preferences ?? {}
    const enabledPageIds = Array.isArray(parsedPreferences.enabledPageIds)
      ? parsedPreferences.enabledPageIds.filter(isPageId)
      : DEFAULT_DASHBOARD_STATE.preferences.enabledPageIds

    return {
      note: typeof parsed.note === 'string' ? parsed.note : DEFAULT_DASHBOARD_STATE.note,
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
