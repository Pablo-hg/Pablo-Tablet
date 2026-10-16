import type { CalendarEvent, CalendarEventColor, CalendarEventRecurrence, CalendarEventReminder, CalendarEventType } from '../dashboardState'

export type CalendarProviderId = 'google' | 'outlook'
export type CalendarSource = 'local' | 'native' | CalendarProviderId
export type CalendarConnectionStatus = 'connecting' | 'connected' | 'syncing' | 'offline' | 'reauthorize' | 'error'
export type CalendarEventSyncStatus = 'local' | 'synced' | 'pending-create' | 'pending-update' | 'pending-delete' | 'conflict' | 'error'

export interface CalendarAccount {
  id: string
  provider: CalendarProviderId
  email: string
  displayName: string
  status: CalendarConnectionStatus
  enabled: boolean
  lastSyncedAt: string | null
  error: string | null
}

export interface SyncedCalendar {
  id: string
  accountId: string
  provider: CalendarProviderId
  remoteId: string
  name: string
  color: CalendarEventColor
  visible: boolean
  readOnly: boolean
}

export interface CalendarOutboxEntry {
  id: string
  accountId: string
  provider: CalendarProviderId
  eventId: string
  operation: 'create' | 'update' | 'delete'
  event: CalendarEvent | null
  expectedVersion: string | null
  createdAt: string
  attempts: number
  lastError: string | null
}

export interface RemoteCalendarEvent {
  provider: CalendarProviderId
  accountId: string
  calendarId: string
  externalId: string
  externalVersion: string | null
  deleted: boolean
  type: CalendarEventType
  recurrence: CalendarEventRecurrence
  completed: boolean
  title: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  allDay: boolean
  timeZone: string
  location: string
  notes: string
  color: CalendarEventColor
  reminders: CalendarEventReminder[]
  updatedAt: string
}

export interface CalendarPairing {
  id: string
  provider: CalendarProviderId
  authorizationUrl: string
  pollToken: string
  expiresAt: string
}

export interface CalendarConnectionResult {
  state: 'pending' | 'connected' | 'expired' | 'error'
  account?: CalendarAccount
  connectionToken?: string
  error?: string
}

export interface CalendarSyncResult {
  calendars: SyncedCalendar[]
  events: RemoteCalendarEvent[]
  acknowledgedOutboxIds: string[]
  createdEvents: Array<{ eventId: string; event: RemoteCalendarEvent }>
  failedOutbox: Array<{ entryId: string; code: 'conflict' | 'reauthorize' | 'temporary' | 'error'; error: string }>
  syncedAt: string
}

export interface CalendarRelay {
  beginConnection(provider: CalendarProviderId): Promise<CalendarPairing>
  getConnection(pairingId: string, pollToken: string): Promise<CalendarConnectionResult>
  synchronize(account: CalendarAccount, connectionToken: string, outbox: CalendarOutboxEntry[]): Promise<CalendarSyncResult>
  disconnect(account: CalendarAccount, connectionToken: string): Promise<void>
}
