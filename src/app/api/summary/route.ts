import { NextResponse } from "next/server"
import { querySummary, queryByAccount, queryByModel, queryByHour, queryByApiKey } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  ensureCollector()

  const { searchParams } = new URL(request.url)
  const range = searchParams.get("range") || "today"

  const [summary, accounts, models, hours, apiKeys] = await Promise.all([
    Promise.resolve(querySummary(range)),
    Promise.resolve(queryByAccount(range)),
    Promise.resolve(queryByModel(range)),
    Promise.resolve(queryByHour(range)),
    Promise.resolve(queryByApiKey(range)),
  ])

  return NextResponse.json({ range, summary, accounts, models, hours, apiKeys })
}