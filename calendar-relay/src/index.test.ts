import { afterEach, describe, expect, it, vi } from 'vitest'

import { pullGoogle, pullOutlook } from './index'

const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('calendar provider pagination', () => {
  it('recovers an invalid Google cursor and follows every page', async () => {
    const requested: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      if (url.endsWith('/calendarList')) return jsonResponse({ items: [{ id: 'primary', summary: 'Personal', backgroundColor: '#0b8043' }] })
      if (url.includes('syncToken=expired')) return jsonResponse({ error: { message: 'Sync token is no longer valid.' } }, 410)
      if (url.includes('pageToken=page-2')) return jsonResponse({ items: [{ id: 'event-2', summary: 'Segundo', start: { date: '2026-10-14' }, end: { date: '2026-10-15' } }], nextSyncToken: 'fresh-token' })
      return jsonResponse({ items: [{ id: 'event-1', summary: 'Primero', start: { date: '2026-10-13' }, end: { date: '2026-10-14' } }], nextPageToken: 'page-2' })
    }))

    const result = await pullGoogle('access-token', 'account-1', { primary: 'expired' })

    expect(result.events).toHaveLength(2)
    expect(result.cursors.primary).toBe('fresh-token')
    expect(requested.some((url) => url.includes('syncToken=expired'))).toBe(true)
    expect(requested.some((url) => url.includes('timeMin='))).toBe(true)
    expect(requested.some((url) => url.includes('pageToken=page-2'))).toBe(true)
  })

  it('recovers an invalid Outlook delta link and follows nextLink', async () => {
    const requested: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/me/calendars?')) return jsonResponse({ value: [{ id: 'calendar-1', name: 'Trabajo', canEdit: true, color: 'lightGreen' }] })
      if (url === 'https://graph.microsoft.com/expired-delta') return jsonResponse({ error: { message: 'Sync state not found.' } }, 410)
      if (url === 'https://graph.microsoft.com/page-2') return jsonResponse({ value: [{ id: 'event-2', subject: 'Segundo', start: { dateTime: '2026-10-14T10:00:00', timeZone: 'Europe/Madrid' }, end: { dateTime: '2026-10-14T11:00:00', timeZone: 'Europe/Madrid' } }], '@odata.deltaLink': 'https://graph.microsoft.com/fresh-delta' })
      return jsonResponse({ value: [{ id: 'event-1', subject: 'Primero', start: { dateTime: '2026-10-13T10:00:00', timeZone: 'Europe/Madrid' }, end: { dateTime: '2026-10-13T11:00:00', timeZone: 'Europe/Madrid' } }], '@odata.nextLink': 'https://graph.microsoft.com/page-2' })
    }))

    const result = await pullOutlook('access-token', 'account-1', { 'calendar-1': 'https://graph.microsoft.com/expired-delta' })

    expect(result.events).toHaveLength(2)
    expect(result.cursors['calendar-1']).toBe('https://graph.microsoft.com/fresh-delta')
    expect(requested).toContain('https://graph.microsoft.com/expired-delta')
    expect(requested.some((url) => url.includes('/calendarView/delta?'))).toBe(true)
    expect(requested).toContain('https://graph.microsoft.com/page-2')
  })
})
