/**
 * Kimi (Moonshot / 月之暗面) quota provider.
 *
 * Queries the Kimi balance API to report remaining credits.
 * Unlike Codex's time-windowed rate limits, Kimi uses a credit/point balance
 * model — no 5h / 7d windows, just remaining balance.
 *
 * Auth file format:
 *   { type: "kimi", api_key: "sk-…", email: "user@example.com" }
 *
 * Balance endpoint:
 *   GET https://api.moonshot.cn/v1/users/me/balance
 *   Authorization: Bearer sk-…
 */

import { fetchHttpsJson } from "../socks5"
import type { AuthFile, QuotaProvider, QuotaResult } from "./types"

const KIMI_BALANCE_URL = "https://api.moonshot.cn/v1/users/me/balance"

interface KimiBalanceResponse {
  balance?: number
  total_used?: number
  available_balance?: number
  gift_balance?: number
  object?: string
}

export const kimiProvider: QuotaProvider = {
  type: "kimi",

  matchAuthFile(auth: AuthFile): boolean {
    return auth.type === "kimi" || false
  },

  async fetchQuota(auth: AuthFile): Promise<QuotaResult> {
    const apiKey = auth.api_key
    if (!apiKey) {
      throw new Error("Missing api_key in Kimi auth file")
    }

    const email = auth.email || "unknown"

    const data = (await fetchHttpsJson(
      KIMI_BALANCE_URL,
      {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      15000,
    )) as KimiBalanceResponse

    // Kimi balance may be reported under different field names depending on API version.
    const balance = data.balance ?? data.available_balance ?? 0
    const totalUsed = data.total_used ?? 0

    // Compute a rough usage percentage if we have both balance and usage.
    const total = balance + totalUsed
    const usedPct = total > 0 ? Math.round((totalUsed / total) * 100) : 0

    // Kimi has no time-windowed rate limits — use the credit usage as secondary.
    return {
      email,
      plan: null,
      allowed: true,
      limitReached: balance <= 0,
      primaryUsedPct: 0,          // no time-window concept
      primaryResetAt: null,
      secondaryUsedPct: usedPct,   // credit usage as percentage
      secondaryResetAt: null,
      creditsBalance: balance > 0 ? String(balance) : null,
      rawJson: JSON.stringify(data),
    }
  },
}
