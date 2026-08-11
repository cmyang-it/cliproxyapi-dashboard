"use client"

import { memo } from "react"
import { fmt } from "@/lib/utils"
import type { ApiKeyRow } from "@/lib/types"

interface ApiKeyTableProps {
  data: ApiKeyRow[]
}

export const ApiKeyTable = memo(function ApiKeyTable({ data }: ApiKeyTableProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无 Key 消耗数据</div>
  }

  return (
    <div className="overflow-auto max-h-[300px] rounded-lg scrollbar-hide">
      <table className="w-full border-collapse text-[0.82rem]">
        <thead className="table-sticky-header">
          <tr>
            <th className="table-header px-3 py-2.5 text-left">API Key</th>
            <th className="table-header px-3 py-2.5 text-right">请求</th>
            <th className="table-header px-3 py-2.5 text-right">总 Token</th>
            <th className="table-header px-3 py-2.5 text-right">输入</th>
            <th className="table-header px-3 py-2.5 text-right">输出</th>
            <th className="table-header px-3 py-2.5 text-right">失败</th>
          </tr>
        </thead>
        <tbody>
          {data.map((k) => (
            <tr key={k.api_key} className="border-b border-border/60 transition-colors hover:bg-primary/5">
              <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-xs text-muted-foreground" title={k.api_key}>
                {k.api_key}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(k.requests)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs font-medium tabular-nums text-primary">{fmt(k.total_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(k.input_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(k.output_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {k.failed > 0 ? (
                  <span className="text-destructive">{k.failed}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
