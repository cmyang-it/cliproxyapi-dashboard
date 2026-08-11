/**
 * Quota fetcher orchestrator.
 *
 * Scans AUTH_DIR for auth JSON files, dispatches each to its matching
 * QuotaProvider, and writes snapshots into SQLite via insertQuotaSnapshot().
 *
 * Runs once on startup, then periodically on QUOTA_REFRESH_SECONDS interval.
 */

import path from "path"
import { env } from "../env"
import { deleteQuotaSnapshotsNotInAccounts, insertQuotaSnapshot, queryLatestQuotaByAuthFile } from "../db"
import {
  readAllAuthEntries,
  recordQuotaRefreshFailure,
  recordQuotaRefreshSuccess,
  type AuthEntry,
} from "./auth"
import { setQuotaAccountDisabled } from "./account-state"
import { getQuotaAccountPolicy } from "./account-policy"
import type { QuotaResult } from "./providers/types"

// ---------------------------------------------------------------------------
// Fetch & persist
// ---------------------------------------------------------------------------

async function refreshSingleAccount(entry: AuthEntry): Promise<QuotaResult | null> {
  const authFileName = path.basename(entry.filepath)
  const label = entry.data.email || authFileName

  try {
    const result = await entry.provider.fetchQuota(entry.data)
    insertQuotaSnapshot({ ...result, authFileName })
    recordQuotaRefreshSuccess(entry.provider.type, result.email)
    const secLabel =
      result.primaryUsedPct > 0
        ? `primary=${result.primaryUsedPct}%`
        : `secondary=${result.secondaryUsedPct}%`
    console.log(`[quota] ✓ ${label} (${entry.provider.type}): ${secLabel}`)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    recordQuotaRefreshFailure(
      entry.provider.type,
      entry.data.email || "unknown",
      path.basename(entry.filepath),
      sanitizeQuotaError(msg),
    )
    console.warn(`[quota] ✗ ${label} (${entry.provider.type}): ${sanitizeQuotaError(msg)}`)
    return null
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

  const entries = readAllAuthEntries(env.authDir)
  deleteQuotaSnapshotsNotInAccounts(entries.map((entry) => ({
    provider: entry.provider.type,
    email: entry.data.email || "unknown",
  })))
  if (entries.length === 0) return 0

  s.refreshing = true
  let refreshed = 0
  let skippedDisabledCodex = 0
  try {
    for (const entry of entries) {
      const authFileName = path.basename(entry.filepath)
      try {
        if (entry.data.disabled === true) {
          if (entry.provider.type === "codex") skippedDisabledCodex++
          continue
        }

        const result = await refreshSingleAccount(entry)
        if (result) {
          refreshed++
          const policy = getQuotaAccountPolicy(entry.provider.type)
          if (policy?.shouldDisable(result)) {
            await setQuotaAccountDisabled(entry, true)
          }
        }
      } catch (err) {
        console.warn(`[quota] ✗ ${authFileName} (${entry.provider.type}): ${err instanceof Error ? err.message : err}`)
      }
    }
    if (skippedDisabledCodex > 0) {
      console.log(`[quota] 已跳过 ${skippedDisabledCodex} 个已禁用 Codex 账号`)
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
  recoveryHandle: ReturnType<typeof setInterval> | null
  refreshing: boolean
  recovering: boolean
}

function qstate(): QuotaState {
  const G = globalThis as Record<string, unknown>
  if (!G[QKEY]) {
    G[QKEY] = { running: false, handle: null, recoveryHandle: null, refreshing: false, recovering: false }
  }
  return G[QKEY] as QuotaState
}

const LIMITED_ACCOUNT_RECOVERY_INTERVAL_MS = 10 * 60 * 1000

async function recoverLimitedCodexAccounts(): Promise<number> {
  const s = qstate()
  if (s.recovering || !env.authDir) return 0

  s.recovering = true
  let restored = 0
  try {
    for (const entry of readAllAuthEntries(env.authDir)) {
      if (entry.provider.type !== "codex" || entry.data.disabled !== true) continue

      const authFileName = path.basename(entry.filepath)
      const latest = queryLatestQuotaByAuthFile(authFileName)
      const policy = getQuotaAccountPolicy(entry.provider.type)
      if (!latest || !policy?.shouldRestore({
        provider: latest.provider,
        primaryUsedPct: latest.primary_used_percent,
        primaryResetAt: latest.primary_reset_at,
      }, new Date())) continue

      try {
        await setQuotaAccountDisabled(entry, false)
        const result = await refreshSingleAccount(entry)
        if (!result) {
          await setQuotaAccountDisabled(entry, true)
          console.warn(`[quota] 恢复 ${authFileName} 后刷新失败，已回滚为禁用`)
          continue
        }

        restored++
        if (policy.shouldDisable(result)) {
          await setQuotaAccountDisabled(entry, true)
        }
      } catch (err) {
        console.warn(`[quota] 恢复 ${authFileName} 失败: ${err instanceof Error ? err.message : err}`)
      }
    }
  } finally {
    s.recovering = false
  }

  return restored
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

  console.log("[quota] Limited Codex recovery started — check every 600s")
  recoverLimitedCodexAccounts()
    .then((n) => {
      if (n > 0) console.log(`[quota] Initial limited-account recovery: ${n} account(s)`)
    })
    .catch((err) => {
      console.error(`[quota] Initial limited-account recovery error: ${err instanceof Error ? err.message : err}`)
    })
  s.recoveryHandle = setInterval(() => {
    recoverLimitedCodexAccounts()
      .then((n) => {
        if (n > 0) console.log(`[quota] Periodic limited-account recovery: ${n} account(s)`)
      })
      .catch((err) => {
        console.error(`[quota] Periodic limited-account recovery error: ${err instanceof Error ? err.message : err}`)
      })
  }, LIMITED_ACCOUNT_RECOVERY_INTERVAL_MS)
}

export function stopQuotaFetcher(): void {
  const s = qstate()
  s.running = false
  if (s.handle) {
    clearInterval(s.handle)
    s.handle = null
  }
  if (s.recoveryHandle) {
    clearInterval(s.recoveryHandle)
    s.recoveryHandle = null
  }
  console.log("[quota] Quota fetcher stopped")
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
