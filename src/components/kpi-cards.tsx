"use client"

import { memo, type ReactNode, type ComponentType } from "react"
import { fmt } from "@/lib/utils"
import { Zap, ArrowDownToLine, ArrowUpFromLine, Brain, BarChart3 } from "lucide-react"
import type { SummaryRow } from "@/lib/types"

interface KpiCard {
  label: string
  value: string
  sub: ReactNode
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
}

interface KpiCardsProps {
  data: SummaryRow
}

export const KpiCards = memo(function KpiCards({ data }: KpiCardsProps) {
  const cards: KpiCard[] = [
    {
      label: "请求数",
      value: fmt(data.requests),
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
      icon: Zap,
      color: "text-[#6ea8fe]",
      bg: "bg-[#6ea8fe]/10",
    },
    {
      label: "总 Tokens",
      value: fmt(data.total_tokens),
      sub: "",
      icon: BarChart3,
      color: "text-[#a3c7f6]",
      bg: "bg-[#a3c7f6]/10",
    },
    {
      label: "输入 Tokens",
      value: fmt(data.input_tokens),
      sub: `缓存 ${fmt(data.cached_tokens)}`,
      icon: ArrowDownToLine,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "输出 Tokens",
      value: fmt(data.output_tokens),
      sub: "",
      icon: ArrowUpFromLine,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
    },
    {
      label: "推理 Tokens",
      value: fmt(data.reasoning_tokens),
      sub: "",
      icon: Brain,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="card-border p-4 flex flex-col gap-2 animate-slide-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-md ${c.bg} flex items-center justify-center`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <span className="kpi-label">{c.label}</span>
          </div>
          <div className="kpi-value">{c.value}</div>
          {c.sub && (
            <div className="text-xs text-muted-foreground">{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
})
