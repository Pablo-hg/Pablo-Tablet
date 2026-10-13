import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationSettings } from '../components/settings/NotificationSettings'

const permissions = vi.hoisted(() => ({
  check: vi.fn(),
  requestDisplay: vi.fn(),
  openExact: vi.fn(),
}))

vi.mock('../notificationPermissions', () => ({
  checkNotificationPermissionStatus: permissions.check,
  requestNotificationDisplayPermission: permissions.requestDisplay,
  openExactAlarmSettings: permissions.openExact,
}))

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.requestDisplay.mockResolvedValue('granted')
    permissions.openExact.mockResolvedValue('granted')
  })

  it('explica cómo recuperar un permiso denegado', async () => {
    permissions.check.mockResolvedValue({ supported: true, display: 'denied', exactAlarm: 'unsupported' })

    render(<NotificationSettings />)

    expect(await screen.findByText('Notificaciones desactivadas')).toBeInTheDocument()
    expect(screen.getByText(/Ajustes de Android.*Pablo Tablet.*Notificaciones/i)).toBeInTheDocument()
    expect(permissions.requestDisplay).not.toHaveBeenCalled()
  })

  it('solicita el permiso sólo después de una acción del usuario', async () => {
    permissions.check
      .mockResolvedValueOnce({ supported: true, display: 'prompt', exactAlarm: 'unsupported' })
      .mockResolvedValueOnce({ supported: true, display: 'granted', exactAlarm: 'granted' })
    const user = userEvent.setup()

    render(<NotificationSettings />)
    const action = await screen.findByRole('button', { name: /Notificaciones desactivadas/i })
    expect(permissions.requestDisplay).not.toHaveBeenCalled()

    await user.click(action)

    expect(permissions.requestDisplay).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('Notificaciones preparadas')).toBeInTheDocument())
  })

  it('ofrece abrir el permiso de alarmas exactas cuando falta', async () => {
    permissions.check
      .mockResolvedValueOnce({ supported: true, display: 'granted', exactAlarm: 'denied' })
      .mockResolvedValueOnce({ supported: true, display: 'granted', exactAlarm: 'granted' })
    const user = userEvent.setup()

    render(<NotificationSettings />)
    await user.click(await screen.findByRole('button', { name: /Permitir alarmas exactas/i }))

    expect(permissions.openExact).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('Notificaciones preparadas')).toBeInTheDocument())
  })
})
