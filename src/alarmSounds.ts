import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Alarm, Timer } from './dashboardState'
import { tx } from './i18n'

export interface DeviceAlarmSound {
  name: string
  uri: string
}

interface AlarmSoundsPlugin {
  listAlarmSounds(): Promise<{ sounds: DeviceAlarmSound[] }>
  playSound(options: { uri: string; loop?: boolean; vibrate?: boolean }): Promise<void>
  stopSound(): Promise<void>
  configureChannel(options: { channelId: string; name: string; soundUri: string | null; silent?: boolean }): Promise<void>
}

const AlarmSounds = registerPlugin<AlarmSoundsPlugin>('AlarmSounds')

export const DEFAULT_ALARM_SOUND: DeviceAlarmSound = {
  name: 'Sonido predeterminado',
  uri: '',
}

function stableNumber(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash) || 1
}

export function alarmChannelId(alarmId: string, soundUri: string | null = null) {
  return `pablo_alarm_${stableNumber(alarmId)}_${stableNumber(soundUri || 'default')}`
}

export function timerChannelId(timerId: string, soundUri: string | null = null) {
  return `pablo_timer_${stableNumber(timerId)}_${stableNumber(soundUri || 'default')}`
}

export async function getDeviceAlarmSounds() {
  if (!Capacitor.isNativePlatform()) return [DEFAULT_ALARM_SOUND]
  const { sounds } = await AlarmSounds.listAlarmSounds()
  return [DEFAULT_ALARM_SOUND, ...sounds.filter((sound) => sound.name !== DEFAULT_ALARM_SOUND.name)]
}

export async function previewAlarmSound(uri: string | null, ring = false) {
  if (!Capacitor.isNativePlatform()) return false
  await AlarmSounds.playSound({ uri: uri ?? '', loop: ring, vibrate: ring })
  return true
}

export async function stopAlarmSoundPreview() {
  if (!Capacitor.isNativePlatform()) return
  await AlarmSounds.stopSound()
}

export async function configureAlarmChannel(alarm: Alarm) {
  if (!Capacitor.isNativePlatform()) return undefined
  const channelId = alarmChannelId(alarm.id, alarm.soundUri)
  await configureAlertChannel(channelId, `${tx('Alarma')}: ${alarm.label.trim() || alarm.time}`, alarm.soundUri)
  return channelId
}

export async function configureTimerChannel(timer: Timer) {
  if (!Capacitor.isNativePlatform()) return undefined
  const channelId = timerChannelId(timer.id, timer.soundUri)
  await configureAlertChannel(channelId, `${tx('Temporizador')}: ${timer.label.trim() || timer.id}`, timer.soundUri)
  return channelId
}

export async function configureAlertChannel(channelId: string, name: string, soundUri: string | null, silent = false) {
  if (!Capacitor.isNativePlatform()) return
  await AlarmSounds.configureChannel({ channelId, name, soundUri, silent })
}
