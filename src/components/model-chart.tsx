"use client"

import { memo } from "react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { fmt } from "@/lib/utils"
import type { ModelRow } from "@/lib/types"

const COLORS = [
  "hsl(200 80% 58%)",
  "hsl(160 70% 45%)",
  "hsl(38 80% 56%)",
  "hsl(280 60% 55%)",
  "hsl(340 70% 55%)",
  "hsl(200 60% 45%)",
  "hsl(160 60% 52%)",
  "hsl(38 60% 50%)",
]

interface ModelChartProps {
  data: ModelRow[]
}

export const ModelChart = memo(function ModelChart({ data }: ModelChartProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无数据</div>
  }

  const sorted = [...data].sort((a, b) => b.total_tokens - a.total_tokens)
  const top = sorted.slice(0, 7)

  // Group remaining tiny slices into "其他"
  const others = sorted.slice(7).reduce(
    (acc, m) => ({
      model: "其他",
      requests: acc.requests + m.requests,
      total_tokens: acc.total_tokens + m.total_tokens,
      failed: acc.failed + m.failed,
    }),
    { model: "其他", requests: 0, total_tokens: 0, failed: 0 } as ModelRow
  )

  const chartData = others.total_tokens > 0 ? [...top, others] : top
  const total = chartData.reduce((sum, d) => sum + d.total_tokens, 0)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="total_tokens"
          nameKey="model"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
          stroke="none"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            fontSize: 13,
          }}
          formatter={(value: number, _name: string, props: any) => {
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0"
            return [`${fmt(value)} Token (${pct}%)`, props.payload.model]
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})
