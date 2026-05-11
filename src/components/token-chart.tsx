"use client"

import { memo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { fmt } from "@/lib/utils"
import type { HourRow } from "@/lib/types"

interface TokenChartProps {
  data: HourRow[]
}

export const TokenChart = memo(function TokenChart({ data }: TokenChartProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无数据</div>
  }

  const chartData = data.map((d) => ({
    time: (d.hour || "").slice(-5),
    tokens: d.total_tokens,
    requests: d.requests,
    label: d.hour,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            fontSize: 13,
          }}
          labelFormatter={(_, payload) => {
            if (payload?.[0]) {
              return (payload[0].payload as { label: string }).label
            }
            return ""
          }}
          formatter={(value: number) => [fmt(value), "Tokens"]}
        />
        <Bar
          dataKey="tokens"
          fill="hsl(200 80% 58%)"
          radius={[3, 3, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
})
