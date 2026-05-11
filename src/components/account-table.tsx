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
    <div className="overflow-auto max-h-[300px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10">
          <tr>
            <th className="table-header text-left py-2">账号</th>
            <th className="table-header text-right py-2">请求</th>
            <th className="table-header text-right py-2">总 Token</th>
            <th className="table-header text-right py-2">输入</th>
            <th className="table-header text-right py-2">输出</th>
            <th className="table-header text-right py-2">推理</th>
            <th className="table-header text-right py-2">失败</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.account} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
              <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">{a.account}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(a.requests)}</td>
              <td className="py-2.5 text-right tabular-nums text-primary font-medium">{fmt(a.total_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(a.input_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(a.output_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(a.reasoning_tokens)}</td>
              <td className="py-2.5 text-right tabular-nums">
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
