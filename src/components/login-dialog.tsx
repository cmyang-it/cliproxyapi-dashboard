"use client"

import { useState, type FormEvent } from "react"
import { KeyRound, Loader2 } from "lucide-react"

interface LoginDialogProps {
  onSuccess: () => void
}

export function LoginDialog({ onSuccess }: LoginDialogProps) {
  const [key, setKey] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim()) {
      setError("请输入密钥")
      return
    }

    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      })

      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "密钥错误，请重试")
      }
    } catch {
      setError("网络错误，请检查连接")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm animate-fade-in">
      <div className="card-border w-full max-w-sm animate-slide-up overflow-hidden p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              <span className="text-sm tracking-tight">USAGE PANEL</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold">身份验证</h2>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          请输入 Dashboard 访问密钥以继续
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setError("")
              }}
              placeholder="输入访问密钥"
              autoFocus
              disabled={loading}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "验证中..." : "确认"}
          </button>
        </form>
      </div>
    </div>
  )
}
