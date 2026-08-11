"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, Github, Radio, RadioTower, RefreshCw, AlertTriangle } from "lucide-react"
import { cn, fmt, RANGE_OPTIONS, RangeOption } from "@/lib/utils"
import { KpiCards } from "@/components/kpi-cards"
import { TokenChart } from "@/components/token-chart"
import { AccountTable } from "@/components/account-table"
import { QuotaPanel } from "@/components/quota-panel"
import { QuotaStatsCards } from "@/components/quota-stats-cards"
import { RequestFeed } from "@/components/request-feed"
import { ThemeToggle } from "@/components/theme-toggle"
import { ApiKeyTable } from "@/components/api-key-table"
import type {
  SummaryRow,
  AccountRow,
  HourRow,
  HourModelRow,
  QuotaSnapshotSafe,
  RecentRequest,
  ApiKeyRow,
  QuotaStats,
  AuthFailureAccount,
  LimitedAccount,
} from "@/lib/types"
import { LoginDialog } from "@/components/login-dialog"

type Tab = "home" | "details"

type QuotaResponse = {
  quotas?: QuotaSnapshotSafe[]
  stats?: QuotaStats
  authFailures?: AuthFailureAccount[]
  limitedAccounts?: LimitedAccount[]
}

const EMPTY_QUOTA_STATS: QuotaStats = { total: 0, normal: 0, limitReached: 0, authFailed: 0 }

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("home")
  const [range, setRange] = useState<RangeOption>("today")
  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [hours, setHours] = useState<HourRow[]>([])
  const [hourModels, setHourModels] = useState<HourModelRow[]>([])
  const [quotas, setQuotas] = useState<QuotaSnapshotSafe[]>([])
  const [quotaStats, setQuotaStats] = useState<QuotaStats>(EMPTY_QUOTA_STATS)
  const [authFailures, setAuthFailures] = useState<AuthFailureAccount[]>([])
  const [limitedAccounts, setLimitedAccounts] = useState<LimitedAccount[]>([])
  const [requests, setRequests] = useState<RecentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState("")
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([])
  const [updated, setUpdated] = useState("")
  const [health, setHealth] = useState<{ events: number; uptime: number; collector: string; lastPollAt: string | null; pollIntervalSeconds: number } | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const fetchData = useCallback(async (currentRange: string) => {
    setRefreshError("")
    try {
      const [summaryRes, quotaRes, reqRes, healthRes] = await Promise.all([
        fetch(`/api/summary?range=${currentRange}`),
        fetch("/api/quota"),
        fetch(`/api/requests?limit=120&range=${currentRange}`),
        fetch("/api/health"),
      ])

      const failed = [
        { label: "汇总数据", response: summaryRes },
        { label: "账号余量", response: quotaRes },
        { label: "请求明细", response: reqRes },
        { label: "采集状态", response: healthRes },
      ].find(({ response }) => !response.ok)

      if (failed) {
        throw new Error(`${failed.label}请求失败（HTTP ${failed.response.status}）`)
      }

      const [summaryData, quotaData, requestData, healthData] = await Promise.all([
        summaryRes.json(),
        quotaRes.json() as Promise<QuotaResponse>,
        reqRes.json(),
        healthRes.json(),
      ])

      setSummary(summaryData.summary)
      setAccounts(summaryData.accounts)
      setApiKeys(summaryData.apiKeys || [])
      setHours(summaryData.hours)
      setHourModels(summaryData.hourModels || [])
      setQuotas(Array.isArray(quotaData.quotas) ? quotaData.quotas : [])
      setQuotaStats(quotaData.stats || EMPTY_QUOTA_STATS)
      setAuthFailures(Array.isArray(quotaData.authFailures) ? quotaData.authFailures : [])
      setLimitedAccounts(Array.isArray(quotaData.limitedAccounts) ? quotaData.limitedAccounts : [])
      setRequests(requestData.requests)
      setHealth(healthData)
      setUpdated(new Date().toLocaleTimeString("zh-CN"))
    } catch (err) {
      const message = err instanceof Error ? err.message : "刷新失败，请稍后重试"
      setRefreshError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auth check
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { authenticated: boolean }) => {
        setAuthenticated(d.authenticated)
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  // Auto-refresh with collector interval
  useEffect(() => {
    const intervalSeconds = health?.pollIntervalSeconds && health.pollIntervalSeconds > 0
      ? health.pollIntervalSeconds
      : 10
    const timer = setInterval(() => fetchData(range), intervalSeconds * 1000)
    return () => clearInterval(timer)
  }, [range, fetchData, health?.pollIntervalSeconds])

  if (!authChecked) {
    return null
  }

  if (!authenticated) {
    return <LoginDialog onSuccess={() => setAuthenticated(true)} />
  }

  const handleRangeChange = (value: RangeOption) => {
    setRange(value)
    setLoading(true)
  }

  return (
    <div className="relative z-[1] min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-secondary/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[58px] max-w-[1600px] items-center justify-between gap-4 px-4 md:px-7">
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-2 font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              <span className="text-[1.05rem] tracking-tight">USAGE PANEL</span>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center gap-1">
            {[
              { key: "home" as Tab, label: "首页" },
              { key: "details" as Tab, label: "账号" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-selected={tab === t.key}
                role="tab"
                className={cn(
                  "rounded-md px-[18px] py-1.5 text-sm font-medium transition-all duration-200",
                  tab === t.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Range selector */}
            <div className="relative">
              <select
                value={range}
                onChange={(e) => handleRangeChange(e.target.value as RangeOption)}
                className="cursor-pointer appearance-none rounded-md border border-border bg-input px-3 py-1.5 pr-8 font-mono text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-0"
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={() => fetchData(range)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-input text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label="刷新数据"
              title="刷新数据"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>

            <ThemeToggle />

            <a
              href="https://github.com/cmyang-it/cliproxyapi-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-input text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label="GitHub"
              title="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-5 animate-fade-in md:px-7 md:py-6">
        {refreshError && (
          <div className="card-border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3 animate-slide-up">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-destructive">数据刷新失败</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{refreshError} — 已保留上一次成功加载的数据</div>
            </div>
          </div>
        )}

        {/* --- Home Tab --- */}
        {tab === "home" && (
          <>
            {/* KPI Cards */}
            {summary && (
              <KpiCards
                data={summary}
                accountTotal={quotaStats.total || accounts.length}
                authFailed={quotaStats.authFailed}
              />
            )}

            {/* Token trend */}
            <section className="card-border min-h-[420px] p-5 animate-slide-up">
              <h2 className="panel-title mb-4">
                {range === "7d" || range === "15d" || range === "30d" ? "按日期 Token 消耗" : "按小时 Token 消耗"}
              </h2>
              {loading && !hours.length ? (
                <Skeleton />
              ) : (
                <TokenChart data={hours} modelData={hourModels} className="min-h-[300px]" />
              )}
            </section>

            {/* Key & account consumption */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="card-border min-h-[332px] p-5 animate-slide-up">
                <h2 className="panel-title mb-4">Key 消耗</h2>
                <ApiKeyTable data={apiKeys} />
              </section>

              <section className="card-border min-h-[332px] p-5 animate-slide-up">
                <h2 className="panel-title mb-4">账号消耗</h2>
                {loading && !accounts.length ? <Skeleton /> : <AccountTable data={accounts} />}
              </section>
            </div>

            {/* Request feed */}
            <section className="card-border p-5 animate-slide-up">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="panel-title">
                  最近请求列表
                  <span className="font-mono text-[0.72rem] font-normal text-muted-foreground">/ 最近 120 条</span>
                </h2>
                {requests.length > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {requests.length} 条
                  </span>
                )}
              </div>
              <RequestFeed data={requests} />
            </section>
          </>
        )}

        {/* --- Details Tab --- */}
        {tab === "details" && (
          <>
            <QuotaStatsCards
              data={quotaStats}
              authFailures={authFailures}
              limitedAccounts={limitedAccounts}
              onChanged={() => fetchData(range)}
            />

            {/* Quota panel */}
            <section className="card-border w-full p-5 animate-slide-up">
              <h2 className="panel-title mb-4">账号列表</h2>
              <QuotaPanel data={quotas} accountTotal={quotaStats.total} />
            </section>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-20 border-t border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between font-mono text-xs text-muted-foreground">
          <span className="flex items-center gap-3">
            <span>CLIProxyAPI Dashboard v1.1.0</span>
            {health && (
              <span className={cn(
                "flex items-center gap-1",
                health.collector === "running" ? "text-emerald-400" : "text-amber-400"
              )}>
                {health.collector === "running" ? (
                  <RadioTower className="w-3 h-3" />
                ) : (
                  <Radio className="w-3 h-3" />
                )}
                采集{health.collector === "running" ? "中" : "未启动"}
              </span>
            )}
          </span>
          <span className="flex items-center gap-4">
            {health && (
              <>
                <span>事件 {fmt(health.events)}</span>
                <span>运行 {Math.floor(health.uptime / 60)}m</span>
              </>
            )}
            {updated && <span>更新 {updated}</span>}
          </span>
        </div>
      </footer>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-secondary rounded w-3/4" />
      <div className="h-4 bg-secondary rounded w-1/2" />
      <div className="h-4 bg-secondary rounded w-2/3" />
      <div className="h-[200px] bg-gradient-to-br from-secondary to-secondary/50 rounded" />
    </div>
  )
}
