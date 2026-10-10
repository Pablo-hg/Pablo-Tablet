import { Capacitor, type PermissionState } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export const NOTIFICATION_SETTINGS_CHANGED_EVENT = 'pablo-notification-settings-changed'

export interface NotificationPermissionStatus {
  supported: boolean
  display: PermissionState | 'unsupported'
  exactAlarm: PermissionState | 'not-required' | 'unsupported'
}

export async function checkNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { supported: false, display: 'unsupported', exactAlarm: 'unsupported' }
  }

  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') {
    return { supported: true, display, exactAlarm: 'unsupported' }
  }
  if (Capacitor.getPlatform() !== 'android') {
    return { supported: true, display, exactAlarm: 'not-required' }
  }

  const { exact_alarm: exactAlarm } = await LocalNotifications.checkExactNotificationSetting()
  return { supported: true, display, exactAlarm }
}

function notifySettingsChanged() {
  window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_CHANGED_EVENT))
}

export async function requestNotificationDisplayPermission() {
  const result = await LocalNotifications.requestPermissions()
  notifySettingsChanged()
  return result.display
}

export async function openExactAlarmSettings() {
  const result = await LocalNotifications.changeExactNotificationSetting()
  notifySettingsChanged()
  return result.exact_alarm
}
