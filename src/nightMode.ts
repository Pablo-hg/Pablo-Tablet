import type { DashboardPreferences } from './dashboardState'

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

export function isNightModeActive(now: Date, preferences: Pick<DashboardPreferences, 'nightModeEnabled' | 'nightModeStart' | 'nightModeEnd'>) {
  if (!preferences.nightModeEnabled) return false
  const start = timeToMinutes(preferences.nightModeStart)
  const end = timeToMinutes(preferences.nightModeEnd)
  if (start === null || end === null) return false
  if (start === end) return true
  const current = now.getHours() * 60 + now.getMinutes()
  return start < end
    ? current >= start && current < end
    : current >= start || current < end
}

export function effectiveDeviceSettings(preferences: DashboardPreferences, nightModeActive: boolean) {
  return {
    autoBrightness: nightModeActive ? false : preferences.autoBrightness,
    brightness: nightModeActive ? preferences.nightBrightness : preferences.brightness,
    alarmVolume: nightModeActive ? preferences.nightAlarmVolume : preferences.alarmVolume,
    mediaVolume: nightModeActive ? preferences.nightMediaVolume : preferences.mediaVolume,
    keepScreenAwake: preferences.keepScreenAwake,
    screenTimeoutSeconds: preferences.screenTimeoutSeconds,
  }
}
