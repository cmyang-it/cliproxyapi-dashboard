"use client"

import { memo } from "react"
import { fmt } from "@/lib/utils"
import type { AccountRow } from "@/lib/types"

interface AccountTableProps {
  data: AccountRow[]
}

export const AccountTable = memo(function AccountTable({ data }: AccountTableProps) {
  if (!data.length) {
    return <div className="text-muted-foreground text-sm py-8 text-center">暂无数据</div>
  }

  return (
    <div className="overflow-auto max-h-[300px] rounded-lg scrollbar-hide">
      <table className="w-full border-collapse text-[0.82rem]">
        <thead className="table-sticky-header">
          <tr>
            <th className="table-header px-3 py-2.5 text-left">账号</th>
            <th className="table-header px-3 py-2.5 text-right">请求</th>
            <th className="table-header px-3 py-2.5 text-right">总 Token</th>
            <th className="table-header px-3 py-2.5 text-right">输入</th>
            <th className="table-header px-3 py-2.5 text-right">输出</th>
            <th className="table-header px-3 py-2.5 text-right">推理</th>
            <th className="table-header px-3 py-2.5 text-right">失败</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.account} className="border-b border-border/60 transition-colors hover:bg-primary/5">
              <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-xs font-medium">{a.account}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(a.requests)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs font-medium tabular-nums text-primary">{fmt(a.total_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(a.input_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(a.output_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(a.reasoning_tokens)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {a.failed > 0 ? (
                  <span className="text-destructive">{a.failed}</span>
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
