import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeMobileAdmin = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setEnabled: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => nativeMobileAdmin,
}))

import { getMobileAdminStatus, setMobileAdminEnabled } from '../mobileAdmin'

describe('puente nativo de administración móvil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta y cambia la preferencia usando el resultado real del servicio', async () => {
    const disabled = { enabled: false, running: false, port: 8765, localAddress: null, hostname: null, error: null }
    const enabled = { enabled: true, running: true, port: 8765, localAddress: 'http://192.168.1.50:8765', hostname: null, error: null }
    nativeMobileAdmin.getStatus.mockResolvedValue(disabled)
    nativeMobileAdmin.setEnabled.mockResolvedValue(enabled)

    await expect(getMobileAdminStatus()).resolves.toEqual(disabled)
    await expect(setMobileAdminEnabled(true)).resolves.toEqual(enabled)
    expect(nativeMobileAdmin.setEnabled).toHaveBeenCalledWith({ enabled: true })
  })
})
