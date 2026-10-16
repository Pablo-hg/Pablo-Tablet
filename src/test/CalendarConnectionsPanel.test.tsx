import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarConnectionsPanel } from '../calendarSync/CalendarConnectionsPanel'
import type { CalendarAccount } from '../calendarSync/contracts'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') } }))
vi.mock('../calendarSync/relayClient', () => ({ calendarRelay: {
  beginConnection: vi.fn().mockResolvedValue({ id: 'test', provider: 'outlook', authorizationUrl: 'https://example.invalid', pollToken: 'test', expiresAt: '2026-10-14T18:30:00Z' }),
  getConnection: vi.fn().mockResolvedValue({ state: 'pending' }),
} }))

const account: CalendarAccount = { id: 'google-test', provider: 'google', email: 'cuenta.con.nombre.largo@example.com', displayName: 'Prueba', enabled: true, status: 'connected', lastSyncedAt: '2026-10-14T18:10:00Z', error: null }
const callbacks = () => ({ onConnected: vi.fn(), onSync: vi.fn(), onDisconnect: vi.fn(), onCalendarVisibilityChange: vi.fn() })

describe('panel de cuentas del calendario', () => {
  it('muestra identidad y última sincronización por separado y conserva las acciones', () => {
    const handlers = callbacks()
    render(<CalendarConnectionsPanel accounts={[account]} calendars={[]} {...handlers} />)
    expect(screen.getByText(account.email)).toBeVisible()
    expect(screen.getByText(/Última sincronización:/)).toBeVisible()
    expect(screen.queryByText('Local activo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }))
    expect(handlers.onSync).toHaveBeenCalledWith(account.id)
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Google' }))
    expect(handlers.onDisconnect).toHaveBeenCalledWith(account.id)
  })

  it('deshabilita sincronizar durante la sincronización y muestra errores completos', () => {
    render(<CalendarConnectionsPanel accounts={[{ ...account, status: 'syncing', error: 'No se pudo sincronizar. Inténtalo de nuevo.' }]} calendars={[]} {...callbacks()} />)
    expect(screen.getByRole('button', { name: 'Sincronizar' })).toBeDisabled()
    expect(screen.getByText('No se pudo sincronizar. Inténtalo de nuevo.')).toBeVisible()
  })

  it('conserva los nombres largos y la selección de calendarios', () => {
    const handlers = callbacks()
    const name = 'Calendario familiar con un nombre largo para comprobar su visualización'
    render(<CalendarConnectionsPanel accounts={[account]} calendars={[{ id: 'calendar-1', accountId: account.id, provider: 'google', remoteId: 'primary', name, color: 'mint', visible: true, readOnly: false }]} {...handlers} />)
    fireEvent.click(screen.getByRole('checkbox', { name: `${name} Google` }))
    expect(handlers.onCalendarVisibilityChange).toHaveBeenCalledWith('calendar-1', false)
  })

  it('abre el QR y permite cerrar la ventana sin desconectar cuentas', async () => {
    const handlers = callbacks()
    render(<CalendarConnectionsPanel accounts={[account]} calendars={[]} {...handlers} />)
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }))
    expect(await screen.findByRole('dialog', { name: 'Conectar Outlook' })).toBeVisible()
    expect(await screen.findByRole('img', { name: 'Código QR de conexión' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(handlers.onDisconnect).not.toHaveBeenCalled()
  })
})
