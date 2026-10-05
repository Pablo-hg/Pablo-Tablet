import type { Timer } from './dashboardState'

export function timerRemainingSeconds(timer: Timer, now: Date) {
  if (!timer.endsAt) return Math.max(0, timer.remainingSeconds)
  return Math.max(0, Math.min(
    timer.remainingSeconds,
    Math.ceil((new Date(timer.endsAt).getTime() - now.getTime()) / 1000),
  ))
}

export function startTimer(timer: Timer, now: Date): Timer {
  const remainingSeconds = timer.remainingSeconds > 0 ? timer.remainingSeconds : timer.durationSeconds
  return {
    ...timer,
    remainingSeconds,
    endsAt: new Date(now.getTime() + remainingSeconds * 1000).toISOString(),
  }
}

export function pauseTimer(timer: Timer, now: Date): Timer {
  return { ...timer, remainingSeconds: timerRemainingSeconds(timer, now), endsAt: null }
}

export function resetTimer(timer: Timer): Timer {
  return { ...timer, remainingSeconds: timer.durationSeconds, endsAt: null }
}

export function timerHasFinished(timer: Timer, now: Date) {
  return Boolean(timer.endsAt && new Date(timer.endsAt).getTime() <= now.getTime())
}

export function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}
