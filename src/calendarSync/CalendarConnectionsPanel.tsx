import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CalendarDays, CloudOff, RefreshCw, Unplug, X } from 'lucide-react'
import type { CalendarAccount, CalendarPairing, CalendarProviderId } from './contracts'
import { calendarRelay } from './relayClient'
import { providerLabel } from './repository'

interface Props {
  accounts: CalendarAccount[]
  onConnected: (account: CalendarAccount, token: string) => Promise<void>
  onSync: (accountId: string) => Promise<void>
  onDisconnect: (accountId: string) => Promise<void>
}

export function CalendarConnectionsPanel({ accounts, onConnected, onSync, onDisconnect }: Props) {
  const [pairing, setPairing] = useState<CalendarPairing | null>(null)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pairing) return
    let active = true
    void QRCode.toDataURL(pairing.authorizationUrl, { width: 240, margin: 1 }).then((value) => { if (active) setQr(value) })
    const poll = window.setInterval(() => {
      void calendarRelay.getConnection(pairing.id, pairing.pollToken).then(async (result) => {
        if (!active || result.state === 'pending') return
        if (result.state === 'connected' && result.account && result.connectionToken) {
          window.clearInterval(poll)
          await onConnected(result.account, result.connectionToken)
          if (active) setPairing(null)
          return
        }
        window.clearInterval(poll)
        if (active) {
          setError(result.error || (result.state === 'expired' ? 'El código ha caducado. Genera uno nuevo.' : 'No se pudo completar la conexión.'))
          setPairing(null)
        }
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo consultar la conexión.') })
    }, 2500)
    return () => { active = false; window.clearInterval(poll) }
  }, [pairing, onConnected])

  const connect = async (provider: CalendarProviderId) => {
    setError('')
    try {
      setPairing(await calendarRelay.beginConnection(provider))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar la conexión.')
    }
  }

  return <section className="calendar-connections">
    <header><div><p className="eyebrow">Calendarios</p><h2>Cuentas sincronizadas</h2></div></header>
    <p className="calendar-connections-help">El calendario local siempre funciona. Google y Outlook son opcionales y pueden usarse por separado o a la vez.</p>
    <div className="calendar-provider-list">{(['google', 'outlook'] as const).map((provider) => {
      const account = accounts.find((item) => item.provider === provider)
      return <article key={provider} className={`calendar-provider ${account ? 'is-connected' : ''}`}>
        <span className={`calendar-provider-logo is-${provider}`}>{provider === 'google' ? 'G' : 'O'}</span>
        <div className="calendar-provider-copy"><strong>{providerLabel(provider)}</strong><small>{account ? account.email || account.displayName : 'Sin conectar'}</small>{account?.lastSyncedAt ? <small>Última sincronización: {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(account.lastSyncedAt))}</small> : null}{account?.error ? <em>{account.error}</em> : null}</div>
        <div className="calendar-provider-actions">{account ? <>{account.status === 'reauthorize' ? <button type="button" onClick={() => void onDisconnect(account.id).then(() => connect(provider))}>Reconectar</button> : <button type="button" disabled={account.status === 'syncing'} onClick={() => void onSync(account.id)}><RefreshCw className={account.status === 'syncing' ? 'is-spinning' : ''} size={15} />Sincronizar</button>}<button type="button" className="is-danger" onClick={() => void onDisconnect(account.id)} aria-label={`Desconectar ${providerLabel(provider)}`}><Unplug size={15} /></button></> : <button type="button" onClick={() => void connect(provider)}>Conectar</button>}</div>
      </article>
    })}</div>
    {error ? <p className="calendar-connection-error"><CloudOff size={16} />{error}</p> : null}
    {pairing ? <div className="calendar-pairing" data-swipe-block role="dialog" aria-modal="true" aria-label={`Conectar ${providerLabel(pairing.provider)}`}><section><button type="button" onClick={() => setPairing(null)} aria-label="Cerrar"><X size={19} /></button><CalendarDays size={28} /><h3>Conectar {providerLabel(pairing.provider)}</h3><p>Escanea el QR con tu móvil e inicia sesión con tu cuenta. La tablet detectará la conexión automáticamente.</p>{qr ? <img src={qr} alt="Código QR de conexión" /> : <RefreshCw className="is-spinning" size={26} />}<small>Caduca a las {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(pairing.expiresAt))}</small></section></div> : null}
  </section>
}
