"use client"

import { memo } from "react"
import { cn, fmtPct } from "@/lib/utils"
import { Circle, ShieldCheck, ShieldAlert } from "lucide-react"
import type { QuotaSnapshot } from "@/lib/types"

interface QuotaPanelProps {
  data: QuotaSnapshot[]
}

export const QuotaPanel = memo(function QuotaPanel({ data }: QuotaPanelProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无余量数据</div>
  }

  return (
    <div className="overflow-auto max-h-[300px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10">
          <tr>
            <th className="table-header text-left py-2">账号</th>
            <th className="table-header text-center py-2">状态</th>
            <th className="table-header text-left py-2">5h 剩余</th>
            <th className="table-header text-left py-2">7d 剩余</th>
            <th className="table-header text-left py-2">重置时间</th>
          </tr>
        </thead>
        <tbody>
          {data.map((q) => (
            <tr key={q.email} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
              <td className="py-2.5 pr-4 font-medium truncate max-w-[180px]">{q.email}</td>
              <td className="py-2.5 text-center">
                {q.allowed ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-xs">可用</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="text-xs">受限</span>
                  </span>
                )}
              </td>
              <td className="py-2.5">
                <QuotaBar value={q.primary_remaining_percent} />
              </td>
              <td className="py-2.5">
                <QuotaBar value={q.secondary_remaining_percent} />
              </td>
              <td className="py-2.5 text-xs text-muted-foreground">
                <div>{q.primary_reset_at || "-"}</div>
                <div>{q.secondary_reset_at || "-"}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

function QuotaBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const cls =
    v <= 10
      ? "bg-destructive"
      : v <= 30
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden min-w-[60px]">
        <div
          className={cn("h-full rounded-full transition-all", cls)}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">{fmtPct(v)}</span>
    </div>
  )
}
