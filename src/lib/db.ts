import Database from "better-sqlite3"
import path from "path"
import fs from "fs"
import { env } from "./env"
import type {
  SummaryRow,
  AccountRow,
  ModelRow,
  HourRow,
  RecentRequest,
  ApiKeyRow,
  QuotaSnapshot,
} from "./types"

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dbDir = path.dirname(env.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
      console.log(`[db] Created directory: ${dbDir}`)
    }

    // Verify the directory is writable before attempting to open/create the DB
    try {
      fs.accessSync(dbDir, fs.constants.W_OK)
    } catch {
      const stat = fs.statSync(dbDir)
      console.error(
        `[db] Directory not writable: ${dbDir} (uid=${stat.uid}, gid=${stat.gid}, mode=${stat.mode.toString(8)}). ` +
        `Running as uid=${process.getuid?.() ?? "?"}, gid=${process.getgid?.() ?? "?"}. ` +
        `Fix: docker-compose down -v && docker-compose up -d, or chmod 777 the data directory.`
      )
      throw new Error(`Cannot write to database directory: ${dbDir}`)
    }

    const dbExists = fs.existsSync(env.dbPath)
    try {
      _db = new Database(env.dbPath)
    } catch (err) {
      console.error(`[db] Failed to open database: ${env.dbPath} — ${err instanceof Error ? err.message : err}`)
      throw err
    }

    _db.pragma("journal_mode = WAL")
    _db.pragma("busy_timeout = 30000")

    if (dbExists) {
      console.log(`[db] Opened existing database: ${env.dbPath}`)
    } else {
      console.log(`[db] Created new database: ${env.dbPath}`)
    }

    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL UNIQUE,
      timestamp TEXT NOT NULL,
      ts_epoch REAL NOT NULL,
      local_date TEXT NOT NULL,
      local_hour TEXT NOT NULL,
      request_id TEXT,
      auth_index TEXT,
      source TEXT,
      provider TEXT,
      model TEXT,
      endpoint TEXT,
      auth_type TEXT,
      api_key_hash TEXT,
      api_key TEXT,
      failed INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      raw_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_events(ts_epoch);
    CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_events(local_date);
    CREATE INDEX IF NOT EXISTS idx_usage_source ON usage_events(source);
    CREATE INDEX IF NOT EXISTS idx_usage_auth ON usage_events(auth_index);

    CREATE TABLE IF NOT EXISTS quota_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      ts_epoch REAL NOT NULL,
      email TEXT NOT NULL,
      plan TEXT,
      allowed INTEGER,
      limit_reached INTEGER,
      primary_used_percent INTEGER,
      primary_remaining_percent INTEGER,
      primary_reset_at TEXT,
      secondary_used_percent INTEGER,
      secondary_remaining_percent INTEGER,
      secondary_reset_at TEXT,
      credits_balance TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quota_email_ts ON quota_snapshots(email, ts_epoch);
  `)

  // Migration: add api_key column for existing databases
  try {
    db.exec("ALTER TABLE usage_events ADD COLUMN api_key TEXT")
  } catch {
    // column already exists
  }
}

/** Insert raw usage JSON records into SQLite, deduping by request_id */
export function insertUsageBatch(items: unknown[]): number {
  const db = getDb()
  let inserted = 0
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO usage_events (
      event_key, timestamp, ts_epoch, local_date, local_hour,
      request_id, auth_index, source, provider, model, endpoint,
      auth_type, api_key_hash, api_key, failed, latency_ms,
      input_tokens, output_tokens, reasoning_tokens, cached_tokens, total_tokens, raw_json
    ) VALUES (
      @event_key, @timestamp, @ts_epoch, @local_date, @local_hour,
      @request_id, @auth_index, @source, @provider, @model, @endpoint,
      @auth_type, @api_key_hash, @api_key, @failed, @latency_ms,
      @input_tokens, @output_tokens, @reasoning_tokens, @cached_tokens, @total_tokens, @raw_json
    )
  `)

  const tzOffset = 8 // Asia/Shanghai hardcoded for simplicity — adjust as needed
  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const payload of rows) {
      const raw = JSON.stringify(payload)
      const rid = (payload as Record<string, string>).request_id
      const eventKey = rid || simpleHash(raw)
      const ts = parseRfc3339((payload as Record<string, string>).timestamp)
      const localTs = new Date(ts.getTime() + tzOffset * 3600000)
      const tokens = (payload as Record<string, Record<string, number>>).tokens || {}
      const apiKey = String((payload as Record<string, string>).api_key || "")

      stmt.run({
        event_key: eventKey,
        timestamp: ts.toISOString(),
        ts_epoch: ts.getTime() / 1000,
        local_date: localTs.toISOString().slice(0, 10),
        local_hour: localTs.toISOString().slice(0, 13) + ":00",
        request_id: (payload as Record<string, string>).request_id || null,
        auth_index: (payload as Record<string, string>).auth_index || null,
        source: (payload as Record<string, string>).source || null,
        provider: (payload as Record<string, string>).provider || null,
        model: (payload as Record<string, string>).model || null,
        endpoint: (payload as Record<string, string>).endpoint || null,
        auth_type: (payload as Record<string, string>).auth_type || null,
        api_key_hash: apiKey ? simpleHash(apiKey).slice(0, 12) : null,
        api_key: apiKey ? maskApiKey(apiKey) : null,
        failed: (payload as Record<string, boolean>).failed ? 1 : 0,
        latency_ms: Number((payload as Record<string, number>).latency_ms) || 0,
        input_tokens: tokens.input_tokens || 0,
        output_tokens: tokens.output_tokens || 0,
        reasoning_tokens: tokens.reasoning_tokens || 0,
        cached_tokens: tokens.cached_tokens || 0,
        total_tokens: tokens.total_tokens || 0,
        raw_json: raw,
      })
      inserted++
    }
  })

  insertMany(items as Record<string, unknown>[])
  return inserted
}

export function insertQuotaSnapshot(data: {
  email: string
  plan: string | null
  allowed: boolean
  limitReached: boolean
  primaryUsedPct: number
  primaryResetAt: string | null
  secondaryUsedPct: number
  secondaryResetAt: string | null
  creditsBalance: string | null
  rawJson: string
}): void {
  const db = getDb()
  const now = new Date()
  db.prepare(`
    INSERT INTO quota_snapshots (
      timestamp, ts_epoch, email, plan, allowed, limit_reached,
      primary_used_percent, primary_remaining_percent, primary_reset_at,
      secondary_used_percent, secondary_remaining_percent, secondary_reset_at,
      credits_balance, raw_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    now.toISOString(),
    now.getTime() / 1000,
    data.email,
    data.plan,
    data.allowed ? 1 : 0,
    data.limitReached ? 1 : 0,
    data.primaryUsedPct,
    Math.max(0, 100 - data.primaryUsedPct),
    data.primaryResetAt,
    data.secondaryUsedPct,
    Math.max(0, 100 - data.secondaryUsedPct),
    data.secondaryResetAt,
    data.creditsBalance,
    data.rawJson,
  )
}

/** Get date range bounds for a range name, returning UTC epoch seconds */
export function getRangeBounds(range: string): { start: number; end: number } {
  const nowEpoch = Date.now() / 1000
  const tzOffset = 8 * 3600 // Asia/Shanghai in seconds
  let start: number

  switch (range) {
    case "1h":
      start = nowEpoch - 3600
      break
    case "5h":
      start = nowEpoch - 5 * 3600
      break
    case "24h":
      start = nowEpoch - 24 * 3600
      break
    case "7d":
      start = nowEpoch - 7 * 24 * 3600
      break
    default: { // today — midnight in Asia/Shanghai, expressed as UTC epoch
      const shanghaiDay = Math.floor((nowEpoch + tzOffset) / 86400)
      start = shanghaiDay * 86400 - tzOffset
    }
  }

  return { start, end: nowEpoch }
}

export function querySummary(range: string): SummaryRow {
  const db = getDb()
  const { start, end } = getRangeBounds(range)
  return db
    .prepare(
      `SELECT
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens),0) as total_tokens,
        COALESCE(SUM(input_tokens),0) as input_tokens,
        COALESCE(SUM(output_tokens),0) as output_tokens,
        COALESCE(SUM(reasoning_tokens),0) as reasoning_tokens,
        COALESCE(SUM(cached_tokens),0) as cached_tokens,
        COALESCE(SUM(failed),0) as failed
      FROM usage_events WHERE ts_epoch BETWEEN ? AND ?`
    )
    .get(start, end) as SummaryRow
}

export function queryByAccount(range: string): AccountRow[] {
  const db = getDb()
  const { start, end } = getRangeBounds(range)
  return db
    .prepare(
      `SELECT
        COALESCE(source, auth_index, 'unknown') as account,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens),0) as total_tokens,
        COALESCE(SUM(input_tokens),0) as input_tokens,
        COALESCE(SUM(output_tokens),0) as output_tokens,
        COALESCE(SUM(reasoning_tokens),0) as reasoning_tokens,
        COALESCE(SUM(cached_tokens),0) as cached_tokens,
        COALESCE(SUM(failed),0) as failed
      FROM usage_events WHERE ts_epoch BETWEEN ? AND ?
      GROUP BY account ORDER BY total_tokens DESC`
    )
    .all(start, end) as AccountRow[]
}

export function queryByModel(range: string): ModelRow[] {
  const db = getDb()
  const { start, end } = getRangeBounds(range)
  return db
    .prepare(
      `SELECT
        COALESCE(model, 'unknown') as model,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens),0) as total_tokens,
        COALESCE(SUM(failed),0) as failed
      FROM usage_events WHERE ts_epoch BETWEEN ? AND ?
      GROUP BY model ORDER BY total_tokens DESC LIMIT 12`
    )
    .all(start, end) as ModelRow[]
}

export function queryByApiKey(range: string): ApiKeyRow[] {
  const db = getDb()
  const { start, end } = getRangeBounds(range)
  return db
    .prepare(
      `SELECT
        COALESCE(api_key, 'unknown') as api_key,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens),0) as total_tokens,
        COALESCE(SUM(input_tokens),0) as input_tokens,
        COALESCE(SUM(output_tokens),0) as output_tokens,
        COALESCE(SUM(failed),0) as failed
      FROM usage_events WHERE ts_epoch BETWEEN ? AND ? AND api_key IS NOT NULL
      GROUP BY api_key ORDER BY total_tokens DESC LIMIT 20`
    )
    .all(start, end) as ApiKeyRow[]
}

export function queryByHour(range: string): HourRow[] {
  const db = getDb()
  const { start, end } = getRangeBounds(range)
  return db
    .prepare(
      `SELECT
        local_hour as hour,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens),0) as total_tokens,
        COALESCE(SUM(failed),0) as failed
      FROM usage_events WHERE ts_epoch BETWEEN ? AND ?
      GROUP BY local_hour ORDER BY local_hour`
    )
    .all(start, end) as HourRow[]
}

export function queryRecentRequests(limit: number): RecentRequest[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT timestamp, source, auth_index, model, endpoint, failed, latency_ms,
        input_tokens, output_tokens, reasoning_tokens, cached_tokens, total_tokens, request_id
      FROM usage_events ORDER BY ts_epoch DESC LIMIT ?`
    )
    .all(limit) as RecentRequest[]

  for (const row of rows) {
    const d = new Date(row.timestamp)
    row.local_time = d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }
  return rows
}

export function queryLatestQuotas(): QuotaSnapshot[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT q.* FROM quota_snapshots q
      JOIN (
        SELECT email, MAX(ts_epoch) as ts FROM quota_snapshots GROUP BY email
      ) latest ON latest.email = q.email AND latest.ts = q.ts_epoch
      ORDER BY email`
    )
    .all() as QuotaSnapshot[]
}

export function getEventCount(): number {
  const db = getDb()
  const row = db.prepare("SELECT COUNT(*) as cnt FROM usage_events").get() as {
    cnt: number
  }
  return row.cnt
}

// Helpers

function parseRfc3339(value: string): Date {
  if (!value) return new Date()
  const d = new Date(value.replace("Z", "+00:00"))
  return isNaN(d.getTime()) ? new Date() : d
}

function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

/** Mask the middle portion of an API key to prevent plaintext leakage */
function maskApiKey(key: string): string {
  if (!key) return ""
  const len = key.length
  if (len <= 8) {
    return key.slice(0, Math.max(1, len - 3)) + "***" + key.slice(Math.max(len - 2, 0))
  }
  if (len <= 16) {
    return key.slice(0, 6) + "***" + key.slice(len - 4)
  }
  return key.slice(0, 8) + "***" + key.slice(len - 4)
}