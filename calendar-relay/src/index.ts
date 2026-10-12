interface Env {
  DB: D1Database
  PUBLIC_BASE_URL: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  MICROSOFT_CLIENT_ID: string
  MICROSOFT_CLIENT_SECRET: string
  TOKEN_ENCRYPTION_KEY: string
}

type Provider = 'google' | 'outlook'
type Json = Record<string, unknown>
type Tokens = { access_token: string; refresh_token?: string; expires_at: number }

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } })
const random = () => crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '')
const bytes = (value: string) => new TextEncoder().encode(value)
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('')
const hash = async (value: string) => hex(await crypto.subtle.digest('SHA-256', bytes(value)))
const b64 = (value: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(value)))
const unb64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
const b64url = (value: ArrayBuffer) => b64(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

async function encryptionKey(env: Env) {
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', bytes(env.TOKEN_ENCRYPTION_KEY)), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encrypt(env: Env, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(env), bytes(JSON.stringify(value)))
  return `${b64(iv)}.${b64(encrypted)}`
}

async function decrypt<T>(env: Env, value: string): Promise<T> {
  const [iv, payload] = value.split('.')
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await encryptionKey(env), unb64(payload))
  return JSON.parse(new TextDecoder().decode(decrypted)) as T
}

const providerConfig = (env: Env, provider: Provider) => provider === 'google' ? {
  clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET,
  auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
  scope: 'openid email profile https://www.googleapis.com/auth/calendar',
} : {
  clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET,
  auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scope: 'openid offline_access User.Read Calendars.ReadWrite',
}

function authorizationUrl(env: Env, provider: Provider, state: string, codeChallenge: string) {
  const config = providerConfig(env, provider)
  const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${env.PUBLIC_BASE_URL}/oauth/${provider}/callback`, response_type: 'code', scope: config.scope, state, code_challenge: codeChallenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' })
  return `${config.auth}?${query}`
}

async function exchangeCode(env: Env, provider: Provider, code: string, codeVerifier: string): Promise<Tokens> {
  const config = providerConfig(env, provider)
  const response = await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: codeVerifier, redirect_uri: `${env.PUBLIC_BASE_URL}/oauth/${provider}/callback`, grant_type: 'authorization_code' }) })
  const payload = await response.json<Json>()
  if (!response.ok || typeof payload.access_token !== 'string') throw new Error(typeof payload.error_description === 'string' ? payload.error_description : 'No se pudo obtener el token OAuth.')
  return { access_token: payload.access_token, refresh_token: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined, expires_at: Date.now() + Number(payload.expires_in ?? 3600) * 1000 }
}

async function refreshTokens(env: Env, provider: Provider, current: Tokens): Promise<Tokens> {
  if (current.expires_at > Date.now() + 60_000) return current
  if (!current.refresh_token) throw new Error('La cuenta necesita volver a autorizarse.')
  const config = providerConfig(env, provider)
  const response = await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: current.refresh_token, grant_type: 'refresh_token', scope: config.scope }) })
  const payload = await response.json<Json>()
  if (!response.ok || typeof payload.access_token !== 'string') throw new Error('No se pudo renovar la autorización.')
  return { access_token: payload.access_token, refresh_token: typeof payload.refresh_token === 'string' ? payload.refresh_token : current.refresh_token, expires_at: Date.now() + Number(payload.expires_in ?? 3600) * 1000 }
}

async function providerProfile(provider: Provider, accessToken: string) {
  const url = provider === 'google' ? 'https://openidconnect.googleapis.com/v1/userinfo' : 'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName'
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const value = await response.json<Json>()
  if (!response.ok) throw new Error('No se pudo leer el perfil de la cuenta.')
  return provider === 'google'
    ? { email: String(value.email ?? ''), displayName: String(value.name ?? value.email ?? '') }
    : { email: String(value.mail ?? value.userPrincipalName ?? ''), displayName: String(value.displayName ?? value.mail ?? '') }
}

class ProviderError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function providerFetch(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!response.ok) {
    const payload = await response.json<Json>().catch(() => ({} as Json))
    const detail = string(object(payload.error).message, string(payload.error_description))
    throw new ProviderError(response.status, detail || `El proveedor de calendario respondió ${response.status}.`)
  }
  return response
}

const object = (value: unknown): Json => value && typeof value === 'object' ? value as Json : {}
const string = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const date = (value: string) => value.slice(0, 10)
const time = (value: string) => value.includes('T') ? value.slice(11, 16) : '00:00'
const nextDate = (value: unknown) => {
  const result = new Date(`${String(value)}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + 1)
  return result.toISOString().slice(0, 10)
}
const calendarColor = (provider: Provider, value: unknown) => {
  const raw = JSON.stringify(value ?? '').toLowerCase()
  if (raw.includes('green') || raw.includes('teal') || raw.includes('#0b8043')) return 'mint'
  if (raw.includes('red') || raw.includes('orange') || raw.includes('#d50000')) return 'coral'
  if (raw.includes('yellow') || raw.includes('#f6bf26')) return 'sun'
  return provider === 'google' ? 'blue' : 'mint'
}
const outlookWeekday = (value: unknown) => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${String(value)}T12:00:00Z`).getUTCDay()]
const reminderBefore = (dateValue: string, timeValue: string, minutes: number, id: string) => {
  const value = new Date(`${dateValue}T${timeValue || '00:00'}:00Z`)
  value.setUTCMinutes(value.getUTCMinutes() - minutes)
  return { id, date: value.toISOString().slice(0, 10), time: value.toISOString().slice(11, 16) }
}
const reminderMinutes = (event: Json) => {
  const start = new Date(`${string(event.date)}T${event.allDay ? '09:00' : string(event.startTime, '00:00')}:00Z`).getTime()
  return (Array.isArray(event.reminders) ? event.reminders : []).map(object).flatMap((reminder) => {
    const value = new Date(`${string(reminder.date)}T${string(reminder.time, '00:00')}:00Z`).getTime()
    const minutes = Math.round((start - value) / 60000)
    return Number.isFinite(minutes) && minutes >= 0 ? [minutes] : []
  }).sort((a, b) => a - b)
}

function normalizedEvent(provider: Provider, accountId: string, calendarId: string, value: unknown) {
  const raw = object(value)
  if (provider === 'google') {
    const start = object(raw.start); const end = object(raw.end); const allDay = Boolean(start.date)
    const startValue = string(start.dateTime, string(start.date)); const endValue = string(end.dateTime, string(end.date, startValue))
    const exclusive = allDay && endValue ? new Date(`${endValue}T12:00:00Z`) : null
    if (exclusive) exclusive.setUTCDate(exclusive.getUTCDate() - 1)
    const recurrenceText = JSON.stringify(raw.recurrence ?? '').toUpperCase()
    const recurrence = recurrenceText.includes('FREQ=DAILY') ? 'daily' : recurrenceText.includes('FREQ=WEEKLY') ? 'weekly' : recurrenceText.includes('FREQ=MONTHLY') ? 'monthly' : recurrenceText.includes('FREQ=YEARLY') ? 'yearly' : 'none'
    const reminderConfig = object(raw.reminders)
    const reminders = Array.isArray(reminderConfig.overrides) ? reminderConfig.overrides.flatMap((value, index) => { const override = object(value); return typeof override.minutes === 'number' ? [reminderBefore(date(startValue), allDay ? '09:00' : time(startValue), override.minutes, `google-${string(raw.id)}-${index}`)] : [] }) : []
    return { provider, accountId, calendarId, externalId: string(raw.id), externalVersion: string(raw.etag, string(raw.updated)) || null, deleted: raw.status === 'cancelled', type: 'event', recurrence, completed: false, title: string(raw.summary, 'Sin título'), date: date(startValue), endDate: exclusive ? exclusive.toISOString().slice(0, 10) : date(endValue), startTime: allDay ? '00:00' : time(startValue), endTime: allDay ? '23:59' : time(endValue), allDay, timeZone: string(start.timeZone, 'Europe/Madrid'), location: string(raw.location), notes: string(raw.description), color: 'blue', reminders, updatedAt: string(raw.updated, new Date().toISOString()) }
  }
  const start = object(raw.start); const end = object(raw.end); const location = object(raw.location)
  const startValue = string(start.dateTime); const endValue = string(end.dateTime, startValue); const allDay = Boolean(raw.isAllDay)
  const pattern = object(object(raw.recurrence).pattern)
  const recurrence = pattern.type === 'daily' ? 'daily' : pattern.type === 'weekly' ? 'weekly' : pattern.type === 'absoluteMonthly' || pattern.type === 'relativeMonthly' ? 'monthly' : pattern.type === 'absoluteYearly' || pattern.type === 'relativeYearly' ? 'yearly' : 'none'
  const reminders = raw.isReminderOn && typeof raw.reminderMinutesBeforeStart === 'number' ? [reminderBefore(date(startValue), allDay ? '09:00' : time(startValue), raw.reminderMinutesBeforeStart, `outlook-${string(raw.id)}`)] : []
  return { provider, accountId, calendarId, externalId: string(raw.id), externalVersion: string(raw.changeKey, string(raw['@odata.etag'])) || null, deleted: Boolean(raw.isCancelled) || Boolean(raw['@removed']), type: 'event', recurrence, completed: false, title: string(raw.subject, 'Sin título'), date: date(startValue), endDate: date(endValue), startTime: allDay ? '00:00' : time(startValue), endTime: allDay ? '23:59' : time(endValue), allDay, timeZone: string(start.timeZone, 'Europe/Madrid'), location: string(location.displayName), notes: string(raw.bodyPreview), color: 'mint', reminders, updatedAt: string(raw.lastModifiedDateTime, new Date().toISOString()) }
}

async function pushOutbox(provider: Provider, token: string, entries: Json[]) {
  const acknowledgedOutboxIds: string[] = []
  const createdEvents: Array<{ eventId: string; event: unknown }> = []
  const failedOutbox: Array<{ entryId: string; code: 'conflict' | 'reauthorize' | 'temporary' | 'error'; error: string }> = []
  for (const entry of entries) {
    const event = object(entry.event); const calendarId = string(event.calendarId); const externalId = string(event.externalId)
    const entryId = string(entry.id); const eventId = string(entry.eventId)
    if (!calendarId || !entryId || !eventId) continue
    const operation = string(entry.operation)
    const collection = provider === 'google' ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`
    const endpoint = externalId ? `${collection}/${encodeURIComponent(externalId)}` : collection
    const eventTimeZone = string(event.timeZone, 'Europe/Madrid')
    const reminders = reminderMinutes(event)
    const googleFrequency = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[string(event.recurrence)]
    const outlookPattern = string(event.recurrence) === 'daily' ? { type: 'daily', interval: 1 } : string(event.recurrence) === 'weekly' ? { type: 'weekly', interval: 1, daysOfWeek: [outlookWeekday(event.date)] } : string(event.recurrence) === 'monthly' ? { type: 'absoluteMonthly', interval: 1, dayOfMonth: Number(string(event.date).slice(8, 10)) } : string(event.recurrence) === 'yearly' ? { type: 'absoluteYearly', interval: 1, dayOfMonth: Number(string(event.date).slice(8, 10)), month: Number(string(event.date).slice(5, 7)) } : null
    const body = provider === 'google'
      ? { summary: event.title, description: event.notes, location: event.location, start: event.allDay ? { date: event.date } : { dateTime: `${event.date}T${event.startTime}:00`, timeZone: eventTimeZone }, end: event.allDay ? { date: nextDate(event.endDate) } : { dateTime: `${event.endDate}T${event.endTime}:00`, timeZone: eventTimeZone }, recurrence: googleFrequency ? [`RRULE:FREQ=${googleFrequency}`] : undefined, reminders: { useDefault: false, overrides: reminders.slice(0, 5).map((minutes) => ({ method: 'popup', minutes })) } }
      : { subject: event.title, body: { contentType: 'text', content: event.notes }, location: { displayName: event.location }, isAllDay: event.allDay, start: { dateTime: `${event.date}T${event.startTime}:00`, timeZone: eventTimeZone }, end: { dateTime: `${event.endDate}T${event.endTime}:00`, timeZone: eventTimeZone }, recurrence: outlookPattern ? { pattern: outlookPattern, range: { type: 'noEnd', startDate: event.date, recurrenceTimeZone: eventTimeZone } } : null, isReminderOn: reminders.length > 0, reminderMinutesBeforeStart: reminders.at(-1) ?? 0 }
    try {
      if (operation === 'delete' && !externalId) { acknowledgedOutboxIds.push(entryId); continue }
      const response = await providerFetch(endpoint, token, { method: operation === 'create' ? 'POST' : operation === 'delete' ? 'DELETE' : 'PATCH', body: operation === 'delete' ? undefined : JSON.stringify(body), headers: entry.expectedVersion ? { 'If-Match': String(entry.expectedVersion) } : undefined })
      acknowledgedOutboxIds.push(entryId)
      if (operation === 'create') createdEvents.push({ eventId, event: { ...normalizedEvent(provider, string(event.accountId), calendarId, await response.json<Json>()), color: string(event.color, provider === 'google' ? 'blue' : 'mint') } })
    } catch (error) {
      const status = error instanceof ProviderError ? error.status : 0
      const code = status === 409 || status === 412 ? 'conflict' : status === 401 || status === 403 ? 'reauthorize' : status === 429 || status >= 500 ? 'temporary' : 'error'
      failedOutbox.push({ entryId, code, error: error instanceof Error ? error.message : 'No se pudo enviar el cambio al proveedor.' })
    }
  }
  return { acknowledgedOutboxIds, createdEvents, failedOutbox }
}

export async function pullGoogle(token: string, accountId: string, cursors: Json) {
  const calendarsPayload = await (await providerFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', token)).json<Json>()
  const calendarItems = Array.isArray(calendarsPayload.items) ? calendarsPayload.items.map(object) : []
  const calendars = calendarItems.map((item) => ({ id: `google:${encodeURIComponent(accountId)}:${encodeURIComponent(string(item.id))}`, accountId, provider: 'google', remoteId: string(item.id), name: string(item.summary, 'Calendario'), color: calendarColor('google', item.backgroundColor ?? item.colorId), visible: true, readOnly: item.accessRole === 'reader' }))
  const events: unknown[] = []; const nextCursors: Json = { ...cursors }
  for (const calendar of calendars) {
    const query = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true', maxResults: '2500' })
    if (string(cursors[calendar.remoteId])) query.set('syncToken', string(cursors[calendar.remoteId])); else query.set('timeMin', new Date(Date.now() - 366 * 86400000).toISOString())
    let page = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.remoteId)}/events?${query}`
    let recoveredInvalidCursor = false
    while (page) {
      let payload: Json
      try {
        payload = await (await providerFetch(page, token)).json<Json>()
      } catch (error) {
        if (error instanceof ProviderError && error.status === 410 && !recoveredInvalidCursor) {
          recoveredInvalidCursor = true
          delete nextCursors[calendar.remoteId]
          const fullQuery = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true', maxResults: '2500', timeMin: new Date(Date.now() - 366 * 86400000).toISOString() })
          page = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.remoteId)}/events?${fullQuery}`
          continue
        }
        throw error
      }
      for (const item of Array.isArray(payload.items) ? payload.items : []) events.push({ ...normalizedEvent('google', accountId, calendar.remoteId, item), color: calendar.color })
      page = typeof payload.nextPageToken === 'string' ? `${page.split('&pageToken=')[0]}&pageToken=${encodeURIComponent(payload.nextPageToken)}` : ''
      if (typeof payload.nextSyncToken === 'string') nextCursors[calendar.remoteId] = payload.nextSyncToken
    }
  }
  return { calendars, events, cursors: nextCursors }
}

export async function pullOutlook(token: string, accountId: string, cursors: Json) {
  const calendarPayload = await (await providerFetch('https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,canEdit,color', token)).json<Json>()
  const items = Array.isArray(calendarPayload.value) ? calendarPayload.value.map(object) : []
  const calendars = items.map((item) => ({ id: `outlook:${encodeURIComponent(accountId)}:${encodeURIComponent(string(item.id))}`, accountId, provider: 'outlook', remoteId: string(item.id), name: string(item.name, 'Calendario'), color: calendarColor('outlook', item.color), visible: true, readOnly: item.canEdit === false }))
  const events: unknown[] = []; const nextCursors: Json = { ...cursors }
  for (const calendar of calendars) {
    const start = new Date(Date.now() - 366 * 86400000).toISOString(); const end = new Date(Date.now() + 732 * 86400000).toISOString()
    const fullPage = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendar.remoteId)}/calendarView/delta?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`
    let page = string(cursors[calendar.remoteId], fullPage)
    let recoveredInvalidCursor = false
    while (page) {
      let payload: Json
      try {
        payload = await (await providerFetch(page, token)).json<Json>()
      } catch (error) {
        if (error instanceof ProviderError && error.status === 410 && !recoveredInvalidCursor) {
          recoveredInvalidCursor = true
          delete nextCursors[calendar.remoteId]
          page = fullPage
          continue
        }
        throw error
      }
      for (const item of Array.isArray(payload.value) ? payload.value : []) events.push({ ...normalizedEvent('outlook', accountId, calendar.remoteId, item), color: calendar.color })
      page = string(payload['@odata.nextLink'])
      if (typeof payload['@odata.deltaLink'] === 'string') nextCursors[calendar.remoteId] = payload['@odata.deltaLink']
    }
  }
  return { calendars, events, cursors: nextCursors }
}

async function handle(request: Request, env: Env) {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method === 'POST' && url.pathname === '/v1/calendar/pairings') {
    const body = await request.json<Json>(); const provider = body.provider
    if (provider !== 'google' && provider !== 'outlook') return json({ error: 'Proveedor no válido.' }, 400)
    const id = crypto.randomUUID(); const pollToken = random(); const state = random(); const codeVerifier = random(); const codeChallenge = b64url(await crypto.subtle.digest('SHA-256', bytes(codeVerifier))); const expiresAt = Date.now() + 10 * 60_000
    await env.DB.prepare('INSERT INTO pairings (id, provider, poll_hash, state, code_verifier, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, provider, await hash(pollToken), state, codeVerifier, expiresAt).run()
    return json({ id, provider, authorizationUrl: authorizationUrl(env, provider, state, codeChallenge), pollToken, expiresAt: new Date(expiresAt).toISOString() }, 201)
  }
  const callback = /^\/oauth\/(google|outlook)\/callback$/.exec(url.pathname)
  if (request.method === 'GET' && callback) {
    const provider = callback[1] as Provider; const state = url.searchParams.get('state'); const code = url.searchParams.get('code')
    if (!state || !code) return new Response('Autorización incompleta.', { status: 400 })
    const pairing = await env.DB.prepare('SELECT * FROM pairings WHERE state = ? AND provider = ?').bind(state, provider).first<Json>()
    if (!pairing || pairing.status !== 'pending' || Number(pairing.expires_at) < Date.now()) return new Response('La vinculación ha caducado o ya se ha utilizado.', { status: 400 })
    const tokens = await exchangeCode(env, provider, code, String(pairing.code_verifier)); const profile = await providerProfile(provider, tokens.access_token); const connectionId = crypto.randomUUID(); const connectionToken = random()
    await env.DB.prepare('INSERT INTO connections (id, provider, email, display_name, connection_hash, encrypted_tokens, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(connectionId, provider, profile.email, profile.displayName, await hash(connectionToken), await encrypt(env, tokens), Date.now()).run()
    const result = { account: { id: connectionId, provider, email: profile.email, displayName: profile.displayName, status: 'connected', enabled: true, lastSyncedAt: null, error: null }, connectionToken }
    await env.DB.prepare("UPDATE pairings SET status = 'connected', result_json = ? WHERE id = ?").bind(await encrypt(env, result), pairing.id).run()
    return new Response('<!doctype html><meta charset="utf-8"><title>Pablo Tablet</title><h1>Cuenta conectada</h1><p>Ya puedes cerrar esta pestaña. La tablet comenzará a sincronizar.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  const pairingMatch = /^\/v1\/calendar\/pairings\/([^/]+)$/.exec(url.pathname)
  if (request.method === 'GET' && pairingMatch) {
    const row = await env.DB.prepare('SELECT * FROM pairings WHERE id = ?').bind(pairingMatch[1]).first<Json>(); const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    if (!row || await hash(token) !== row.poll_hash) return json({ error: 'Vinculación no válida.' }, 401)
    if (Number(row.expires_at) < Date.now()) return json({ state: 'expired' })
    if (row.status !== 'connected' || typeof row.result_json !== 'string') return json({ state: 'pending' })
    return json({ state: 'connected', ...await decrypt<Json>(env, row.result_json) })
  }
  const connectionMatch = /^\/v1\/calendar\/connections\/([^/]+)(\/sync)?$/.exec(url.pathname)
  if (connectionMatch) {
    const row = await env.DB.prepare('SELECT * FROM connections WHERE id = ?').bind(connectionMatch[1]).first<Json>(); const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    if (!row || await hash(token) !== row.connection_hash) return json({ error: 'Conexión no válida.' }, 401)
    if (request.method === 'DELETE' && !connectionMatch[2]) { await env.DB.prepare('DELETE FROM connections WHERE id = ?').bind(row.id).run(); return json({ ok: true }) }
    if (request.method === 'POST' && connectionMatch[2]) {
      const provider = row.provider as Provider; let tokens = await decrypt<Tokens>(env, String(row.encrypted_tokens)); tokens = await refreshTokens(env, provider, tokens)
      const body = await request.json<Json>(); const entries = Array.isArray(body.outbox) ? body.outbox.map(object) : []; const outboxResult = await pushOutbox(provider, tokens.access_token, entries)
      const cursors = typeof row.sync_cursor === 'string' ? JSON.parse(row.sync_cursor) as Json : {}; const pulled = provider === 'google' ? await pullGoogle(tokens.access_token, String(row.id), cursors) : await pullOutlook(tokens.access_token, String(row.id), cursors)
      const syncedAt = new Date().toISOString(); await env.DB.prepare('UPDATE connections SET encrypted_tokens = ?, sync_cursor = ?, updated_at = ? WHERE id = ?').bind(await encrypt(env, tokens), JSON.stringify(pulled.cursors), Date.now(), row.id).run()
      return json({ calendars: pulled.calendars, events: pulled.events, ...outboxResult, syncedAt })
    }
  }
  return json({ error: 'Ruta no encontrada.' }, 404)
}

export default { async fetch(request: Request, env: Env) { try { return await handle(request, env) } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : 'Error interno.' }, 500) } } }
