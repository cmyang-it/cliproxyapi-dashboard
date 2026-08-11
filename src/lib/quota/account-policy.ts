import type { QuotaResult } from "./providers/types"

export interface QuotaAccountSnapshot {
  provider: string
  primaryUsedPct: number
  primaryResetAt: string | null
}

export interface QuotaAccountPolicy {
  shouldDisable(result: QuotaResult): boolean
  shouldRestore(snapshot: QuotaAccountSnapshot, now: Date): boolean
}

const policies: Record<string, QuotaAccountPolicy> = {
  codex: {
    shouldDisable(result) {
      return result.primaryUsedPct > 95
    },
    shouldRestore(snapshot, now) {
      if (snapshot.primaryUsedPct <= 95 || !snapshot.primaryResetAt) return false
      const resetTime = Date.parse(snapshot.primaryResetAt)
      return Number.isFinite(resetTime) && resetTime <= now.getTime()
    },
  },
}

export function getQuotaAccountPolicy(provider: string): QuotaAccountPolicy | null {
  return policies[provider] || null
}
