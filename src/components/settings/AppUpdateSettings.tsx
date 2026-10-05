import { useEffect, useState } from 'react'
import { CheckCircle2, Download, LoaderCircle, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import {
  appUpdatesSupported,
  checkForAppUpdate,
  downloadAppUpdate,
  installDownloadedAppUpdate,
  type AppUpdateInfo,
} from '../../appUpdater'

type UpdateStep = 'idle' | 'checking' | 'downloading' | 'ready' | 'installing'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes < 1) return null
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function AppUpdateSettings() {
  const supported = appUpdatesSupported()
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null)
  const [step, setStep] = useState<UpdateStep>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    setStep('checking')
    setMessage(null)
    setError(null)
    try {
      const result = await checkForAppUpdate()
      setUpdate(result)
      setMessage(!result.releaseAvailable
        ? 'Todavía no hay ninguna Release publicada en GitHub.'
        : result.updateAvailable
          ? `La versión ${result.latestVersionName} está disponible.`
          : 'La aplicación está actualizada.')
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setStep('idle')
    }
  }

  useEffect(() => {
    if (!supported) return
    const timeout = window.setTimeout(() => { void check() }, 0)
    return () => window.clearTimeout(timeout)
  }, [supported])

  const download = async () => {
    if (!update) return
    setStep('downloading')
    setMessage('Descargando y verificando el APK…')
    setError(null)
    try {
      await downloadAppUpdate(update)
      setStep('ready')
      setMessage('Descarga verificada. Ya se puede abrir el instalador de Android.')
    } catch (nextError) {
      setStep('idle')
      setError(errorMessage(nextError))
    }
  }

  const install = async () => {
    setStep('installing')
    setError(null)
    try {
      const result = await installDownloadedAppUpdate()
      if (result.permissionRequired) {
        setStep('ready')
        setMessage('Activa “Permitir desde esta fuente”, vuelve a Pablo Tablet y pulsa Instalar de nuevo.')
      } else {
        setMessage('Android ha abierto la confirmación de instalación.')
      }
    } catch (nextError) {
      setStep('ready')
      setError(errorMessage(nextError))
    }
  }

  const busy = step === 'checking' || step === 'downloading' || step === 'installing'
  const versionLabel = update ? `Versión instalada: ${update.currentVersionName} (${update.currentVersionCode})` : 'Consultando la versión instalada…'

  return (
    <div className="app-update-settings" aria-labelledby="app-update-title">
      <div className="settings-subheading app-update-heading">
        <div><p className="eyebrow">Sistema</p><h2 id="app-update-title">Actualizaciones</h2></div>
        <ShieldCheck size={20} />
      </div>

      <div className="app-update-card">
        <span className="settings-icon"><Smartphone size={20} /></span>
        <span className="settings-copy">
          <strong>{update?.updateAvailable ? `Nueva versión ${update.latestVersionName}` : 'Pablo Tablet'}</strong>
          <small>{supported ? versionLabel : 'Disponible al abrir la aplicación en Android.'}</small>
          {update?.updateAvailable && update.releaseName ? <small>{update.releaseName}{formatBytes(update.assetSize) ? ` · ${formatBytes(update.assetSize)}` : ''}</small> : null}
        </span>
        {update && !update.updateAvailable ? <CheckCircle2 className="app-update-ok" size={22} aria-label="Aplicación actualizada" /> : null}
      </div>

      {update?.updateAvailable && update.releaseNotes ? <details className="app-update-notes"><summary>Ver novedades</summary><p>{update.releaseNotes}</p></details> : null}
      {message ? <p className="app-update-message">{message}</p> : null}
      {error ? <p className="app-update-message is-error" role="alert">{error}</p> : null}

      <div className="app-update-actions">
        <button type="button" disabled={!supported || busy} onClick={() => void check()}>
          {step === 'checking' ? <LoaderCircle className="is-spinning" size={17} /> : <RefreshCw size={17} />}
          {step === 'checking' ? 'Comprobando…' : 'Buscar actualizaciones'}
        </button>
        {update?.updateAvailable && step !== 'ready' && step !== 'installing' ? (
          <button type="button" className="is-primary" disabled={busy} onClick={() => void download()}>
            {step === 'downloading' ? <LoaderCircle className="is-spinning" size={17} /> : <Download size={17} />}
            {step === 'downloading' ? 'Descargando…' : 'Descargar'}
          </button>
        ) : null}
        {(step === 'ready' || step === 'installing') ? (
          <button type="button" className="is-primary" disabled={step === 'installing'} onClick={() => void install()}>
            {step === 'installing' ? <LoaderCircle className="is-spinning" size={17} /> : <ShieldCheck size={17} />}
            {step === 'installing' ? 'Abriendo…' : 'Instalar'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
