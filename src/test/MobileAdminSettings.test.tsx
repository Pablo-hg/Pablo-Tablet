import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileAdminSettings } from '../MobileAdminSettings'

const mobileAdmin = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setEnabled: vi.fn(),
  listDevices: vi.fn(),
  createPairing: vi.fn(),
  cancelPairing: vi.fn(),
  revokeAll: vi.fn(),
  addStatusListener: vi.fn(),
  removeStatusListener: vi.fn(),
  statusListener: null as null | ((status: Record<string, unknown>) => void),
}))

vi.mock('../mobileAdmin', () => ({
  getMobileAdminStatus: mobileAdmin.getStatus,
  setMobileAdminEnabled: mobileAdmin.setEnabled,
  listAuthorizedDevices: mobileAdmin.listDevices,
  cancelMobilePairing: mobileAdmin.cancelPairing,
  createMobilePairing: mobileAdmin.createPairing,
  addMobileAdminStatusListener: mobileAdmin.addStatusListener,
  decidePairingRequest: vi.fn(),
  listPendingPairingRequests: vi.fn().mockResolvedValue([]),
  renameAuthorizedDevice: vi.fn(),
  revokeAuthorizedDevice: vi.fn(),
  revokeAllAuthorizedDevices: mobileAdmin.revokeAll,
}))

describe('MobileAdminSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mobileAdmin.statusListener = null
    mobileAdmin.addStatusListener.mockImplementation(async (listener) => {
      mobileAdmin.statusListener = listener
      return { remove: mobileAdmin.removeStatusListener }
    })
    mobileAdmin.getStatus.mockResolvedValue({
      enabled: false,
      running: false,
      port: 8765,
      localAddress: null,
      hostname: null,
      networkGeneration: 0,
      error: null,
      serviceState: 'disabled',
    })
    mobileAdmin.setEnabled.mockResolvedValue({
      enabled: true,
      running: true,
      port: 8765,
      localAddress: 'http://192.168.1.50:8765',
      hostname: null,
      networkGeneration: 1,
      error: null,
      serviceState: 'available',
    })
    mobileAdmin.listDevices.mockResolvedValue([])
    mobileAdmin.createPairing.mockResolvedValue({ id: 'pair-1', url: 'http://192.168.1.50:8765/?pair=token', expiresAt: Date.now() + 300_000, networkGeneration: 1 })
    mobileAdmin.cancelPairing.mockResolvedValue(undefined)
    mobileAdmin.revokeAll.mockResolvedValue(0)
  })

  it('mantiene el acceso LAN desactivado hasta que el usuario lo permite', async () => {
    const user = userEvent.setup()
    render(<MobileAdminSettings />)

    const toggle = await screen.findByRole('switch', { name: /permitir administración/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: /vincular un móvil/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /revocar todos/i })).not.toBeInTheDocument()

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
      networkGeneration: 1,
      error: null,
      serviceState: 'available',
    })
    mobileAdmin.setEnabled
      .mockResolvedValueOnce({ enabled: false, running: false, port: 8765, localAddress: null, hostname: null, networkGeneration: 2, error: null, serviceState: 'disabled' })
      .mockResolvedValueOnce({ enabled: true, running: true, port: 8765, localAddress: 'http://192.168.1.50:8765', hostname: null, networkGeneration: 3, error: null, serviceState: 'available' })

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
      networkGeneration: 1,
      error: 'No se pudo abrir el puerto local.',
      serviceState: 'error',
    })

    render(<MobileAdminSettings />)

    expect(await screen.findByText('Servidor no disponible')).toBeInTheDocument()
    expect(screen.getByText('No se pudo abrir el puerto local.')).toBeInTheDocument()
    expect(screen.queryByText('Acceso desde la red desactivado')).not.toBeInTheDocument()
  })

  it('muestra el estado de arranque mientras el servicio recuperable se inicia', async () => {
    mobileAdmin.getStatus.mockResolvedValue({
      enabled: true,
      running: false,
      port: 8765,
      localAddress: null,
      hostname: null,
      networkGeneration: 1,
      error: null,
      serviceState: 'starting',
    })

    render(<MobileAdminSettings />)

    expect(await screen.findByText('Iniciando servidor local…')).toBeInTheDocument()
  })

  it('actualiza la dirección e invalida automáticamente un QR de la red anterior', async () => {
    mobileAdmin.getStatus.mockResolvedValue({
      enabled: true,
      running: true,
      port: 8765,
      localAddress: 'http://192.168.1.50:8765',
      hostname: null,
      networkGeneration: 1,
      error: null,
      serviceState: 'available',
    })

    const user = userEvent.setup()
    render(<MobileAdminSettings />)
    await user.click(await screen.findByRole('button', { name: /vincular un móvil/i }))
    expect(await screen.findByText('Escanea este QR')).toBeInTheDocument()
    await waitFor(() => expect(mobileAdmin.statusListener).not.toBeNull())

    act(() => {
      mobileAdmin.statusListener?.({
        enabled: true,
        running: true,
        port: 8765,
        localAddress: 'http://192.168.1.77:8765',
        hostname: null,
        networkGeneration: 2,
        error: null,
        serviceState: 'available',
      })
    })

    expect(await screen.findByText('http://192.168.1.77:8765')).toBeInTheDocument()
    expect(screen.queryByText('Escanea este QR')).not.toBeInTheDocument()
    expect(screen.getByText(/el QR anterior ya no es válido/i)).toBeInTheDocument()
    await waitFor(() => expect(mobileAdmin.cancelPairing).toHaveBeenCalledWith('pair-1'))
  })

  it('cancela la revocación global sin hacer cambios', async () => {
    mobileAdmin.listDevices.mockResolvedValue([{ id: 'device-1', name: 'Móvil personal', userAgent: 'Chrome', createdAt: 1, lastSeenAt: 2, revokedAt: null }])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<MobileAdminSettings />)

    await user.click(await screen.findByRole('button', { name: /revocar todos los dispositivos/i }))

    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/todos los móviles tendrán que volver a vincularse/i))
    expect(mobileAdmin.revokeAll).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('revoca todos los móviles en una sola operación y actualiza la lista', async () => {
    mobileAdmin.listDevices
      .mockResolvedValueOnce([
        { id: 'device-1', name: 'Móvil personal', userAgent: 'Chrome', createdAt: 1, lastSeenAt: 2, revokedAt: null },
        { id: 'device-2', name: 'Móvil familiar', userAgent: 'Safari', createdAt: 1, lastSeenAt: 2, revokedAt: null },
      ])
      .mockResolvedValueOnce([])
    mobileAdmin.revokeAll.mockResolvedValue(2)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<MobileAdminSettings />)

    await user.click(await screen.findByRole('button', { name: /revocar todos los dispositivos/i }))

    await waitFor(() => expect(mobileAdmin.revokeAll).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Se han revocado 2 dispositivos. Tendrán que volver a vincularse.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revocar todos los dispositivos/i })).not.toBeInTheDocument()
    confirm.mockRestore()
  })
})
