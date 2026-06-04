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
    <div className="overflow-auto max-h-[300px] scrollbar-hide">
      <table className="w-full text-sm">
        <thead className="table-sticky-header">
          <tr>
            <th className="table-header text-left py-2">API Key</th>
            <th className="table-header text-right py-2">请求</th>
            <th className="table-header text-right py-2">总 Token</th>
            <th className="table-header text-right py-2">输入</th>
            <th className="table-header text-right py-2">输出</th>
            <th className="table-header text-right py-2">失败</th>
          </tr>
        </thead>
        <tbody>
          {data.map((k) => (
            <tr key={k.api_key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
              <td className="py-2.5 pr-4 font-mono text-xs truncate max-w-[160px]" title={k.api_key}>
                {k.api_key}
              </td>
              <td className="py-2.5 text-right tabular-nums">{fmt(k.requests)}</td>
              <td className="py-2.5 text-right tabular-nums text-primary font-medium">{fmt(k.total_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(k.input_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(k.output_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">
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
