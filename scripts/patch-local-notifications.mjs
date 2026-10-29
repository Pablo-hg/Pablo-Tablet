import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Capacitor 8.3.1 re-arms schedule.on with RTC and drops allowWhileIdle.
// Keep the fix reproducible after npm ci; fail if upstream changes this code.
const original = `        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
        if (wantsExact && canExact) {
            alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent)
        } else {
            if (wantsExact) {
                Logger.warn("Capacitor/LocalNotification", "Exact alarms not allowed in user settings.  Notification scheduled with non-exact alarm.")
            }
            alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)
        }`

const replacement = `        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
        // Pablo Tablet #30: preserve idle/wakeup semantics on every repetition.
        val allowWhileIdle = storedNotification?.getJSObject("schedule")?.getBoolean("allowWhileIdle", false) ?: false
        if (wantsExact && canExact) {
            if (allowWhileIdle) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent)
            }
        } else {
            if (wantsExact) {
                Logger.warn("Capacitor/LocalNotification", "Exact alarms not allowed in user settings.  Notification scheduled with non-exact alarm.")
            }
            if (allowWhileIdle) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)
            }
        }`

export function patchRecurringNotificationSource(source) {
  const normalized = source.replaceAll('\r\n', '\n')
  if (normalized.includes(replacement)) return normalized
  if (!normalized.includes(original)) throw new Error('Local Notifications: native recurrence code changed; review the #30 patch before building.')
  return normalized.replace(original, replacement)
}

const categoryAnchor = '        localNotification.badge?.let { mBuilder.setNumber(it) }'
const categoryReplacement = `        // Pablo Tablet #30: Android 15+ downgrades alarm audio without CATEGORY_ALARM.
        val alertKind = (localNotification.extra as? org.json.JSONObject)?.optString("kind")
        if (alertKind == "alarm" || alertKind == "timer") {
            mBuilder.setCategory(Notification.CATEGORY_ALARM)
        }

${categoryAnchor}`

export function patchNotificationCategorySource(source) {
  const normalized = source.replaceAll('\r\n', '\n')
  if (normalized.includes(categoryReplacement)) return normalized
  if (!normalized.includes(categoryAnchor)) throw new Error('Local Notifications: native builder changed; review the #30 audio category patch.')
  return normalized.replace(categoryAnchor, categoryReplacement)
}

export function patchInstalledLocalNotifications() {
  const plugin = new URL('../node_modules/@capacitor/local-notifications/', import.meta.url)
  const metadata = JSON.parse(readFileSync(new URL('package.json', plugin), 'utf8'))
  if (metadata.version !== '8.3.1') throw new Error(`Review the #30 native patch for Local Notifications ${metadata.version}.`)
  const target = new URL('android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.kt', plugin)
  const source = readFileSync(target, 'utf8')
  const patched = patchRecurringNotificationSource(source)
  if (patched !== source) writeFileSync(target, patched)
  const managerTarget = new URL('android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/LocalNotificationManager.kt', plugin)
  const managerSource = readFileSync(managerTarget, 'utf8')
  const patchedManager = patchNotificationCategorySource(managerSource)
  if (patchedManager !== managerSource) writeFileSync(managerTarget, patchedManager)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  patchInstalledLocalNotifications()
  console.log('Local Notifications: recurring idle/wakeup and alarm audio patches verified (8.3.1).')
}
