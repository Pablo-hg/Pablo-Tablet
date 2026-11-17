import { tx } from '../i18n'

export type AssistantCommand =
  | { type: 'get_current_datetime'; args: { part: 'time' | 'date' } }
  | { type: 'get_daily_summary'; args: { date: string } }
  | { type: 'get_weather'; args: { period: 'now' | 'today' | 'tomorrow' | 'next_week' } }
  | { type: 'get_calendar'; args: { from: string; to: string; type?: 'task' | 'event' | 'birthday'; taskStatus?: 'completed' | 'pending' } }
  | { type: 'search_tasks'; args: { query: string } }
  | { type: 'get_notes'; args: { limit: number } }
  | { type: 'search_notes'; args: { query: string; limit: number } }
  | { type: 'read_note'; args: { query: string } }
  | { type: 'read_note_id'; args: { id: string } }
  | { type: 'get_clock_status'; args: { include: 'alarms' | 'timers' | 'both' } }
  | { type: 'create_task_reminder'; args: { title: string; date: string; timeZone: string; time: string; reminderMinutesBefore?: number } }
  | { type: 'create_birthday'; args: { title: string; date: string; timeZone: string } }
  | { type: 'create_event'; args: { title: string; date: string; timeZone: string; startTime: string; endTime: string } }
  | { type: 'request_note_rename'; args: { title: string; newTitle: string } }
  | { type: 'rename_local_note'; args: { id: string; expected: string; title: string; newTitle: string } }
  | { type: 'request_event_change'; args: { title: string; action: 'rename'; newTitle: string; date?: string } }
  | { type: 'update_local_event'; args: { id: string; expected: string; title: string; date: string; timeZone: string; action: 'rename'; newTitle: string } }
  | { type: 'request_task_change'; args: { title: string; action: 'complete' | 'rename'; newTitle: string; date?: string } }
  | { type: 'update_local_task'; args: { id: string; expected: string; title: string; date: string; timeZone: string; action: 'complete' | 'rename'; newTitle: string } }
  | { type: 'create_task'; args: { title: string; date: string; timeZone: string } }
  | { type: 'create_note'; args: { title: string; content: string; reminderAt: string | null } }
  | { type: 'create_alarm'; args: { label: string; at: string; repeatDays: number[] } }
  | { type: 'start_timer'; args: { label: string; durationSeconds: number } }
  | { type: 'get_local_help'; args: { topic: string } }

export type AssistantCommandType = AssistantCommand['type']

export interface AssistantRequest {
  text: string
  locale: 'es-ES' | 'en-GB'
  now: string
  timeZone: string
  timeClarification?: AssistantTimeContext
}

export interface AssistantTimeContext {
  title: string
  date: string
  timeZone: string
  hour?: number
  minute?: number
}

export class AssistantTimeRequired extends Error {
  context: AssistantTimeContext
  constructor(message: string, context: AssistantTimeContext) {
    super(message)
    this.name = 'AssistantTimeRequired'
    this.context = context
  }
}

export interface AssistantProposal {
  command: unknown
  explanation: string
}

export interface ValidatedAssistantPlan {
  proposalId?: string
  command: AssistantCommand
  explanation: string
  requiresConfirmation: boolean
}

export interface AssistantCommandExecutor {
  execute(command: AssistantCommand): Promise<unknown>
}

export class InvalidAssistantCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidAssistantCommandError'
  }
}

const WRITE_COMMANDS = new Set<AssistantCommandType>(['request_note_rename', 'rename_local_note', 'request_event_change', 'update_local_event', 'request_task_change', 'update_local_task', 'create_note', 'create_birthday', 'create_event', 'create_task', 'create_task_reminder', 'create_alarm', 'start_timer'])
const PERIODS = new Set(['now', 'today', 'tomorrow', 'next_week'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value)

const isNonEmptyText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength

const isIsoDateTime = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))

const isDateOnly = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

const isRepeatDays = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 7 &&
  new Set(value).size === value.length &&
  value.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)

export const requiresAssistantConfirmation = (command: AssistantCommand): boolean => WRITE_COMMANDS.has(command.type)

export function validateAssistantCommand(value: unknown): AssistantCommand {
  if (!isRecord(value) || typeof value.type !== 'string' || !isRecord(value.args)) {
    throw new InvalidAssistantCommandError(tx('El proveedor no devolvió un comando con la estructura esperada.'))
  }

  const { type, args } = value
  switch (type) {
    case 'get_current_datetime':
      if (!hasOnlyKeys(args, ['part']) || (args.part !== 'time' && args.part !== 'date')) break
      return { type, args: { part: args.part } }
    case 'get_daily_summary':
      if (!hasOnlyKeys(args, ['date']) || !isDateOnly(args.date)) break
      return { type, args: { date: args.date } }
    case 'get_weather':
      if (!hasOnlyKeys(args, ['period']) || typeof args.period !== 'string' || !PERIODS.has(args.period)) break
      return { type, args: { period: args.period as 'now' | 'today' | 'tomorrow' | 'next_week' } }
    case 'get_calendar':
      if (!hasOnlyKeys(args, ['from', 'to', ...('type' in args ? ['type'] : []), ...('taskStatus' in args ? ['taskStatus'] : [])]) || ('type' in args && args.type !== 'task' && args.type !== 'event' && args.type !== 'birthday') || ('taskStatus' in args && (args.type !== 'task' || (args.taskStatus !== 'completed' && args.taskStatus !== 'pending'))) || !isIsoDateTime(args.from) || !isIsoDateTime(args.to)) break
      if (typeof args.from !== 'string' || typeof args.to !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(args.from) || !/^\d{4}-\d{2}-\d{2}T/.test(args.to) || !isDateOnly(args.from.slice(0, 10)) || !isDateOnly(args.to.slice(0, 10))) break
      if (Date.parse(args.from) > Date.parse(args.to)) break
      if (Date.parse(`${args.to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${args.from.slice(0, 10)}T00:00:00Z`) > 31 * 86_400_000) break
      return { type, args: { from: args.from, to: args.to, ...(args.type === 'task' || args.type === 'event' || args.type === 'birthday' ? { type: args.type } : {}), ...(args.taskStatus === 'completed' || args.taskStatus === 'pending' ? { taskStatus: args.taskStatus } : {}) } }
    case 'search_tasks':
      if (!hasOnlyKeys(args, ['query']) || !isNonEmptyText(args.query, 120)) break
      return { type, args: { query: args.query.trim() } }
    case 'get_notes':
      if (!hasOnlyKeys(args, ['limit']) || !Number.isInteger(args.limit) || (args.limit as number) < 1 || (args.limit as number) > 10) break
      return { type, args: { limit: args.limit as number } }
    case 'search_notes':
      if (!hasOnlyKeys(args, ['query', 'limit']) || !isNonEmptyText(args.query, 200) || !Number.isInteger(args.limit) || (args.limit as number) < 1 || (args.limit as number) > 10) break
      return { type, args: { query: args.query.trim(), limit: args.limit as number } }
    case 'read_note':
      if (!hasOnlyKeys(args, ['query']) || !isNonEmptyText(args.query, 200)) break
      return { type, args: { query: args.query.trim() } }
    case 'read_note_id':
      if (!hasOnlyKeys(args, ['id']) || !isNonEmptyText(args.id, 200)) break
      return { type, args: { id: args.id.trim() } }
    case 'get_clock_status':
      if (!hasOnlyKeys(args, ['include']) || (args.include !== 'alarms' && args.include !== 'timers' && args.include !== 'both')) break
      return { type, args: { include: args.include } }
    case 'create_task_reminder': {
      if (!hasOnlyKeys(args, ['title', 'date', 'timeZone', 'time', ...('reminderMinutesBefore' in args ? ['reminderMinutesBefore'] : [])]) || ('reminderMinutesBefore' in args && (!Number.isInteger(args.reminderMinutesBefore) || (args.reminderMinutesBefore as number) < 1 || (args.reminderMinutesBefore as number) > 10080)) || !isNonEmptyText(args.title, 120) || !isDateOnly(args.date) || !isNonEmptyText(args.timeZone, 100) || typeof args.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(args.time)) break
      try { new Intl.DateTimeFormat('en', { timeZone: args.timeZone }).format() } catch { break }
      return { type, args: { title: args.title.trim(), date: args.date, timeZone: args.timeZone, time: args.time, reminderMinutesBefore: (args.reminderMinutesBefore as number | undefined) ?? 60 } }
    }
    case 'create_event': {
      if (!hasOnlyKeys(args, ['title', 'date', 'timeZone', 'startTime', 'endTime']) || !isNonEmptyText(args.title, 120) || !isDateOnly(args.date) || !isNonEmptyText(args.timeZone, 100) || typeof args.startTime !== 'string' || typeof args.endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(args.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(args.endTime) || args.endTime <= args.startTime) break
      try { new Intl.DateTimeFormat('en', { timeZone: args.timeZone }).format() } catch { break }
      return { type, args: { title: args.title.trim(), date: args.date, timeZone: args.timeZone, startTime: args.startTime, endTime: args.endTime } }
    }
    case 'request_note_rename':
      if (!hasOnlyKeys(args, ['title', 'newTitle']) || !isNonEmptyText(args.title, 120) || !isNonEmptyText(args.newTitle, 120)) break
      return { type, args: { title: args.title.trim(), newTitle: args.newTitle.trim() } }
    case 'rename_local_note':
      if (!hasOnlyKeys(args, ['id', 'expected', 'title', 'newTitle']) || !isNonEmptyText(args.id, 200) || !isNonEmptyText(args.expected, 2000000) || !isNonEmptyText(args.title, 120) || !isNonEmptyText(args.newTitle, 120)) break
      return { type, args: { id: args.id, expected: args.expected, title: args.title, newTitle: args.newTitle.trim() } }
    case 'request_event_change':
      if (!hasOnlyKeys(args, ['title', 'action', 'newTitle', ...('date' in args ? ['date'] : [])]) || ('date' in args && !isDateOnly(args.date)) || !isNonEmptyText(args.title, 120) || args.action !== 'rename' || !isNonEmptyText(args.newTitle, 120)) break
      return { type, args: { title: args.title.trim(), action: 'rename', newTitle: args.newTitle.trim(), ...(typeof args.date === 'string' ? { date: args.date } : {}) } }
    case 'update_local_event':
      if (!hasOnlyKeys(args, ['id', 'expected', 'title', 'date', 'timeZone', 'action', 'newTitle']) || !isNonEmptyText(args.id, 200) || !isNonEmptyText(args.expected, 20000) || !isNonEmptyText(args.title, 120) || !isDateOnly(args.date) || !isNonEmptyText(args.timeZone, 100) || args.action !== 'rename' || !isNonEmptyText(args.newTitle, 120)) break
      try { new Intl.DateTimeFormat('en', { timeZone: args.timeZone }).format() } catch { break }
      return { type, args: { id: args.id, expected: args.expected, title: args.title, date: args.date, timeZone: args.timeZone, action: 'rename', newTitle: args.newTitle.trim() } }
    case 'request_task_change':
      if (!hasOnlyKeys(args, ['title', 'action', 'newTitle', ...('date' in args ? ['date'] : [])]) || ('date' in args && !isDateOnly(args.date)) || !isNonEmptyText(args.title, 120) || (args.action !== 'complete' && args.action !== 'rename') || typeof args.newTitle !== 'string' || (args.action === 'rename' ? !isNonEmptyText(args.newTitle, 120) : args.newTitle !== '')) break
      return { type, args: { title: args.title.trim(), action: args.action, newTitle: args.newTitle.trim(), ...(typeof args.date === 'string' ? { date: args.date } : {}) } }
    case 'update_local_task':
      if (!hasOnlyKeys(args, ['id', 'expected', 'title', 'date', 'timeZone', 'action', 'newTitle']) || !isNonEmptyText(args.id, 200) || !isNonEmptyText(args.expected, 20000) || !isNonEmptyText(args.title, 120) || !isDateOnly(args.date) || !isNonEmptyText(args.timeZone, 100) || (args.action !== 'complete' && args.action !== 'rename') || typeof args.newTitle !== 'string' || (args.action === 'rename' ? !isNonEmptyText(args.newTitle, 120) : args.newTitle !== '')) break
      try { new Intl.DateTimeFormat('en', { timeZone: args.timeZone }).format() } catch { break }
      return { type, args: { id: args.id, expected: args.expected, title: args.title, date: args.date, timeZone: args.timeZone, action: args.action, newTitle: args.newTitle.trim() } }
    case 'create_birthday':
    case 'create_task': {
      if (!hasOnlyKeys(args, ['title', 'date', 'timeZone']) || !isNonEmptyText(args.title, 120) || !isDateOnly(args.date) || !isNonEmptyText(args.timeZone, 100)) break
      try { new Intl.DateTimeFormat('en', { timeZone: args.timeZone }).format() } catch { break }
      return { type, args: { title: args.title.trim(), date: args.date, timeZone: args.timeZone } }
    }
    case 'create_note':
      if (
        !hasOnlyKeys(args, ['title', 'content', 'reminderAt']) ||
        !isNonEmptyText(args.title, 120) ||
        !isNonEmptyText(args.content, 4_000) ||
        !(args.reminderAt === null || isIsoDateTime(args.reminderAt))
      ) break
      return { type, args: { title: args.title.trim(), content: args.content.trim(), reminderAt: args.reminderAt } }
    case 'create_alarm':
      if (
        !hasOnlyKeys(args, ['label', 'at', 'repeatDays']) ||
        !isNonEmptyText(args.label, 120) ||
        !isIsoDateTime(args.at) ||
        !isRepeatDays(args.repeatDays)
      ) break
      return { type, args: { label: args.label.trim(), at: args.at, repeatDays: args.repeatDays } }
    case 'start_timer':
      if (
        !hasOnlyKeys(args, ['label', 'durationSeconds']) ||
        !isNonEmptyText(args.label, 120) ||
        !Number.isInteger(args.durationSeconds) ||
        (args.durationSeconds as number) < 1 ||
        (args.durationSeconds as number) > 86_400
      ) break
      return { type, args: { label: args.label.trim(), durationSeconds: args.durationSeconds as number } }
    case 'get_local_help':
      if (!hasOnlyKeys(args, ['topic']) || !isNonEmptyText(args.topic, 200)) break
      return { type, args: { topic: args.topic.trim() } }
  }

  throw new InvalidAssistantCommandError(tx('Comando inválido o no permitido: {{type}}.', { type }))
}
