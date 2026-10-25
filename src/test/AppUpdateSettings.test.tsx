import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppUpdateSettings } from '../components/settings/AppUpdateSettings'

const updater = vi.hoisted(() => ({
  simulated: false,
  checkForAppUpdate: vi.fn(),
  confirmSimulatedWebInstallation: vi.fn(),
  downloadAppUpdate: vi.fn(),
  getInstalledAppVersion: vi.fn(),
  installDownloadedAppUpdate: vi.fn(),
  releaseNotesForInstalledVersion: vi.fn(),
  resetSimulatedWebInstallation: vi.fn(),
}))

vi.mock('../appUpdater', () => ({
  appUpdatesSupported: () => true,
  checkForAppUpdate: updater.checkForAppUpdate,
  confirmSimulatedWebInstallation: updater.confirmSimulatedWebInstallation,
  downloadAppUpdate: updater.downloadAppUpdate,
  getInstalledAppVersion: updater.getInstalledAppVersion,
  installDownloadedAppUpdate: updater.installDownloadedAppUpdate,
  releaseNotesForInstalledVersion: updater.releaseNotesForInstalledVersion,
  releaseNotesForUpdate: (update: { releaseNotes: string | null }) => update.releaseNotes,
  resetSimulatedWebInstallation: updater.resetSimulatedWebInstallation,
  webUpdateSimulationEnabled: () => updater.simulated,
}))

const availableUpdate = {
  currentVersionName: '0.1.0',
  currentVersionCode: 1000,
  releaseAvailable: true,
  updateAvailable: true,
  latestVersionName: '0.2.0',
  releaseName: 'Pablo Tablet 0.2',
  releaseNotes: 'Mejoras visuales y de actualización.',
  publishedAt: '2026-10-07T10:00:00Z',
  downloadUrl: 'https://example.test/Pablo-Tablet-0.2.0.apk',
  sha256: 'a'.repeat(64),
  assetName: 'Pablo-Tablet-0.2.0.apk',
  assetSize: 10 * 1024 * 1024,
}

describe('AppUpdateSettings', () => {
  beforeEach(() => {
    window.localStorage.removeItem('pablo-tablet.pending-update-version')
    window.localStorage.removeItem('pablo-tablet.release-catalog.v2')
    updater.simulated = false
    updater.checkForAppUpdate.mockReset().mockResolvedValue(availableUpdate)
    updater.downloadAppUpdate.mockReset().mockImplementation(async (_update, onProgress) => {
      onProgress?.({ phase: 'downloading', bytesDownloaded: 5 * 1024 * 1024, totalBytes: 10 * 1024 * 1024, percent: 50 })
      onProgress?.({ phase: 'verifying', bytesDownloaded: 10 * 1024 * 1024, totalBytes: 10 * 1024 * 1024, percent: 100 })
      onProgress?.({ phase: 'ready', bytesDownloaded: 10 * 1024 * 1024, totalBytes: 10 * 1024 * 1024, percent: 100 })
      return { readyToInstall: true, assetName: availableUpdate.assetName, bytesDownloaded: availableUpdate.assetSize }
    })
    updater.getInstalledAppVersion.mockReset().mockResolvedValue({ currentVersionName: '0.2.0', currentVersionCode: 1001 })
    updater.installDownloadedAppUpdate.mockReset().mockResolvedValue({ permissionRequired: false, installerOpened: true })
    updater.releaseNotesForInstalledVersion.mockReset().mockImplementation((_update, version) => version === '0.2.0' ? 'Novedades ya instaladas.' : null)
    updater.confirmSimulatedWebInstallation.mockReset()
    updater.resetSimulatedWebInstallation.mockReset()
  })

  it('muestra la versión instalada en la tarjeta sin buscar actualizaciones', async () => {
    render(<AppUpdateSettings />)

    expect(await screen.findByText('Versión instalada: 0.2.0')).toBeInTheDocument()
    expect(updater.getInstalledAppVersion).toHaveBeenCalledTimes(1)
    expect(updater.checkForAppUpdate).not.toHaveBeenCalled()
  })

  it('permite consultar siempre las novedades instaladas y las conserva localmente', async () => {
    const user = userEvent.setup()
    const view = render(<AppUpdateSettings />)

    await screen.findByText('Versión instalada: 0.2.0')
    await user.click(screen.getByText('Novedades de la versión instalada'))

    expect(await screen.findByText('Novedades ya instaladas.')).toBeInTheDocument()
    expect(updater.checkForAppUpdate).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('pablo-tablet.release-catalog.v2')).toContain('0.2.0')

    view.unmount()
    updater.checkForAppUpdate.mockRejectedValue(new Error('Sin conexión'))
    render(<AppUpdateSettings />)
    await screen.findByText('Versión instalada: 0.2.0')
    await user.click(screen.getByText('Novedades de la versión instalada'))

    expect(screen.getByText('Novedades ya instaladas.')).toBeInTheDocument()
    expect(updater.checkForAppUpdate).toHaveBeenCalledTimes(1)
  })

  it('muestra la versión pública y separa descarga e instalación', async () => {
    const user = userEvent.setup()
    render(<AppUpdateSettings />)

    await user.click(screen.getByRole('button', { name: 'Buscar actualizaciones' }))

    expect(await screen.findByText('Versión instalada: 0.1.0')).toBeInTheDocument()
    expect(screen.queryByText(/1000/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Descargar' }))

    expect(await screen.findByText('Descarga completada y verificada. Continúa cuando quieras abrir el instalador de Android.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar con la instalación' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Proceso de actualización' })).toBeInTheDocument()
  })

  it('explica qué debe hacer el usuario cuando se abre Android', async () => {
    const user = userEvent.setup()
    render(<AppUpdateSettings />)

    await user.click(screen.getByRole('button', { name: 'Buscar actualizaciones' }))
    await user.click(await screen.findByRole('button', { name: 'Descargar' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar con la instalación' }))

    expect(await screen.findByText('Instalador abierto. Pulsa “Actualizar” en Android; al volver comprobaremos el resultado.')).toBeInTheDocument()
    expect(window.localStorage.getItem('pablo-tablet.pending-update-version')).toBe('0.2.0')
  })

  it('permite completar en web la instalación simulada y verificar la nueva versión', async () => {
    updater.simulated = true
    const user = userEvent.setup()
    render(<AppUpdateSettings />)

    await user.click(screen.getByRole('button', { name: 'Buscar actualizaciones' }))
    await user.click(await screen.findByRole('button', { name: 'Descargar' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar con la instalación' }))

    expect(screen.getByRole('dialog', { name: '¿Quieres actualizar esta aplicación?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(updater.confirmSimulatedWebInstallation).toHaveBeenCalledWith('0.2.0')

    await user.click(screen.getByRole('button', { name: 'Comprobar instalación' }))
    expect(await screen.findByText('Actualización completada. Versión instalada: 0.2.0.')).toBeInTheDocument()
    expect(updater.installDownloadedAppUpdate).not.toHaveBeenCalled()
  })
})
