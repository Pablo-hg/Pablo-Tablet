export interface MobileCalendarEventTimingInput {
  type?: string
  recurrence?: string
  completed?: boolean
  date?: string
  endDate?: string
  startTime?: string
  endTime?: string
  allDay?: boolean
}

export interface MobileCalendarEventTiming {
  durationDays: number
  durationLabel: string
  ended: boolean
  status: 'Finalizado' | 'Vencida' | 'Se repite' | 'Próximo' | 'En curso'
}

export function calendarEventTiming(event: MobileCalendarEventTimingInput, now?: Date): MobileCalendarEventTiming
