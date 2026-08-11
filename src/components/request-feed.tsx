"use client"

import { memo } from "react"
import { cn, fmt, fmtMs } from "@/lib/utils"
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
    <div className="overflow-auto max-h-[460px] rounded-lg scrollbar-hide">
      <table className="w-full border-collapse text-[0.82rem]">
        <thead className="table-sticky-header">
          <tr>
            <th className="table-header px-3 py-2.5 text-left">时间</th>
            <th className="table-header px-3 py-2.5 text-left">状态</th>
            <th className="table-header px-3 py-2.5 text-left">接口</th>
            <th className="table-header px-3 py-2.5 text-left">模型</th>
            <th className="table-header px-3 py-2.5 text-left">账号</th>
            <th className="table-header px-3 py-2.5 text-left">Key</th>
            <th className="table-header px-3 py-2.5 text-right">输入 Token</th>
            <th className="table-header px-3 py-2.5 text-right">输出 Token</th>
            <th className="table-header px-3 py-2.5 text-right">总 Token</th>
            <th className="table-header px-3 py-2.5 text-right">耗时</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-b border-border/60 transition-colors hover:bg-primary/5">
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {r.local_time}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-[7px] w-[7px] rounded-full",
                      r.failed ? "bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]" : "bg-emerald-400 shadow-[0_0_6px_rgb(74_222_128)]",
                    )}
                  />
                  <span className={r.failed ? "text-destructive" : "text-emerald-400"}>
                    {r.failed ? "ERR" : "OK"}
                  </span>
                </span>
              </td>
              <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {r.endpoint || "-"}
              </td>
              <td className="max-w-[180px] truncate px-3 py-2.5 font-mono text-xs">
                {r.model || "-"}
              </td>
              <td className="max-w-[140px] truncate px-3 py-2.5">
                {r.source || r.auth_index || "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {maskKey(r.api_key)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {fmt(r.input_tokens)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {fmt(r.output_tokens)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs font-medium tabular-nums text-primary">
                {fmt(r.total_tokens)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {fmtMs(r.latency_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
