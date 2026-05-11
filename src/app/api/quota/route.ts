import { NextResponse } from "next/server"
import { queryLatestQuotas } from "@/lib/db"
import { ensureCollector } from "@/lib/collector"

export const dynamic = "force-dynamic"

export async function GET() {
  ensureCollector()
  const quotas = queryLatestQuotas()
  return NextResponse.json({ quotas })
}
