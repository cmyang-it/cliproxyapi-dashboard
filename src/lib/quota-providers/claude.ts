/**
 * Claude (Anthropic) quota provider.
 *
 * Anthropic does not expose a public per-key balance / usage endpoint.
 * This provider performs an API key validation by listing available models,
 * and reports availability accordingly.  Actual usage tracking relies on
 * the usage_events already collected through CLIProxyAPI.
 *
 * Auth file format:
 *   { type: "claude", api_key: "sk-ant-…", email: "user@example.com" }
 *
 * If the file contains an OAuth access_token instead (Claude Code CLI),
 * set type to "codex" or "claude-code" — this provider only handles API keys.
 */

import { fetchHttpsJson } from "../socks5"
import type { AuthFile, QuotaProvider, QuotaResult } from "./types"

const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models"
const ANTHROPIC_VERSION = "2023-06-01"

interface AnthropicModel {
  id: string
  display_name?: string
  created_at?: string
}

interface AnthropicModelsResponse {
  data?: AnthropicModel[]
}

export const claudeProvider: QuotaProvider = {
  type: "claude",

  matchAuthFile(auth: AuthFile): boolean {
    return auth.type === "claude" || false
  },

  async fetchQuota(auth: AuthFile): Promise<QuotaResult> {
    const apiKey = auth.api_key
    if (!apiKey) {
      throw new Error("Missing api_key in Claude auth file")
    }

    const email = auth.email || "unknown"

    const data = (await fetchHttpsJson(
      ANTHROPIC_MODELS_URL,
      {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        Accept: "application/json",
      },
      15000,
    )) as AnthropicModelsResponse

    const modelCount = data.data?.length ?? 0

    // Anthropic: no public balance endpoint — report key validity only.
    // Spending limits are configured per workspace in the Console;
    // usage is best tracked client-side via usage_events.
    return {
      provider: "claude",
      email,
      plan: null,
      allowed: modelCount > 0,
      limitReached: false,
      primaryUsedPct: 0,
      primaryResetAt: null,
      secondaryUsedPct: 0,
      secondaryResetAt: null,
      creditsBalance: null,
      rawJson: JSON.stringify(data),
    }
  },
}
