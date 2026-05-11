"use client"

import { memo } from "react"
import { fmt } from "@/lib/utils"
import { Zap, ArrowDownToLine, ArrowUpFromLine, Brain, AlertTriangle, BarChart3 } from "lucide-react"
import type { SummaryRow } from "@/lib/types"

interface KpiCardsProps {
  data: SummaryRow
}

export const KpiCards = memo(function KpiCards({ data }: KpiCardsProps) {
  const cards = [
    {
      label: "请求数",
      value: fmt(data.requests),
      sub: data.failed > 0 ? `失败 ${fmt(data.failed)}` : "",
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
          className="card-border p-4 flex flex-col gap-2 animate-slide-up"
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
