import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Alarm } from '../dashboardState'
import { syncAlarmNotifications } from '../reminderNotifications'

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
})
