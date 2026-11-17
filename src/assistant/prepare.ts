import type { DashboardState } from '../dashboardState'
import { toLocalDateKey } from '../calendarRecurrence'
import { txFor } from '../i18n'
import type { AssistantCommand } from './contracts'

export function prepareAssistantCommand(state: DashboardState, command: AssistantCommand, now = new Date()): AssistantCommand {
  const normalizeTitle = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
  if (command.type === 'request_note_rename') {
    const matches = state.notes.filter(note => !note.archived && normalizeTitle(note.title) === normalizeTitle(command.args.title))
    if (matches.length !== 1) throw new Error(txFor(state.preferences.assistantLanguage, matches.length ? 'Hay varias notas activas con ese título. Cámbiales el nombre en Notas antes de continuar.' : 'No he encontrado una nota activa con ese título.'))
    const note = matches[0]
    return { type: 'rename_local_note', args: { id: note.id, expected: JSON.stringify(note), title: note.title, newTitle: command.args.newTitle } }
  }
  if (command.type !== 'request_task_change' && command.type !== 'request_event_change') return command
  const eventChange = command.type === 'request_event_change'
  const matchingTasks = state.calendarEvents.filter(item => item.type === (eventChange ? 'event' : 'task') && item.syncStatus !== 'pending-delete' && (!command.args.date || item.date === command.args.date) && normalizeTitle(item.title) === normalizeTitle(command.args.title))
  const pending = matchingTasks.filter(item => !item.completed)
  const currentOrFuture = pending.filter(item => item.date >= toLocalDateKey(now))
  // Una fecha explícita también permite seleccionar una tarea pasada.
  const latestPastDate = pending.reduce((latest, item) => item.date > latest ? item.date : latest, '')
  const matches = command.args.date ? pending : currentOrFuture.length ? currentOrFuture : pending.filter(item => item.date === latestPastDate)
  if (!eventChange && matches.length === 0 && matchingTasks.some(item => item.completed)) throw new Error(txFor(state.preferences.assistantLanguage, 'No hay ninguna tarea pendiente con ese título; hay tareas completadas con ese nombre.'))
  const language = state.preferences.assistantLanguage
  if (matches.length > 1) {
    const dates = [...new Set(matches.map(item => item.date))].sort().slice(0, 8).join(', ')
    throw new Error(txFor(language, eventChange ? 'He encontrado {{count}} eventos con ese título. Fechas: {{dates}}. Indica la fecha; si coinciden, revísalos en Calendario.' : 'He encontrado {{count}} tareas pendientes con ese título. Fechas: {{dates}}. Indica la fecha; si coinciden, revísalas en Calendario.', { count: matches.length, dates }))
  }
  if (!matches.length) throw new Error(txFor(language, eventChange ? 'No he encontrado un evento con ese título y fecha.' : 'No he encontrado una tarea pendiente con ese título y fecha.'))
  const task = matches[0]
  if (task.source !== 'local' || task.recurrence !== 'none') throw new Error(txFor(language, eventChange ? 'Solo puedo modificar eventos locales sin repetición.' : 'Solo puedo modificar tareas locales sin repetición.'))
  if (command.type === 'request_event_change') return { type: 'update_local_event', args: { id: task.id, expected: JSON.stringify(task), title: task.title, date: task.date, timeZone: task.timeZone, action: 'rename', newTitle: command.args.newTitle } }
  return { type: 'update_local_task', args: { id: task.id, expected: JSON.stringify(task), title: task.title, date: task.date, timeZone: task.timeZone, action: command.args.action, newTitle: command.args.newTitle } }
}
