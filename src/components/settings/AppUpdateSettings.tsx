import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, LoaderCircle, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import {
  appUpdatesSupported,
  checkForAppUpdate,
  confirmSimulatedWebInstallation,
  downloadAppUpdate,
  getInstalledAppVersion,
  installDownloadedAppUpdate,
  releaseNotesForUpdate,
  resetSimulatedWebInstallation,
  webUpdateSimulationEnabled,
  type AppUpdateInfo,
  type AppUpdateProgress,
  type InstalledAppVersion,
} from '../../appUpdater'
import { tx } from '../../i18n'

type UpdateStep = 'idle' | 'checking' | 'downloading' | 'verifying' | 'ready' | 'opening-installer' | 'awaiting-permission' | 'awaiting-result' | 'checking-result'

const PENDING_UPDATE_VERSION_KEY = 'pablo-tablet.pending-update-version'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : tx('No se pudo completar la operación.')
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
  const simulated = webUpdateSimulationEnabled()
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null)
  const [step, setStep] = useState<UpdateStep>('idle')
  const stepRef = useRef<UpdateStep>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null)
  const [installedVersion, setInstalledVersion] = useState<InstalledAppVersion | null>(null)
  const [showSimulatedInstaller, setShowSimulatedInstaller] = useState(false)

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
      setInstalledVersion({ currentVersionName: result.currentVersionName, currentVersionCode: result.currentVersionCode })
      setMessage(!result.releaseAvailable
        ? tx('No hay actualizaciones disponibles.')
        : result.updateAvailable
          ? tx('La versión {{version}} está disponible.', { version: result.latestVersionName })
          : tx('La aplicación está actualizada.'))
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
    setMessage(tx('Comprobando si Android completó la instalación…'))
    try {
      const installed = await getInstalledAppVersion()
      setInstalledVersion(installed)
      if (versionIsAtLeast(installed.currentVersionName, expectedVersion)) {
        window.localStorage.removeItem(PENDING_UPDATE_VERSION_KEY)
        setUpdate((current) => current ? { ...current, currentVersionName: installed.currentVersionName, currentVersionCode: installed.currentVersionCode, updateAvailable: false } : current)
        changeStep('idle')
        setMessage(tx('Actualización completada. Versión instalada: {{version}}.', { version: installed.currentVersionName }))
      } else {
        changeStep('ready')
        setMessage(tx('La instalación no terminó. Puedes volver a abrir el instalador o descargar de nuevo el archivo.'))
      }
    } catch (nextError) {
      changeStep('ready')
      setError(errorMessage(nextError))
    }
  }

  useEffect(() => {
    if (!supported) return
    let active = true
    const initialVerification = window.setTimeout(() => {
      if (window.localStorage.getItem(PENDING_UPDATE_VERSION_KEY)) {
        void verifyPendingInstallation()
        return
      }
      void getInstalledAppVersion()
        .then((installed) => { if (active) setInstalledVersion(installed) })
        .catch(() => { })
    }, 0)

    const verifyWhenReturning = () => {
      if (document.visibilityState === 'visible' && stepRef.current === 'awaiting-result') void verifyPendingInstallation()
    }
    window.addEventListener('focus', verifyWhenReturning)
    document.addEventListener('visibilitychange', verifyWhenReturning)
    return () => {
      active = false
      window.clearTimeout(initialVerification)
      window.removeEventListener('focus', verifyWhenReturning)
      document.removeEventListener('visibilitychange', verifyWhenReturning)
    }
  }, [supported])

  const download = async () => {
    if (!update) return
    changeStep('downloading')
    setProgress({ phase: 'downloading', bytesDownloaded: 0, totalBytes: update.assetSize, percent: 0 })
    setMessage(tx('Descargando la actualización…'))
    setError(null)
    try {
      await downloadAppUpdate(update, (nextProgress) => {
        setProgress(nextProgress)
        if (nextProgress.phase === 'verifying') {
          changeStep('verifying')
          setMessage(tx('Comprobando que el archivo descargado es seguro…'))
        }
      })
      changeStep('ready')
      setMessage(tx('Descarga completada y verificada. Continúa cuando quieras abrir el instalador de Android.'))
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
    setMessage(tx('Preparando Android. En la siguiente pantalla pulsa “Actualizar”.'))
    setError(null)
    try {
      if (simulated) {
        setShowSimulatedInstaller(true)
        changeStep('awaiting-result')
        setMessage(tx('Instalador simulado abierto. Pulsa “Actualizar” en la ventana de Android.'))
        return
      }
      const result = await installDownloadedAppUpdate()
      if (result.permissionRequired) {
        changeStep('awaiting-permission')
        setMessage(tx('Activa “Permitir desde esta fuente”, vuelve a Pablo Tablet y pulsa “Continuar con la instalación”.'))
      } else {
        changeStep('awaiting-result')
        setMessage(tx('Instalador abierto. Pulsa “Actualizar” en Android; al volver comprobaremos el resultado.'))
      }
    } catch (nextError) {
      changeStep('ready')
      setError(errorMessage(nextError))
    }
  }

  const completeSimulatedInstallation = () => {
    if (!update?.latestVersionName) return
    confirmSimulatedWebInstallation(update.latestVersionName)
    setShowSimulatedInstaller(false)
    setMessage(tx('La instalación simulada ha terminado. Pulsa “Comprobar instalación”.'))
  }

  const cancelSimulatedInstallation = () => {
    setShowSimulatedInstaller(false)
    changeStep('ready')
    setMessage(tx('Instalación cancelada. Puedes volver a intentarlo cuando quieras.'))
  }

  const resetSimulation = () => {
    resetSimulatedWebInstallation()
    window.localStorage.removeItem(PENDING_UPDATE_VERSION_KEY)
    setUpdate(null)
    setInstalledVersion(null)
    setProgress(null)
    setMessage(null)
    setError(null)
    setShowSimulatedInstaller(false)
    changeStep('idle')
    void getInstalledAppVersion().then(setInstalledVersion).catch(() => { })
  }

  const busy = step === 'checking' || step === 'downloading' || step === 'verifying' || step === 'opening-installer' || step === 'checking-result'
  const downloadPercent = progress?.percent ?? null
  const progressBytes = progress && progress.totalBytes
    ? `${formatBytes(progress.bytesDownloaded)} de ${formatBytes(progress.totalBytes)}`
    : progress ? formatBytes(progress.bytesDownloaded) : null
  const showProgress = ['downloading', 'verifying', 'ready', 'opening-installer', 'awaiting-permission', 'awaiting-result', 'checking-result'].includes(step)
  const currentVersion = update?.currentVersionName ?? installedVersion?.currentVersionName
  const versionLabel = currentVersion
    ? tx('Versión instalada: {{version}}', { version: currentVersion })
    : tx('Consultando la versión instalada…')
  const updateNotes = update ? releaseNotesForUpdate(update) : null

  return (
    <div className="app-update-settings" aria-labelledby="app-update-title">
      <div className="settings-subheading app-update-heading">
        <div><p className="eyebrow">{tx('Sistema')}</p><h2 id="app-update-title">{tx('Actualizaciones')}</h2></div>
        <div className="app-update-heading-actions">
          {simulated ? <span className="app-update-demo-badge">{tx('Demo web')}</span> : null}
          <ShieldCheck size={20} />
        </div>
      </div>

      <div className="app-update-card">
        <span className="settings-icon"><Smartphone size={20} /></span>
        <span className="settings-copy">
          <strong>{update?.updateAvailable ? tx('Nueva versión {{version}}', { version: update.latestVersionName }) : 'Pablo Tablet'}</strong>
          <small>{supported ? versionLabel : tx('Disponible al abrir la aplicación en Android.')}</small>
          {update?.updateAvailable && update.releaseName ? <small>{update.releaseName}{formatBytes(update.assetSize) ? ` · ${formatBytes(update.assetSize)}` : ''}</small> : null}
        </span>
        {update && !update.updateAvailable ? <CheckCircle2 className="app-update-ok" size={22} aria-label={tx('Aplicación actualizada')} /> : null}
      </div>

      {update?.updateAvailable && updateNotes ? <details className="app-update-notes"><summary>{tx('Ver novedades')}</summary><p>{updateNotes}</p></details> : null}
      {showProgress ? (
        <section className="app-update-progress" aria-label={tx('Proceso de actualización')}>
          <ol className="app-update-steps">
            <li className={step === 'downloading' ? 'is-active' : progress ? 'is-complete' : ''}><span>1</span>{tx('Descarga')}</li>
            <li className={step === 'verifying' ? 'is-active' : progress?.phase === 'ready' || ['ready', 'opening-installer', 'awaiting-permission', 'awaiting-result', 'checking-result'].includes(step) ? 'is-complete' : ''}><span>2</span>{tx('Verificación')}</li>
            <li className={['opening-installer', 'awaiting-permission', 'awaiting-result', 'checking-result'].includes(step) ? 'is-active' : ''}><span>3</span>{tx('Instalación')}</li>
          </ol>
          {(step === 'downloading' || step === 'verifying') ? (
            <div className="app-update-progress-detail">
              <div><strong>{tx(step === 'verifying' ? 'Verificando archivo' : 'Descargando actualización')}</strong><span>{step === 'verifying' ? tx('Comprobación SHA-256') : progressBytes}</span></div>
              <progress max="100" value={step === 'verifying' ? 100 : downloadPercent ?? undefined} aria-label={tx(step === 'verifying' ? 'Verificando actualización' : 'Progreso de descarga')} />
              {step === 'downloading' && downloadPercent !== null ? <output>{downloadPercent}%</output> : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="app-update-status-row">
        <div className="app-update-actions">
          <button type="button" disabled={!supported || busy} onClick={() => void check()}>
            {step === 'checking' ? <LoaderCircle className="is-spinning" size={17} /> : <RefreshCw size={17} />}
            {tx(step === 'checking' ? 'Comprobando…' : 'Buscar actualizaciones')}
          </button>
          {update?.updateAvailable && step === 'idle' ? (
            <button type="button" className="is-primary" disabled={busy} onClick={() => void download()}>
              <Download size={17} /> {tx('Descargar')}
            </button>
          ) : null}
          {(step === 'ready' || step === 'awaiting-permission' || step === 'awaiting-result' || step === 'opening-installer') ? (
            <button type="button" className="is-primary" disabled={step === 'opening-installer'} onClick={() => void install()}>
              {step === 'opening-installer' ? <LoaderCircle className="is-spinning" size={17} /> : <ShieldCheck size={17} />}
              {tx(step === 'opening-installer' ? 'Abriendo Android…' : step === 'awaiting-result' ? 'Abrir instalador de nuevo' : 'Continuar con la instalación')}
            </button>
          ) : null}
          {(step === 'ready' || step === 'awaiting-permission' || step === 'awaiting-result') ? <button type="button" onClick={() => void download()}>{tx('Volver a descargar')}</button> : null}
          {step === 'awaiting-result' ? <button type="button" onClick={() => void verifyPendingInstallation()}>{tx('Comprobar instalación')}</button> : null}
          {simulated ? <button type="button" onClick={resetSimulation}>{tx('Reiniciar simulación')}</button> : null}
        </div>
        {message ? <p className="app-update-message">{message}</p> : null}
        {error ? <p className="app-update-message is-error" role="alert">{error}</p> : null}
      </div>
      {showSimulatedInstaller ? (
        <div className="simulated-installer-backdrop" role="presentation">
          <section className="simulated-installer" role="dialog" aria-modal="true" aria-labelledby="simulated-installer-title">
            <span className="simulated-installer-icon"><Smartphone size={28} /></span>
            <div>
              <p className="eyebrow">{tx('Instalador de Android · Simulación')}</p>
              <h3 id="simulated-installer-title">{tx('¿Quieres actualizar esta aplicación?')}</h3>
              <p>{tx('Se actualizará Pablo Tablet de la versión {{currentVersion}} a la {{latestVersion}}. Tus datos se conservarán.', {
                currentVersion: update?.currentVersionName ?? installedVersion?.currentVersionName ?? '—',
                latestVersion: update?.latestVersionName ?? '—',
              })}</p>
            </div>
            <div className="simulated-installer-actions">
              <button type="button" onClick={cancelSimulatedInstallation}>{tx('Cancelar')}</button>
              <button type="button" className="is-primary" onClick={completeSimulatedInstallation}>{tx('Actualizar')}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
