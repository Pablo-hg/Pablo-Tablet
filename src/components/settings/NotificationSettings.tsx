import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, ClockAlert, TriangleAlert } from 'lucide-react'
import {
  checkNotificationPermissionStatus,
  openExactAlarmSettings,
  requestNotificationDisplayPermission,
  type NotificationPermissionStatus,
} from '../../notificationPermissions'

type ViewState = NotificationPermissionStatus & { loading: boolean; error: boolean }

const INITIAL_STATE: ViewState = {
  supported: false,
  display: 'unsupported',
  exactAlarm: 'unsupported',
  loading: true,
  error: false,
}

export function NotificationSettings() {
  const [status, setStatus] = useState<ViewState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    try {
      const next = await checkNotificationPermissionStatus()
      setStatus({ ...next, loading: false, error: false })
    } catch (error) {
      console.warn('No se pudo consultar el estado de las notificaciones.', error)
      setStatus((current) => ({ ...current, loading: false, error: true }))
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- el estado procede del permiso nativo asíncrono
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  if (status.loading) {
    return <div className="settings-row notification-permission-row" aria-live="polite"><span className="settings-icon"><BellRing size={20} /></span><span className="settings-copy"><strong>Notificaciones</strong><small>Comprobando permisos de Android…</small></span></div>
  }

  if (status.error) {
    return <button type="button" className="settings-row notification-permission-row is-warning" onClick={() => void refresh()}><span className="settings-icon"><TriangleAlert size={20} /></span><span className="settings-copy"><strong>No se pudo comprobar el permiso</strong><small>Toca para volver a intentarlo.</small></span></button>
  }

  if (!status.supported) {
    return <div className="settings-row notification-permission-row"><span className="settings-icon"><BellRing size={20} /></span><span className="settings-copy"><strong>Notificaciones</strong><small>Los permisos se comprueban en la aplicación Android.</small></span></div>
  }

  if (status.display !== 'granted') {
    const canRequest = status.display === 'prompt' || status.display === 'prompt-with-rationale'
    const content = <>
      <span className="settings-icon"><TriangleAlert size={20} /></span>
      <span className="settings-copy">
        <strong>Notificaciones desactivadas</strong>
        <small>{canRequest ? 'Toca para permitir alarmas, temporizadores y recordatorios.' : 'Actívalas en Ajustes de Android › Apps › Pablo Tablet › Notificaciones.'}</small>
      </span>
    </>
    return canRequest ? (
      <button
        type="button"
        className="settings-row notification-permission-row is-warning"
        onClick={async () => { await requestNotificationDisplayPermission(); await refresh() }}
      >
        {content}
      </button>
    ) : <div className="settings-row notification-permission-row is-warning">{content}</div>
  }

  if (status.exactAlarm !== 'granted' && status.exactAlarm !== 'not-required') {
    return (
      <button type="button" className="settings-row notification-permission-row is-warning" onClick={async () => { await openExactAlarmSettings(); await refresh() }}>
        <span className="settings-icon"><ClockAlert size={20} /></span>
        <span className="settings-copy"><strong>Permitir alarmas exactas</strong><small>Android puede retrasar los avisos. Toca para permitir “Alarmas y recordatorios”.</small></span>
      </button>
    )
  }

  return <div className="settings-row notification-permission-row is-ready"><span className="settings-icon"><Check size={20} /></span><span className="settings-copy"><strong>Notificaciones preparadas</strong><small>Alarmas, temporizadores y recordatorios pueden avisar a la hora prevista.</small></span></div>
}
