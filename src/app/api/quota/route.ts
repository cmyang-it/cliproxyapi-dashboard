import { NextResponse } from "next/server"
import { queryLatestQuotas } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"
import { ensureQuotaFetcher } from "@/lib/quota-fetcher"

export const dynamic = "force-dynamic"

export async function GET() {
  ensureCollector()
  ensureQuotaFetcher()
  const quotas = queryLatestQuotas()
  return NextResponse.json({ quotas })
}
