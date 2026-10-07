import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, LoaderCircle, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import {
  appUpdatesSupported,
  checkForAppUpdate,
  downloadAppUpdate,
  getInstalledAppVersion,
  installDownloadedAppUpdate,
  type AppUpdateInfo,
  type AppUpdateProgress,
} from '../../appUpdater'

type UpdateStep = 'idle' | 'checking' | 'downloading' | 'verifying' | 'ready' | 'opening-installer' | 'awaiting-permission' | 'awaiting-result' | 'checking-result'

const PENDING_UPDATE_VERSION_KEY = 'pablo-tablet.pending-update-version'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes < 1) return null
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function versionParts(value: string) {
  return value.split(/[-+]/, 1)[0].split('.').map((part) => Number.parseInt(part.replace(/\D.*$/, ''), 10) || 0)
}

function versionIsAtLeast(current: string, expected: string) {
  const currentParts = versionParts(current)
  const expectedParts = versionParts(expected)
  const length = Math.max(currentParts.length, expectedParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (currentParts[index] ?? 0) - (expectedParts[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}

export function AppUpdateSettings() {
  const supported = appUpdatesSupported()
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null)
  const [step, setStep] = useState<UpdateStep>('idle')
  const stepRef = useRef<UpdateStep>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null)

  const changeStep = (nextStep: UpdateStep) => {
    stepRef.current = nextStep
    setStep(nextStep)
  }

  const check = async () => {
    changeStep('checking')
    setMessage(null)
    setError(null)
    try {
      const result = await checkForAppUpdate()
      setUpdate(result)
      setMessage(!result.releaseAvailable
        ? 'No hay actualizaciones disponibles.'
        : result.updateAvailable
          ? `La versión ${result.latestVersionName} está disponible.`
          : 'La aplicación está actualizada.')
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      changeStep('idle')
    }
  }

  const verifyPendingInstallation = async () => {
    const expectedVersion = window.localStorage.getItem(PENDING_UPDATE_VERSION_KEY)
    if (!expectedVersion) return
    changeStep('checking-result')
    setError(null)
    setMessage('Comprobando si Android completó la instalación…')
    try {
      const installed = await getInstalledAppVersion()
      if (versionIsAtLeast(installed.currentVersionName, expectedVersion)) {
        window.localStorage.removeItem(PENDING_UPDATE_VERSION_KEY)
        setUpdate((current) => current ? { ...current, currentVersionName: installed.currentVersionName, currentVersionCode: installed.currentVersionCode, updateAvailable: false } : current)
        changeStep('idle')
        setMessage(`Actualización completada. Versión instalada: ${installed.currentVersionName}.`)
      } else {
        changeStep('ready')
        setMessage('La instalación no terminó. Puedes volver a abrir el instalador o descargar de nuevo el archivo.')
      }
    } catch (nextError) {
      changeStep('ready')
      setError(errorMessage(nextError))
    }
  }

  useEffect(() => {
    if (!supported) return
    const initialVerification = window.setTimeout(() => {
      if (window.localStorage.getItem(PENDING_UPDATE_VERSION_KEY)) void verifyPendingInstallation()
    }, 0)

    const verifyWhenReturning = () => {
      if (document.visibilityState === 'visible' && stepRef.current === 'awaiting-result') void verifyPendingInstallation()
    }
    window.addEventListener('focus', verifyWhenReturning)
    document.addEventListener('visibilitychange', verifyWhenReturning)
    return () => {
      window.clearTimeout(initialVerification)
      window.removeEventListener('focus', verifyWhenReturning)
      document.removeEventListener('visibilitychange', verifyWhenReturning)
    }
  }, [supported])

  const download = async () => {
    if (!update) return
    changeStep('downloading')
    setProgress({ phase: 'downloading', bytesDownloaded: 0, totalBytes: update.assetSize, percent: 0 })
    setMessage('Descargando la actualización…')
    setError(null)
    try {
      await downloadAppUpdate(update, (nextProgress) => {
        setProgress(nextProgress)
        if (nextProgress.phase === 'verifying') {
          changeStep('verifying')
          setMessage('Comprobando que el archivo descargado es seguro…')
        }
      })
      changeStep('ready')
      setMessage('Descarga completada y verificada. Continúa cuando quieras abrir el instalador de Android.')
    } catch (nextError) {
      changeStep('idle')
      setProgress(null)
      setError(errorMessage(nextError))
    }
  }

  const install = async () => {
    if (!update?.latestVersionName) return
    changeStep('opening-installer')
    window.localStorage.setItem(PENDING_UPDATE_VERSION_KEY, update.latestVersionName)
    setMessage('Preparando Android. En la siguiente pantalla pulsa “Actualizar”.')
    setError(null)
    try {
      const result = await installDownloadedAppUpdate()
      if (result.permissionRequired) {
        changeStep('awaiting-permission')
        setMessage('Activa “Permitir desde esta fuente”, vuelve a Pablo Tablet y pulsa “Continuar con la instalación”.')
      } else {
        changeStep('awaiting-result')
        setMessage('Instalador abierto. Pulsa “Actualizar” en Android; al volver comprobaremos el resultado.')
      }
    } catch (nextError) {
      changeStep('ready')
      setError(errorMessage(nextError))
    }
  }

  const busy = step === 'checking' || step === 'downloading' || step === 'verifying' || step === 'opening-installer' || step === 'checking-result'
  const downloadPercent = progress?.percent ?? null
  const progressBytes = progress && progress.totalBytes
    ? `${formatBytes(progress.bytesDownloaded)} de ${formatBytes(progress.totalBytes)}`
    : progress ? formatBytes(progress.bytesDownloaded) : null
  const showProgress = ['downloading', 'verifying', 'ready', 'opening-installer', 'awaiting-permission', 'awaiting-result', 'checking-result'].includes(step)
  const versionLabel = update ? `Versión instalada: ${update.currentVersionName}` : 'Pulsa Buscar actualizaciones para comprobar el estado.'

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
      {showProgress ? (
        <section className="app-update-progress" aria-label="Proceso de actualización">
          <ol className="app-update-steps">
            <li className={step === 'downloading' ? 'is-active' : progress ? 'is-complete' : ''}><span>1</span>Descarga</li>
            <li className={step === 'verifying' ? 'is-active' : progress?.phase === 'ready' || ['ready', 'opening-installer', 'awaiting-permission', 'awaiting-result', 'checking-result'].includes(step) ? 'is-complete' : ''}><span>2</span>Verificación</li>
            <li className={['opening-installer', 'awaiting-permission', 'awaiting-result', 'checking-result'].includes(step) ? 'is-active' : ''}><span>3</span>Instalación</li>
          </ol>
          {(step === 'downloading' || step === 'verifying') ? (
            <div className="app-update-progress-detail">
              <div><strong>{step === 'verifying' ? 'Verificando archivo' : 'Descargando actualización'}</strong><span>{step === 'verifying' ? 'Comprobación SHA-256' : progressBytes}</span></div>
              <progress max="100" value={step === 'verifying' ? 100 : downloadPercent ?? undefined} aria-label={step === 'verifying' ? 'Verificando actualización' : 'Progreso de descarga'} />
              {step === 'downloading' && downloadPercent !== null ? <output>{downloadPercent}%</output> : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="app-update-status-row">
        <div className="app-update-actions">
          <button type="button" disabled={!supported || busy} onClick={() => void check()}>
            {step === 'checking' ? <LoaderCircle className="is-spinning" size={17} /> : <RefreshCw size={17} />}
            {step === 'checking' ? 'Comprobando…' : 'Buscar actualizaciones'}
          </button>
          {update?.updateAvailable && step === 'idle' ? (
            <button type="button" className="is-primary" disabled={busy} onClick={() => void download()}>
              <Download size={17} /> Descargar
            </button>
          ) : null}
          {(step === 'ready' || step === 'awaiting-permission' || step === 'awaiting-result' || step === 'opening-installer') ? (
            <button type="button" className="is-primary" disabled={step === 'opening-installer'} onClick={() => void install()}>
              {step === 'opening-installer' ? <LoaderCircle className="is-spinning" size={17} /> : <ShieldCheck size={17} />}
              {step === 'opening-installer' ? 'Abriendo Android…' : step === 'awaiting-result' ? 'Abrir instalador de nuevo' : 'Continuar con la instalación'}
            </button>
          ) : null}
          {(step === 'ready' || step === 'awaiting-permission' || step === 'awaiting-result') ? <button type="button" onClick={() => void download()}>Volver a descargar</button> : null}
          {step === 'awaiting-result' ? <button type="button" onClick={() => void verifyPendingInstallation()}>Comprobar instalación</button> : null}
        </div>
        {message ? <p className="app-update-message">{message}</p> : null}
        {error ? <p className="app-update-message is-error" role="alert">{error}</p> : null}
      </div>
    </div>
  )
}
