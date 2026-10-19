import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { tx } from './i18n'

export interface InstalledAppVersion {
  currentVersionName: string
  currentVersionCode: number
}

export interface AppUpdateInfo {
  currentVersionName: string
  currentVersionCode: number
  releaseAvailable: boolean
  updateAvailable: boolean
  latestVersionName: string | null
  releaseName: string | null
  releaseNotes: string | null
  publishedAt: string | null
  downloadUrl: string | null
  sha256: string | null
  assetName: string | null
  assetSize: number | null
}

export interface AppUpdateDownloadResult {
  readyToInstall: boolean
  assetName: string
  bytesDownloaded: number
}

export interface AppUpdateProgress {
  phase: 'downloading' | 'verifying' | 'ready'
  bytesDownloaded: number
  totalBytes: number | null
  percent: number | null
}

export interface AppUpdateInstallResult {
  permissionRequired: boolean
  installerOpened: boolean
}

interface AppUpdaterPlugin {
  getInstalledVersion(): Promise<InstalledAppVersion>
  checkForUpdate(): Promise<AppUpdateInfo>
  downloadUpdate(options: { downloadUrl: string; sha256: string; assetName: string }): Promise<AppUpdateDownloadResult>
  installDownloadedUpdate(): Promise<AppUpdateInstallResult>
  addListener(eventName: 'downloadProgress', listener: (progress: AppUpdateProgress) => void): Promise<PluginListenerHandle>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

const WEB_SIMULATION_VERSION_KEY = 'pablo-tablet.simulated-installed-version'
const SIMULATED_PREVIOUS_VERSION = '0.3.7'
const SIMULATED_LATEST_VERSION = '0.4.1'
const SIMULATED_VERSION_CODE = 1041
const SIMULATED_ASSET_SIZE = 3_463_652
const simulatedReleaseNotes = () => [
  tx('Notas con modos de texto, dibujo y lista interactiva reordenable.'),
  tx('Festivos separados de las citas y eventos personales de Tu agenda.'),
  tx('Fila Todo el día en la vista horaria y próximos festivos configurables.'),
  tx('Indicador del dock animado al navegar entre páginas adyacentes.'),
].join('\n')

function simulatedStartingVersion() {
  if (typeof window === 'undefined' || !import.meta.env.DEV || Capacitor.getPlatform() !== 'web') return null
  return new URLSearchParams(window.location.search).get('simulate-update')
}

function simulatedInstalledVersion() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(WEB_SIMULATION_VERSION_KEY) ?? simulatedStartingVersion()
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

const webStatus: AppUpdateInfo = {
  currentVersionName: 'web',
  currentVersionCode: 0,
  releaseAvailable: false,
  updateAvailable: false,
  latestVersionName: null,
  releaseName: null,
  releaseNotes: null,
  publishedAt: null,
  downloadUrl: null,
  sha256: null,
  assetName: null,
  assetSize: null,
}

export function appUpdatesSupported() {
  return Capacitor.getPlatform() === 'android' || webUpdateSimulationEnabled()
}

export function webUpdateSimulationEnabled() {
  return simulatedStartingVersion() !== null
}

export function confirmSimulatedWebInstallation(version: string) {
  if (!webUpdateSimulationEnabled()) return
  window.localStorage.setItem(WEB_SIMULATION_VERSION_KEY, version)
}

export function resetSimulatedWebInstallation() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(WEB_SIMULATION_VERSION_KEY)
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  if (webUpdateSimulationEnabled()) {
    const currentVersionName = simulatedInstalledVersion() ?? SIMULATED_PREVIOUS_VERSION
    const updateAvailable = currentVersionName !== SIMULATED_LATEST_VERSION
    return {
      currentVersionName,
      currentVersionCode: updateAvailable ? 1037 : SIMULATED_VERSION_CODE,
      releaseAvailable: true,
      updateAvailable,
      latestVersionName: SIMULATED_LATEST_VERSION,
      releaseName: 'Pablo Tablet 0.4.1',
      releaseNotes: simulatedReleaseNotes(),
      publishedAt: '2026-10-19T00:00:00Z',
      downloadUrl: 'https://github.com/Pablo-hg/Pablo-Tablet/releases/download/v0.4.1/Pablo-Tablet-0.4.1.apk',
      sha256: 'simulation-only',
      assetName: 'Pablo-Tablet-0.4.1.apk',
      assetSize: SIMULATED_ASSET_SIZE,
    }
  }
  if (!appUpdatesSupported()) return webStatus
  return AppUpdater.checkForUpdate()
}

export async function getInstalledAppVersion(): Promise<InstalledAppVersion> {
  if (webUpdateSimulationEnabled()) {
    const currentVersionName = simulatedInstalledVersion() ?? SIMULATED_PREVIOUS_VERSION
    return { currentVersionName, currentVersionCode: currentVersionName === SIMULATED_LATEST_VERSION ? SIMULATED_VERSION_CODE : 1037 }
  }
  if (!appUpdatesSupported()) return { currentVersionName: 'web', currentVersionCode: 0 }
  return AppUpdater.getInstalledVersion()
}

export async function downloadAppUpdate(
  update: AppUpdateInfo,
  onProgress?: (progress: AppUpdateProgress) => void,
): Promise<AppUpdateDownloadResult> {
  if (webUpdateSimulationEnabled()) {
    const totalBytes = update.assetSize ?? SIMULATED_ASSET_SIZE
    for (const percent of [12, 28, 47, 69, 86, 100]) {
      await wait(220)
      onProgress?.({ phase: 'downloading', bytesDownloaded: Math.round(totalBytes * percent / 100), totalBytes, percent })
    }
    onProgress?.({ phase: 'verifying', bytesDownloaded: totalBytes, totalBytes, percent: 100 })
    await wait(700)
    onProgress?.({ phase: 'ready', bytesDownloaded: totalBytes, totalBytes, percent: 100 })
    return { readyToInstall: true, assetName: update.assetName ?? 'Pablo-Tablet-0.4.1.apk', bytesDownloaded: totalBytes }
  }
  if (!appUpdatesSupported()) throw new Error('Las actualizaciones solo se pueden instalar desde la tablet Android.')
  if (!update.downloadUrl || !update.sha256 || !update.assetName) throw new Error('La Release no contiene un APK verificable.')
  const listener = onProgress ? await AppUpdater.addListener('downloadProgress', onProgress) : null
  try {
    return await AppUpdater.downloadUpdate({ downloadUrl: update.downloadUrl, sha256: update.sha256, assetName: update.assetName })
  } finally {
    await listener?.remove()
  }
}

export async function installDownloadedAppUpdate(): Promise<AppUpdateInstallResult> {
  if (webUpdateSimulationEnabled()) return { permissionRequired: false, installerOpened: true }
  if (!appUpdatesSupported()) throw new Error('Las actualizaciones solo se pueden instalar desde la tablet Android.')
  return AppUpdater.installDownloadedUpdate()
}
