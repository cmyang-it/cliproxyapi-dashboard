/**
 * Quota fetcher orchestrator.
 *
 * Scans AUTH_DIR for auth JSON files, dispatches each to its matching
 * QuotaProvider, and writes snapshots into SQLite via insertQuotaSnapshot().
 *
 * Runs once on startup, then periodically on QUOTA_REFRESH_SECONDS interval.
 */

import fs from "fs"
import path from "path"
import { env } from "./env"
import { insertQuotaSnapshot } from "./db"

import { codexProvider } from "./quota-providers/codex"
import { geminiProvider } from "./quota-providers/gemini"
import { kimiProvider } from "./quota-providers/kimi"
import { claudeProvider } from "./quota-providers/claude"
import type { AuthFile, QuotaProvider } from "./quota-providers/types"

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

/** Ordered list of providers — first match wins */
const providers: QuotaProvider[] = [
  codexProvider,
  geminiProvider,
  kimiProvider,
  claudeProvider,
]

/**
 * Find the right provider for an auth file.
 *
 * Priority:
 *   1. `auth.type` field matches provider.type
 *   2. Fallback: provider.matchAuthFile() (for custom logic)
 *   3. Fallback: filename prefix (e.g. "codex-" → codexProvider)
 */
function findProvider(auth: AuthFile, _filename: string): QuotaProvider | null {
  // 1. Exact type match
  if (auth.type) {
    const byType = providers.find((p) => p.type === auth.type)
    if (byType) return byType
  }

  // 2. Provider custom matching
  for (const p of providers) {
    if (p.matchAuthFile(auth)) return p
  }

  // 3. Filename prefix heuristic
  const basename = path.basename(_filename)
  for (const p of providers) {
    if (basename.startsWith(p.type + "-")) return p
  }

  return null
}

// ---------------------------------------------------------------------------
// Auth file discovery
// ---------------------------------------------------------------------------

interface AuthEntry {
  filepath: string
  data: AuthFile
}

function readAuthFiles(): AuthEntry[] {
  if (!env.authDir) return []

  const dir = path.resolve(env.authDir)
  if (!fs.existsSync(dir)) {
    console.warn(`[quota] Auth directory not found: ${dir}`)
    return []
  }

  const results: AuthEntry[] = []
  let files: string[]
  try {
    files = fs.readdirSync(dir)
  } catch (err) {
    console.warn(`[quota] Failed to read auth directory: ${err instanceof Error ? err.message : err}`)
    return []
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue
    const filepath = path.join(dir, file)
    try {
      const content = fs.readFileSync(filepath, "utf-8")
      const data = JSON.parse(content)
      // Require at least an email or known token field
      if (!data.email && !data.access_token && !data.api_key) {
        console.warn(`[quota] Skipping ${file}: no email / token / key field`)
        continue
      }
      if (data.disabled) {
        console.log(`[quota] Skipping ${file}: account is disabled`)
        continue
      }
      results.push({ filepath, data })
    } catch (err) {
      console.warn(`[quota] Failed to parse ${file}: ${err instanceof Error ? err.message : err}`)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Fetch & persist
// ---------------------------------------------------------------------------

async function refreshSingleAccount(entry: AuthEntry): Promise<void> {
  const provider = findProvider(entry.data, entry.filepath)
  if (!provider) {
    console.warn(
      `[quota] No matching provider for ${path.basename(entry.filepath)} (type=${entry.data.type || "unknown"})`,
    )
    return
  }

  const label = entry.data.email || path.basename(entry.filepath)

  try {
    const result = await provider.fetchQuota(entry.data)
    insertQuotaSnapshot(result)
    const secLabel =
      result.primaryUsedPct > 0
        ? `primary=${result.primaryUsedPct}%`
        : `secondary=${result.secondaryUsedPct}%`
    console.log(`[quota] ✓ ${label} (${provider.type}): ${secLabel}`)
  } catch (err) {
    console.warn(
      `[quota] ✗ ${label}: ${err instanceof Error ? err.message : err}`,
    )
  }
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
  if (!env.authDir) return 0

  const entries = readAuthFiles()
  if (entries.length === 0) return 0

  let refreshed = 0
  for (const entry of entries) {
    try {
      await refreshSingleAccount(entry)
      refreshed++
    } catch {
      // Already logged inside refreshSingleAccount
    }
  }

  return refreshed
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let quotaHandle: ReturnType<typeof setInterval> | null = null
let quotaRunning = false

export function startQuotaFetcher(): void {
  if (quotaRunning) return
  if (!env.authDir) {
    console.log("[quota] AUTH_DIR not configured — quota fetcher idle")
    return
  }

  quotaRunning = true
  const intervalMs = env.quotaRefreshSeconds * 1000

  console.log(
    `[quota] Quota fetcher started — refresh every ${env.quotaRefreshSeconds}s`,
  )

  // Fire immediately (non-blocking), then on interval
  refreshAllQuotas()
    .then((n) => {
      if (n > 0) console.log(`[quota] Initial refresh: ${n} account(s)`)
    })
    .catch((err) => {
      console.error(`[quota] Initial refresh failed: ${err instanceof Error ? err.message : err}`)
    })

  quotaHandle = setInterval(() => {
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
  quotaRunning = false
  if (quotaHandle) {
    clearInterval(quotaHandle)
    quotaHandle = null
    console.log("[quota] Quota fetcher stopped")
  }
}

export function isQuotaRunning(): boolean {
  return quotaRunning
}

/**
 * Idempotent — safe to call from any code path that needs quota data.
 */
export function ensureQuotaFetcher(): void {
  startQuotaFetcher()
}
