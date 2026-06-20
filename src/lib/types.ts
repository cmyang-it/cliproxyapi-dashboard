export interface UsageEvent {
  id: number
  event_key: string
  timestamp: string
  ts_epoch: number
  local_date: string
  local_hour: string
  request_id: string | null
  auth_index: string | null
  source: string | null
  provider: string | null
  model: string | null
  endpoint: string | null
  auth_type: string | null
  api_key_hash: string | null
  failed: number
  latency_ms: number
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cached_tokens: number
  total_tokens: number
  raw_json: string
}

export interface SummaryRow {
  requests: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cached_tokens: number
  failed: number
}

export interface AccountRow extends SummaryRow {
  account: string
}

export interface ModelRow {
  model: string
  requests: number
  total_tokens: number
  failed: number
}

export interface HourRow {
  hour: string
  requests: number
  total_tokens: number
  failed: number
}

export interface QuotaSnapshot {
  id: number
  timestamp: string
  ts_epoch: number
  provider: string
  email: string
  plan: string | null
  allowed: number
  limit_reached: number
  primary_used_percent: number
  primary_remaining_percent: number
  primary_reset_at: string | null
  secondary_used_percent: number
  secondary_remaining_percent: number
  secondary_reset_at: string | null
  credits_balance: string | null
  raw_json: string
}

/** QuotaSnapshot with raw_json stripped */
export type QuotaSnapshotSafe = Omit<QuotaSnapshot, "raw_json"> & {
  /** True when the latest quota refresh failed due to auth/API validation */
  authFailed?: boolean
  authFailureMessage?: string
}

export interface QuotaStats {
  total: number
  normal: number
  limitReached: number
  authFailed: number
}

export interface AuthFailureAccount {
  provider: string
  email: string
  name: string
  message: string
  at: number
}

export interface RecentRequest {
  timestamp: string
  local_time: string
  source: string | null
  auth_index: string | null
  api_key: string | null
  model: string | null
  endpoint: string | null
  failed: number
  latency_ms: number
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cached_tokens: number
  total_tokens: number
  request_id: string | null
}

export interface ApiKeyUsageBucket {
  snapshot_ts: number
  provider: string
  base_url: string
  api_key_hash: string
  bucket_label: string
  success: number
  failed: number
}

export interface ApiKeyRow {
  api_key: string
  requests: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  failed: number
}
