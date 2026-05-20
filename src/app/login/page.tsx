"use client"

import { useRouter } from "next/navigation"
import { LoginDialog } from "@/components/login-dialog"

export default function LoginPage() {
  const router = useRouter()

  return <LoginDialog onSuccess={() => router.replace("/")} />
}
