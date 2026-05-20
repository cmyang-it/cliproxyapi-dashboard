import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number | null | undefined): string {
  if (n == null) return "0"
  return n.toLocaleString("zh-CN")
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function fmtPct(value: number): string {
  return `${Math.round(value)}%`
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export const RANGE_OPTIONS = [
  { value: "today", label: "今天" },
  { value: "24h", label: "最近 24 小时" },
  { value: "7d", label: "最近 7 天" },
  { value: "15d", label: "最近 15 天" },
  { value: "30d", label: "最近 30 天" },
] as const

export type RangeOption = (typeof RANGE_OPTIONS)[number]["value"]
