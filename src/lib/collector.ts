import { env } from "./env"
import { getDb, insertUsageBatch } from "./db"

let collectorHandle: ReturnType<typeof setInterval> | null = null
let running = false
let lastPollAt = 0

export function isRunning(): boolean {
  return running
}

export function lastPollTime(): number {
  return lastPollAt
}

/**
 * Start the background collector.
 * Idempotent — safe to call multiple times (including on every API request).
 */
export function startCollector(): void {
  if (running) return
  if (!env.managementKey) {
    console.warn("[collector] MANAGEMENT_KEY not set — collector stays idle")
    return
  }

  running = true
  const url = `${env.apiBaseUrl}/v0/management/usage-queue?count=100`

  console.log(`[collector] Polling ${url} every ${env.pollIntervalSeconds}s`)

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
      lastPollAt = Date.now()
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
  collectorHandle = setInterval(poll, env.pollIntervalSeconds * 1000)
}

export function stopCollector(): void {
  running = false
  if (collectorHandle) {
    clearInterval(collectorHandle)
    collectorHandle = null
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
