import { NextResponse } from "next/server"
import { queryLatestQuotas } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"
import { ensureQuotaFetcher } from "@/lib/quota-fetcher"
import { env } from "@/lib/env"
import {
  buildQuotaStats,
  filterQuotasForAccounts,
  getCurrentAuthAccountsFromDir,
  getQuotaRefreshFailures,
} from "@/lib/quota-auth"
import type { QuotaSnapshot, QuotaSnapshotSafe } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  ensureCollector()
  ensureQuotaFetcher()
  const accounts = getCurrentAuthAccountsFromDir(env.authDir)
  const latestQuotas = filterQuotasForAccounts(queryLatestQuotas(), accounts)
  const authFailures = getQuotaRefreshFailures().filter((failure) =>
    accounts.some((account) => account.provider === failure.provider && account.email === failure.email),
  )
  const stats = buildQuotaStats(accounts, latestQuotas, authFailures)
  const failureByAccount = new Map(authFailures.map((failure) => [`${failure.provider}:${failure.email}`, failure]))
  const quotaByAccount = new Map(latestQuotas.map((quota) => [`${quota.provider}:${quota.email}`, quota]))
  const displayQuotas = [...latestQuotas]

  for (const failure of authFailures) {
    const key = `${failure.provider}:${failure.email}`
    if (quotaByAccount.has(key)) continue
    displayQuotas.push({
      id: 0,
      timestamp: new Date(failure.at).toISOString(),
      ts_epoch: failure.at / 1000,
      provider: failure.provider,
      email: failure.email,
      plan: null,
      allowed: 0,
      limit_reached: 0,
      primary_used_percent: 100,
      primary_remaining_percent: 0,
      primary_reset_at: null,
      secondary_used_percent: 100,
      secondary_remaining_percent: 0,
      secondary_reset_at: null,
      credits_balance: null,
      raw_json: "{}",
    })
  }

  const quotas: QuotaSnapshotSafe[] = displayQuotas.map((q: QuotaSnapshot) => {
    const failure = failureByAccount.get(`${q.provider}:${q.email}`)
    const { raw_json: _, ...safe } = failure
      ? {
        ...q,
        allowed: 0,
        limit_reached: 0,
        primary_used_percent: 100,
        primary_remaining_percent: 0,
        secondary_used_percent: 100,
        secondary_remaining_percent: 0,
      }
      : q
    return {
      ...safe,
      ...(failure ? { authFailed: true, authFailureMessage: failure.message } : {}),
    }
  })
  return NextResponse.json({ quotas, stats, authFailures })
}
