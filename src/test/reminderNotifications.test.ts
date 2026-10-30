import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Alarm, CalendarEvent } from '../dashboardState'
import { MAX_SCHEDULED_CALENDAR_NOTIFICATIONS, syncAlarmNotifications, syncCalendarEventNotifications } from '../reminderNotifications'

const notificationPlugin = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  checkExactNotificationSetting: vi.fn(),
  getPending: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  removeDeliveredNotificationsById: vi.fn(),
  cancel: vi.fn(),
  update: vi.fn(),
  schedule: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: notificationPlugin,
  Weekday: {},
}))

vi.mock('../alarmSounds', () => ({
  alarmChannelId: vi.fn((id: string) => `alarm-${id}`),
  configureAlarmChannel: vi.fn(async (alarm: Alarm) => `alarm-${alarm.id}`),
  configureAlertChannel: vi.fn(async () => undefined),
}))

const alarm: Alarm = {
  id: 'alarm-1',
  label: 'Despertar',
  time: '07:30',
  enabled: true,
  weekdays: [1],
  soundName: 'Predeterminado',
  soundUri: null,
  createdAt: '2026-10-10T00:00:00.000Z',
}

describe('sincronización de notificaciones locales', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.clearAllMocks()
    notificationPlugin.checkPermissions.mockResolvedValue({ display: 'granted' })
    notificationPlugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' })
    notificationPlugin.getPending.mockResolvedValue({ notifications: [] })
    notificationPlugin.getDeliveredNotifications.mockResolvedValue({ notifications: [] })
    notificationPlugin.removeDeliveredNotificationsById.mockResolvedValue(undefined)
    notificationPlugin.cancel.mockResolvedValue(undefined)
    notificationPlugin.update.mockResolvedValue({ notifications: [] })
    notificationPlugin.schedule.mockResolvedValue({ notifications: [] })
  })

  it('programa una alarma nueva con un identificador estable', async () => {
    await syncAlarmNotifications([alarm])

    expect(notificationPlugin.schedule).toHaveBeenCalledTimes(1)
    expect(notificationPlugin.schedule).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({
        title: 'Despertar',
        channelId: 'alarm-alarm-1',
        isExactNotification: true,
        extra: expect.objectContaining({ source: 'pablo-tablet-alarm', alarmId: 'alarm-1' }),
      })],
    })
    expect(notificationPlugin.requestPermissions).not.toHaveBeenCalled()
  })

  it('actualiza la programación existente sin crear un duplicado', async () => {
    await syncAlarmNotifications([alarm])
    const scheduled = notificationPlugin.schedule.mock.calls[0][0].notifications[0]
    notificationPlugin.schedule.mockClear()
    notificationPlugin.getPending.mockResolvedValue({ notifications: [scheduled] })

    await syncAlarmNotifications([{ ...alarm, label: 'Medicinas' }])

    expect(notificationPlugin.update).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ id: scheduled.id, title: 'Medicinas' })],
    })
    expect(notificationPlugin.schedule).not.toHaveBeenCalled()
  })

  it('cancela avisos y pospuestos huérfanos al desactivar una alarma', async () => {
    notificationPlugin.getPending.mockResolvedValue({
      notifications: [
        { id: 101, extra: { source: 'pablo-tablet-alarm', alarmId: 'alarm-1' } },
        { id: 102, extra: { source: 'pablo-tablet-alarm-snooze', alarmId: 'alarm-1' } },
      ],
    })
    notificationPlugin.getDeliveredNotifications.mockResolvedValue({
      notifications: [{ id: 103, extra: { source: 'pablo-tablet-alarm-snooze', alarmId: 'alarm-1' } }],
    })

    await syncAlarmNotifications([{ ...alarm, enabled: false }])

    expect(notificationPlugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 101 }, { id: 102 }] })
    expect(notificationPlugin.removeDeliveredNotificationsById).toHaveBeenCalledWith({ ids: [103] })
    expect(notificationPlugin.schedule).not.toHaveBeenCalled()
  })

  it('no abre diálogos ni programa en segundo plano mientras falta el permiso', async () => {
    notificationPlugin.checkPermissions.mockResolvedValue({ display: 'prompt' })

    await syncAlarmNotifications([alarm])

    expect(notificationPlugin.requestPermissions).not.toHaveBeenCalled()
    expect(notificationPlugin.checkExactNotificationSetting).not.toHaveBeenCalled()
    expect(notificationPlugin.getPending).toHaveBeenCalledTimes(1)
    expect(notificationPlugin.schedule).not.toHaveBeenCalled()
  })

  it('sí cancela avisos obsoletos aunque el permiso de visualización esté denegado', async () => {
    notificationPlugin.checkPermissions.mockResolvedValue({ display: 'denied' })
    notificationPlugin.getPending.mockResolvedValue({
      notifications: [{ id: 201, extra: { source: 'pablo-tablet-alarm', alarmId: 'alarm-1' } }],
    })

    await syncAlarmNotifications([{ ...alarm, enabled: false }])

    expect(notificationPlugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 201 }] })
    expect(notificationPlugin.schedule).not.toHaveBeenCalled()
  })

  it('usa programación inexacta sin abrir Ajustes cuando Android no concede alarmas exactas', async () => {
    notificationPlugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' })

    await syncAlarmNotifications([alarm])

    expect(notificationPlugin.schedule).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ isExactNotification: false })],
    })
  })

  it.each([
    { recurrence: 'daily' as const, date: '2020-01-01', now: '2026-10-30T10:00:00', next: '2026-10-30', count: 40 },
    { recurrence: 'weekly' as const, date: '2020-01-01', now: '2026-10-30T10:00:00', next: '2026-11-04', count: 40 },
    { recurrence: 'monthly' as const, date: '2020-01-31', now: '2026-02-28T10:00:00', next: '2026-02-28', count: 24 },
    { recurrence: 'yearly' as const, date: '2000-02-29', now: '2026-02-28T10:00:00', next: '2026-02-28', count: 10 },
  ])('programa las próximas ocurrencias de una serie antigua $recurrence', async ({ recurrence, date, now, next, count }) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    const event: CalendarEvent = {
      id: 'old-series', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
      type: 'event', recurrence, completed: false, title: 'Serie antigua', date, endDate: date,
      startTime: '12:00', endTime: '13:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'sun',
      reminders: [{ id: 'r1', date, time: '11:55' }], createdAt: '', updatedAt: '',
    }
    await syncCalendarEventNotifications([event])
    expect(notificationPlugin.schedule).toHaveBeenCalledOnce()
    const scheduled = notificationPlugin.schedule.mock.calls[0][0].notifications
    expect(scheduled).toHaveLength(count)
    expect(scheduled[0].schedule.at).toEqual(new Date(`${next}T11:55:00`))
    expect(scheduled.every((notification: { schedule: { at: Date } }) => notification.schedule.at.getTime() > Date.now())).toBe(true)
    if (recurrence === 'monthly') expect(scheduled[1].schedule.at).toEqual(new Date('2026-03-31T11:55:00'))
    if (recurrence === 'yearly') expect(scheduled[2].schedule.at).toEqual(new Date('2028-02-29T11:55:00'))
  })

  it('conserva IDs al desplazar la ventana diaria y repone la última ocurrencia', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T10:00:00'))
    const event: CalendarEvent = {
      id: 'daily-series', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
      type: 'event', recurrence: 'daily', completed: false, title: 'Serie', date: '2020-01-01', endDate: '2020-01-01',
      startTime: '12:00', endTime: '13:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'sun',
      reminders: [{ id: 'r1', date: '2020-01-01', time: '11:55' }], createdAt: '', updatedAt: '',
    }
    await syncCalendarEventNotifications([event])
    expect(notificationPlugin.schedule).toHaveBeenCalledOnce()
    const first = notificationPlugin.schedule.mock.calls[0][0].notifications
    notificationPlugin.getPending.mockResolvedValue({ notifications: first.slice(1) })
    notificationPlugin.schedule.mockClear()
    vi.setSystemTime(new Date('2026-10-31T10:00:00'))
    await syncCalendarEventNotifications([event])
    expect(notificationPlugin.update.mock.calls[0][0].notifications.map((notification: { id: number }) => notification.id))
      .toEqual(first.slice(1).map((notification: { id: number }) => notification.id))
    expect(notificationPlugin.schedule.mock.calls[0][0].notifications).toHaveLength(1)
  })

  it('busca por la fecha del aviso cuando el recordatorio precede varios días al evento', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T10:00:00'))
    const event: CalendarEvent = {
      id: 'early-reminder', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
      type: 'event', recurrence: 'weekly', completed: false, title: 'Serie', date: '2020-01-01', endDate: '2020-01-01',
      startTime: '12:00', endTime: '13:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'sun',
      reminders: [{ id: 'r1', date: '2019-12-29', time: '11:55' }], createdAt: '', updatedAt: '',
    }
    await syncCalendarEventNotifications([event])
    expect(notificationPlugin.schedule).toHaveBeenCalledOnce()
    expect(notificationPlugin.schedule.mock.calls[0][0].notifications[0].schedule.at).toEqual(new Date('2026-11-01T11:55:00'))
  })

  it('limita los recordatorios de calendario y conserva primero los más próximos', async () => {
    const events = Array.from({ length: 200 }, (_, index): CalendarEvent => {
      const date = new Date(Date.UTC(2099, 0, index + 1)).toISOString().slice(0, 10)
      return {
        id: `event-${index}`,
        source: 'google',
        accountId: 'google-1',
        calendarId: 'primary',
        externalId: `remote-${index}`,
        externalVersion: 'v1',
        syncStatus: 'synced',
        type: 'event',
        recurrence: 'none',
        completed: false,
        title: `Evento ${index}`,
        date,
        endDate: date,
        startTime: '10:00',
        endTime: '11:00',
        allDay: false,
        timeZone: 'Europe/Madrid',
        location: '',
        notes: '',
        color: 'blue',
        reminders: [{ id: `reminder-${index}`, date, time: '09:45' }],
        createdAt: '2098-12-01T00:00:00.000Z',
        updatedAt: '2098-12-01T00:00:00.000Z',
      }
    })

    await syncCalendarEventNotifications(events.reverse())

    const scheduled = notificationPlugin.schedule.mock.calls[0][0].notifications
    expect(scheduled).toHaveLength(MAX_SCHEDULED_CALENDAR_NOTIFICATIONS)
    expect(scheduled[0].title).toBe('Evento 0')
    expect(scheduled.at(-1)?.title).toBe(`Evento ${MAX_SCHEDULED_CALENDAR_NOTIFICATIONS - 1}`)
  })

  it('cancela el exceso ya programado antes de actualizar los recordatorios conservados', async () => {
    const date = '2099-01-01'
    const event: CalendarEvent = {
      id: 'event-recovery', source: 'google', accountId: 'google-1', calendarId: 'primary', externalId: 'remote-1', externalVersion: 'v1', syncStatus: 'synced',
      type: 'event', recurrence: 'none', completed: false, title: 'Cita', date, endDate: date, startTime: '10:00', endTime: '11:00', allDay: false,
      timeZone: 'Europe/Madrid', location: '', notes: '', color: 'blue', reminders: [{ id: 'reminder-1', date, time: '09:45' }],
      createdAt: '2098-12-01T00:00:00.000Z', updatedAt: '2098-12-01T00:00:00.000Z',
    }

    await syncCalendarEventNotifications([event])
    const desired = notificationPlugin.schedule.mock.calls[0][0].notifications[0]
    notificationPlugin.schedule.mockClear()
    notificationPlugin.getPending.mockResolvedValue({
      notifications: [
        desired,
        ...Array.from({ length: 499 }, (_, index) => ({
          id: 10_000 + index,
          extra: { source: 'pablo-tablet-calendar-event', calendarEventId: `old-${index}` },
        })),
      ],
    })

    await syncCalendarEventNotifications([event])

    expect(notificationPlugin.cancel).toHaveBeenCalledWith({
      notifications: Array.from({ length: 499 }, (_, index) => ({ id: 10_000 + index })),
    })
    expect(notificationPlugin.update).toHaveBeenCalledWith({ notifications: [expect.objectContaining({ id: desired.id })] })
    expect(notificationPlugin.cancel.mock.invocationCallOrder[0]).toBeLessThan(notificationPlugin.update.mock.invocationCallOrder[0])
    expect(notificationPlugin.schedule).not.toHaveBeenCalled()
  })

  it('recupera alarmas huérfanas aunque el plugin no las devuelva como pendientes', async () => {
    const events = Array.from({ length: 500 }, (_, index): CalendarEvent => {
      const date = new Date(Date.UTC(2099, 0, index + 1)).toISOString().slice(0, 10)
      return {
        id: `orphan-${index}`, source: 'google', accountId: 'google-1', calendarId: 'primary', externalId: `remote-${index}`, externalVersion: 'v1', syncStatus: 'synced',
        type: 'event', recurrence: 'none', completed: false, title: `Huérfana ${index}`, date, endDate: date, startTime: '10:00', endTime: '11:00', allDay: false,
        timeZone: 'Europe/Madrid', location: '', notes: '', color: 'blue', reminders: [{ id: `reminder-${index}`, date, time: '09:45' }],
        createdAt: '2098-12-01T00:00:00.000Z', updatedAt: '2098-12-01T00:00:00.000Z',
      }
    })

    await syncCalendarEventNotifications(events)

    const cancelledIds = notificationPlugin.cancel.mock.calls.flatMap(([request]) => request.notifications.map(({ id }: { id: number }) => id))
    expect(cancelledIds).toHaveLength(500)
    expect(new Set(cancelledIds).size).toBe(500)
    expect(notificationPlugin.cancel).toHaveBeenCalledTimes(4)
    expect(notificationPlugin.schedule.mock.calls[0][0].notifications).toHaveLength(MAX_SCHEDULED_CALENDAR_NOTIFICATIONS)
    expect(notificationPlugin.cancel.mock.invocationCallOrder.at(-1)).toBeLessThan(notificationPlugin.schedule.mock.invocationCallOrder[0])
  })
})
