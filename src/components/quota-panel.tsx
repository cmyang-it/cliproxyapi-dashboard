"use client"

import { memo, useMemo, useState } from "react"
import { cn, fmtPct } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, Coins } from "lucide-react"
import type { QuotaSnapshotSafe } from "@/lib/types"

// ---------------------------------------------------------------------------
// Provider badge config
// ---------------------------------------------------------------------------

const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  codex:  { label: "Codex",  bg: "bg-blue-500/15",   text: "text-blue-400" },
  kimi:   { label: "Kimi",   bg: "bg-emerald-500/15", text: "text-emerald-400" },
  claude: { label: "Claude", bg: "bg-violet-500/15",  text: "text-violet-400" },
}

function providerBadge(type: string) {
  return PROVIDER_BADGE[type] || { label: type || "?", bg: "bg-secondary", text: "text-muted-foreground" }
}

// ---------------------------------------------------------------------------
// QuotaPanel
// ---------------------------------------------------------------------------

interface QuotaPanelProps {
  data: QuotaSnapshotSafe[]
  accountTotal: number
}

type ProviderFilter = "all" | "codex" | "kimi" | "claude"

const PROVIDER_FILTERS: Array<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "codex", label: "Codex" },
  { value: "kimi", label: "Kimi" },
  { value: "claude", label: "Claude" },
]

export const QuotaPanel = memo(function QuotaPanel({ data, accountTotal }: QuotaPanelProps) {
  const [filter, setFilter] = useState<ProviderFilter>("all")
  const counts = useMemo(() => {
    const next: Record<ProviderFilter, number> = {
      all: data.length,
      codex: 0,
      kimi: 0,
      claude: 0,
    }

    for (const item of data) {
      if (item.provider in next) {
        next[item.provider as ProviderFilter]++
      }
    }

    return next
  }, [data])
  const filteredData = filter === "all" ? data : data.filter((q) => q.provider === filter)

  if (accountTotal === 0) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无余量数据</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center bg-secondary rounded-lg p-0.5 w-fit max-w-full overflow-x-auto scrollbar-hide">
        {PROVIDER_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-200",
              filter === item.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            <span className="tabular-nums text-[10px] text-muted-foreground">
              {counts[item.value]}
            </span>
          </button>
        ))}
      </div>

      {filteredData.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-auto pr-1 scrollbar-hide">
          {filteredData.map((q) => (
            <QuotaCard key={`${q.provider}:${q.email}`} quota={q} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm py-8 text-center">
          {filter === "all" ? "暂无余量数据" : `${providerBadge(filter).label} 下暂无余量数据`}
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// QuotaCard
// ---------------------------------------------------------------------------

function QuotaCard({ quota }: { quota: QuotaSnapshotSafe }) {
  const q = quota
  const resetAt = q.primary_reset_at
  const blocked = !!q.authFailed || !q.allowed || !!q.limit_reached
  const badge = providerBadge(q.provider)
  const statusLabel = q.authFailed ? "异常" : q.limit_reached ? "达限" : "受限"
  const codexFree = q.provider === "codex" && (q.plan || "").toLowerCase() === "free"

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
                  {statusLabel}
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
      {q.authFailed ? (
        <QuotaBar
          label="额度"
          pct={0}
          resetAt={null}
        />
      ) : q.provider === "codex" && codexFree ? (
        <QuotaBar
          label="月额度"
          pct={q.secondary_remaining_percent}
          resetAt={null}
        />
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
