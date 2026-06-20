"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Server, Clock, ChevronDown, Radio, RadioTower, Home, List, AlertTriangle } from "lucide-react"
import { cn, fmt, RANGE_OPTIONS, RangeOption } from "@/lib/utils"
import { KpiCards } from "@/components/kpi-cards"
import { TokenChart } from "@/components/token-chart"
import { ModelChart } from "@/components/model-chart"
import { AccountTable } from "@/components/account-table"
import { QuotaPanel } from "@/components/quota-panel"
import { QuotaStatsCards } from "@/components/quota-stats-cards"
import { RequestFeed } from "@/components/request-feed"
import { ThemeToggle } from "@/components/theme-toggle"
import { ApiKeyTable } from "@/components/api-key-table"
import type {
  SummaryRow,
  AccountRow,
  ModelRow,
  HourRow,
  QuotaSnapshotSafe,
  RecentRequest,
  ApiKeyRow,
  QuotaStats,
  AuthFailureAccount,
} from "@/lib/types"
import { LoginDialog } from "@/components/login-dialog"

type Tab = "home" | "details"

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("home")
  const [range, setRange] = useState<RangeOption>("today")
  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [models, setModels] = useState<ModelRow[]>([])
  const [hours, setHours] = useState<HourRow[]>([])
  const [quotas, setQuotas] = useState<QuotaSnapshotSafe[]>([])
  const [quotaStats, setQuotaStats] = useState<QuotaStats>({ total: 0, normal: 0, limitReached: 0, authFailed: 0 })
  const [authFailures, setAuthFailures] = useState<AuthFailureAccount[]>([])
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
        quotaRes.json(),
        reqRes.json(),
        healthRes.json(),
      ])

      setSummary(summaryData.summary)
      setAccounts(summaryData.accounts)
      setModels(summaryData.models)
      setApiKeys(summaryData.apiKeys || [])
      setHours(summaryData.hours)
      setQuotas(quotaData.quotas)
      setQuotaStats(quotaData.stats || { total: 0, normal: 0, limitReached: 0, authFailed: 0 })
      setAuthFailures(quotaData.authFailures || [])
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Server className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">CLIProxyAPI</h1>
              <p className="text-xs text-muted-foreground">用量统计面板</p>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            {[
              { key: "home" as Tab, label: "首页", icon: <Home className="w-3.5 h-3.5" /> },
              { key: "details" as Tab, label: "详情", icon: <List className="w-3.5 h-3.5" /> },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-selected={tab === t.key}
                role="tab"
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                  tab === t.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Range selector */}
            <div className="relative">
              <select
                value={range}
                onChange={(e) => handleRangeChange(e.target.value as RangeOption)}
                className="appearance-none bg-secondary border border-border rounded-md px-3 py-1.5 pr-8 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
              className="flex items-center gap-1.5 bg-secondary border border-border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-secondary/70 transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              刷新
            </button>

            <ThemeToggle />

            <a
              href="https://github.com/cmyang-it/cliproxyapi-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-secondary hover:bg-secondary/70 transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-6 w-full animate-fade-in">
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
            {summary && <KpiCards data={summary} />}

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <section className="card-border p-5 min-h-[332px] flex flex-col">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {range === "7d" || range === "15d" || range === "30d" ? "按日期消耗" : "按小时消耗"}
                </h2>
                {loading && !hours.length ? (
                  <Skeleton />
                ) : (
                  <TokenChart data={hours} className="flex-1 min-h-[260px]" />
                )}
              </section>

              <section className="card-border p-5 min-h-[332px]">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChartIcon className="w-4 h-4 text-primary" />
                  模型消耗分布
                </h2>
                {loading && !models.length ? (
                  <Skeleton />
                ) : (
                  <ModelChart data={models} />
                )}
              </section>
            </div>

            {/* Tables row: 账号消耗 + Key消耗 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="card-border p-5">
                <h2 className="text-sm font-semibold mb-3">账号消耗</h2>
                {loading && !accounts.length ? <Skeleton /> : <AccountTable data={accounts} />}
              </section>
              <section className="card-border p-5">
                <h2 className="text-sm font-semibold mb-3">Key 消耗</h2>
                <ApiKeyTable data={apiKeys} />
              </section>
            </div>

            {/* Request feed */}
            <section className="card-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">最近请求</h2>
                {requests.length > 0 && (
                  <span className="text-xs text-muted-foreground">
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
              onChanged={() => fetchData(range)}
            />

            {/* Quota panel */}
            <section className="card-border p-5 w-full">
              <h2 className="text-sm font-semibold mb-3">账号列表</h2>
              <QuotaPanel data={quotas} accountTotal={quotaStats.total} />
            </section>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border py-3 px-6">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
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

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16h2" />
      <path d="M11 11h2" />
      <path d="M15 8h2" />
      <path d="M19 13h2" />
    </svg>
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
