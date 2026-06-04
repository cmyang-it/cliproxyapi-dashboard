/**
 * Gemini quota provider.
 *
 * Supports two auth modes:
 *   1. Google AI Studio API key: validates the key by listing models.
 *   2. Gemini CLI OAuth: reads Code Assist quota buckets through OAuth.
 */

import fs from "fs"
import { fetchHttpsJson, postHttpsFormJson, postHttpsJson } from "../socks5"
import type { AuthFile, QuotaProvider, QuotaResult } from "./types"

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"
const CODE_ASSIST_LOAD_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist"
const CODE_ASSIST_QUOTA_URL = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota"

interface GeminiModel {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

interface GeminiModelsResponse {
  models?: GeminiModel[]
}

interface GeminiCliToken {
  access_token?: string
  refresh_token?: string
  client_id?: string
  client_secret?: string
  token_uri?: string
  expiry?: string | number
  scopes?: string[]
}

interface GeminiCliAuth extends AuthFile {
  project_id?: string
  token?: GeminiCliToken
}

interface OAuthRefreshResponse {
  access_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

interface CodeAssistBucket {
  remainingAmount?: string
  remainingFraction?: number
  resetTime?: string
  tokenType?: string
  modelId?: string
}

interface RetrieveUserQuotaResponse {
  buckets?: CodeAssistBucket[]
}

interface LoadCodeAssistResponse {
  currentTier?: { id?: string; name?: string } | null
  cloudaicompanionProject?: string | null
  paidTier?: { id?: string; name?: string; availableCredits?: unknown[] } | null
}

export const geminiProvider: QuotaProvider = {
  type: "gemini",

  matchAuthFile(auth: AuthFile): boolean {
    return auth.type === "gemini" || false
  },

  async fetchQuota(auth: AuthFile): Promise<QuotaResult> {
    if (auth.api_key) {
      return fetchApiKeyQuota(auth)
    }

    if (isGeminiCliAuth(auth)) {
      return fetchGeminiCliQuota(auth)
    }

    throw new Error("Missing api_key or Gemini CLI OAuth token in Gemini auth file")
  },
}

async function fetchApiKeyQuota(auth: AuthFile): Promise<QuotaResult> {
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

  return {
    provider: "gemini",
    email,
    plan: "free",
    allowed: modelCount > 0,
    limitReached: false,
    primaryUsedPct: 0,
    primaryResetAt: null,
    secondaryUsedPct: 0,
    secondaryResetAt: null,
    creditsBalance: null,
    rawJson: JSON.stringify({ apiKeyMode: true, modelCount }),
  }
}

async function fetchGeminiCliQuota(auth: GeminiCliAuth): Promise<QuotaResult> {
  const accessToken = await getValidGeminiAccessToken(auth)
  const projectId = auth.project_id || "cloudshell-gca"
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  }

  const metadata = {
    ideType: "IDE_UNSPECIFIED",
    platform: "PLATFORM_UNSPECIFIED",
    pluginType: "GEMINI",
    duetProject: projectId,
  }

  const loadCodeAssist = await postCodeAssist<LoadCodeAssistResponse>(
    "loadCodeAssist",
    CODE_ASSIST_LOAD_URL,
    headers,
    {
      cloudaicompanionProject: projectId,
      metadata,
      mode: "HEALTH_CHECK",
    },
  )

  const quota = await postCodeAssist<RetrieveUserQuotaResponse>(
    "retrieveUserQuota",
    CODE_ASSIST_QUOTA_URL,
    headers,
    {
      project: loadCodeAssist.cloudaicompanionProject || projectId,
    },
  )

  const bucket = selectQuotaBucket(quota.buckets || [])
  if (!bucket) {
    throw new Error("No Gemini CLI quota buckets returned")
  }

  const remainingFraction = clampFraction(bucket.remainingFraction)
  const remainingAmount = Number(bucket.remainingAmount || "0")
  const primaryUsedPct = Math.max(0, Math.min(100, 100 - Math.round(remainingFraction * 100)))
  const allowed = remainingFraction > 0 || remainingAmount > 0

  return {
    provider: "gemini",
    email: auth.email || "unknown",
    plan: paidTierLabel(loadCodeAssist),
    allowed,
    limitReached: !allowed,
    primaryUsedPct,
    primaryResetAt: bucket.resetTime || null,
    secondaryUsedPct: 0,
    secondaryResetAt: null,
    creditsBalance: null,
    rawJson: JSON.stringify({ loadCodeAssist, retrieveUserQuota: quota, selectedBucket: bucket }),
  }
}

function paidTierLabel(data: LoadCodeAssistResponse): string {
  const text = `${data.paidTier?.id || ""} ${data.paidTier?.name || ""}`.toLowerCase()
  if (text.includes("ultra")) return "ultra"
  if (text.includes("pro")) return "pro"
  if (text.includes("standard")) return "standard"
  return "cli"
}

function isGeminiCliAuth(auth: AuthFile): auth is GeminiCliAuth {
  const token = (auth as GeminiCliAuth).token
  if (!token || typeof token !== "object") return false
  return Boolean(
    token.access_token ||
    (token.refresh_token && token.client_id && token.client_secret && token.token_uri)
  )
}

async function postCodeAssist<T>(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<T> {
  try {
    return (await postHttpsJson(url, headers, body, 15000)) as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini Code Assist ${method} failed: ${message}`)
  }
}

async function getValidGeminiAccessToken(auth: GeminiCliAuth): Promise<string> {
  const token = auth.token
  if (!token) throw new Error("Missing Gemini CLI OAuth token")

  if (token.access_token && !isTokenExpired(token.expiry)) {
    return token.access_token
  }

  const { refresh_token, client_id, client_secret, token_uri } = token
  if (!refresh_token || !client_id || !client_secret || !token_uri) {
    throw new Error("Gemini CLI OAuth token expired and refresh fields are incomplete")
  }

  let data: OAuthRefreshResponse
  try {
    data = (await postHttpsFormJson(
      token_uri,
      { Accept: "application/json" },
      {
        grant_type: "refresh_token",
        refresh_token,
        client_id,
        client_secret,
      },
      15000,
    )) as OAuthRefreshResponse
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini CLI OAuth refresh failed: ${message}`)
  }

  if (!data.access_token) {
    throw new Error("Gemini CLI OAuth refresh did not return access_token")
  }

  // Persist refreshed token back to the auth file so subsequent rounds
  // don't trigger redundant OAuth refresh requests.
  if (auth._filepath) {
    const newExpiry = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
    token.access_token = data.access_token
    if (newExpiry) token.expiry = newExpiry
    try {
      const content = fs.readFileSync(auth._filepath, "utf-8")
      const parsed = JSON.parse(content) as Record<string, unknown>
      const existingToken = (parsed.token && typeof parsed.token === "object") ? parsed.token as Record<string, unknown> : {}
      parsed.token = { ...existingToken, access_token: data.access_token }
      if (newExpiry) (parsed.token as Record<string, unknown>).expiry = newExpiry
      fs.writeFileSync(auth._filepath, JSON.stringify(parsed, null, 2))
    } catch {
      // Non-fatal: token is still valid in-memory for this round
      console.warn(`[gemini] Failed to persist refreshed token to ${auth._filepath}`)
    }
  }

  return data.access_token
}

function isTokenExpired(expiry: string | number | undefined): boolean {
  if (!expiry) return false

  let expiryMs: number
  if (typeof expiry === "number") {
    // Heuristic: values < 1e12 are likely seconds, not milliseconds
    expiryMs = expiry < 1e12 ? expiry * 1000 : expiry
  } else {
    expiryMs = new Date(expiry).getTime()
  }
  if (!Number.isFinite(expiryMs)) return true

  return Date.now() >= expiryMs - 60_000
}

function selectQuotaBucket(buckets: CodeAssistBucket[]): CodeAssistBucket | null {
  if (buckets.length === 0) return null

  return [...buckets].sort((a, b) => {
    const aFraction = clampFraction(a.remainingFraction)
    const bFraction = clampFraction(b.remainingFraction)
    return aFraction - bFraction
  })[0]
}

function clampFraction(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
