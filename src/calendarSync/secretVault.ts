import { Capacitor, registerPlugin } from '@capacitor/core'

interface CalendarSecretsPlugin {
  get(options: { key: string }): Promise<{ value: string | null }>
  set(options: { key: string; value: string }): Promise<void>
  remove(options: { key: string }): Promise<void>
}

const NativeCalendarSecrets = registerPlugin<CalendarSecretsPlugin>('CalendarSecrets')
const browserSessionVault = new Map<string, string>()

const secretKey = (accountId: string) => `calendar-connection:${accountId}`

export async function readCalendarConnectionToken(accountId: string) {
  const key = secretKey(accountId)
  if (!Capacitor.isNativePlatform()) return browserSessionVault.get(key) ?? null
  return (await NativeCalendarSecrets.get({ key })).value
}

export async function writeCalendarConnectionToken(accountId: string, token: string) {
  const key = secretKey(accountId)
  if (!Capacitor.isNativePlatform()) {
    browserSessionVault.set(key, token)
    return
  }
  await NativeCalendarSecrets.set({ key, value: token })
}

export async function removeCalendarConnectionToken(accountId: string) {
  const key = secretKey(accountId)
  if (!Capacitor.isNativePlatform()) {
    browserSessionVault.delete(key)
    return
  }
  await NativeCalendarSecrets.remove({ key })
}
