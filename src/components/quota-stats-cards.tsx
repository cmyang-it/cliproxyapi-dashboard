"use client"

import { memo, useState, type ComponentType } from "react"
import { AlertTriangle, ShieldCheck, Trash2, Users, X, ZapOff } from "lucide-react"
import { fmt } from "@/lib/utils"
import type { AuthFailureAccount, QuotaStats } from "@/lib/types"

interface QuotaStatsCard {
  label: string
  value: number
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
  action?: "authFailures"
}

interface QuotaStatsCardsProps {
  data: QuotaStats
  authFailures: AuthFailureAccount[]
  onChanged: () => void
}

export const QuotaStatsCards = memo(function QuotaStatsCards({
  data,
  authFailures,
  onChanged,
}: QuotaStatsCardsProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState("")
  const [error, setError] = useState("")
  const cards: QuotaStatsCard[] = [
    {
      label: "账户总数",
      value: data.total,
      icon: Users,
      color: "text-[#6ea8fe]",
      bg: "bg-[#6ea8fe]/10",
    },
    {
      label: "正常账户",
      value: data.normal,
      icon: ShieldCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "达限账户",
      value: data.limitReached,
      icon: ZapOff,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "异常账户",
      value: data.authFailed,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      action: "authFailures",
    },
  ]

  const deleteAccount = async (account: AuthFailureAccount) => {
    if (!window.confirm(`确认删除账户 ${account.email} 吗？`)) return

    setError("")
    setDeleting(account.name)
    try {
      const res = await fetch("/api/quota/auth-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: account.name }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || `删除失败（HTTP ${res.status}）`)
      }
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试")
    } finally {
      setDeleting("")
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const interactive = card.action === "authFailures" && card.value > 0
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                if (interactive) setOpen(true)
              }}
              disabled={!interactive}
              className="card-border p-4 flex items-center justify-between gap-3 text-left transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default"
            >
              <div>
                <div className="kpi-label">{card.label}</div>
                <div className="kpi-value mt-1">{fmt(card.value)}</div>
              </div>
              <div className={`w-9 h-9 rounded-md ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </button>
          )
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">异常账户</h3>
                <p className="text-xs text-muted-foreground mt-0.5">认证失败的账户需要重新授权或删除</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-md border border-border bg-secondary hover:bg-secondary/70 flex items-center justify-center"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {error && (
                <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <div className="overflow-auto max-h-[420px] scrollbar-hide">
                <table className="w-full text-sm">
                  <thead className="table-sticky-header">
                    <tr>
                      <th className="table-header text-left py-2">账户类型</th>
                      <th className="table-header text-left py-2">账户名称</th>
                      <th className="table-header text-left py-2">失败原因</th>
                      <th className="table-header text-right py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authFailures.map((account) => (
                      <tr key={`${account.provider}:${account.name}`} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 font-medium">{account.provider}</td>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium truncate max-w-[220px]" title={account.email}>
                            {account.email}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground truncate max-w-[260px]" title={formatFailureMessage(account.message)}>
                          {formatFailureMessage(account.message)}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => deleteAccount(account)}
                            disabled={deleting === account.name}
                            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleting === account.name ? "删除中" : "删除"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

function formatFailureMessage(message: string): string {
  const status = message.match(/^HTTP\s+(\d{3})\b/)?.[1]
  if (status === "401") return "HTTP 401 认证失败"
  if (status === "403") return "HTTP 403 无访问权限"
  if (status === "429") return "HTTP 429 请求过于频繁"
  if (status) return `HTTP ${status} 请求失败`
  return message
}
