import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

function simpleHash(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

function authToken(): string {
  const key = process.env.ACCESS_KEY || ""
  if (!key) return ""
  return simpleHash(key)
}

// POST /api/auth — login
export async function POST(request: Request) {
  const accessKey = process.env.ACCESS_KEY || ""

  if (!accessKey) {
    return NextResponse.json({ authenticated: true })
  }

  let body: { key?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }

  if (body.key === accessKey) {
    cookies().set("dashboard_auth", authToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
    return NextResponse.json({ authenticated: true })
  }

  return NextResponse.json({ error: "密钥错误" }, { status: 401 })
}

// GET /api/auth — check auth status
export async function GET() {
  const accessKey = process.env.ACCESS_KEY || ""
  if (!accessKey) {
    return NextResponse.json({ authenticated: true })
  }

  const token = cookies().get("dashboard_auth")?.value
  return NextResponse.json({ authenticated: token === authToken() })
}
