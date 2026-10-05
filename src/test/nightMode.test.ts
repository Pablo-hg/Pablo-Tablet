import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_STATE } from '../dashboardState'
import { effectiveDeviceSettings, isNightModeActive } from '../nightMode'

describe('modo nocturno', () => {
  const schedule = { nightModeEnabled: true, nightModeStart: '22:30', nightModeEnd: '07:00' }

  it('activa correctamente un horario que cruza medianoche', () => {
    expect(isNightModeActive(new Date(2026, 9, 4, 23, 15), schedule)).toBe(true)
    expect(isNightModeActive(new Date(2026, 9, 5, 6, 59), schedule)).toBe(true)
    expect(isNightModeActive(new Date(2026, 9, 5, 7, 0), schedule)).toBe(false)
    expect(isNightModeActive(new Date(2026, 9, 5, 16, 0), schedule)).toBe(false)
  })

  it('aplica brillo y volumen nocturnos sin perder los valores diurnos', () => {
    const preferences = { ...DEFAULT_DASHBOARD_STATE.preferences, brightness: 80, mediaVolume: 65, nightBrightness: 4, nightMediaVolume: 10 }
    expect(effectiveDeviceSettings(preferences, true)).toMatchObject({ autoBrightness: false, brightness: 4, mediaVolume: 10 })
    expect(effectiveDeviceSettings(preferences, false)).toMatchObject({ brightness: 80, mediaVolume: 65 })
  })
})
