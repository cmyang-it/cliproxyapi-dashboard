import { NextResponse } from "next/server"
import { queryLatestQuotas } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"
import { ensureQuotaFetcher } from "@/lib/quota/fetcher"
import { env } from "@/lib/env"
import { buildAntigravityQuotaGroups } from "@/lib/quota/antigravity-quota"
import {
  buildLimitedAccounts,
  buildQuotaStats,
  filterQuotasForAccounts,
  getAllAuthAccountsFromDir,
  getCurrentAuthAccountsFromDir,
  getQuotaRefreshFailures,
  readManagedAuthAccountsFromDir,
} from "@/lib/quota/auth"
import type { QuotaSnapshot, QuotaSnapshotSafe } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  ensureCollector()
  ensureQuotaFetcher()
  const currentAccounts = getCurrentAuthAccountsFromDir(env.authDir)
  const allAccounts = getAllAuthAccountsFromDir(env.authDir)
  const managedAccounts = readManagedAuthAccountsFromDir(env.authDir)
  const allLatestQuotas = queryLatestQuotas()
  const latestQuotas = filterQuotasForAccounts(allLatestQuotas, currentAccounts)
  const allAccountQuotas = filterQuotasForAccounts(allLatestQuotas, allAccounts)
  const authFailures = getQuotaRefreshFailures().filter((failure) =>
    allAccounts.some((account) => account.provider === failure.provider && account.email === failure.email),
  )
  const failedAccounts = new Set(authFailures.map((failure) => `${failure.provider}:${failure.email}`))
  const latestManagedQuotas = filterQuotasForAccounts(allLatestQuotas, managedAccounts)
  const limitedAccounts = buildLimitedAccounts(
    managedAccounts.filter((account) => !failedAccounts.has(`${account.provider}:${account.email}`)),
    latestManagedQuotas.filter((quota) =>
      typeof quota.auth_file_name === "string" && !failedAccounts.has(`${quota.provider}:${quota.email}`),
    ).map((quota) => ({
      provider: quota.provider,
      email: quota.email,
      auth_file_name: quota.auth_file_name as string,
      allowed: quota.allowed,
      limit_reached: quota.limit_reached,
      primary_used_percent: quota.primary_used_percent,
      primary_reset_at: quota.primary_reset_at,
    })),
  )
  const baseStats = buildQuotaStats(allAccounts, allAccountQuotas, authFailures)
  const stats = {
    ...baseStats,
    limitReached: limitedAccounts.length,
    normal: Math.max(0, allAccounts.length - limitedAccounts.length - baseStats.authFailed),
  }
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
    const quotaGroups = !failure && q.provider === "antigravity"
      ? buildAntigravityQuotaGroups(q.raw_json)
      : undefined
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
      ...(quotaGroups ? { quotaGroups } : {}),
      ...(failure ? { authFailed: true, authFailureMessage: failure.message } : {}),
    }
  })
  return NextResponse.json({ quotas, stats, authFailures, limitedAccounts })
}
