"use client"

import { memo } from "react"
import { fmt } from "@/lib/utils"
import type { ModelRow } from "@/lib/types"

const PALETTE = [
  ["#7dd3fc", "#2563eb"],
  ["#86efac", "#16a34a"],
  ["#fde68a", "#d97706"],
  ["#c4b5fd", "#7c3aed"],
  ["#fda4af", "#e11d48"],
  ["#67e8f9", "#0891b2"],
  ["#fdba74", "#ea580c"],
  ["#a5b4fc", "#4f46e5"],
  ["#6ee7b7", "#059669"],
]

interface ModelChartProps {
  data: ModelRow[]
}

interface DisplayRow {
  model: string
  requests: number
  total_tokens: number
  failed: number
  color: string[]
  muted?: boolean
}

export const ModelChart = memo(function ModelChart({ data }: ModelChartProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-12 text-center">暂无数据</div>
  }

  const sorted = [...data].sort((a, b) => b.total_tokens - a.total_tokens)
  const totalTokens = data.reduce((sum, d) => sum + d.total_tokens, 0)
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0)
  const visible = sorted.slice(0, 9)
  const rest = sorted.slice(9)
  const maxTokens = Math.max(sorted[0]?.total_tokens ?? 0, 1)

  const rows: DisplayRow[] = visible.map((model, index) => ({
    ...model,
    color: PALETTE[index % PALETTE.length],
  }))

  if (rest.length > 0) {
    rows.push({
      model: `其他 ${rest.length} 个模型`,
      requests: rest.reduce((sum, d) => sum + d.requests, 0),
      total_tokens: rest.reduce((sum, d) => sum + d.total_tokens, 0),
      failed: rest.reduce((sum, d) => sum + d.failed, 0),
      color: ["#94a3b8", "#64748b"],
      muted: true,
    })
  }

  const top = sorted[0]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-secondary/20 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              模型消耗分布
            </div>
            <div className="text-sm font-semibold truncate" title={top.model}>
              {top.model}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              最高消耗 · {fmt(top.requests)} 次请求
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold tabular-nums leading-none">
              {fmt(totalTokens)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Token · {fmt(totalRequests)} 次
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((model, index) => {
          const [start, end] = model.color
          const tokenPct = totalTokens > 0 ? (model.total_tokens / totalTokens) * 100 : 0
          const barPct = Math.min(100, Math.max(0, (model.total_tokens / maxTokens) * 100))
          const failedPct = model.requests > 0 ? (model.failed / model.requests) * 100 : 0

          return (
            <div
              key={model.model}
              className="group rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 text-right text-[11px] tabular-nums text-muted-foreground/70">
                  {model.muted ? "—" : index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_12px_currentColor]"
                        style={{ color: start, backgroundColor: start }}
                      />
                      <span
                        className={model.muted ? "text-xs text-muted-foreground truncate" : "text-xs font-medium truncate"}
                        title={model.model}
                      >
                        {model.model}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-xs tabular-nums font-medium">
                        {fmt(model.total_tokens)}
                      </span>
                      <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
                        {tokenPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${barPct}%`,
                        background: `linear-gradient(90deg, ${start}, ${end})`,
                      }}
                    />
                    {failedPct > 0 && (
                      <div
                        className="absolute right-0 top-0 h-full bg-destructive/70"
                        style={{ width: `${Math.min(100, failedPct)}%` }}
                      />
                    )}
                  </div>
                </div>

                <div className="hidden sm:block w-16 text-right text-[11px] text-muted-foreground tabular-nums">
                  {fmt(model.requests)} 次
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
