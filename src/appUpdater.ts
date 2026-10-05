import { Capacitor, registerPlugin } from '@capacitor/core'

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

export interface AppUpdateInstallResult {
  permissionRequired: boolean
  installerOpened: boolean
}

interface AppUpdaterPlugin {
  checkForUpdate(): Promise<AppUpdateInfo>
  downloadUpdate(options: { downloadUrl: string; sha256: string; assetName: string }): Promise<AppUpdateDownloadResult>
  installDownloadedUpdate(): Promise<AppUpdateInstallResult>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

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
  return Capacitor.getPlatform() === 'android'
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  if (!appUpdatesSupported()) return webStatus
  return AppUpdater.checkForUpdate()
}

export async function downloadAppUpdate(update: AppUpdateInfo): Promise<AppUpdateDownloadResult> {
  if (!appUpdatesSupported()) throw new Error('Las actualizaciones solo se pueden instalar desde la tablet Android.')
  if (!update.downloadUrl || !update.sha256 || !update.assetName) throw new Error('La Release no contiene un APK verificable.')
  return AppUpdater.downloadUpdate({ downloadUrl: update.downloadUrl, sha256: update.sha256, assetName: update.assetName })
}

export async function installDownloadedAppUpdate(): Promise<AppUpdateInstallResult> {
  if (!appUpdatesSupported()) throw new Error('Las actualizaciones solo se pueden instalar desde la tablet Android.')
  return AppUpdater.installDownloadedUpdate()
}
