"use client"

import { memo, useMemo, useState } from "react"
import { cn, fmtPct } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, Coins } from "lucide-react"
import type { QuotaSnapshotSafe } from "@/lib/types"

// ---------------------------------------------------------------------------
// Provider badge config
// ---------------------------------------------------------------------------

const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  codex:       { label: "Codex",       bg: "bg-blue-500/15",    text: "text-blue-400" },
  kimi:        { label: "Kimi",        bg: "bg-emerald-500/15", text: "text-emerald-400" },
  claude:      { label: "Claude",      bg: "bg-violet-500/15",  text: "text-violet-400" },
  antigravity: { label: "Antigravity", bg: "bg-cyan-500/15",    text: "text-cyan-400" },
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

type ProviderFilter = "all" | "codex" | "kimi" | "claude" | "antigravity"

const PROVIDER_FILTERS: Array<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "codex", label: "Codex" },
  { value: "antigravity", label: "Antigravity" },
  { value: "kimi", label: "Kimi" },
  { value: "claude", label: "Claude" },
]

export const QuotaPanel = memo(function QuotaPanel({ data, accountTotal }: QuotaPanelProps) {
  const [filter, setFilter] = useState<ProviderFilter>("all")
  const counts = useMemo(() => {
    const next: Record<ProviderFilter, number> = {
      all: data.length,
      codex: 0,
      antigravity: 0,
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
    <div className="space-y-5">
      <div className="flex max-w-full flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="mr-1 text-[0.82rem] text-muted-foreground">模型筛选</span>
        {PROVIDER_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200",
              filter === item.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
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
        <div className="grid max-h-[620px] grid-cols-1 gap-3 overflow-auto pr-1 scrollbar-hide sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
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
        "group relative overflow-hidden rounded-[10px] border p-[18px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        blocked
          ? "border-destructive/30 bg-destructive/5 hover:border-destructive/60"
          : "border-border bg-card hover:border-primary",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
      {/* Header row: provider badge + email + plan + status */}
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
        {/* Provider badge — prominent pill before account name */}
        <span className={cn(
          "shrink-0 rounded px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide",
          badge.bg, badge.text,
        )}>
          {badge.label}
        </span>

        {/* Email (truncated) */}
        <span className="truncate font-mono text-[0.88rem] font-medium" title={q.email}>
          {q.email}
        </span>

        {/* Plan */}
        {q.plan && (
          <span className="shrink-0 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
            {q.plan}
          </span>
        )}
        </div>

        {/* Status + reset time — pushed to right */}
        <span className="shrink-0 flex items-center gap-1.5">
          <span className="flex items-center gap-1">
            {blocked ? (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[10px] text-destructive font-medium">
                  {statusLabel}
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
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
      ) : q.quotaGroups?.length ? (
        <QuotaGroups groups={q.quotaGroups} />
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

function QuotaGroups({ groups }: { groups: NonNullable<QuotaSnapshotSafe["quotaGroups"]> }) {
  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={group.title} className={cn(index > 0 && "border-t border-border/50 pt-3")}>
          <div className="mb-2">
            <div className="text-[12px] font-semibold">{group.title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              此分组包含：{group.models}
            </div>
          </div>
          <div className="space-y-1.5">
            {group.bars.map((bar) => (
              <QuotaGroupBar key={bar.label} bar={bar} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function QuotaGroupBar({
  bar,
}: {
  bar: NonNullable<QuotaSnapshotSafe["quotaGroups"]>[number]["bars"][number]
}) {
  const hasPercent = typeof bar.remainingPercent === "number"
  const v = hasPercent ? Math.max(0, Math.min(100, bar.remainingPercent || 0)) : null
  const barColor = v == null ? "bg-transparent" : v <= 0 ? "bg-destructive" : "bg-emerald-500"
  const labelColor = v == null ? "text-muted-foreground" : v <= 0 ? "text-destructive" : "text-emerald-500"
  const resetLabel = bar.resetAt ? `${formatShort(bar.resetAt)} 后刷新` : "可刷新"

  return (
    <div className="quota-surface rounded-md px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] text-foreground font-semibold">{bar.label}</span>
        <span className="flex-1" />
        <span className={cn("text-[11px] font-semibold tabular-nums", labelColor)}>
          {hasPercent ? fmtPct(v || 0) : bar.statusLabel}
        </span>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">{resetLabel}</span>
      </div>
      <div className="quota-track h-[3px] overflow-hidden rounded-full">
        {v != null && (
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${v}%` }}
          />
        )}
      </div>
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
    <div className="quota-surface mb-2 rounded-md px-3 py-2 last:mb-0">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
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
      <div className="quota-track h-[3px] overflow-hidden rounded-full">
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
