/**
 * Parse CLIProxyAPI base URL from environment.
 *
 * Priority: CLIPROXY_URL > CLIPROXY_HOST + CLIPROXY_PORT > default
 *
 * Accepts forms like:
 *   http://127.0.0.1:8317
 *   https://api.xiyangai.cn
 *   http://192.168.1.100:8371/v0/management   (path is stripped)
 */
function parseBaseUrl(): string {
  const raw = process.env.CLIPROXY_URL?.trim()
  if (raw) {
    try {
      const u = new URL(raw)
      // strip path/query/hash — keep only origin
      return u.origin
    } catch {
      console.warn(`[env] Invalid CLIPROXY_URL "${raw}", falling back to host+port`)
    }
  }

  // Fallback to separate host / port
  const host = process.env.CLIPROXY_HOST?.trim() || "127.0.0.1"
  const port = process.env.CLIPROXY_PORT?.trim() || "8317"
  const protocol = process.env.CLIPROXY_HTTPS === "true" ? "https" : "http"
  return `${protocol}://${host}:${port}`
}

const _baseUrl = parseBaseUrl()

export const env = {
  /** Full base URL of CLIProxyAPI, e.g. "https://api.xiyangai.cn" or "http://127.0.0.1:8317" */
  apiBaseUrl: _baseUrl,

  /** Management API plaintext key (required) */
  managementKey: process.env.MANAGEMENT_KEY || "",

  /** Seconds between usage-queue polls (default 2) */
  pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || "2", 10),

  /** Seconds between quota refreshes (default 300) */
  quotaRefreshSeconds: parseInt(process.env.QUOTA_REFRESH_SECONDS || "300", 10),

  /** SQLite database path (default ./data/usage.sqlite) */
  dbPath: process.env.DB_PATH || "./data/usage.sqlite",

  /** Directory containing Codex OAuth JSON files (optional) */
  authDir: process.env.AUTH_DIR || "",

  /** SOCKS5 proxy host for quota fetching (optional) */
  socks5ProxyHost: process.env.SOCKS5_PROXY_HOST || "",
  /** SOCKS5 proxy port (default 0 = disabled) */
  socks5ProxyPort: parseInt(process.env.SOCKS5_PROXY_PORT || "0", 10),

  /** Dashboard access key (empty = auth disabled) */
  accessKey: process.env.ACCESS_KEY || "",
}

export function validate(): string[] {
  const errors: string[] = []
  if (!env.managementKey) errors.push("MANAGEMENT_KEY is required")
  return errors
}