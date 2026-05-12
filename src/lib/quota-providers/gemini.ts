/**
 * Gemini (Google AI Studio) quota provider.
 *
 * Google AI Studio free-tier API keys don't have a credit balance — instead
 * they operate under RPM (requests per minute) / TPM (tokens per minute)
 * rate limits.  This provider:
 *   1. Validates the API key by listing models
 *   2. Extracts rate-limit metadata where available
 *
 * Auth file format:
 *   { type: "gemini", api_key: "AIzaSy…", email: "user@gmail.com" }
 *
 * API reference:
 *   https://ai.google.dev/api/rest/v1beta/models/list
 */

import { fetchHttpsJson } from "../socks5"
import type { AuthFile, QuotaProvider, QuotaResult } from "./types"

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"

interface GeminiModel {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

interface GeminiModelsResponse {
  models?: GeminiModel[]
}

export const geminiProvider: QuotaProvider = {
  type: "gemini",

  matchAuthFile(auth: AuthFile): boolean {
    return auth.type === "gemini" || false
  },

  async fetchQuota(auth: AuthFile): Promise<QuotaResult> {
    const apiKey = auth.api_key
    if (!apiKey) {
      throw new Error("Missing api_key in Gemini auth file")
    }

    const email = auth.email || "unknown"

    const data = (await fetchHttpsJson(
      `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`,
      { Accept: "application/json" },
      15000,
    )) as GeminiModelsResponse

    const modelCount = data.models?.length ?? 0

    // Gemini free tier: no balance, no usage percentage — report key is valid.
    // Advanced: could inspect response headers for x-ratelimit-* but
    // fetchHttpsJson currently only returns the body.
    return {
      email,
      plan: "free",
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
