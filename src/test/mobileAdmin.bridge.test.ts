import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeMobileAdmin = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setEnabled: vi.fn(),
  revokeAllDevices: vi.fn(),
  addListener: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => nativeMobileAdmin,
}))

import { addMobileAdminStatusListener, getMobileAdminStatus, revokeAllAuthorizedDevices, setMobileAdminEnabled } from '../mobileAdmin'

describe('puente nativo de administración móvil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta y cambia la preferencia usando el resultado real del servicio', async () => {
    const disabled = { enabled: false, running: false, port: 8765, localAddress: null, hostname: null, networkGeneration: 0, error: null, serviceState: 'disabled' as const }
    const enabled = { enabled: true, running: true, port: 8765, localAddress: 'http://192.168.1.50:8765', hostname: null, networkGeneration: 1, error: null, serviceState: 'available' as const }
    nativeMobileAdmin.getStatus.mockResolvedValue(disabled)
    nativeMobileAdmin.setEnabled.mockResolvedValue(enabled)

    await expect(getMobileAdminStatus()).resolves.toEqual(disabled)
    await expect(setMobileAdminEnabled(true)).resolves.toEqual(enabled)
    expect(nativeMobileAdmin.setEnabled).toHaveBeenCalledWith({ enabled: true })
  })

  it('suscribe la interfaz a los cambios nativos de red', async () => {
    const listener = vi.fn()
    const handle = { remove: vi.fn() }
    nativeMobileAdmin.addListener.mockResolvedValue(handle)

    await expect(addMobileAdminStatusListener(listener)).resolves.toBe(handle)
    expect(nativeMobileAdmin.addListener).toHaveBeenCalledWith('statusChanged', listener)
  })

  it('revoca todos los dispositivos mediante una única llamada nativa', async () => {
    nativeMobileAdmin.revokeAllDevices.mockResolvedValue({ revokedCount: 3 })

    await expect(revokeAllAuthorizedDevices()).resolves.toBe(3)
    expect(nativeMobileAdmin.revokeAllDevices).toHaveBeenCalledTimes(1)
  })
})
