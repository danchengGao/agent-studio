export type TriggerType = 'cron' | 'webhook' | 'polling'
export type TargetType = 'agent' | 'workflow'
export type TriggerStatus = 'active' | 'inactive'
export type ExecutionStatus = 'running' | 'success' | 'error' | 'skipped'
export type FiredBy = 'scheduler' | 'webhook' | 'poll' | 'manual'

export interface Trigger {
  trigger_id: string
  space_id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  target_type: TargetType
  target_id: string
  target_version: string
  input_payload: Record<string, unknown> | null
  is_active: boolean
  config: Record<string, unknown> | null
  webhook_token: string | null
  scheduler_job_id: string | null
  create_time: number | null
  update_time: number | null
}

export interface TriggerExecutionLog {
  id: number
  trigger_id: string
  trace_id: string | null
  conversation_id: string | null
  status: ExecutionStatus
  fired_by: FiredBy | null
  trigger_type: TriggerType
  started_at: number | null
  finished_at: number | null
  duration_ms: number | null
  inputs_snapshot: Record<string, unknown> | null
  outputs: Record<string, unknown> | null
  error_message: string | null
  poll_hash_seen: string | null
  create_time: number | null
}

// ── Request shapes ────────────────────────────────────────────────────────────

export interface CreateTriggerRequest {
  space_id: string
  name: string
  description?: string
  trigger_type: TriggerType
  target_type: TargetType
  target_id: string
  target_version?: string
  input_payload?: Record<string, unknown>
  cron_config?: { cron_expr: string }
  webhook_config?: { webhook_secret?: string }
  polling_config?: { poll_url: string; poll_interval_seconds: number }
}

export interface UpdateTriggerRequest extends Partial<Omit<CreateTriggerRequest, 'space_id' | 'trigger_type'>> {
  space_id: string
  trigger_id: string
}

export interface TriggerListRequest {
  space_id: string
  trigger_type?: TriggerType
  target_type?: TargetType
  is_active?: boolean
  page?: number
  page_size?: number
}

// ── Response shapes ───────────────────────────────────────────────────────────

export interface TriggerListResponse {
  items: Trigger[]
  total: number
  page: number
  page_size: number
}

export interface TriggerLogsResponse {
  items: TriggerExecutionLog[]
  total: number
  page: number
  page_size: number
}
