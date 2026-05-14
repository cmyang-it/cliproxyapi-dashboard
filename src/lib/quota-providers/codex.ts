/**
 * Codex (OpenAI ChatGPT / Codex CLI) quota provider.
 *
 * Uses the ChatGPT backend API (`chatgpt.com/backend-api/wham/usage`) which
 * returns rate-limit windows directly — no need to call separate subscription
 * or usage endpoints.
 *
 * Reference: Python implementation in cliproxyapi-usage-dashboard/usage_dashboard.py
 */

import { fetchHttpsJson } from "../socks5"
import type { AuthFile, QuotaProvider, QuotaResult } from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function epochToIso(epoch: number | undefined | null): string | null {
  if (!epoch) return null
  const ms = Number(epoch) * 1000
  if (isNaN(ms) || ms <= 0) return null
  // Convert Unix epoch (seconds) → ISO-8601 in Asia/Shanghai
  const d = new Date(ms)
  // Format manually to keep consistent with QuotaPanel expectations
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

interface WhamResponse {
  rate_limit?: {
    allowed?: boolean
    limit_reached?: boolean
    primary_window?: {
      used_percent?: number
      reset_at?: number
    }
    secondary_window?: {
      used_percent?: number
      reset_at?: number
    }
  }
  plan_type?: string
  credits?: {
    balance?: string | number
  }
}

function parseWhamResponse(raw: WhamResponse, email: string): QuotaResult {
  const rl = raw.rate_limit || {}
  const primary = rl.primary_window || {}
  const secondary = rl.secondary_window || {}

  const primaryUsed = Math.round(primary.used_percent || 0)
  const secondaryUsed = Math.round(secondary.used_percent || 0)

  return {
    provider: "codex",
    email,
    plan: raw.plan_type || null,
    allowed: rl.allowed !== false,
    limitReached: rl.limit_reached === true,
    primaryUsedPct: primaryUsed,
    primaryResetAt: epochToIso(primary.reset_at),
    secondaryUsedPct: secondaryUsed,
    secondaryResetAt: epochToIso(secondary.reset_at),
    creditsBalance:
      raw.credits?.balance != null ? String(raw.credits.balance) : null,
    rawJson: JSON.stringify(raw),
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const CHATGPT_HOST = "chatgpt.com"
const WHAM_PATH = "/backend-api/wham/usage"

export const codexProvider: QuotaProvider = {
  type: "codex",

  matchAuthFile(auth: AuthFile): boolean {
    // Codex auth files are identified by type field in JSON.
    // Fallback: filename prefix "codex-" (handled by orchestrator's file-name matching).
    return auth.type === "codex" || false
  },

  async fetchQuota(auth: AuthFile): Promise<QuotaResult> {
    const token = auth.access_token
    if (!token) {
      throw new Error("Missing access_token in Codex auth file")
    }

    const email = auth.email || "unknown"

    const data = (await fetchHttpsJson(
      `https://${CHATGPT_HOST}${WHAM_PATH}`,
      {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "codex-cli",
      },
      20000,
    )) as WhamResponse

    return parseWhamResponse(data, email)
  },
}
