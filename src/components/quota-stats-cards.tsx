"use client"

import { memo, useEffect, useState, type ComponentType } from "react"
import { AlertTriangle, ShieldCheck, Trash2, Users, X, ZapOff } from "lucide-react"
import { fmt } from "@/lib/utils"
import type { AuthFailureAccount, LimitedAccount, QuotaStats } from "@/lib/types"

interface QuotaStatsCard {
  label: string
  value: number
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
  detail?: string
  action?: "authFailures" | "limitedAccounts"
}

interface QuotaStatsCardsProps {
  data: QuotaStats
  authFailures: AuthFailureAccount[]
  limitedAccounts: LimitedAccount[]
  onChanged: () => void
}

export const QuotaStatsCards = memo(function QuotaStatsCards({
  data,
  authFailures,
  limitedAccounts,
  onChanged,
}: QuotaStatsCardsProps) {
  const [open, setOpen] = useState<"authFailures" | "limitedAccounts" | null>(null)
  const [deleting, setDeleting] = useState("")
  const [toggling, setToggling] = useState("")
  const [error, setError] = useState("")
  const [limitedError, setLimitedError] = useState("")
  const [confirming, setConfirming] = useState<AuthFailureAccount | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const cards: QuotaStatsCard[] = [
    {
      label: "账户总数",
      value: data.total,
      detail: `正常 ${data.normal} / 达限 ${data.limitReached} / 异常 ${data.authFailed}`,
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
      action: "limitedAccounts",
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

  useEffect(() => {
    if (open !== "limitedAccounts") return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [open])

  const deleteAccount = async (account: AuthFailureAccount) => {
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
      setConfirming(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试")
    } finally {
      setDeleting("")
    }
  }

  const toggleLimitedAccount = async (account: LimitedAccount) => {
    setLimitedError("")
    setToggling(limitedAccountKey(account))
    try {
      const res = await fetch("/api/quota/auth-file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: account.name, disabled: !account.disabled }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || `操作失败（HTTP ${res.status}）`)
      }
      onChanged()
    } catch (err) {
      setLimitedError(err instanceof Error ? err.message : "操作失败，请稍后重试")
    } finally {
      setToggling("")
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const interactive = card.action === "authFailures"
            ? authFailures.length > 0
            : card.action === "limitedAccounts" && limitedAccounts.length > 0
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                if (interactive && card.action) setOpen(card.action)
              }}
              disabled={!interactive}
              className="card-border group relative overflow-hidden p-[18px] text-left enabled:hover:-translate-y-px disabled:cursor-default"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
              <div>
                <div className="kpi-label">{card.label}</div>
                <div className="kpi-value mt-1">{fmt(card.value)}</div>
                {card.detail && <div className="mt-1 text-[11px] text-muted-foreground">{card.detail}</div>}
              </div>
              <div className={`absolute right-4 top-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </button>
          )
        })}
      </div>

      {open === "authFailures" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">异常账户</h3>
                <p className="text-xs text-muted-foreground mt-0.5">认证失败的账户需要重新授权或删除</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(null)
                  setConfirming(null)
                }}
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
                            onClick={() => setConfirming(account)}
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

      {open === "limitedAccounts" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">达限账户</h3>
                <p className="text-xs text-muted-foreground mt-0.5">达到额度限制的账户可在此启用或禁用</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(null)
                  setLimitedError("")
                }}
                className="w-8 h-8 rounded-md border border-border bg-secondary hover:bg-secondary/70 flex items-center justify-center"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {limitedError && (
                <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {limitedError}
                </div>
              )}

              <div className="overflow-auto max-h-[420px] scrollbar-hide">
                <table className="w-full text-sm">
                  <thead className="table-sticky-header">
                    <tr>
                      <th className="table-header text-left py-2">账户</th>
                      <th className="table-header text-left py-2">距离额度刷新</th>
                      <th className="table-header text-left py-2">状态</th>
                      <th className="table-header text-right py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitedAccounts.map((account) => {
                      const rowKey = limitedAccountKey(account)
                      return (
                        <tr key={rowKey} className="border-b border-border/50">
                          <td className="py-2.5 pr-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                                {account.provider}
                              </span>
                              <span className="truncate font-medium max-w-[240px]" title={account.email}>
                                {account.email}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                            {formatResetDistance(account.resetAt, now)}
                          </td>
                          <td className="py-2.5 pr-4 text-xs">
                            <span className={account.disabled ? "text-muted-foreground" : "text-amber-500"}>
                              {account.disabled ? "已禁用" : "已启用"}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => toggleLimitedAccount(account)}
                              disabled={toggling === rowKey}
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-500/10 disabled:opacity-60"
                            >
                              {toggling === rowKey ? "处理中" : account.disabled ? "启用" : "禁用"}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">确认删除异常账户？</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  删除后该认证文件将从异常账户列表中移除，请确认不再需要继续使用。
                </p>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">账户</div>
                <div className="mt-1 truncate font-mono text-xs font-medium" title={confirming.email}>
                  {confirming.email}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={deleting === confirming.name}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => deleteAccount(confirming)}
                disabled={deleting === confirming.name}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting === confirming.name ? "删除中" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export function limitedAccountKey(account: LimitedAccount): string {
  return account.name
}

function formatFailureMessage(message: string): string {
  const status = message.match(/^HTTP\s+(\d{3})\b/)?.[1]
  if (status === "401") return "HTTP 401 认证失败"
  if (status === "403") return "HTTP 403 无访问权限"
  if (status === "429") return "HTTP 429 请求过于频繁"
  if (status) return `HTTP ${status} 请求失败`
  return message
}

export function formatResetDistance(resetAt: string | null, now: number): string {
  if (!resetAt) return "--"
  const resetTime = new Date(resetAt).getTime()
  if (!Number.isFinite(resetTime)) return "--"

  const diff = resetTime - now
  if (diff <= 0) return "已到刷新时间"

  const totalMinutes = Math.ceil(diff / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days} 天 ${hours} 小时 ${minutes} 分钟`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${minutes} 分钟`
}
