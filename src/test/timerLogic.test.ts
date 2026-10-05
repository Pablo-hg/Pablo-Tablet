import { describe, expect, it } from 'vitest'
import { formatCountdown, pauseTimer, resetTimer, startTimer, timerHasFinished, timerRemainingSeconds } from '../timerLogic'
import type { Timer } from '../dashboardState'

const baseTimer: Timer = {
  id: 'timer-1',
  label: 'Horno',
  durationSeconds: 300,
  remainingSeconds: 300,
  endsAt: null,
  createdAt: '2026-10-04T10:00:00.000Z',
}

describe('temporizadores', () => {
  it('inicia, descuenta y pausa conservando el tiempo restante', () => {
    const start = new Date('2026-10-04T10:00:00.000Z')
    const running = startTimer(baseTimer, start)
    expect(running.endsAt).toBe('2026-10-04T10:05:00.000Z')
    expect(timerRemainingSeconds(running, new Date('2026-10-04T10:01:15.000Z'))).toBe(225)

    const paused = pauseTimer(running, new Date('2026-10-04T10:01:15.000Z'))
    expect(paused).toMatchObject({ remainingSeconds: 225, endsAt: null })
  })

  it('reinicia y vuelve a usar la duración completa después de finalizar', () => {
    const finished = { ...baseTimer, remainingSeconds: 0 }
    const restarted = startTimer(finished, new Date('2026-10-04T11:00:00.000Z'))
    expect(restarted.remainingSeconds).toBe(300)
    expect(resetTimer({ ...restarted, remainingSeconds: 100 })).toMatchObject({ remainingSeconds: 300, endsAt: null })
  })

  it('detecta el final y nunca muestra valores negativos', () => {
    const running = { ...baseTimer, endsAt: '2026-10-04T10:05:00.000Z' }
    const afterEnd = new Date('2026-10-04T10:06:00.000Z')
    expect(timerHasFinished(running, afterEnd)).toBe(true)
    expect(timerRemainingSeconds(running, afterEnd)).toBe(0)
    expect(formatCountdown(-3)).toBe('00:00')
    expect(formatCountdown(125)).toBe('02:05')
  })
})
