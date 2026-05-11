import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function simpleHash(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect API routes, skip auth endpoint itself
  if (!pathname.startsWith("/api/") || pathname === "/api/auth") {
    return NextResponse.next()
  }

  const accessKey = process.env.ACCESS_KEY || ""
  if (!accessKey) {
    return NextResponse.next()
  }

  const token = request.cookies.get("dashboard_auth")?.value
  const expected = simpleHash(accessKey)

  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/api/:path*",
}
