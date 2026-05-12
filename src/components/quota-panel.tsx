"use client"

import { memo } from "react"
import { cn, fmtPct } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, Coins } from "lucide-react"
import type { QuotaSnapshot } from "@/lib/types"

interface QuotaPanelProps {
  data: QuotaSnapshot[]
}

export const QuotaPanel = memo(function QuotaPanel({ data }: QuotaPanelProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无余量数据</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-auto pr-1">
      {data.map((q) => (
        <QuotaCard key={q.email} quota={q} />
      ))}
    </div>
  )
})

function QuotaCard({ quota }: { quota: QuotaSnapshot }) {
  const q = quota
  const blocked = !q.allowed || !!q.limit_reached

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        blocked
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      {/* Header: email + plan + icon-only status */}
      <div className="flex items-center gap-1.5 mb-2.5 min-w-0">
        <span className="text-xs font-medium truncate" title={q.email}>
          {q.email}
        </span>
        {q.plan && (
          <span className="text-[10px] px-1 py-px rounded font-medium bg-primary/10 text-primary shrink-0">
            {q.plan}
          </span>
        )}
        <span className="ml-auto shrink-0 flex items-center gap-1">
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
      </div>

      {/* Quota: label + pct + reset on top, bar below */}
      <QuotaBar
        label="周额度"
        pct={q.primary_remaining_percent}
        resetAt={formatShort(q.primary_reset_at)}
      />

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
  resetAt,
}: {
  label: string
  pct: number
  resetAt: string | null
}) {
  const v = Math.max(0, Math.min(100, pct))
  const barColor =
    v <= 10 ? "bg-destructive" : v <= 30 ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div>
      {/* Label row: 周额度 (bold) ... 97%  5/19 18:23 */}
      <div className="flex items-center gap-1.5 mb-1">
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
        {resetAt && (
          <span className="text-xs tabular-nums text-muted-foreground/70">
            {resetAt}
          </span>
        )}
      </div>

      {/* Progress bar */}
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
    // M/D HH:mm
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch {
    return iso.slice(5, 16)
  }
}
