"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Server, Database, Clock, ChevronDown, Radio, RadioTower } from "lucide-react"
import { cn, fmt, RANGE_OPTIONS, RangeOption } from "@/lib/utils"
import { KpiCards } from "@/components/kpi-cards"
import { TokenChart } from "@/components/token-chart"
import { ModelChart } from "@/components/model-chart"
import { AccountTable } from "@/components/account-table"
import { QuotaPanel } from "@/components/quota-panel"
import { RequestFeed } from "@/components/request-feed"
import { ThemeToggle } from "@/components/theme-toggle"
import { ApiKeyTable } from "@/components/api-key-table"
import type { SummaryRow, AccountRow, ModelRow, HourRow, QuotaSnapshot, RecentRequest, ApiKeyRow } from "@/lib/types"
import { LoginDialog } from "@/components/login-dialog"

export default function DashboardPage() {
  const [range, setRange] = useState<RangeOption>("today")
  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [models, setModels] = useState<ModelRow[]>([])
  const [hours, setHours] = useState<HourRow[]>([])
  const [quotas, setQuotas] = useState<QuotaSnapshot[]>([])
  const [requests, setRequests] = useState<RecentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([])
  const [updated, setUpdated] = useState("")
  const [health, setHealth] = useState<{ events: number; uptime: number; collector: string; lastPollAt: string | null; pollIntervalSeconds: number } | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const fetchData = useCallback(async (currentRange: string) => {
    try {
      const [summaryRes, quotaRes, reqRes] = await Promise.all([
        fetch(`/api/summary?range=${currentRange}`),
        fetch("/api/quota"),
        fetch("/api/requests?limit=120"),
      ])

      if (summaryRes.ok) {
        const d = await summaryRes.json()
        setSummary(d.summary)
        setAccounts(d.accounts)
        setModels(d.models)
        setApiKeys(d.apiKeys || [])
        setHours(d.hours)
      }
      if (quotaRes.ok) {
        const d = await quotaRes.json()
        setQuotas(d.quotas)
      }
      if (reqRes.ok) {
        const d = await reqRes.json()
        setRequests(d.requests)
      }
      setUpdated(new Date().toLocaleTimeString("zh-CN"))
    } catch {
      // silent fail — retain old data
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

  // Auto-refresh every 10s
  useEffect(() => {
    const timer = setInterval(() => fetchData(range), 10000)
    return () => clearInterval(timer)
  }, [range, fetchData])

  // Health check
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {})
  }, [])

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

  const empty = !loading && summary && summary.requests === 0 && requests.length === 0

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
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-6 w-full">
        {/* KPI Cards */}
        {summary && <KpiCards data={summary} />}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="card-border p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              按小时消耗
            </h2>
            {loading && !hours.length ? (
              <Skeleton />
            ) : (
              <TokenChart data={hours} />
            )}
          </section>

          <section className="card-border p-5">
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

        {/* Tables row */}
        <div className="space-y-4">
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

          <section className="card-border p-5 w-full">
            <h2 className="text-sm font-semibold mb-3">账号余量</h2>
            <QuotaPanel data={quotas} />
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

        {/* Empty state */}
        {empty && !loading && (
          <div className="text-center py-16">
            <Database className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">当前时间范围内暂无用量数据</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              采集器每隔 {health?.pollIntervalSeconds ?? 2} 秒从 CLIProxyAPI 拉取数据
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border py-3 px-6">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-3">
            <span>CLIProxyAPI Dashboard v0.1.0</span>
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
      <div className="h-[200px] bg-secondary rounded" />
    </div>
  )
}