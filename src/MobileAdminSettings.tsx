import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Link2, Pencil, RefreshCw, ShieldCheck, Smartphone, Unlink, Wifi, X } from 'lucide-react'
import {
  cancelMobilePairing,
  createMobilePairing,
  decidePairingRequest,
  addMobileAdminStatusListener,
  getMobileAdminStatus,
  listAuthorizedDevices,
  listPendingPairingRequests,
  renameAuthorizedDevice,
  revokeAllAuthorizedDevices,
  revokeAuthorizedDevice,
  setMobileAdminEnabled,
  type AuthorizedDevice,
  type MobileAdminStatus,
  type PairingRequest,
  type PairingSession,
} from './mobileAdmin'

const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

export function MobileAdminSettings() {
  const [status, setStatus] = useState<MobileAdminStatus | null>(null)
  const [pairing, setPairing] = useState<PairingSession | null>(null)
  const [pairingQr, setPairingQr] = useState<string | null>(null)
  const [requests, setRequests] = useState<PairingRequest[]>([])
  const [devices, setDevices] = useState<AuthorizedDevice[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [now, setNow] = useState(() => new Date().getTime())
  const pairingRef = useRef<PairingSession | null>(null)

  const storePairing = useCallback((nextPairing: PairingSession | null) => {
    pairingRef.current = nextPairing
    setPairing(nextPairing)
  }, [])

  const applyStatus = useCallback((nextStatus: MobileAdminStatus) => {
    const currentPairing = pairingRef.current
    if (currentPairing && currentPairing.networkGeneration !== nextStatus.networkGeneration) {
      void cancelMobilePairing(currentPairing.id)
      storePairing(null)
      setPairingQr(null)
      setRequests([])
      setMessage('La Wi-Fi o la dirección IP han cambiado. El QR anterior ya no es válido; genera uno nuevo.')
    }
    setStatus(nextStatus)
  }, [storePairing])

  const refresh = useCallback(async () => {
    const [nextStatus, nextDevices] = await Promise.all([getMobileAdminStatus(), listAuthorizedDevices()])
    applyStatus(nextStatus)
    setDevices(nextDevices)
  }, [applyStatus])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh().catch((error) => setMessage(error instanceof Error ? error.message : 'No se pudo consultar el servidor local.'))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refresh])

  useEffect(() => {
    let active = true
    let removeListener: (() => Promise<void>) | undefined
    void addMobileAdminStatusListener((nextStatus) => {
      if (active) applyStatus(nextStatus)
    }).then((handle) => {
      if (!active) void handle.remove()
      else removeListener = () => handle.remove()
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'No se pudieron observar los cambios de red.')
    })
    return () => {
      active = false
      if (removeListener) void removeListener()
    }
  }, [applyStatus])

  useEffect(() => {
    if (!pairing) return
    let cancelled = false
    const update = async () => {
      try {
        const nextRequests = await listPendingPairingRequests()
        if (!cancelled) setRequests(nextRequests)
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'No se pudieron consultar las solicitudes.')
      }
    }
    void update()
    const interval = window.setInterval(() => {
      const currentTime = new Date().getTime()
      setNow(currentTime)
      if (currentTime >= pairing.expiresAt) {
        storePairing(null)
        setRequests([])
        setMessage('El QR ha caducado. Genera uno nuevo para vincular otro móvil.')
        return
      }
      void update()
    }, 1_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [pairing, storePairing])

  useEffect(() => {
    if (!pairing) return
    let cancelled = false
    void QRCode.toDataURL(pairing.url, { width: 360, margin: 2, color: { dark: '#10142c', light: '#ffffff' } })
      .then((value) => { if (!cancelled) setPairingQr(value) })
      .catch(() => { if (!cancelled) setMessage('No se pudo dibujar el QR.') })
    return () => { cancelled = true }
  }, [pairing])

  useEffect(() => () => {
    if (pairingRef.current) void cancelMobilePairing(pairingRef.current.id)
  }, [])

  const remainingSeconds = useMemo(() => pairing ? Math.max(0, Math.ceil((pairing.expiresAt - now) / 1_000)) : 0, [now, pairing])

  const startPairing = async () => {
    setBusy(true)
    setMessage(null)
    try {
      if (pairing) await cancelMobilePairing(pairing.id)
      storePairing(await createMobilePairing())
      setPairingQr(null)
      setRequests([])
      setNow(new Date().getTime())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar la vinculación.')
    } finally {
      setBusy(false)
    }
  }

  const toggleAccess = async () => {
    if (!status) return
    setBusy(true)
    setMessage(null)
    try {
      if (status.enabled && pairing) await closePairing()
      applyStatus(await setMobileAdminEnabled(!status.enabled))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el acceso desde la red local.')
    } finally {
      setBusy(false)
    }
  }

  const closePairing = async () => {
    if (pairing) await cancelMobilePairing(pairing.id)
    storePairing(null)
    setPairingQr(null)
    setRequests([])
  }

  const decide = async (request: PairingRequest, approved: boolean) => {
    setBusy(true)
    try {
      await decidePairingRequest(request.id, approved)
      setRequests((current) => current.filter((item) => item.id !== request.id))
      setMessage(approved ? `${request.deviceName} ya está autorizado.` : `Solicitud de ${request.deviceName} rechazada.`)
      if (approved) {
        await refresh()
        storePairing(null)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo responder a la solicitud.')
    } finally {
      setBusy(false)
    }
  }

  const saveName = async (device: AuthorizedDevice) => {
    const name = editingName.trim()
    if (!name) return
    await renameAuthorizedDevice(device.id, name)
    setEditingId(null)
    await refresh()
  }

  const revoke = async (device: AuthorizedDevice) => {
    if (!window.confirm(`¿Revocar el acceso de ${device.name}? Tendrá que volver a vincularse por QR.`)) return
    await revokeAuthorizedDevice(device.id)
    setMessage(`Acceso revocado para ${device.name}.`)
    await refresh()
  }

  const revokeAll = async () => {
    if (!window.confirm('¿Revocar todos los dispositivos autorizados? Todos los móviles tendrán que volver a vincularse mediante un QR nuevo.')) return
    setBusy(true)
    setMessage(null)
    try {
      const revokedCount = await revokeAllAuthorizedDevices()
      storePairing(null)
      setPairingQr(null)
      setRequests([])
      setEditingId(null)
      await refresh()
      setMessage(revokedCount === 1 ? 'Se ha revocado 1 dispositivo. Tendrá que volver a vincularse.' : `Se han revocado ${revokedCount} dispositivos. Tendrán que volver a vincularse.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron revocar los dispositivos autorizados.')
    } finally {
      setBusy(false)
    }
  }

  const activeDevices = devices.filter((device) => device.revokedAt === null)

  return (
    <section className="settings-section mobile-admin-section" data-swipe-block aria-labelledby="mobile-admin-title">
      <div className="section-heading">
        <div><p className="eyebrow">Red local</p><h2 id="mobile-admin-title">Administración móvil</h2></div>
        <Smartphone size={22} />
      </div>

      <button type="button" className="mobile-access-toggle" role="switch" aria-checked={status?.enabled ?? false} disabled={busy || !status} onClick={() => void toggleAccess()}>
        <span><strong>Permitir administración desde otros dispositivos</strong><small>Solo desde la red Wi-Fi privada activa.</small></span>
        <i className={status?.enabled ? 'is-on' : ''} aria-hidden="true"><b /></i>
      </button>

      <div className={`mobile-server-status ${status?.running ? 'is-online' : 'is-offline'}`}>
        <span className="mobile-status-icon"><Wifi size={21} /></span>
        <span><strong>{status?.serviceState === 'available' ? 'Servidor local activo' : status?.serviceState === 'starting' ? 'Iniciando servidor local…' : status?.serviceState === 'error' ? 'Servidor no disponible' : 'Acceso desde la red desactivado'}</strong><small>{status?.localAddress ?? (status?.enabled ? 'Esperando una Wi-Fi privada…' : 'La tablet sigue funcionando con sus datos locales.')}</small></span>
        <button type="button" className="icon-button" onClick={() => void refresh()} aria-label="Actualizar servidor"><RefreshCw size={17} /></button>
      </div>
      <p className="settings-help">El móvil debe estar conectado a la misma Wi‑Fi. Si no puede abrir la dirección, comprueba que la red no aísle unos dispositivos de otros. Los datos y las fotos siguen guardándose únicamente en esta tablet.</p>
      {status?.error ? <p className="mobile-admin-message is-error">{status.error}</p> : null}
      {message ? <p className="mobile-admin-message">{message}</p> : null}

      {!pairing ? (
        <button type="button" className="mobile-pair-button" disabled={busy || !status?.running || !status.localAddress} onClick={() => void startPairing()}>
          <Link2 size={19} />Vincular un móvil
        </button>
      ) : (
        <div className="pairing-panel">
          <div className="pairing-panel-header"><div><strong>Escanea este QR</strong><small>Caduca en {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</small></div><button type="button" className="icon-button" onClick={() => void closePairing()} aria-label="Cerrar QR"><X size={18} /></button></div>
          {pairingQr ? <img src={pairingQr} alt="QR temporal para vincular un móvil" className="pairing-qr" /> : <div className="pairing-qr-placeholder">Preparando QR…</div>}
          <code className="pairing-address">{pairing.url}</code>
          <p>Después de escanearlo, confirma aquí la solicitud que aparezca.</p>
        </div>
      )}

      {requests.map((request) => (
        <div className="pairing-request" key={request.id} role="alertdialog" aria-label={`Autorizar ${request.deviceName}`}>
          <span className="mobile-status-icon"><ShieldCheck size={21} /></span>
          <div><strong>{request.deviceName}</strong><small>{request.userAgent}</small><small>Solicitado a las {timeFormatter.format(request.createdAt)}</small></div>
          <div className="pairing-request-actions"><button type="button" onClick={() => void decide(request, false)} disabled={busy}><X size={16} />Rechazar</button><button type="button" className="is-primary" onClick={() => void decide(request, true)} disabled={busy}><Check size={16} />Permitir</button></div>
        </div>
      ))}

      <div className="authorized-devices-heading"><strong>Dispositivos autorizados</strong><span>{activeDevices.length}</span></div>
      {activeDevices.length === 0 ? <p className="empty-mobile-devices">Todavía no hay móviles vinculados.</p> : activeDevices.map((device) => (
        <div className="authorized-device" key={device.id}>
          <Smartphone size={19} />
          <div className="authorized-device-copy">
            {editingId === device.id ? <input value={editingName} maxLength={60} onChange={(event) => setEditingName(event.target.value)} aria-label="Nombre del dispositivo" /> : <strong>{device.name}</strong>}
            <small>Último acceso: {new Date(device.lastSeenAt).toLocaleString('es-ES')}</small>
          </div>
          {editingId === device.id ? <button type="button" className="icon-button" onClick={() => void saveName(device)} aria-label="Guardar nombre"><Check size={17} /></button> : <button type="button" className="icon-button" onClick={() => { setEditingId(device.id); setEditingName(device.name) }} aria-label="Cambiar nombre"><Pencil size={16} /></button>}
          <button type="button" className="icon-button is-danger" onClick={() => void revoke(device)} aria-label="Revocar acceso"><Unlink size={17} /></button>
        </div>
      ))}
      {activeDevices.length > 0 ? (
        <button type="button" className="revoke-all-devices" disabled={busy} onClick={() => void revokeAll()}>
          <Unlink size={17} />Revocar todos los dispositivos
        </button>
      ) : null}
    </section>
  )
}
