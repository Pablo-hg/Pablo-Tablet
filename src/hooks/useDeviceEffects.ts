import { useEffect } from 'react'
import type { DashboardState } from '../dashboardState'
import { applyDeviceSettings } from '../deviceSettings'
import { effectiveDeviceSettings } from '../nightMode'
import { syncAlarmNotifications, syncCalendarEventNotifications, syncReminderNotifications, syncTimerNotifications } from '../reminderNotifications'
import { NOTIFICATION_SETTINGS_CHANGED_EVENT } from '../notificationPermissions'

export function useDeviceEffects(state: DashboardState, nightModeActive: boolean) {
  useEffect(() => {
    const activeSettings = effectiveDeviceSettings(state.preferences, nightModeActive)
    const { autoBrightness, brightness, alarmVolume, mediaVolume, autoRotate, keepScreenAwake, screenTimeoutSeconds } = activeSettings
    const timeout = window.setTimeout(() => {
      void applyDeviceSettings(autoBrightness, brightness, alarmVolume, mediaVolume, autoRotate, keepScreenAwake, screenTimeoutSeconds)
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

  useEffect(() => {
    const syncAll = () => {
      void syncReminderNotifications(state.notes)
      void syncCalendarEventNotifications(state.calendarEvents)
      void syncAlarmNotifications(state.alarms)
      void syncTimerNotifications(state.timers)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncAll()
    }
    window.addEventListener(NOTIFICATION_SETTINGS_CHANGED_EVENT, syncAll)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(NOTIFICATION_SETTINGS_CHANGED_EVENT, syncAll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state.alarms, state.calendarEvents, state.notes, state.timers])
}
