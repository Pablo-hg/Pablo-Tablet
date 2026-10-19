import type { CalendarEvent } from '../dashboardState'
import type { CalendarAccount, CalendarOutboxEntry, CalendarProviderId, CalendarSyncResult, RemoteCalendarEvent, SyncedCalendar } from './contracts'

export const externalCalendarEventId = (event: Pick<RemoteCalendarEvent, 'provider' | 'accountId' | 'calendarId' | 'externalId'>) =>
  `${event.provider}:${encodeURIComponent(event.accountId)}:${encodeURIComponent(event.calendarId)}:${encodeURIComponent(event.externalId)}`

function normalizedRemoteEvent(event: RemoteCalendarEvent, previous?: CalendarEvent): CalendarEvent {
  const pending = previous?.syncStatus === 'pending-update'
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
    isHoliday: conflict ? previous.isHoliday : event.isHoliday,
    timeZone: conflict ? previous.timeZone : event.timeZone,
    location: conflict ? previous.location : event.location,
    notes: conflict ? previous.notes : event.notes,
    color: event.color,
    reminders: conflict ? previous.reminders : event.reminders,
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
  const allRemoteEvents = [...result.events, ...result.createdEvents.map((created) => created.event)]
  const remoteById = new Map(allRemoteEvents.map((event) => [externalCalendarEventId(event), event]))
  const currentById = new Map(events.map((event) => [event.id, event]))
  for (const created of result.createdEvents) currentById.set(externalCalendarEventId(created.event), currentById.get(created.eventId) ?? currentById.get(externalCalendarEventId(created.event))!)
  const deletedIds = new Set(allRemoteEvents.filter((event) => event.deleted).map(externalCalendarEventId))
  const replacedClientIds = new Set(result.createdEvents.map((created) => created.eventId))

  const retained = events.filter((event) => !replacedClientIds.has(event.id) && (event.accountId !== account.id || (!deletedIds.has(event.id) && !remoteById.has(event.id))))
  const mergedById = new Map<string, CalendarEvent>()
  for (const event of allRemoteEvents) {
    if (!event.deleted) mergedById.set(externalCalendarEventId(event), normalizedRemoteEvent(event, currentById.get(externalCalendarEventId(event))))
  }
  const nextCalendars = [
    ...calendars.filter((calendar) => calendar.accountId !== account.id),
    ...result.calendars.map((calendar) => ({ ...calendar, visible: true })),
  ]
  const acknowledged = new Set(result.acknowledgedOutboxIds)
  const failed = new Map(result.failedOutbox.map((entry) => [entry.entryId, entry]))

  return {
    events: [...retained, ...mergedById.values()],
    calendars: nextCalendars,
    outbox: outbox.filter((entry) => !acknowledged.has(entry.id)).map((entry) => {
      const failure = failed.get(entry.id)
      return failure ? { ...entry, attempts: entry.attempts + 1, lastError: failure.error } : entry
    }),
    account: {
      ...account,
      status: result.failedOutbox.some((entry) => entry.code === 'reauthorize') ? 'reauthorize' as const : 'connected' as const,
      lastSyncedAt: result.syncedAt,
      error: result.failedOutbox.length > 0 ? result.failedOutbox[0].error : null,
    },
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
    event,
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
