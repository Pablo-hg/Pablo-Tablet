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

async function providerFetch(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!response.ok) throw new Error(`El proveedor de calendario respondió ${response.status}.`)
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

function normalizedEvent(provider: Provider, accountId: string, calendarId: string, value: unknown) {
  const raw = object(value)
  if (provider === 'google') {
    const start = object(raw.start); const end = object(raw.end); const allDay = Boolean(start.date)
    const startValue = string(start.dateTime, string(start.date)); const endValue = string(end.dateTime, string(end.date, startValue))
    const exclusive = allDay && endValue ? new Date(`${endValue}T12:00:00Z`) : null
    if (exclusive) exclusive.setUTCDate(exclusive.getUTCDate() - 1)
    return { provider, accountId, calendarId, externalId: string(raw.id), externalVersion: string(raw.etag, string(raw.updated)) || null, deleted: raw.status === 'cancelled', type: 'event', recurrence: Array.isArray(raw.recurrence) ? 'weekly' : 'none', completed: false, title: string(raw.summary, 'Sin título'), date: date(startValue), endDate: exclusive ? exclusive.toISOString().slice(0, 10) : date(endValue), startTime: allDay ? '00:00' : time(startValue), endTime: allDay ? '23:59' : time(endValue), allDay, location: string(raw.location), notes: string(raw.description), color: 'blue', updatedAt: string(raw.updated, new Date().toISOString()) }
  }
  const start = object(raw.start); const end = object(raw.end); const location = object(raw.location)
  const startValue = string(start.dateTime); const endValue = string(end.dateTime, startValue); const allDay = Boolean(raw.isAllDay)
  return { provider, accountId, calendarId, externalId: string(raw.id), externalVersion: string(raw.changeKey, string(raw['@odata.etag'])) || null, deleted: Boolean(raw.isCancelled) || Boolean(raw['@removed']), type: 'event', recurrence: raw.recurrence ? 'weekly' : 'none', completed: false, title: string(raw.subject, 'Sin título'), date: date(startValue), endDate: date(endValue), startTime: allDay ? '00:00' : time(startValue), endTime: allDay ? '23:59' : time(endValue), allDay, location: string(location.displayName), notes: string(raw.bodyPreview), color: 'mint', updatedAt: string(raw.lastModifiedDateTime, new Date().toISOString()) }
}

async function pushOutbox(provider: Provider, token: string, entries: Json[]) {
  const acknowledged: string[] = []
  for (const entry of entries) {
    const event = object(entry.event); const calendarId = string(event.calendarId); const externalId = string(event.externalId)
    if (!calendarId || !externalId) continue
    const operation = string(entry.operation)
    const endpoint = provider === 'google'
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`
      : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`
    const body = provider === 'google'
      ? { summary: event.title, description: event.notes, location: event.location, start: event.allDay ? { date: event.date } : { dateTime: `${event.date}T${event.startTime}:00` }, end: event.allDay ? { date: nextDate(event.endDate) } : { dateTime: `${event.endDate}T${event.endTime}:00` } }
      : { subject: event.title, body: { contentType: 'text', content: event.notes }, location: { displayName: event.location }, isAllDay: event.allDay, start: { dateTime: `${event.date}T${event.startTime}:00`, timeZone: 'Europe/Madrid' }, end: { dateTime: `${event.endDate}T${event.endTime}:00`, timeZone: 'Europe/Madrid' } }
    await providerFetch(endpoint, token, { method: operation === 'delete' ? 'DELETE' : 'PATCH', body: operation === 'delete' ? undefined : JSON.stringify(body), headers: entry.expectedVersion ? { 'If-Match': String(entry.expectedVersion) } : undefined })
    acknowledged.push(string(entry.id))
  }
  return acknowledged
}

async function pullGoogle(token: string, accountId: string, cursors: Json) {
  const calendarsPayload = await (await providerFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', token)).json<Json>()
  const calendarItems = Array.isArray(calendarsPayload.items) ? calendarsPayload.items.map(object) : []
  const calendars = calendarItems.map((item) => ({ id: `google:${encodeURIComponent(accountId)}:${encodeURIComponent(string(item.id))}`, accountId, provider: 'google', remoteId: string(item.id), name: string(item.summary, 'Calendario'), color: 'blue', visible: true, readOnly: item.accessRole === 'reader' }))
  const events: unknown[] = []; const nextCursors: Json = { ...cursors }
  for (const calendar of calendars) {
    const cursor = string(cursors[calendar.remoteId]); const query = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true', maxResults: '2500' })
    if (cursor) query.set('syncToken', cursor); else query.set('timeMin', new Date(Date.now() - 366 * 86400000).toISOString())
    let page = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.remoteId)}/events?${query}`
    while (page) {
      const payload = await (await providerFetch(page, token)).json<Json>()
      for (const item of Array.isArray(payload.items) ? payload.items : []) events.push(normalizedEvent('google', accountId, calendar.remoteId, item))
      page = typeof payload.nextPageToken === 'string' ? `${page.split('&pageToken=')[0]}&pageToken=${encodeURIComponent(payload.nextPageToken)}` : ''
      if (typeof payload.nextSyncToken === 'string') nextCursors[calendar.remoteId] = payload.nextSyncToken
    }
  }
  return { calendars, events, cursors: nextCursors }
}

async function pullOutlook(token: string, accountId: string, cursors: Json) {
  const calendarPayload = await (await providerFetch('https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,canEdit,color', token)).json<Json>()
  const items = Array.isArray(calendarPayload.value) ? calendarPayload.value.map(object) : []
  const calendars = items.map((item) => ({ id: `outlook:${encodeURIComponent(accountId)}:${encodeURIComponent(string(item.id))}`, accountId, provider: 'outlook', remoteId: string(item.id), name: string(item.name, 'Calendario'), color: 'mint', visible: true, readOnly: item.canEdit === false }))
  const events: unknown[] = []; const nextCursors: Json = { ...cursors }
  for (const calendar of calendars) {
    const start = new Date(Date.now() - 366 * 86400000).toISOString(); const end = new Date(Date.now() + 732 * 86400000).toISOString()
    let page = string(cursors[calendar.remoteId], `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendar.remoteId)}/calendarView/delta?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`)
    while (page) {
      const payload = await (await providerFetch(page, token)).json<Json>()
      for (const item of Array.isArray(payload.value) ? payload.value : []) events.push(normalizedEvent('outlook', accountId, calendar.remoteId, item))
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
    if (!pairing || Number(pairing.expires_at) < Date.now()) return new Response('La vinculación ha caducado.', { status: 400 })
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
      const body = await request.json<Json>(); const entries = Array.isArray(body.outbox) ? body.outbox.map(object) : []; const acknowledgedOutboxIds = await pushOutbox(provider, tokens.access_token, entries)
      const cursors = typeof row.sync_cursor === 'string' ? JSON.parse(row.sync_cursor) as Json : {}; const pulled = provider === 'google' ? await pullGoogle(tokens.access_token, String(row.id), cursors) : await pullOutlook(tokens.access_token, String(row.id), cursors)
      const syncedAt = new Date().toISOString(); await env.DB.prepare('UPDATE connections SET encrypted_tokens = ?, sync_cursor = ?, updated_at = ? WHERE id = ?').bind(await encrypt(env, tokens), JSON.stringify(pulled.cursors), Date.now(), row.id).run()
      return json({ calendars: pulled.calendars, events: pulled.events, acknowledgedOutboxIds, syncedAt })
    }
  }
  return json({ error: 'Ruta no encontrada.' }, 404)
}

export default { async fetch(request: Request, env: Env) { try { return await handle(request, env) } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : 'Error interno.' }, 500) } } }
