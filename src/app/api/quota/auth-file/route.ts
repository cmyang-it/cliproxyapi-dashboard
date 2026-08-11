import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { setAuthFileDisabled } from "@/lib/quota/auth-file-status"
import { markAuthFileDeleted } from "@/lib/quota/auth"

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


export async function PATCH(request: Request) {
  let body: { name?: unknown; disabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "账户文件名无效" }, { status: 400 })
  }

  if (typeof body.disabled !== "boolean") {
    return NextResponse.json({ error: "disabled 必须为 boolean" }, { status: 400 })
  }

  if (!env.managementKey.trim()) {
    return NextResponse.json({ error: "MANAGEMENT_KEY 未配置" }, { status: 500 })
  }

  try {
    const disabled = await setAuthFileDisabled(name, body.disabled)
    return NextResponse.json({ disabled })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes("MANAGEMENT_KEY 未配置") ? 500 : 502
    return NextResponse.json({ error: message || "更新账户文件状态失败" }, { status })
  }
}
