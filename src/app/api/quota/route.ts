import { NextResponse } from "next/server"
import { queryLatestQuotas } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"
import { ensureQuotaFetcher } from "@/lib/quota-fetcher"
import type { QuotaSnapshot, GeminiBucketView, QuotaSnapshotSafe } from "@/lib/types"

export const dynamic = "force-dynamic"

/** Parse Gemini bucket details from raw_json (server-side only) */
function parseGeminiRaw(rawJson: string): { buckets: GeminiBucketView[]; apiKeyMode: boolean } {
  try {
    const raw = JSON.parse(rawJson) as {
      apiKeyMode?: boolean
      retrieveUserQuota?: {
        buckets?: Array<{
          modelId?: string
          remainingFraction?: number
          resetTime?: string
        }>
      }
    }
    const buckets = (raw.retrieveUserQuota?.buckets || [])
      .filter((b) => b.modelId && Number.isFinite(b.remainingFraction))
      .map((b) => ({
        model: (b.modelId || "unknown").replace(/^gemini-/, ""),
        pct: Math.max(0, Math.min(100, Math.round((b.remainingFraction || 0) * 100))),
        resetAt: b.resetTime || null,
      }))
    return { buckets, apiKeyMode: !!raw.apiKeyMode }
  } catch {
    return { buckets: [], apiKeyMode: false }
  }
}

export async function GET() {
  ensureCollector()
  ensureQuotaFetcher()
  const quotas: QuotaSnapshotSafe[] = queryLatestQuotas().map((q: QuotaSnapshot) => {
    let geminiBuckets: GeminiBucketView[] = []
    let apiKeyMode = false
    if (q.provider === "gemini") {
      const parsed = parseGeminiRaw(q.raw_json)
      geminiBuckets = parsed.buckets
      apiKeyMode = parsed.apiKeyMode
    }
    const { raw_json: _, ...safe } = q
    return { ...safe, geminiBuckets, ...(apiKeyMode ? { apiKeyMode: true } : {}) }
  })
  return NextResponse.json({ quotas })
}
