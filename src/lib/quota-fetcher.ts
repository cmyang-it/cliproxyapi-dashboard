/**
 * Quota fetcher orchestrator.
 *
 * Scans AUTH_DIR for auth JSON files, dispatches each to its matching
 * QuotaProvider, and writes snapshots into SQLite via insertQuotaSnapshot().
 *
 * Runs once on startup, then periodically on QUOTA_REFRESH_SECONDS interval.
 */

import path from "path"
import { env } from "./env"
import { insertQuotaSnapshot } from "./db"
import {
  readCurrentAuthEntries,
  recordQuotaRefreshFailure,
  recordQuotaRefreshSuccess,
  type AuthEntry,
} from "./quota-auth"

// ---------------------------------------------------------------------------
// Fetch & persist
// ---------------------------------------------------------------------------

async function refreshSingleAccount(entry: AuthEntry): Promise<boolean> {
  const label = entry.data.email || path.basename(entry.filepath)

  try {
    const result = await entry.provider.fetchQuota(entry.data)
    insertQuotaSnapshot(result)
    recordQuotaRefreshSuccess(entry.provider.type, result.email)
    const secLabel =
      result.primaryUsedPct > 0
        ? `primary=${result.primaryUsedPct}%`
        : `secondary=${result.secondaryUsedPct}%`
    console.log(`[quota] ✓ ${label} (${entry.provider.type}): ${secLabel}`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    recordQuotaRefreshFailure(
      entry.provider.type,
      entry.data.email || "unknown",
      path.basename(entry.filepath),
      sanitizeQuotaError(msg),
    )
    console.warn(`[quota] ✗ ${label} (${entry.provider.type}): ${sanitizeQuotaError(msg)}`)
    return false
  }
}

function sanitizeQuotaError(message: string): string {
  const status = message.match(/^HTTP (\d{3})\b/)?.[1]
  if (status === "401") return "HTTP 401 认证失败"
  if (status === "403") return "HTTP 403 无访问权限"
  if (status === "429") return "HTTP 429 请求过于频繁"
  if (status) return `HTTP ${status} 请求失败`
  return message.replace(/[\r\n]/g, " ").slice(0, 300)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch quotas for all accounts discovered in AUTH_DIR.
 *
 * Accounts are processed sequentially to avoid triggering provider rate limits.
 *
 * @returns Number of accounts that were successfully refreshed.
 */
export async function refreshAllQuotas(): Promise<number> {
  const s = qstate()

  // Re-entry guard: skip if a previous round is still in-flight.
  // Prevents overlapping refreshes that could trigger provider rate limits
  // and pile up SOCKS5 connections.
  if (s.refreshing) {
    console.warn("[quota] Previous refresh still in progress — skipping this round")
    return 0
  }

  if (!env.authDir) return 0

  const entries = readCurrentAuthEntries(env.authDir)
  if (entries.length === 0) return 0

  s.refreshing = true
  let refreshed = 0
  try {
    for (const entry of entries) {
      try {
        if (await refreshSingleAccount(entry)) refreshed++
      } catch {
        // Already logged inside refreshSingleAccount
      }
    }
  } finally {
    s.refreshing = false
  }

  return refreshed
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// Cross-context singleton via globalThis (see collector.ts for rationale)
const QKEY = "__cliproxydash_quota"

interface QuotaState {
  running: boolean
  handle: ReturnType<typeof setInterval> | null
  refreshing: boolean
}

function qstate(): QuotaState {
  const G = globalThis as Record<string, unknown>
  if (!G[QKEY]) {
    G[QKEY] = { running: false, handle: null, refreshing: false }
  }
  return G[QKEY] as QuotaState
}

// ---------------------------------------------------------------------------
// Public lifecycle API
// ---------------------------------------------------------------------------

export function startQuotaFetcher(): void {
  const s = qstate()
  if (s.running) return
  if (!env.authDir) {
    console.log("[quota] AUTH_DIR not configured — quota fetcher idle")
    return
  }

  // Validate interval: reject <= 0, NaN, or unreasonably small values
  let intervalSec = env.quotaRefreshSeconds
  if (!Number.isFinite(intervalSec) || intervalSec < 60) {
    console.warn(
      `[quota] QUOTA_REFRESH_SECONDS=${env.quotaRefreshSeconds} is too small or invalid — using safe default 300s`
    )
    intervalSec = 300
  }

  s.running = true
  const intervalMs = intervalSec * 1000

  console.log(
    `[quota] Quota fetcher started — refresh every ${intervalSec}s`,
  )

  // Log proxy configuration at startup for diagnostics
  if (env.socks5ProxyHost && env.socks5ProxyPort > 0) {
    const authInfo = env.socks5ProxyUsername ? " (auth enabled)" : ""
    console.log(`[quota] SOCKS5 proxy: ${env.socks5ProxyHost}:${env.socks5ProxyPort}${authInfo}`)
  } else {
    console.log("[quota] SOCKS5 proxy: disabled (direct connection will be used)")
  }

  // Fire immediately (non-blocking), then on interval
  refreshAllQuotas()
    .then((n) => {
      if (n > 0) console.log(`[quota] Initial refresh: ${n} account(s)`)
    })
    .catch((err) => {
      console.error(`[quota] Initial refresh failed: ${err instanceof Error ? err.message : err}`)
    })

  s.handle = setInterval(() => {
    refreshAllQuotas()
      .then((n) => {
        if (n > 0) console.log(`[quota] Periodic refresh: ${n} account(s)`)
      })
      .catch((err) => {
        console.error(`[quota] Periodic refresh error: ${err instanceof Error ? err.message : err}`)
      })
  }, intervalMs)
}

export function stopQuotaFetcher(): void {
  const s = qstate()
  s.running = false
  if (s.handle) {
    clearInterval(s.handle)
    s.handle = null
    console.log("[quota] Quota fetcher stopped")
  }
}

export function isQuotaRunning(): boolean {
  return qstate().running
}

/**
 * Idempotent — safe to call from any code path that needs quota data.
 */
export function ensureQuotaFetcher(): void {
  startQuotaFetcher()
}
