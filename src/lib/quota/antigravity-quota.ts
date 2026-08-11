import type { QuotaGroup, QuotaGroupBar } from "../types"

const ANTIGRAVITY_GROUPS = [
  {
    title: "Gemini 模型",
    models: "Gemini Flash, Gemini Pro",
    aliases: ["gemini", "geminiModels", "gemini_models", "google"],
  },
  {
    title: "Claude 和 GPT 模型",
    models: "Claude Opus, Claude Sonnet, GPT-OSS",
    aliases: ["claudeAndGpt", "claude_and_gpt", "claudeGpt", "claude_gpt", "claude", "gpt"],
  },
] as const

const FIVE_HOUR_ALIASES = ["fiveHour", "five_hour", "5h", "hourly", "short", "shortTerm", "primary"]
const WEEKLY_ALIASES = ["weekly", "week", "7d", "sevenDay", "seven_day", "long", "secondary"]

export function buildAntigravityQuotaGroups(rawJson: string | null | undefined): QuotaGroup[] {
  const raw = parseRecord(rawJson)

  return ANTIGRAVITY_GROUPS.map((group) => {
    const source = findGroupSource(raw, group.aliases)
    return {
      title: group.title,
      models: group.models,
      bars: [
        buildBar(source, FIVE_HOUR_ALIASES, "5 小时限额"),
        buildBar(source, WEEKLY_ALIASES, "周限额"),
      ],
    }
  })
}

function buildBar(
  source: Record<string, unknown> | null,
  aliases: string[],
  label: string,
): QuotaGroupBar {
  const bucket = source ? findBucket(source, aliases) : null
  const remainingPercent = parseRemainingPercent(bucket)
  return {
    label,
    remainingPercent,
    statusLabel: statusLabel(bucket, remainingPercent),
    resetAt: normalizeResetAt(bucket),
  }
}

function parseRecord(rawJson: string | null | undefined): Record<string, unknown> | null {
  if (!rawJson) return null
  try {
    const parsed = JSON.parse(rawJson)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function findGroupSource(raw: Record<string, unknown> | null, aliases: readonly string[]): Record<string, unknown> | null {
  if (!raw) return null

  for (const key of ["quotaSummary", "quota_summary", "userQuotaSummary", "user_quota_summary"]) {
    const nested = raw[key]
    if (isRecord(nested)) {
      const source = findGroupSource(nested, aliases)
      if (source) return source
    }
  }

  for (const key of ["quotaGroups", "quota_groups", "groups"]) {
    const groups = raw[key]
    if (!Array.isArray(groups)) continue
    for (const item of groups) {
      if (!isRecord(item)) continue
      const label = [item.id, item.key, item.name, item.title, item.type, item.displayName]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
      if (aliases.some((alias) => label.includes(alias.toLowerCase()))) {
        return item
      }
    }
  }

  for (const containerKey of ["quotas", "quota", "rateLimits", "rate_limits", "limits"]) {
    const container = raw[containerKey]
    if (!isRecord(container)) continue
    const direct = findAliasedRecord(container, aliases)
    if (direct) return direct
  }

  return findAliasedRecord(raw, aliases)
}

function findBucket(source: Record<string, unknown>, aliases: string[]): unknown {
  const direct = findAliasedValue(source, aliases)
  if (direct != null) return direct

  for (const key of ["bars", "buckets", "quotas", "limits", "rateLimits", "rate_limits"]) {
    const items = source[key]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      if (!isRecord(item)) continue
      const label = [item.id, item.key, item.name, item.title, item.type, item.window, item.period, item.bucketId, item.displayName]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
      if (aliases.some((alias) => label.includes(alias.toLowerCase()))) {
        return item
      }
    }
  }

  return null
}

function findAliasedRecord(source: Record<string, unknown>, aliases: readonly string[]): Record<string, unknown> | null {
  const value = findAliasedValue(source, aliases)
  return isRecord(value) ? value : null
}

function findAliasedValue(source: Record<string, unknown>, aliases: readonly string[]): unknown {
  const entries = Object.entries(source)
  for (const alias of aliases) {
    const exact = source[alias]
    if (exact != null) return exact
    const normalizedAlias = normalizeKey(alias)
    const entry = entries.find(([key]) => normalizeKey(key) === normalizedAlias)
    if (entry) return entry[1]
  }
  return null
}

function parseRemainingPercent(bucket: unknown): number | null {
  if (typeof bucket === "number" || typeof bucket === "string") {
    return clampPercent(parseNumber(bucket))
  }
  if (!isRecord(bucket)) return null

  const remaining = firstNumber(bucket, [
    "remainingPercent",
    "remaining_percent",
    "availablePercent",
    "available_percent",
    "remaining",
    "available",
    "percentRemaining",
  ])
  if (remaining != null) return clampPercent(remaining)

  const remainingFraction = firstNumber(bucket, ["remainingFraction", "remaining_fraction"])
  if (remainingFraction != null) return clampPercent(remainingFraction * 100)

  const used = firstNumber(bucket, ["usedPercent", "used_percent", "usagePercent", "usage_percent", "used"])
  if (used != null) return clampPercent(100 - used)

  const amount = firstNumber(bucket, ["remainingAmount", "availableAmount", "availableCredit", "creditAmount"])
  const limit = firstNumber(bucket, ["limitAmount", "totalAmount", "total", "limit"])
  if (amount != null && limit != null && limit > 0) {
    return clampPercent((amount / limit) * 100)
  }

  return null
}

function statusLabel(bucket: unknown, remainingPercent: number | null): string {
  if (isRecord(bucket)) {
    const raw = firstString(bucket, ["statusLabel", "status_label", "description", "label", "status", "message"])
    if (raw) return raw
  }
  if (remainingPercent == null) return "额度可用"
  return remainingPercent <= 0 ? "已耗尽" : "额度可用"
}

function normalizeResetAt(bucket: unknown): string | null {
  if (!isRecord(bucket)) return null
  const value = firstValue(bucket, [
    "resetAt",
    "reset_at",
    "nextResetAt",
    "next_reset_at",
    "quotaResetTimeStamp",
    "quota_reset_timestamp",
    "resetTime",
    "reset_time",
    "refreshAt",
    "refresh_at",
  ])
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(ms).toISOString()
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  return null
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  const value = firstValue(source, keys)
  return parseNumber(value)
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  const value = firstValue(source, keys)
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function firstValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = findAliasedValue(source, [key])
    if (value != null) return value
  }
  return null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace("%", ""))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function clampPercent(value: number | null): number | null {
  if (value == null) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeKey(value: string): string {
  return value.replace(/[_\-\s]/g, "").toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
