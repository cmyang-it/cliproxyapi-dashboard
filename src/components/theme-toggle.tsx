"use client"

import { useState, useEffect } from "react"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-md border border-border bg-secondary hover:bg-secondary/70 transition-colors",
        className
      )}
      aria-label={mounted ? (dark ? "切换到亮色模式" : "切换到暗色模式") : "切换主题"}
    >
      {mounted ? (
        dark ? (
          <Sun className="w-4 h-4 text-warning" />
        ) : (
          <Moon className="w-4 h-4 text-primary" />
        )
      ) : (
        <span className="w-4 h-4" />
      )}
    </button>
  )
}
