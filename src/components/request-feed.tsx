"use client"

import { memo } from "react"
import { cn, fmt, fmtMs } from "@/lib/utils"
import { CheckCircle, XCircle } from "lucide-react"
import type { RecentRequest } from "@/lib/types"

interface RequestFeedProps {
  data: RecentRequest[]
}

function maskKey(key: string | null): string {
  if (!key) return "-"
  if (key.includes("***")) return key
  const len = key.length
  if (len <= 8) {
    return `${key.slice(0, Math.max(1, len - 3))}***${key.slice(Math.max(len - 2, 0))}`
  }
  if (len <= 16) {
    return `${key.slice(0, 6)}***${key.slice(len - 4)}`
  }
  return `${key.slice(0, 8)}***${key.slice(len - 4)}`
}

export const RequestFeed = memo(function RequestFeed({ data }: RequestFeedProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无请求记录</div>
  }

  return (
    <div className="overflow-auto max-h-[420px] scrollbar-hide">
      <table className="w-full text-sm">
        <thead className="table-sticky-header">
          <tr>
            <th className="table-header text-left py-2">时间</th>
            <th className="table-header text-left py-2">Key</th>
            <th className="table-header text-left py-2">账号</th>
            <th className="table-header text-left py-2">模型</th>
            <th className="table-header text-right py-2">Token</th>
            <th className="table-header text-right py-2">输入</th>
            <th className="table-header text-right py-2">输出</th>
            <th className="table-header text-right py-2">耗时</th>
            <th className="table-header text-center py-2">状态</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
              <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                {r.local_time}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                {maskKey(r.api_key)}
              </td>
              <td className="py-2 pr-4 truncate max-w-[140px]">
                {r.source || r.auth_index || "-"}
              </td>
              <td className="py-2 pr-4 truncate max-w-[160px]">
                {r.model || "-"}
              </td>
              <td className="py-2 text-right tabular-nums font-medium">
                {fmt(r.total_tokens)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {fmt(r.input_tokens)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {fmt(r.output_tokens)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {fmtMs(r.latency_ms)}
              </td>
              <td className="py-2 text-center">
                {r.failed ? (
                  <XCircle className="w-4 h-4 text-destructive inline" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
