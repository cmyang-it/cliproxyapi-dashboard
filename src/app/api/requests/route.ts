import { NextResponse } from "next/server"
import { queryRecentRequests } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  ensureCollector()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(500, parseInt(searchParams.get("limit") || "100", 10))

  const requests = queryRecentRequests(limit)
  return NextResponse.json({ requests })
}
