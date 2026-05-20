"use client"

import { memo } from "react"
import { cn, fmtPct } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, Coins } from "lucide-react"
import type { QuotaSnapshot } from "@/lib/types"

// ---------------------------------------------------------------------------
// Provider badge config
// ---------------------------------------------------------------------------

const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  codex:  { label: "Codex",  bg: "bg-blue-500/15",   text: "text-blue-400" },
  kimi:   { label: "Kimi",   bg: "bg-emerald-500/15", text: "text-emerald-400" },
  gemini: { label: "Gemini", bg: "bg-amber-500/15",   text: "text-amber-400" },
  claude: { label: "Claude", bg: "bg-violet-500/15",  text: "text-violet-400" },
}

function providerBadge(type: string) {
  return PROVIDER_BADGE[type] || { label: type || "?", bg: "bg-secondary", text: "text-muted-foreground" }
}

// ---------------------------------------------------------------------------
// QuotaPanel
// ---------------------------------------------------------------------------

interface QuotaPanelProps {
  data: QuotaSnapshot[]
}

export const QuotaPanel = memo(function QuotaPanel({ data }: QuotaPanelProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无余量数据</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-auto pr-1 scrollbar-hide">
      {data.map((q) => (
        <QuotaCard key={q.email} quota={q} />
      ))}
    </div>
  )
})

// ---------------------------------------------------------------------------
// QuotaCard
// ---------------------------------------------------------------------------

function QuotaCard({ quota }: { quota: QuotaSnapshot }) {
  const q = quota
  const geminiBuckets = parseGeminiBuckets(q)
  const resetAt = earliestResetAt(geminiBuckets) || q.primary_reset_at
  const blocked = !q.allowed || !!q.limit_reached
  const badge = providerBadge(q.provider)

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        blocked
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      {/* Header row: provider badge + email + plan + status */}
      <div className="flex items-center gap-1.5 mb-3 min-w-0">
        {/* Provider badge — prominent pill before account name */}
        <span className={cn(
          "text-xs px-2.5 py-1 rounded-md font-bold shrink-0 tracking-wider",
          badge.bg, badge.text,
        )}>
          {badge.label}
        </span>

        {/* Email (truncated) */}
        <span className="text-xs font-medium truncate" title={q.email}>
          {q.email}
        </span>

        {/* Plan */}
        {q.plan && (
          <span className="text-[10px] px-1 py-px rounded font-medium bg-primary/10 text-primary shrink-0">
            {q.plan}
          </span>
        )}

        {/* Status + reset time — pushed to right */}
        <span className="ml-auto shrink-0 flex items-center gap-1.5">
          <span className="flex items-center gap-1">
            {blocked ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                <span className="text-[10px] text-destructive font-medium">
                  {q.limit_reached ? "达限" : "受限"}
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium">可用</span>
              </>
            )}
          </span>
          {/* Reset time next to status */}
          {resetAt && (
            <span className="text-[10px] tabular-nums text-muted-foreground/60 shrink-0">
              {formatShort(resetAt)}
            </span>
          )}
        </span>
      </div>

      {/* Quota bars — per-provider semantics */}
      {geminiBuckets.length > 0 ? (
        <GeminiQuotaBuckets buckets={geminiBuckets} />
      ) : q.provider === "codex" ? (
        <>
          <QuotaBar
            label="5h"
            pct={q.primary_remaining_percent}
            resetAt={null}
          />
          <QuotaBar
            label="7d"
            pct={q.secondary_remaining_percent}
            resetAt={null}
          />
        </>
      ) : (
        <QuotaBar
          label="余量"
          pct={q.primary_remaining_percent}
          resetAt={null}
        />
      )}

      {/* Credits */}
      {q.credits_balance && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Coins className="w-3 h-3" />
          <span className="font-mono font-medium text-foreground">
            ${q.credits_balance}
          </span>
        </div>
      )}
    </div>
  )
}

interface GeminiBucketView {
  model: string
  pct: number
  resetAt: string | null
}

function GeminiQuotaBuckets({ buckets }: { buckets: GeminiBucketView[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-2">
      {buckets.map((bucket) => {
        const v = Math.max(0, Math.min(100, bucket.pct))
        const barColor = v <= 10 ? "bg-destructive" : v <= 30 ? "bg-amber-500" : "bg-emerald-500"
        const textColor = v <= 10 ? "text-destructive" : v <= 30 ? "text-amber-500" : "text-emerald-500"

        return (
          <div key={bucket.model} className="min-w-0">
            <div className="mb-0.5 flex items-center gap-1">
              <span className="truncate text-[10px] font-semibold text-muted-foreground" title={bucket.model}>
                {bucket.model}
              </span>
              <span className={cn("ml-auto text-[10px] font-semibold tabular-nums", textColor)}>
                {fmtPct(v)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barColor)}
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuotaBar — single progress bar
// ---------------------------------------------------------------------------

function parseGeminiBuckets(q: QuotaSnapshot): GeminiBucketView[] {
  if (q.provider !== "gemini" || !q.raw_json) return []

  try {
    const raw = JSON.parse(q.raw_json) as {
      retrieveUserQuota?: {
        buckets?: Array<{
          modelId?: string
          remainingFraction?: number
          resetTime?: string
        }>
      }
    }

    return (raw.retrieveUserQuota?.buckets || [])
      .filter((bucket) => bucket.modelId && Number.isFinite(bucket.remainingFraction))
      .map((bucket) => ({
        model: shortGeminiModel(bucket.modelId || "unknown"),
        pct: Math.max(0, Math.min(100, Math.round((bucket.remainingFraction || 0) * 100))),
        resetAt: bucket.resetTime || null,
      }))
  } catch {
    return []
  }
}

function shortGeminiModel(model: string): string {
  return model.replace(/^gemini-/, "")
}

function earliestResetAt(buckets: GeminiBucketView[]): string | null {
  let earliest: string | null = null
  let earliestMs = Infinity

  for (const bucket of buckets) {
    if (!bucket.resetAt) continue
    const time = new Date(bucket.resetAt).getTime()
    if (!Number.isFinite(time) || time >= earliestMs) continue
    earliest = bucket.resetAt
    earliestMs = time
  }

  return earliest
}

function QuotaBar({
  label,
  pct,
}: {
  label: string
  pct: number
  resetAt: string | null
}) {
  const v = Math.max(0, Math.min(100, pct))
  const barColor =
    v <= 10 ? "bg-destructive" : v <= 30 ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[11px] text-muted-foreground font-semibold">{label}</span>
        <span className="flex-1" />
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            v <= 10 ? "text-destructive" : v <= 30 ? "text-amber-500" : "text-emerald-500",
          )}
        >
          {fmtPct(v)}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}

/** Shorten reset timestamp: M/D HH:MM */
function formatShort(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso.slice(5, 16)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch {
    return iso.slice(5, 16)
  }
}
