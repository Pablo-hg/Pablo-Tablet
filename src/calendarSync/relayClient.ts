import type { CalendarAccount, CalendarOutboxEntry, CalendarPairing, CalendarProviderId, CalendarRelay, CalendarConnectionResult, CalendarSyncResult } from './contracts'
import { tx } from '../i18n'

const trimBaseUrl = (value: string) => value.trim().replace(/\/+$/, '')

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(payload?.error || tx('El servicio de calendario respondió con el estado {{status}}.', { status: response.status }))
  return payload as T
}

export class HttpCalendarRelay implements CalendarRelay {
  readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = trimBaseUrl(baseUrl)
  }

  get configured() {
    return this.baseUrl.startsWith('https://')
  }

  private url(path: string) {
    if (!this.configured) throw new Error(tx('El servicio seguro de calendario todavía no está configurado.'))
    return `${this.baseUrl}${path}`
  }

  async beginConnection(provider: CalendarProviderId) {
    return responseJson<CalendarPairing>(await fetch(this.url('/v1/calendar/pairings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    }))
  }

  async getConnection(pairingId: string, pollToken: string) {
    return responseJson<CalendarConnectionResult>(await fetch(this.url(`/v1/calendar/pairings/${encodeURIComponent(pairingId)}`), {
      headers: { Authorization: `Bearer ${pollToken}` },
    }))
  }

  async synchronize(account: CalendarAccount, connectionToken: string, outbox: CalendarOutboxEntry[]) {
    const result = await responseJson<CalendarSyncResult>(await fetch(this.url(`/v1/calendar/connections/${encodeURIComponent(account.id)}/sync`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${connectionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ outbox }),
    }))
    return { ...result, createdEvents: result.createdEvents ?? [], failedOutbox: result.failedOutbox ?? [] }
  }

  async disconnect(account: CalendarAccount, connectionToken: string) {
    await responseJson(await fetch(this.url(`/v1/calendar/connections/${encodeURIComponent(account.id)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${connectionToken}` },
    }))
  }
}

export const calendarRelay = new HttpCalendarRelay(import.meta.env.VITE_CALENDAR_RELAY_URL ?? '')
