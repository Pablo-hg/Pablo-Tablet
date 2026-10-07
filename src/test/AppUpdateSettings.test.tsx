import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppUpdateSettings } from '../components/settings/AppUpdateSettings'

const updater = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  downloadAppUpdate: vi.fn(),
  getInstalledAppVersion: vi.fn(),
  installDownloadedAppUpdate: vi.fn(),
}))

vi.mock('../appUpdater', () => ({
  appUpdatesSupported: () => true,
  checkForAppUpdate: updater.checkForAppUpdate,
  downloadAppUpdate: updater.downloadAppUpdate,
  getInstalledAppVersion: updater.getInstalledAppVersion,
  installDownloadedAppUpdate: updater.installDownloadedAppUpdate,
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
    updater.checkForAppUpdate.mockReset().mockResolvedValue(availableUpdate)
    updater.downloadAppUpdate.mockReset().mockImplementation(async (_update, onProgress) => {
      onProgress?.({ phase: 'downloading', bytesDownloaded: 5 * 1024 * 1024, totalBytes: 10 * 1024 * 1024, percent: 50 })
      onProgress?.({ phase: 'verifying', bytesDownloaded: 10 * 1024 * 1024, totalBytes: 10 * 1024 * 1024, percent: 100 })
      onProgress?.({ phase: 'ready', bytesDownloaded: 10 * 1024 * 1024, totalBytes: 10 * 1024 * 1024, percent: 100 })
      return { readyToInstall: true, assetName: availableUpdate.assetName, bytesDownloaded: availableUpdate.assetSize }
    })
    updater.getInstalledAppVersion.mockReset().mockResolvedValue({ currentVersionName: '0.2.0', currentVersionCode: 1001 })
    updater.installDownloadedAppUpdate.mockReset().mockResolvedValue({ permissionRequired: false, installerOpened: true })
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
})
