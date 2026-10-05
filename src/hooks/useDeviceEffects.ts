import { useEffect } from 'react'
import type { DashboardState } from '../dashboardState'
import { applyDeviceSettings } from '../deviceSettings'
import { effectiveDeviceSettings } from '../nightMode'
import { syncAlarmNotifications, syncCalendarEventNotifications, syncReminderNotifications, syncTimerNotifications } from '../reminderNotifications'

export function useDeviceEffects(state: DashboardState, nightModeActive: boolean) {
  useEffect(() => {
    const activeSettings = effectiveDeviceSettings(state.preferences, nightModeActive)
    const { autoBrightness, brightness, alarmVolume, mediaVolume, keepScreenAwake, screenTimeoutSeconds } = activeSettings
    const timeout = window.setTimeout(() => {
      void applyDeviceSettings(autoBrightness, brightness, alarmVolume, mediaVolume, keepScreenAwake, screenTimeoutSeconds)
        .catch((error) => console.warn('No se pudieron aplicar los ajustes del dispositivo.', error))
    }, 80)
    return () => window.clearTimeout(timeout)
  }, [state.preferences, nightModeActive])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncReminderNotifications(state.notes), 600)
    return () => window.clearTimeout(timeout)
  }, [state.notes])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncCalendarEventNotifications(state.calendarEvents), 600)
    return () => window.clearTimeout(timeout)
  }, [state.calendarEvents])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncAlarmNotifications(state.alarms), 600)
    return () => window.clearTimeout(timeout)
  }, [state.alarms])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncTimerNotifications(state.timers), 600)
    return () => window.clearTimeout(timeout)
  }, [state.timers])
}
