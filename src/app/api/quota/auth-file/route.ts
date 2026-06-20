import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { markAuthFileDeleted } from "@/lib/quota-auth"

export const dynamic = "force-dynamic"

export async function DELETE(request: Request) {
  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "账户文件名无效" }, { status: 400 })
  }

  if (!env.managementKey) {
    return NextResponse.json({ error: "MANAGEMENT_KEY 未配置" }, { status: 500 })
  }

  const url = `${env.apiBaseUrl}/v0/management/auth-files?name=${encodeURIComponent(name)}`
  let res: Response
  try {
    res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${env.managementKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求 CLIProxyAPI 失败"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  if (!res.ok) {
    let message = `删除失败（HTTP ${res.status}）`
    try {
      const data = await res.json() as { error?: string; message?: string }
      message = data.error || data.message || message
    } catch {
      // Keep the status-based message.
    }
    return NextResponse.json({ error: message }, { status: res.status })
  }

  markAuthFileDeleted(name)
  return NextResponse.json({ ok: true })
}
