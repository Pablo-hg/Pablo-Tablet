import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alarmChannelId, configureTimerChannel, timerChannelId } from '../alarmSounds'
import type { Timer } from '../dashboardState'

const plugin = vi.hoisted(() => ({ configureChannel: vi.fn() }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => plugin,
}))

describe('canales de sonido', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mantiene el canal de cada tono y usa uno distinto al cambiarlo', () => {
    expect(timerChannelId('t1', null)).toBe(timerChannelId('t1', ''))
    expect(timerChannelId('t1', 'content://sounds/1')).not.toBe(timerChannelId('t1', 'content://sounds/2'))
    expect(timerChannelId('t1', null)).not.toBe(timerChannelId('t2', null))
    expect(alarmChannelId('a1', 'content://sounds/1')).not.toBe(alarmChannelId('a1', 'content://sounds/2'))
    expect(alarmChannelId('a1', null)).not.toBe(timerChannelId('a1', null))
  })

  it('configura el canal nativo con el tono elegido en el temporizador', async () => {
    const timer: Timer = { id: 't1', label: 'Horno', soundName: 'Campanas', soundUri: 'content://sounds/7', durationSeconds: 60, remainingSeconds: 60, endsAt: null, createdAt: '' }
    await expect(configureTimerChannel(timer)).resolves.toBe(timerChannelId(timer.id, timer.soundUri))
    expect(plugin.configureChannel).toHaveBeenCalledWith({
      channelId: timerChannelId(timer.id, timer.soundUri), name: 'Temporizador: Horno', soundUri: 'content://sounds/7', silent: false,
    })
  })
})
