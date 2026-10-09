import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileAdminSettings } from '../MobileAdminSettings'

const mobileAdmin = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setEnabled: vi.fn(),
  listDevices: vi.fn(),
  createPairing: vi.fn(),
  cancelPairing: vi.fn(),
}))

vi.mock('../mobileAdmin', () => ({
  getMobileAdminStatus: mobileAdmin.getStatus,
  setMobileAdminEnabled: mobileAdmin.setEnabled,
  listAuthorizedDevices: mobileAdmin.listDevices,
  cancelMobilePairing: mobileAdmin.cancelPairing,
  createMobilePairing: mobileAdmin.createPairing,
  decidePairingRequest: vi.fn(),
  listPendingPairingRequests: vi.fn().mockResolvedValue([]),
  renameAuthorizedDevice: vi.fn(),
  revokeAuthorizedDevice: vi.fn(),
}))

describe('MobileAdminSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mobileAdmin.createPairing.mockResolvedValue({ id: 'pair-1', url: 'http://192.168.1.50:8765/?pair=token', expiresAt: Date.now() + 300_000 })
    mobileAdmin.cancelPairing.mockResolvedValue(undefined)
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

  it('cancela el QR activo al desactivar el acceso y permite volver a activarlo', async () => {
    mobileAdmin.getStatus.mockResolvedValue({
      enabled: true,
      running: true,
      port: 8765,
      localAddress: 'http://192.168.1.50:8765',
      hostname: null,
      error: null,
    })
    mobileAdmin.setEnabled
      .mockResolvedValueOnce({ enabled: false, running: false, port: 8765, localAddress: null, hostname: null, error: null })
      .mockResolvedValueOnce({ enabled: true, running: true, port: 8765, localAddress: 'http://192.168.1.50:8765', hostname: null, error: null })

    const user = userEvent.setup()
    render(<MobileAdminSettings />)

    await user.click(await screen.findByRole('button', { name: /vincular un móvil/i }))
    expect(await screen.findByText('Escanea este QR')).toBeInTheDocument()

    const toggle = screen.getByRole('switch', { name: /permitir administración/i })
    await user.click(toggle)
    expect(mobileAdmin.cancelPairing).toHaveBeenCalledWith('pair-1')
    expect(mobileAdmin.setEnabled).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.getByText('Acceso desde la red desactivado')).toBeInTheDocument())

    await user.click(toggle)
    expect(mobileAdmin.setEnabled).toHaveBeenLastCalledWith(true)
    await waitFor(() => expect(screen.getByText('Servidor local activo')).toBeInTheDocument())
  })

  it('diferencia un error de arranque de la desactivación elegida por el usuario', async () => {
    mobileAdmin.getStatus.mockResolvedValue({
      enabled: true,
      running: false,
      port: 8765,
      localAddress: null,
      hostname: null,
      error: 'No se pudo abrir el puerto local.',
    })

    render(<MobileAdminSettings />)

    expect(await screen.findByText('Servidor no disponible')).toBeInTheDocument()
    expect(screen.getByText('No se pudo abrir el puerto local.')).toBeInTheDocument()
    expect(screen.queryByText('Acceso desde la red desactivado')).not.toBeInTheDocument()
  })
})
