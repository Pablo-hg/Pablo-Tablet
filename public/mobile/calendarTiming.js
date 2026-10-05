const DAY_MILLISECONDS = 86_400_000

function dateKeyToDayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return Math.floor(timestamp / DAY_MILLISECONDS)
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function calendarEventTiming(event, now = new Date()) {
  const startDate = typeof event?.date === 'string' ? event.date : ''
  const endDate = typeof event?.endDate === 'string' ? event.endDate : startDate
  const startDay = dateKeyToDayNumber(startDate)
  const endDay = dateKeyToDayNumber(endDate)
  const durationDays = startDay === null || endDay === null ? 1 : Math.max(1, endDay - startDay + 1)
  const today = localDateKey(now)
  const recurring = event?.recurrence && event.recurrence !== 'none'
  const completedTask = event?.type === 'task' && Boolean(event.completed)
  const overdueTask = event?.type === 'task' && !event.completed && !recurring && endDate < today
  let ended = completedTask

  if (event?.type !== 'task' && !recurring) {
    if (endDate < today) ended = true
    else if (endDate === today && !event.allDay) {
      const endTime = /^\d{2}:\d{2}$/.test(String(event.endTime ?? '')) ? event.endTime : event.startTime
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      ended = /^\d{2}:\d{2}$/.test(String(endTime ?? '')) && endTime <= currentTime
    }
  }

  const status = ended
    ? 'Finalizado'
    : overdueTask
      ? 'Vencida'
      : recurring
        ? 'Se repite'
        : startDate > today
          ? 'Próximo'
          : 'En curso'

  return {
    durationDays,
    durationLabel: `${durationDays} ${durationDays === 1 ? 'día' : 'días'}`,
    ended,
    status,
  }
}
