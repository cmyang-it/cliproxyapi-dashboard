# CLIProxyAPI Dashboard

A local-first usage statistics and monitoring dashboard for CLIProxyAPI. It collects per-request token usage from the CLIProxyAPI Management API, stores data in SQLite, and provides a real-time visualization panel.

## Features

- **KPI Overview** — Request count, total tokens, input/output/reasoning/cached tokens
- **Hourly Trends** — Token consumption area chart grouped by hour
- **Model Distribution** — Donut pie chart showing token share per model (Top 7 + "Others")
- **Account Consumption** — Detailed breakdown by account/source
- **API Key Consumption** — Token usage grouped by individual API key
- **Quota Status** — Codex 5h/7d remaining quota progress bars per account
- **Request Feed** — Recent requests with token counts, latency, and model info
- **Time Range** — Toggle between Today, 1h, 5h, 24h, and 7d views
- **Light / Dark Mode** — One-click theme toggle, preference persisted in localStorage
- **Authentication** — Optional access key protection with login dialog
- **Auto Refresh** — Data refreshes every 10 seconds, with a manual refresh button
- **Collector Status** — Footer shows collector running state, event count, and uptime

## Quick Start

### Prerequisites

- Node.js 18+
- CLIProxyAPI running with Management API enabled
- Usage statistics enabled in CLIProxyAPI

Ensure your CLIProxyAPI config includes:

```yaml
usage-statistics-enabled: true
redis-usage-queue-retention-seconds: 3600
```

### Local Development

```bash
# 1. Navigate to project
cd cliproxyapi-dashboard

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set MANAGEMENT_KEY

# 4. Start dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

### Docker Deployment

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env

# 2. Start services
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

Open `http://localhost:8320` in your browser.

## Environment Variables

| Variable | Default | Description |
|------|--------|------|
| `CLIPROXY_URL` | `http://127.0.0.1:8317` | Full CLIProxyAPI URL (recommended; supports `https://` and domains) |
| `CLIPROXY_HOST` | `127.0.0.1` | CLIProxyAPI host (used only when `CLIPROXY_URL` is not set) |
| `CLIPROXY_PORT` | `8317` | CLIProxyAPI port (used only when `CLIPROXY_URL` is not set) |
| `MANAGEMENT_KEY` | (required) | Management API plaintext key |
| `ACCESS_KEY` | — | Dashboard login key (auth disabled when empty) |
| `POLL_INTERVAL_SECONDS` | `2` | Data collection interval (seconds) |
| `QUOTA_REFRESH_SECONDS` | `300` | Quota refresh interval (seconds) |
| `DB_PATH` | `./data/usage.sqlite` | SQLite database path |
| `AUTH_DIR` | — | Codex OAuth directory (optional, for quota queries) |
| `SOCKS5_PROXY_HOST` | — | SOCKS5 proxy host for quota fetching |
| `SOCKS5_PROXY_PORT` | `0` | SOCKS5 proxy port (0 = disabled) |

> **Prefer `CLIPROXY_URL`**: set `http://127.0.0.1:8317` or `https://api.xiyangai.cn` — the system auto-parses protocol, host, and port. Legacy `CLIPROXY_HOST` + `CLIPROXY_PORT` are still supported.

## Authentication

When `ACCESS_KEY` is configured, the dashboard requires a login key before displaying any data. On successful authentication, an httpOnly cookie is stored in the browser (valid for 30 days), so re-authentication is not needed on subsequent visits. Leave `ACCESS_KEY` empty to skip authentication entirely.

```bash
# .env
ACCESS_KEY=your-secret-key
```

## Data Storage

All usage data is stored locally in SQLite (WAL mode) — nothing is uploaded to any third-party service. The database contains two tables:

- `usage_events` — Per-request usage events (token counts, model, account, API key hash, latency, etc.)
- `quota_snapshots` — ChatGPT/Codex account quota snapshots (optional)

## Architecture

```
CLIProxyAPI :8317  ←→  Dashboard (Next.js)
  │                        │
  │ GET /usage-queue       │ Collector (polls every N seconds)
  │                        │
  │                        ↓
  │                    SQLite
  │                        │
  │                        ↓
  │                 API Routes (+ Auth Middleware)
  │                        │
  │                        ↓
  └────────────────→  React Panel (Light / Dark theme)
```

## API Endpoints

| Endpoint | Auth Required | Description |
|------|------|------|
| `GET /api/health` | Yes | Health check & collector status |
| `GET /api/summary?range=today` | Yes | Usage summary (grouped by account/model/key/hour) |
| `GET /api/requests?limit=100` | Yes | Recent request details |
| `GET /api/quota` | Yes | Account quota snapshots |
| `POST /api/auth` | No | Login verification |
| `GET /api/auth` | No | Check authentication status |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Charts**: Recharts (Area Chart / Donut Pie Chart)
- **Database**: better-sqlite3 (WAL mode)
- **Styling**: Tailwind CSS + CSS custom properties theme system
- **Icons**: Lucide React
- **Auth**: httpOnly Cookie + Edge Middleware

## License

MIT
