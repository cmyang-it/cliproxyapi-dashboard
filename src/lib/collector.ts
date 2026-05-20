import { env } from "./env"
import { getDb, insertUsageBatch } from "./db"

// ---------------------------------------------------------------------------
// Cross-context singleton via globalThis
//
// Next.js compiles instrumentation hooks and API routes into separate webpack
// bundles. Module-level `let` / `const` are NOT shared across bundles.  To
// prevent the collector from starting twice we store its state on globalThis
// so every compilation context sees the same instance.
// ---------------------------------------------------------------------------

const G = globalThis as Record<string, unknown>
const KEY = "__cliproxydash_collector"

interface CollectorState {
  running: boolean
  handle: ReturnType<typeof setInterval> | null
  lastPollAt: number
}

function state(): CollectorState {
  if (!G[KEY]) {
    G[KEY] = { running: false, handle: null, lastPollAt: 0 } satisfies CollectorState
  }
  return G[KEY] as CollectorState
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isRunning(): boolean {
  return state().running
}

export function lastPollTime(): number {
  return state().lastPollAt
}

/**
 * Start the background collector.
 * Idempotent — safe to call multiple times (including across webpack contexts).
 */
export function startCollector(): void {
  const s = state()
  if (s.running) return
  if (!env.managementKey) {
    console.warn("[collector] MANAGEMENT_KEY not set — collector stays idle")
    return
  }

  let intervalSec = env.pollIntervalSeconds
  if (!Number.isFinite(intervalSec) || intervalSec < 1) {
    console.warn(
      `[collector] POLL_INTERVAL_SECONDS=${env.pollIntervalSeconds} is too small or invalid — using safe default 2s`
    )
    intervalSec = 2
  }

  s.running = true
  const url = `${env.apiBaseUrl}/v0/management/usage-queue?count=100`

  console.log(`[collector] Polling ${url} every ${intervalSec}s`)

  const poll = async () => {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.managementKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.error(`[collector] Auth failed (HTTP ${res.status}) — check MANAGEMENT_KEY`)
        } else {
          console.error(`[collector] HTTP ${res.status}`)
        }
        return
      }

      const items = await res.json()
      if (!Array.isArray(items) || items.length === 0) return

      const inserted = insertUsageBatch(items)
      s.lastPollAt = Date.now()
      if (inserted > 0) {
        console.log(`[collector] +${inserted} events`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[collector] Poll failed: ${msg}`)
    }
  }

  // poll immediately, then on interval
  poll()
  s.handle = setInterval(poll, intervalSec * 1000)
}

export function stopCollector(): void {
  const s = state()
  s.running = false
  if (s.handle) {
    clearInterval(s.handle)
    s.handle = null
  }
}

/**
 * Ensure the collector is running.
 * Call this from any code path that needs data — it's a no-op if already started.
 */
export function ensureCollector(): void {
  // trigger DB init first (creates tables if needed)
  getDb()
  startCollector()
}