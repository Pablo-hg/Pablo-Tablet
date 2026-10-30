import { useRef, useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDashboardState } from '../dashboardState'
import { useDashboardPersistence } from '../hooks/useDashboardPersistence'
import { useDeviceEffects } from '../hooks/useDeviceEffects'
import { NOTIFICATION_SETTINGS_CHANGED_EVENT } from '../notificationPermissions'

const storage = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
const sync = vi.hoisted(() => ({ notes: vi.fn(), calendar: vi.fn(), alarms: vi.fn(), timers: vi.fn() }))
vi.mock('../appStorage', () => ({
  DASHBOARD_STORAGE_KEY: 'dashboard-state', usesNativeAppStorage: () => true,
  readAppStorageRecord: storage.read, writeAppStorage: storage.write,
}))
vi.mock('../deviceSettings', () => ({ applyDeviceSettings: async () => {} }))
vi.mock('../reminderNotifications', () => ({
  syncReminderNotifications: sync.notes, syncCalendarEventNotifications: sync.calendar,
  syncAlarmNotifications: sync.alarms, syncTimerNotifications: sync.timers,
}))

function useStartup() {
  const [state, setState] = useState(loadDashboardState)
  const stateRef = useRef(state)
  const ready = useDashboardPersistence({ state, stateRef, setState })
  useDeviceEffects(state, false, ready)
  return ready
}

describe('avisos al arrancar Android', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); storage.write.mockResolvedValue({ updatedAt: 2 }) })
  afterEach(() => vi.useRealTimers())

  it('espera al almacenamiento nativo antes de reconciliar avisos y usa los datos restaurados', async () => {
    const restored = loadDashboardState(JSON.stringify({ timers: [{ id: 'saved-timer', label: 'Horno', durationSeconds: 60, remainingSeconds: 60, endsAt: '2099-01-01T10:00:00.000Z' }] }))
    let finish!: (value: { value: string; updatedAt: number }) => void
    const pending = new Promise<{ value: string; updatedAt: number }>((resolve) => { finish = resolve })
    storage.read.mockReturnValue(pending)
    const { result } = renderHook(useStartup)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
      window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_CHANGED_EVENT))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(false)
    for (const call of Object.values(sync)) expect(call).not.toHaveBeenCalled()
    expect(storage.write).not.toHaveBeenCalled()

    await act(async () => { finish({ value: JSON.stringify(restored), updatedAt: 1 }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(result.current).toBe(true)
    expect(sync.timers).toHaveBeenCalledWith(restored.timers)
    expect(sync.alarms).toHaveBeenCalledTimes(1)
  })

  it('no reemplaza los datos ni cancela avisos si falla la lectura inicial', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    storage.read.mockRejectedValue(new Error('storage unavailable'))
    const { result } = renderHook(useStartup)
    await act(async () => { await vi.advanceTimersByTimeAsync(700) })
    expect(result.current).toBe(false)
    expect(storage.write).not.toHaveBeenCalled()
    for (const call of Object.values(sync)) expect(call).not.toHaveBeenCalled()
  })

  it('recupera la sincronización si la lectura nativa vuelve a funcionar', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const restored = loadDashboardState(JSON.stringify({ timers: [{ id: 'saved-timer', durationSeconds: 60, remainingSeconds: 60, endsAt: '2099-01-01T10:00:00.000Z' }] }))
    storage.read.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue({ value: JSON.stringify(restored), updatedAt: 5 })
    const { result } = renderHook(useStartup)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(result.current).toBe(true)
    expect(sync.timers).toHaveBeenCalledWith(restored.timers)
  })
})
