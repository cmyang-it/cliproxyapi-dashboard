/**
 * Provider architecture — unified interfaces for multi-provider quota fetching.
 *
 * Each provider (Codex, Kimi, Claude, …) implements the QuotaProvider
 * interface. The quota-fetcher orchestrator discovers auth files, dispatches them
 * to the correct provider, and writes QuotaResult snapshots into SQLite.
 */

/**
 * Parsed content of an auth JSON file from AUTH_DIR.
 *
 * The structure is intentionally loose — different providers store different
 * fields (access_token vs api_key, extra metadata, etc.).  The orchestrator
 * passes the full object to each provider, which extracts what it needs.
 */
export interface AuthFile {
  /** Provider identifier, e.g. "codex", "kimi", "claude" */
  type?: string

  /** OAuth access token (Bearer) */
  access_token?: string

  /** API key (plaintext, e.g. "sk-…", "AIza…") */
  api_key?: string

  /** Account email / identifier for display */
  email?: string

  /** Whether this account has been manually disabled */
  disabled?: boolean

  /** Token expiry date (ISO-8601 or similar) */
  expired?: string

  /** Set by quota-fetcher — absolute path to the auth JSON file, enables token write-back */
  _filepath?: string

  /** Allow providers to attach arbitrary extra fields */
  [key: string]: unknown
}

/**
 * Normalised quota snapshot ready for SQLite insertion.
 *
 * Matches the parameter shape of db.insertQuotaSnapshot() exactly —
 * see src/lib/db.ts for the storage schema.
 */
export interface QuotaResult {
  /** Provider identifier matching QuotaProvider.type ("codex"|"kimi"|"claude") */
  provider: string
  email: string
  plan: string | null
  allowed: boolean
  limitReached: boolean
  /** 0–100 — primary usage percentage (e.g. 5 h rate limit for Codex) */
  primaryUsedPct: number
  /** ISO-8601 timestamp when primary quota resets (null if unknown) */
  primaryResetAt: string | null
  /** 0–100 — secondary usage percentage (e.g. 7 d / billing period) */
  secondaryUsedPct: number
  /** ISO-8601 timestamp when secondary quota resets */
  secondaryResetAt: string | null
  /** Human-readable credits / balance string */
  creditsBalance: string | null
  /** Raw provider response for debugging / archival */
  rawJson: string
}

/**
 * A single quota provider (Codex, Kimi, Claude, …).
 *
 * Implementors must be stateless — the orchestrator may call fetchQuota
 * concurrently for different accounts.
 */
export interface QuotaProvider {
  /** Stable identifier that matches the `type` field in auth JSON */
  readonly type: string

  /**
   * Decide whether this provider can handle the given auth file.
   * Default implementation checks `auth.type === this.type`.
   */
  matchAuthFile(auth: AuthFile): boolean

  /**
   * Fetch quota / balance from the provider's API.
   *
   * @throws On network errors, auth failures, or unparseable responses.
   *         The orchestrator catches and logs errors; one failing account
   *         does not block others.
   */
  fetchQuota(auth: AuthFile): Promise<QuotaResult>
}
