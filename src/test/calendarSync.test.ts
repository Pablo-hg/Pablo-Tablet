import { describe, expect, it } from 'vitest'
import { mapGoogleEvent, mapOutlookEvent } from '../calendarSync/adapters'
import { applyCalendarSync, compactCalendarOutbox, createCalendarOutboxEntry } from '../calendarSync/repository'
import { loadDashboardState, type CalendarEvent } from '../dashboardState'

const localEvent: CalendarEvent = {
  id: 'local-1', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
  type: 'event', recurrence: 'none', completed: false, title: 'Local', date: '2026-10-11', endDate: '2026-10-11',
  startTime: '10:00', endTime: '11:00', allDay: false, location: '', notes: '', color: 'blue', reminders: [],
  timeZone: 'Europe/Madrid',
  createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T08:00:00Z',
}

describe('sincronización de calendarios', () => {
  it('convierte eventos de Google y respeta el final exclusivo de todo el día', () => {
    const event = mapGoogleEvent('g1', 'primary', { id: 'e1', summary: 'Viaje', start: { date: '2026-10-11' }, end: { date: '2026-10-13' }, etag: 'v1' })
    expect(event).toMatchObject({ provider: 'google', date: '2026-10-11', endDate: '2026-10-12', allDay: true })
  })

  it('reconoce eliminaciones de Microsoft delta', () => {
    expect(mapOutlookEvent('m1', 'calendar', { id: 'e2', '@removed': { reason: 'deleted' } })?.deleted).toBe(true)
  })

  it('mantiene el calendario local y permite Google y Outlook a la vez', () => {
    const account = { id: 'g1', provider: 'google' as const, email: 'p@example.com', displayName: 'P', status: 'syncing' as const, enabled: true, lastSyncedAt: null, error: null }
    const remote = mapGoogleEvent('g1', 'primary', { id: 'e1', summary: 'Google', start: { dateTime: '2026-10-12T10:00:00Z' }, end: { dateTime: '2026-10-12T11:00:00Z' } })!
    const result = applyCalendarSync([localEvent], [], [], account, { calendars: [], events: [remote], acknowledgedOutboxIds: [], createdEvents: [], failedOutbox: [], syncedAt: '2026-10-11T09:00:00Z' })
    const outlookAccount = { ...account, id: 'm1', provider: 'outlook' as const, email: 'p@outlook.com' }
    const outlook = mapOutlookEvent('m1', 'calendar', { id: 'e2', subject: 'Outlook', start: { dateTime: '2026-10-13T10:00:00' }, end: { dateTime: '2026-10-13T11:00:00' } })!
    const combined = applyCalendarSync(result.events, result.calendars, result.outbox, outlookAccount, { calendars: [], events: [outlook], acknowledgedOutboxIds: [], createdEvents: [], failedOutbox: [], syncedAt: '2026-10-11T09:01:00Z' })
    expect(combined.events.map((event) => event.source)).toEqual(['local', 'google', 'outlook'])
  })

  it('migra los eventos antiguos como eventos locales sin perder datos', () => {
    const legacy = { ...localEvent } as Partial<CalendarEvent>
    delete legacy.source
    delete legacy.updatedAt
    expect(loadDashboardState(JSON.stringify({ calendarEvents: [legacy] })).calendarEvents[0]).toMatchObject({ id: 'local-1', source: 'local', syncStatus: 'local' })
  })

  it('compacta crear+actualizar y cancela crear+eliminar', () => {
    const external = { ...localEvent, source: 'google' as const, accountId: 'g1', calendarId: 'primary', syncStatus: 'pending-create' as const }
    const create = createCalendarOutboxEntry(external, 'create', () => 'o1')!
    const update = createCalendarOutboxEntry({ ...external, title: 'Nuevo' }, 'update', () => 'o2')!
    expect(compactCalendarOutbox([create], update)[0].operation).toBe('create')
    const remove = createCalendarOutboxEntry(external, 'delete', () => 'o3')!
    expect(remove.event).toMatchObject({ calendarId: 'primary' })
    expect(compactCalendarOutbox([create], remove)).toEqual([])
  })

  it('sustituye el id local cuando el proveedor confirma una creación', () => {
    const account = { id: 'g1', provider: 'google' as const, email: 'p@example.com', displayName: 'P', status: 'syncing' as const, enabled: true, lastSyncedAt: null, error: null }
    const pending = { ...localEvent, id: 'draft-1', source: 'google' as const, accountId: 'g1', calendarId: 'primary', syncStatus: 'pending-create' as const }
    const entry = createCalendarOutboxEntry(pending, 'create', () => 'outbox-1')!
    const remote = mapGoogleEvent('g1', 'primary', { id: 'remote-1', summary: 'Local', start: { dateTime: '2026-10-11T10:00:00Z', timeZone: 'Europe/Madrid' }, end: { dateTime: '2026-10-11T11:00:00Z' }, etag: 'v1' })!
    const result = applyCalendarSync([pending], [], [entry], account, { calendars: [], events: [], acknowledgedOutboxIds: ['outbox-1'], createdEvents: [{ eventId: 'draft-1', event: remote }], failedOutbox: [], syncedAt: '2026-10-11T09:00:00Z' })
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ externalId: 'remote-1', syncStatus: 'synced' })
    expect(result.outbox).toEqual([])
  })

  it('conserva en la cola un conflicto sin perder el cambio local', () => {
    const account = { id: 'g1', provider: 'google' as const, email: 'p@example.com', displayName: 'P', status: 'syncing' as const, enabled: true, lastSyncedAt: null, error: null }
    const pending = { ...localEvent, id: 'google:g1:primary:e1', source: 'google' as const, accountId: 'g1', calendarId: 'primary', externalId: 'e1', externalVersion: 'v1', syncStatus: 'pending-update' as const, title: 'Cambio local' }
    const entry = createCalendarOutboxEntry(pending, 'update', () => 'outbox-1')!
    const remote = mapGoogleEvent('g1', 'primary', { id: 'e1', summary: 'Cambio remoto', start: { dateTime: '2026-10-11T10:00:00Z' }, end: { dateTime: '2026-10-11T11:00:00Z' }, etag: 'v2' })!
    const result = applyCalendarSync([pending], [], [entry], account, { calendars: [], events: [remote], acknowledgedOutboxIds: [], createdEvents: [], failedOutbox: [{ entryId: 'outbox-1', code: 'conflict', error: 'Conflicto' }], syncedAt: '2026-10-11T09:00:00Z' })
    expect(result.events[0]).toMatchObject({ title: 'Cambio local', syncStatus: 'conflict' })
    expect(result.outbox[0]).toMatchObject({ attempts: 1, lastError: 'Conflicto' })
  })

  it('no vuelve a mostrar un calendario ocultado al sincronizar', () => {
    const account = { id: 'g1', provider: 'google' as const, email: 'p@example.com', displayName: 'P', status: 'syncing' as const, enabled: true, lastSyncedAt: null, error: null }
    const calendar = { id: 'google:g1:primary', accountId: 'g1', provider: 'google' as const, remoteId: 'primary', name: 'Principal', color: 'blue' as const, visible: false, readOnly: false }
    const result = applyCalendarSync([], [calendar], [], account, { calendars: [{ ...calendar, visible: true }], events: [], acknowledgedOutboxIds: [], createdEvents: [], failedOutbox: [], syncedAt: '2026-10-11T09:00:00Z' })
    expect(result.calendars[0].visible).toBe(false)
  })
})
