/**
 * Recording module event types.
 */

export type SSEEventType =
  | 'start'
  | 'message'
  | 'done'
  | 'summary_response'
  | 'waiting_user_input'
  | 'user_input_ended'
  | 'error'

export interface SSEData {
  event: SSEEventType
  agent: string
  content?: unknown
  section_idx?: string | number
  plan_idx?: string | number
  step_idx?: string | number
  message_id?: string
  conversation_id?: string
}

export interface RecordedEvent {
  data: SSEData
  timestamp: number
}

export type InteractionKind = 'hitl' | 'outline'

export interface InteractionEvent {
  kind: InteractionKind
  feedback: string
  userMessage: string
  backendMessage?: string
  afterEventCount: number
  timestamp: number
}

export type RewriteAction = 'polish' | 'expand' | 'shorten' | 'supplementary_search' | 'sync'

export interface RewriteRequest {
  action: RewriteAction
  selectedText: string
  startOffset: number
  endOffset: number
  userInstruction?: string
}

export type RewriteRequestMismatchReason =
  | 'action'
  | 'selectedText'
  | 'offset'
  | 'userInstruction'

export interface RewriteMockSequenceHint {
  expectedOrder: number
  attemptedOrder?: number
}

export interface RewriteMockDiagnostic {
  closestRequest?: RewriteRequest
  mismatchReasons: RewriteRequestMismatchReason[]
  sequenceHint?: RewriteMockSequenceHint
}

export interface RewriteEvent {
  request: RewriteRequest
  responseEvents: RecordedEvent[]
  timestamp: number
}
