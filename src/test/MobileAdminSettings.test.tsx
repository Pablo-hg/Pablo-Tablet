import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileAdminSettings } from '../MobileAdminSettings'

const mobileAdmin = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setEnabled: vi.fn(),
  listDevices: vi.fn(),
}))

vi.mock('../mobileAdmin', () => ({
  getMobileAdminStatus: mobileAdmin.getStatus,
  setMobileAdminEnabled: mobileAdmin.setEnabled,
  listAuthorizedDevices: mobileAdmin.listDevices,
  cancelMobilePairing: vi.fn(),
  createMobilePairing: vi.fn(),
  decidePairingRequest: vi.fn(),
  listPendingPairingRequests: vi.fn().mockResolvedValue([]),
  renameAuthorizedDevice: vi.fn(),
  revokeAuthorizedDevice: vi.fn(),
}))

describe('MobileAdminSettings', () => {
  beforeEach(() => {
    mobileAdmin.getStatus.mockResolvedValue({
      enabled: false,
      running: false,
      port: 8765,
      localAddress: null,
      hostname: null,
      error: null,
    })
    mobileAdmin.setEnabled.mockResolvedValue({
      enabled: true,
      running: true,
      port: 8765,
      localAddress: 'http://192.168.1.50:8765',
      hostname: null,
      error: null,
    })
    mobileAdmin.listDevices.mockResolvedValue([])
  })

  it('mantiene el acceso LAN desactivado hasta que el usuario lo permite', async () => {
    const user = userEvent.setup()
    render(<MobileAdminSettings />)

    const toggle = await screen.findByRole('switch', { name: /permitir administración/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: /vincular un móvil/i })).toBeDisabled()

    await user.click(toggle)

    expect(mobileAdmin.setEnabled).toHaveBeenCalledWith(true)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByText('http://192.168.1.50:8765')).toBeInTheDocument()
  })
})
