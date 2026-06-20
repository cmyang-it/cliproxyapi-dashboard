import fs from "fs"
import path from "path"
import type { AuthFailureAccount, QuotaSnapshot, QuotaStats } from "./types"
import { codexProvider } from "./quota-providers/codex"
import { kimiProvider } from "./quota-providers/kimi"
import { claudeProvider } from "./quota-providers/claude"
import type { AuthFile, QuotaProvider } from "./quota-providers/types"

const providers: QuotaProvider[] = [
  codexProvider,
  kimiProvider,
  claudeProvider,
]

export interface AuthEntry {
  filepath: string
  data: AuthFile
  provider: QuotaProvider
}

export interface CurrentAuthAccount {
  provider: string
  email: string
  name: string
}

const REFRESH_FAILURES_KEY = "__cliproxydash_quota_refresh_failures"
const DELETED_AUTH_FILES_KEY = "__cliproxydash_deleted_auth_files"

type RefreshFailure = AuthFailureAccount

export function findProvider(auth: AuthFile, filename: string): QuotaProvider | null {
  if (auth.type) {
    const byType = providers.find((p) => p.type === auth.type)
    if (byType) return byType
  }

  for (const p of providers) {
    if (p.matchAuthFile(auth)) return p
  }

  const basename = path.basename(filename)
  for (const p of providers) {
    if (basename.startsWith(p.type + "-")) return p
  }

  return null
}

export function readCurrentAuthEntries(authDir: string): AuthEntry[] {
  if (!authDir) return []

  const dir = path.resolve(authDir)
  if (!fs.existsSync(dir)) {
    console.warn(`[quota] Auth directory not found: ${dir}`)
    return []
  }

  let files: string[]
  try {
    files = fs.readdirSync(dir)
  } catch (err) {
    console.warn(`[quota] Failed to read auth directory: ${err instanceof Error ? err.message : err}`)
    return []
  }

  const results: AuthEntry[] = []
  const deleted = deletedAuthFiles()
  for (const file of files) {
    if (!file.endsWith(".json")) continue
    if (deleted.has(file)) continue
    const filepath = path.join(dir, file)
    try {
      const content = fs.readFileSync(filepath, "utf-8")
      const data = JSON.parse(content)
      if (!data.email && !data.access_token && !data.api_key) {
        console.warn(`[quota] Skipping ${file}: no email / token / key field`)
        continue
      }
      if (data.disabled) {
        console.log(`[quota] Skipping ${file}: account is disabled`)
        continue
      }

      const auth = { ...data, _filepath: filepath } as AuthFile
      const provider = findProvider(auth, filepath)
      if (!provider) {
        console.warn(
          `[quota] No matching provider for ${path.basename(filepath)} (type=${auth.type || "unknown"})`,
        )
        continue
      }

      results.push({ filepath, data: auth, provider })
    } catch (err) {
      console.warn(`[quota] Failed to parse ${file}: ${err instanceof Error ? err.message : err}`)
    }
  }

  return results
}

export function getCurrentAuthAccountsFromDir(authDir: string): CurrentAuthAccount[] {
  const seen = new Set<string>()
  const accounts: CurrentAuthAccount[] = []

  for (const entry of readCurrentAuthEntries(authDir)) {
    const email = entry.data.email || "unknown"
    const name = path.basename(entry.filepath)
    const key = accountKey(entry.provider.type, email)
    if (seen.has(key)) continue
    seen.add(key)
    accounts.push({ provider: entry.provider.type, email, name })
  }

  return accounts
}

export function filterQuotasForAccounts<T extends Pick<QuotaSnapshot, "provider" | "email">>(
  quotas: T[],
  accounts: CurrentAuthAccount[],
): T[] {
  const allowed = new Set(accounts.map((account) => accountKey(account.provider, account.email)))
  return quotas.filter((quota) => allowed.has(accountKey(quota.provider, quota.email)))
}

export function buildQuotaStats(
  accounts: CurrentAuthAccount[],
  quotas: Array<Pick<QuotaSnapshot, "provider" | "email" | "allowed" | "limit_reached">>,
  refreshFailures: AuthFailureAccount[] = [],
): QuotaStats {
  const active = new Set(accounts.map((account) => accountKey(account.provider, account.email)))
  const limitedAccounts = new Set<string>()
  const failedAccounts = new Set<string>()

  for (const failure of refreshFailures) {
    const key = accountKey(failure.provider, failure.email)
    if (active.has(key)) {
      failedAccounts.add(key)
    }
  }

  for (const quota of quotas) {
    const key = accountKey(quota.provider, quota.email)
    if (!active.has(key)) continue
    if (failedAccounts.has(key)) continue
    if (quota.allowed === 0 || quota.limit_reached === 1) {
      limitedAccounts.add(key)
    }
  }

  const unavailableAccounts = new Set([
    ...Array.from(limitedAccounts),
    ...Array.from(failedAccounts),
  ])

  return {
    total: accounts.length,
    normal: Math.max(0, accounts.length - unavailableAccounts.size),
    limitReached: limitedAccounts.size,
    authFailed: failedAccounts.size,
  }
}

export function recordQuotaRefreshSuccess(provider: string, email: string): void {
  refreshFailures().delete(accountKey(provider, email))
}

export function recordQuotaRefreshFailure(provider: string, email: string, name: string, message: string): void {
  refreshFailures().set(accountKey(provider, email), {
    provider,
    email,
    name,
    message,
    at: Date.now(),
  })
}

export function getQuotaRefreshFailures(): AuthFailureAccount[] {
  return Array.from(refreshFailures().values())
}

export function markAuthFileDeleted(name: string): void {
  deletedAuthFiles().add(name)

  for (const [key, failure] of Array.from(refreshFailures().entries())) {
    if (failure.name === name) {
      refreshFailures().delete(key)
    }
  }
}

function accountKey(provider: string, email: string): string {
  return `${provider}:${email}`
}

function refreshFailures(): Map<string, RefreshFailure> {
  const G = globalThis as Record<string, unknown>
  if (!G[REFRESH_FAILURES_KEY]) {
    G[REFRESH_FAILURES_KEY] = new Map<string, RefreshFailure>()
  }
  return G[REFRESH_FAILURES_KEY] as Map<string, RefreshFailure>
}

function deletedAuthFiles(): Set<string> {
  const G = globalThis as Record<string, unknown>
  if (!G[DELETED_AUTH_FILES_KEY]) {
    G[DELETED_AUTH_FILES_KEY] = new Set<string>()
  }
  return G[DELETED_AUTH_FILES_KEY] as Set<string>
}
