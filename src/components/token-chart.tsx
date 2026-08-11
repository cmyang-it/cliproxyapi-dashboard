"use client"

import { memo, useMemo, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { cn, fmt, fmtCompact } from "@/lib/utils"
import type { HourModelRow, HourRow } from "@/lib/types"

interface TokenChartProps {
  data: HourRow[]
  modelData?: HourModelRow[]
  className?: string
}

const MODEL_COLORS = [
  "#e8a940",
  "#a78bfa",
  "#60a5fa",
  "#4ade80",
  "#f87171",
  "#fbbf24",
  "#67e8f9",
  "#fdba74",
  "#94a3b8",
  "#f472b6",
  "#34d399",
  "#818cf8",
]

interface ModelSeries {
  key: string
  model: string
  total: number
  color: string
}

export const TokenChart = memo(function TokenChart({ data, modelData = [], className }: TokenChartProps) {
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(() => new Set())

  const { chartData, modelSeries } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of modelData) {
      totals.set(row.model, (totals.get(row.model) || 0) + row.total_tokens)
    }

    const series: ModelSeries[] = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([model, total], index) => ({
        key: `model_${index}`,
        model,
        total,
        color: MODEL_COLORS[index % MODEL_COLORS.length],
      }))

    const keyByModel = new Map(series.map((item) => [item.model, item.key]))
    const rows = data.map((d) => {
      const row: Record<string, string | number> = {
        time: (d.hour || "").slice(-5),
        totalTokens: d.total_tokens,
        requests: d.requests,
        label: d.hour,
      }
      for (const item of series) {
        row[item.key] = 0
      }
      return row
    })
    const rowByHour = new Map(rows.map((row) => [String(row.label), row]))

    for (const modelRow of modelData) {
      const row = rowByHour.get(modelRow.hour)
      const key = keyByModel.get(modelRow.model)
      if (row && key) {
        row[key] = Number(row[key] || 0) + modelRow.total_tokens
      }
    }

    return { chartData: rows, modelSeries: series }
  }, [data, modelData])

  const toggleModel = (key: string) => {
    setHiddenModels((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (!data.length) {
    return <div className={cn("text-muted-foreground text-sm py-8 text-center", className)}>暂无数据</div>
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.55)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 13,
                boxShadow: "0 10px 30px rgb(0 0 0 / 0.24)",
                padding: "8px 12px",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 2 }}
              labelFormatter={(_, payload) => {
                if (payload?.[0]) {
                  return (payload[0].payload as { label: string }).label
                }
                return ""
              }}
              formatter={(value: number, name: string) => {
                const label = name === "总量" ? "总量" : name
                return [fmt(Number(value)), label]
              }}
            />
            <Line
              type="monotone"
              dataKey="totalTokens"
              name="总量"
              stroke="hsl(var(--primary))"
              strokeWidth={2.6}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            />
            {modelSeries.map((series) => {
              if (hiddenModels.has(series.key)) {
                return null
              }
              return (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.model}
                  stroke={series.color}
                  strokeWidth={1.7}
                  dot={false}
                  activeDot={{ r: 3, fill: series.color, strokeWidth: 0 }}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {modelSeries.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {modelSeries.map((series) => {
            const active = !hiddenModels.has(series.key)
            return (
              <button
                key={series.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleModel(series.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  active
                    ? "border-border bg-card text-foreground hover:border-primary"
                    : "border-border/60 bg-secondary/40 text-muted-foreground opacity-60 hover:opacity-100",
                )}
                title={`${series.model}: ${fmt(series.total)} Tokens`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? series.color : "hsl(var(--muted-foreground))" }}
                />
                <span className="max-w-[180px] truncate">{series.model}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{fmtCompact(series.total)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
