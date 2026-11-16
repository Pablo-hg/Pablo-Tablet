import { describe, expect, it, vi } from 'vitest'
import { deliveredCalendarReminders } from '../calendarReminderDelivery'
import { LocalNotifications } from '@capacitor/local-notifications'

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { getDeliveredNotifications: vi.fn(), getByIds: vi.fn() } }))
describe('recuperación de recordatorios Android', () => {
  it('recupera extra del almacenamiento para abrir el modal incluso sin callback recibido', async () => {
    vi.mocked(LocalNotifications.getDeliveredNotifications).mockResolvedValue({ notifications: [{ id: 5, title: 'Comprar pilas', body: 'Empieza a las 19:00' }, { id: 6, title: 'Otra', body: '' }] })
    const reminder = { id: 5, title: 'Comprar pilas', body: 'Empieza a las 19:00', extra: { kind: 'calendar', calendarEventId: 'task', calendarReminderId: 'reminder', recurrenceIndex: 0 } }
    vi.mocked(LocalNotifications.getByIds).mockResolvedValue({ notifications: [reminder, { id: 6, title: 'Otra', body: '', extra: { kind: 'alarm' } }] })
    expect(await deliveredCalendarReminders()).toEqual([reminder])
    expect(LocalNotifications.getByIds).toHaveBeenCalledWith({ ids: [5, 6] })
  })
  it('no recupera avisos programados que todavía no se han entregado', async () => {
    vi.mocked(LocalNotifications.getDeliveredNotifications).mockResolvedValue({ notifications: [] })
    expect(await deliveredCalendarReminders()).toEqual([])
    expect(LocalNotifications.getByIds).not.toHaveBeenCalled()
  })
})
