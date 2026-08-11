"use client"

import { memo, type ReactNode } from "react"
import { cn, fmt, fmtCompact } from "@/lib/utils"
import type { SummaryRow } from "@/lib/types"

interface KpiCard {
  label: string
  value: string
  sub: ReactNode
  color: string
}

interface KpiCardsProps {
  data: SummaryRow
  accountTotal: number
  authFailed: number
}

export const KpiCards = memo(function KpiCards({ data, accountTotal, authFailed }: KpiCardsProps) {
  const inputPct = data.total_tokens > 0 ? (data.input_tokens / data.total_tokens) * 100 : 0
  const outputPct = data.total_tokens > 0 ? (data.output_tokens / data.total_tokens) * 100 : 0

  const cards: KpiCard[] = [
    {
      label: "账号总数",
      value: fmtCompact(accountTotal),
      sub: (
        <span>
          正常 {fmt(Math.max(0, accountTotal - authFailed))} / 异常 {fmt(authFailed)}
        </span>
      ),
      color: "",
    },
    {
      label: "请求数",
      value: fmtCompact(data.requests),
      sub: (
        <span className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>成功</span>
            <span className="tabular-nums font-medium">{fmt(data.requests - data.failed)}</span>
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            <span>失败</span>
            <span className="tabular-nums font-medium">{fmt(data.failed)}</span>
          </span>
        </span>
      ),
      color: "",
    },
    {
      label: "总 Token",
      value: fmtCompact(data.total_tokens),
      sub: data.reasoning_tokens > 0 ? `推理 ${fmtCompact(data.reasoning_tokens)}` : "全部模型汇总",
      color: "",
    },
    {
      label: "输入 Token",
      value: fmtCompact(data.input_tokens),
      sub: `占比 ${inputPct.toFixed(1)}% / 缓存 ${fmtCompact(data.cached_tokens)}`,
      color: "text-[#60a5fa]",
    },
    {
      label: "输出 Token",
      value: fmtCompact(data.output_tokens),
      sub: `占比 ${outputPct.toFixed(1)}%`,
      color: "text-violet-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, index) => (
        <div
          key={c.label}
          className="card-border group relative overflow-hidden p-[18px] animate-slide-up hover:-translate-y-px"
          style={{ animationDelay: `${(index + 1) * 0.04}s` }}
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="kpi-label mb-2">{c.label}</div>
          <div className={cn("kpi-value", c.color)}>{c.value}</div>
          {c.sub && <div className="mt-2 min-h-4 text-[0.72rem] text-muted-foreground">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
})
