import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { getCurrentAuthAccountsFromDir, buildQuotaStats } from "./quota-auth"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quota-auth-"))

fs.writeFileSync(
  path.join(dir, "codex-a.json"),
  JSON.stringify({ type: "codex", email: "a@example.com", access_token: "token" }),
)
fs.writeFileSync(
  path.join(dir, "kimi-b.json"),
  JSON.stringify({ type: "kimi", email: "b@example.com", api_key: "key" }),
)
fs.writeFileSync(
  path.join(dir, "disabled.json"),
  JSON.stringify({ type: "codex", email: "disabled@example.com", access_token: "token", disabled: true }),
)
fs.writeFileSync(
  path.join(dir, "stale.txt"),
  "ignored",
)

const accounts = getCurrentAuthAccountsFromDir(dir)
assert.deepEqual(accounts, [
  { provider: "codex", email: "a@example.com", name: "codex-a.json" },
  { provider: "kimi", email: "b@example.com", name: "kimi-b.json" },
])

const stats = buildQuotaStats(accounts, [
  {
    id: 1,
    timestamp: "",
    ts_epoch: 1,
    provider: "codex",
    email: "a@example.com",
    plan: null,
    allowed: 0,
    limit_reached: 0,
    primary_used_percent: 0,
    primary_remaining_percent: 100,
    primary_reset_at: null,
    secondary_used_percent: 0,
    secondary_remaining_percent: 100,
    secondary_reset_at: null,
    credits_balance: null,
    raw_json: "{}",
  },
])

assert.deepEqual(stats, { total: 2, normal: 1, limitReached: 1, authFailed: 0 })

const statsWithRefreshFailure = buildQuotaStats(accounts, [], [
  { provider: "kimi", email: "b@example.com", name: "kimi-b.json", message: "HTTP 401", at: 1 },
])

assert.deepEqual(statsWithRefreshFailure, { total: 2, normal: 1, limitReached: 0, authFailed: 1 })

fs.rmSync(dir, { recursive: true, force: true })
