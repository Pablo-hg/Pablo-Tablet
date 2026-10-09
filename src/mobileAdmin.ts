import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface MobileAdminStatus {
  enabled: boolean
  running: boolean
  port: number
  localAddress: string | null
  hostname: string | null
  networkGeneration: number
  error: string | null
}

export interface PairingSession {
  id: string
  url: string
  expiresAt: number
  networkGeneration: number
}

export interface PairingRequest {
  id: string
  deviceName: string
  userAgent: string
  status: 'pending'
  createdAt: number
  expiresAt: number
}

export interface AuthorizedDevice {
  id: string
  name: string
  userAgent: string
  createdAt: number
  lastSeenAt: number
  revokedAt: number | null
}

interface MobileAdminPlugin {
  getStatus(): Promise<MobileAdminStatus>
  setEnabled(options: { enabled: boolean }): Promise<MobileAdminStatus>
  createPairing(): Promise<PairingSession>
  cancelPairing(options: { id: string }): Promise<void>
  listPendingRequests(): Promise<{ requests: PairingRequest[] }>
  approveRequest(options: { id: string }): Promise<void>
  rejectRequest(options: { id: string }): Promise<void>
  listDevices(): Promise<{ devices: AuthorizedDevice[] }>
  renameDevice(options: { id: string; name: string }): Promise<void>
  revokeDevice(options: { id: string }): Promise<void>
  revokeAllDevices(): Promise<{ revokedCount: number }>
  addListener(eventName: 'statusChanged', listener: (status: MobileAdminStatus) => void): Promise<PluginListenerHandle>
}

const NativeMobileAdmin = registerPlugin<MobileAdminPlugin>('MobileAdmin')

export function supportsMobileAdmin() {
  return Capacitor.isNativePlatform()
}

export async function getMobileAdminStatus(): Promise<MobileAdminStatus> {
  if (!supportsMobileAdmin()) return { enabled: false, running: false, port: 8765, localAddress: null, hostname: null, networkGeneration: 0, error: 'Disponible al ejecutar la app Android.' }
  return NativeMobileAdmin.getStatus()
}

export async function addMobileAdminStatusListener(listener: (status: MobileAdminStatus) => void): Promise<PluginListenerHandle> {
  if (!supportsMobileAdmin()) return { remove: async () => undefined }
  return NativeMobileAdmin.addListener('statusChanged', listener)
}

export async function setMobileAdminEnabled(enabled: boolean): Promise<MobileAdminStatus> {
  if (!supportsMobileAdmin()) return getMobileAdminStatus()
  return NativeMobileAdmin.setEnabled({ enabled })
}

export async function createMobilePairing() {
  if (!supportsMobileAdmin()) throw new Error('El emparejamiento solo está disponible en la tablet Android.')
  return NativeMobileAdmin.createPairing()
}

export async function cancelMobilePairing(id: string) {
  if (supportsMobileAdmin()) await NativeMobileAdmin.cancelPairing({ id })
}

export async function listPendingPairingRequests() {
  if (!supportsMobileAdmin()) return []
  return (await NativeMobileAdmin.listPendingRequests()).requests
}

export async function decidePairingRequest(id: string, approved: boolean) {
  if (!supportsMobileAdmin()) return
  if (approved) await NativeMobileAdmin.approveRequest({ id })
  else await NativeMobileAdmin.rejectRequest({ id })
}

export async function listAuthorizedDevices() {
  if (!supportsMobileAdmin()) return []
  return (await NativeMobileAdmin.listDevices()).devices
}

export async function renameAuthorizedDevice(id: string, name: string) {
  await NativeMobileAdmin.renameDevice({ id, name })
}

export async function revokeAuthorizedDevice(id: string) {
  await NativeMobileAdmin.revokeDevice({ id })
}

export async function revokeAllAuthorizedDevices() {
  if (!supportsMobileAdmin()) return 0
  return (await NativeMobileAdmin.revokeAllDevices()).revokedCount
}
