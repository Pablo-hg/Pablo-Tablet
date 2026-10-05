import { Capacitor, registerPlugin } from '@capacitor/core'

interface AppStoragePlugin {
  get(options: { key: string }): Promise<{ value: string | null; updatedAt: number | null }>
  set(options: { key: string; value: string }): Promise<{ updatedAt: number }>
  remove(options: { key: string }): Promise<void>
}

const NativeAppStorage = registerPlugin<AppStoragePlugin>('AppStorage')

export const DASHBOARD_STORAGE_KEY = 'dashboard-state'
export const WEATHER_STORAGE_KEY = 'pablo-tablet.weather-cache.v1'

export function usesNativeAppStorage() {
  return Capacitor.isNativePlatform()
}

export async function readAppStorage(key: string) {
  return (await readAppStorageRecord(key)).value
}

export async function readAppStorageRecord(key: string): Promise<{ value: string | null; updatedAt: number | null }> {
  if (!usesNativeAppStorage()) return { value: window.localStorage.getItem(key), updatedAt: null }
  return NativeAppStorage.get({ key })
}

export async function writeAppStorage(key: string, value: string) {
  if (!usesNativeAppStorage()) {
    window.localStorage.setItem(key, value)
    return { updatedAt: Date.now() }
  }
  return NativeAppStorage.set({ key, value })
}

export async function removeAppStorage(key: string) {
  if (!usesNativeAppStorage()) {
    window.localStorage.removeItem(key)
    return
  }
  await NativeAppStorage.remove({ key })
}
