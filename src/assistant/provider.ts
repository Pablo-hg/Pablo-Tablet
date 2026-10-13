import type { AssistantProposal, AssistantRequest } from './contracts'

export interface AssistantProvider {
  readonly id: string
  interpret(request: AssistantRequest, signal?: AbortSignal): Promise<AssistantProposal>
}
