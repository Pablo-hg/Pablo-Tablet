import {
  InvalidAssistantCommandError,
  requiresAssistantConfirmation,
  validateAssistantCommand,
  type AssistantCommandExecutor,
  type AssistantProposal,
  type AssistantRequest,
  type ValidatedAssistantPlan,
} from './contracts'
import type { AssistantProvider } from './provider'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const dateInTimeZone = (now: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * Proveedor local determinista para validar el contrato sin red, credenciales ni consumo.
 * Solo reconoce ejemplos cerrados: no pretende sustituir al proveedor remoto.
 */
export class PrototypeAssistantProvider implements AssistantProvider {
  readonly id = 'local-prototype'

  async interpret(request: AssistantRequest): Promise<AssistantProposal> {
    const text = normalize(request.text)
    const today = dateInTimeZone(request.now, request.timeZone)

    if (text.includes('que tengo hoy') || text.includes('resumen del dia')) {
      return proposal({ type: 'get_daily_summary', args: { date: today } }, 'Preparar el resumen local de hoy.')
    }
    if (text.includes('tiempo') || text.includes('llover')) {
      return proposal({ type: 'get_weather', args: { period: 'today' } }, 'Consultar la previsión guardada para hoy.')
    }
    if (text.startsWith('guarda una nota:')) {
      const content = request.text.slice(request.text.indexOf(':') + 1).trim()
      return proposal(
        { type: 'create_note', args: { title: content.slice(0, 60), content, reminderAt: null } },
        'Proponer una nota nueva; no se guardará hasta confirmarla.',
      )
    }
    if (text.includes('temporizador') && text.includes('20 minutos')) {
      return proposal(
        { type: 'start_timer', args: { label: 'Temporizador', durationSeconds: 1_200 } },
        'Proponer un temporizador de veinte minutos.',
      )
    }
    if (text.includes('como cambio el brillo')) {
      return proposal({ type: 'get_local_help', args: { topic: 'cambiar el brillo' } }, 'Buscar la ayuda incluida en la app.')
    }

    throw new InvalidAssistantCommandError('El prototipo local no reconoce esta petición; abre el módulo manual.')
  }
}

const proposal = (command: unknown, explanation: string): AssistantProposal => ({ command, explanation })

export async function planAssistantRequest(
  provider: AssistantProvider,
  request: AssistantRequest,
  signal?: AbortSignal,
): Promise<ValidatedAssistantPlan> {
  const proposalResult = await provider.interpret(request, signal)
  const command = validateAssistantCommand(proposalResult.command)
  return {
    command,
    explanation: proposalResult.explanation,
    requiresConfirmation: requiresAssistantConfirmation(command),
  }
}

export async function executeAssistantPlan(
  plan: ValidatedAssistantPlan,
  executor: AssistantCommandExecutor,
  confirmed = false,
): Promise<unknown> {
  if (plan.requiresConfirmation && !confirmed) {
    throw new InvalidAssistantCommandError('La acción requiere confirmación explícita antes de ejecutarse.')
  }
  return executor.execute(plan.command)
}
