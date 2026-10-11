import type { CalendarEvent } from '../dashboardState'
import type { CalendarAccount, CalendarOutboxEntry, CalendarProviderId, CalendarSyncResult, RemoteCalendarEvent, SyncedCalendar } from './contracts'

export const externalCalendarEventId = (event: Pick<RemoteCalendarEvent, 'provider' | 'accountId' | 'calendarId' | 'externalId'>) =>
  `${event.provider}:${encodeURIComponent(event.accountId)}:${encodeURIComponent(event.calendarId)}:${encodeURIComponent(event.externalId)}`

function normalizedRemoteEvent(event: RemoteCalendarEvent, previous?: CalendarEvent): CalendarEvent {
  const pending = previous?.syncStatus === 'pending-create' || previous?.syncStatus === 'pending-update'
  const conflict = pending && previous.externalVersion !== event.externalVersion
  return {
    id: externalCalendarEventId(event),
    source: event.provider,
    accountId: event.accountId,
    calendarId: event.calendarId,
    externalId: event.externalId,
    externalVersion: event.externalVersion,
    syncStatus: conflict ? 'conflict' : 'synced',
    type: event.type,
    recurrence: event.recurrence,
    completed: event.completed,
    title: conflict ? previous.title : event.title,
    date: conflict ? previous.date : event.date,
    endDate: conflict ? previous.endDate : event.endDate,
    startTime: conflict ? previous.startTime : event.startTime,
    endTime: conflict ? previous.endTime : event.endTime,
    allDay: conflict ? previous.allDay : event.allDay,
    location: conflict ? previous.location : event.location,
    notes: conflict ? previous.notes : event.notes,
    color: event.color,
    reminders: conflict ? previous.reminders : [],
    createdAt: previous?.createdAt ?? event.updatedAt,
    updatedAt: event.updatedAt,
  }
}

export function applyCalendarSync(
  events: CalendarEvent[],
  calendars: SyncedCalendar[],
  outbox: CalendarOutboxEntry[],
  account: CalendarAccount,
  result: CalendarSyncResult,
) {
  const remoteById = new Map(result.events.map((event) => [externalCalendarEventId(event), event]))
  const currentById = new Map(events.map((event) => [event.id, event]))
  const deletedIds = new Set(result.events.filter((event) => event.deleted).map(externalCalendarEventId))

  const retained = events.filter((event) => event.accountId !== account.id || (!deletedIds.has(event.id) && !remoteById.has(event.id)))
  const merged = result.events.flatMap((event) => event.deleted ? [] : [normalizedRemoteEvent(event, currentById.get(externalCalendarEventId(event)))])
  const nextCalendars = [
    ...calendars.filter((calendar) => calendar.accountId !== account.id),
    ...result.calendars,
  ]
  const acknowledged = new Set(result.acknowledgedOutboxIds)

  return {
    events: [...retained, ...merged],
    calendars: nextCalendars,
    outbox: outbox.filter((entry) => !acknowledged.has(entry.id)),
    account: { ...account, status: 'connected' as const, lastSyncedAt: result.syncedAt, error: null },
  }
}

export function createCalendarOutboxEntry(
  event: CalendarEvent,
  operation: CalendarOutboxEntry['operation'],
  createId: () => string,
  now = new Date(),
): CalendarOutboxEntry | null {
  if (event.source === 'local' || !event.accountId || (event.source !== 'google' && event.source !== 'outlook')) return null
  return {
    id: createId(),
    accountId: event.accountId,
    provider: event.source,
    eventId: event.id,
    operation,
    event: operation === 'delete' ? null : event,
    expectedVersion: event.externalVersion,
    createdAt: now.toISOString(),
    attempts: 0,
    lastError: null,
  }
}

export function compactCalendarOutbox(entries: CalendarOutboxEntry[], next: CalendarOutboxEntry) {
  const unrelated = entries.filter((entry) => entry.eventId !== next.eventId)
  const previous = entries.findLast((entry) => entry.eventId === next.eventId)
  if (previous?.operation === 'create' && next.operation === 'delete') return unrelated
  if (previous?.operation === 'create' && next.operation === 'update') return [...unrelated, { ...next, operation: 'create' as const }]
  return [...unrelated, next]
}

export function providerLabel(provider: CalendarProviderId) {
  return provider === 'google' ? 'Google' : 'Outlook'
}
