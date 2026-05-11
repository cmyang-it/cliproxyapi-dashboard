import { NextResponse } from "next/server"
import { getEventCount } from "@/lib/db"
import { env } from "@/lib/env"
import { isRunning, lastPollTime, ensureCollector } from "@/lib/collector"

export const dynamic = "force-dynamic"

export async function GET() {
  ensureCollector()

  return NextResponse.json({
    ok: true,
    cliproxy: env.apiBaseUrl,
    pollIntervalSeconds: env.pollIntervalSeconds,
    collector: isRunning() ? "running" : "stopped",
    lastPollAt: lastPollTime() ? new Date(lastPollTime()).toISOString() : null,
    events: getEventCount(),
    uptime: Math.floor(process.uptime()),
  })
}