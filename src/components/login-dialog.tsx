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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="card-border p-6 w-full max-w-sm mx-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">身份验证</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
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
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "验证中..." : "确认"}
          </button>
        </form>
      </div>
    </div>
  )
}
