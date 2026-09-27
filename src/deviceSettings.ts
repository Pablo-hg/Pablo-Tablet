import { Capacitor, registerPlugin } from '@capacitor/core'

interface DeviceSettingsPlugin {
  apply(options: { brightness: number; alarmVolume: number; mediaVolume: number; keepScreenAwake: boolean; screenTimeoutSeconds: number }): Promise<void>
  previewVolume(options: { channel: 'alarm' | 'media'; volume: number }): Promise<void>
  playInteractionSound(options: { volume: number }): Promise<void>
}

const DeviceSettings = registerPlugin<DeviceSettingsPlugin>('DeviceSettings')

export async function applyDeviceSettings(brightness: number, alarmVolume: number, mediaVolume: number, keepScreenAwake: boolean, screenTimeoutSeconds: number) {
  if (!Capacitor.isNativePlatform()) return
  await DeviceSettings.apply({ brightness, alarmVolume, mediaVolume, keepScreenAwake, screenTimeoutSeconds })
}

export async function previewDeviceVolume(channel: 'alarm' | 'media', volume: number) {
  if (!Capacitor.isNativePlatform()) return
  await DeviceSettings.previewVolume({ channel, volume })
}

export async function playInteractionSound(volume: number) {
  if (!Capacitor.isNativePlatform()) return
  await DeviceSettings.playInteractionSound({ volume })
}
