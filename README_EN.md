# CLIProxyAPI Dashboard

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](#license)

[简体中文](README.md) | [English](README_EN.md)

A local-first usage statistics and monitoring dashboard for CLIProxyAPI. It collects per-request token usage from the CLIProxyAPI Management API, stores data in SQLite, and provides a real-time dashboard with visual charts, request details, and multi-provider quota monitoring.

## Recent Updates

- **Gemini CLI multi-model quotas** — Supports Gemini CLI OAuth and reads Code Assist quota buckets, displaying per-model progress bars, percentages, reset times, and paid-tier labels.
- **Richer quota panel** — Codex shows 5h/7d dual progress bars; Gemini can show multiple model buckets; Kimi, Claude, and other providers use the unified quota bar style.
- **Masked API key in request feed** — Recent requests now include a masked Key column, making it easier to trace usage sources without exposing plaintext keys.
- **Stable chart card heights** — Token trend and model distribution cards keep a stable minimum height when switching ranges, avoiding layout jumps between 24h/7d-style views.
- **Extended statistics ranges** — Supports Today, last 24 hours, last 7 days, last 15 days, and last 30 days.

## Features

- **Home / Details Tabs** — Dual-tab navigation: Home for overview and charts, Details for consumption tables and quotas.
- **KPI Overview** — Request count (with success/failure breakdown), total tokens, input/output/reasoning/cached tokens.
- **Token Trends** — Area chart grouped by hour or day depending on the selected range.
- **Model Distribution** — Custom gradient horizontal bar chart with framer-motion animations, Top 10 models, and global percentage.
- **Account Consumption** — Detailed breakdown by account/source (Details tab).
- **API Key Consumption** — Token usage grouped by individual API key (Details tab).
- **Quota Status** — Account quota snapshots and progress bars for Codex, Gemini, Kimi, Claude, and other providers (Details tab).
- **Request Feed** — Recent requests with time, masked key, account, model, token counts, latency, and status.
- **Time Range** — Toggle between Today, 24h, 7d, 15d, and 30d views.
- **Light / Dark Mode** — One-click theme toggle, preference persisted in localStorage.
- **Authentication** — Optional access key protection with login dialog.
- **Auto Refresh** — Data refreshes every 10 seconds, with a manual refresh button.
- **Collector Status** — Footer shows collector running state, event count, and uptime.

## Screenshots

![img1](./images/img1.png)

![img2](./images/img2.png)

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

You can also run the image directly:

```bash
docker run -d \
  --name cliproxyapi-dashboard \
  --restart unless-stopped \
  -p 3000:3000 \
  -e CLIPROXY_URL="${CLIPROXY_URL:-http://127.0.0.1:8317}" \
  -e MANAGEMENT_KEY="${MANAGEMENT_KEY:-}" \
  -e ACCESS_KEY="${ACCESS_KEY:-admin123}" \
  -e POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-2}" \
  -e QUOTA_REFRESH_SECONDS="${QUOTA_REFRESH_SECONDS:-300}" \
  -e SOCKS5_PROXY_HOST="${SOCKS5_PROXY_HOST:-}" \
  -e SOCKS5_PROXY_PORT="${SOCKS5_PROXY_PORT:-0}" \
  -e SOCKS5_PROXY_USERNAME="${SOCKS5_PROXY_USERNAME:-}" \
  -e SOCKS5_PROXY_PASSWORD="${SOCKS5_PROXY_PASSWORD:-}" \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/auths:/app/auths:ro" \
  xiyangai/cliproxyapi-dashboard:latest
```

Open `http://localhost:3000` in your browser.

## Environment Variables

| Variable | Default | Description |
|------|--------|------|
| `CLIPROXY_URL` | `http://127.0.0.1:8317` | Full CLIProxyAPI URL (recommended; supports `https://` and domains) |
| `CLIPROXY_HOST` | `127.0.0.1` | CLIProxyAPI host (used only when `CLIPROXY_URL` is not set) |
| `CLIPROXY_PORT` | `8317` | CLIProxyAPI port (used only when `CLIPROXY_URL` is not set) |
| `MANAGEMENT_KEY` | (required) | Management API plaintext key |
| `ACCESS_KEY` | — | Dashboard login key (auth disabled when empty) |
| `POLL_INTERVAL_SECONDS` | `2` | Data collection interval (seconds) |
| `QUOTA_REFRESH_SECONDS` | `300` | Account quota refresh interval (seconds) |
| `DB_PATH` | `./data/usage.sqlite` | SQLite database path |
| `AUTH_DIR` | `./auths` | Provider auth file directory for Codex/Gemini/Kimi/Claude quota queries |
| `SOCKS5_PROXY_HOST` | — | SOCKS5 proxy host for quota fetching |
| `SOCKS5_PROXY_PORT` | `0` | SOCKS5 proxy port (0 = disabled) |
| `SOCKS5_PROXY_USERNAME` | — | SOCKS5 proxy username (optional; must be set together with password) |
| `SOCKS5_PROXY_PASSWORD` | — | SOCKS5 proxy password (optional; must be set together with username) |

> **Prefer `CLIPROXY_URL`**: set `http://127.0.0.1:8317` — the system auto-parses protocol, host, and port. Legacy `CLIPROXY_HOST` + `CLIPROXY_PORT` are still supported.

## Authentication

When `ACCESS_KEY` is configured, the dashboard requires a login key before displaying any data. On successful authentication, an httpOnly cookie is stored in the browser for 30 days, so re-authentication is not needed on subsequent visits. Leave `ACCESS_KEY` empty to skip authentication entirely.

```bash
# .env
ACCESS_KEY=your-secret-key
```

## Data Storage

All usage data is stored locally in SQLite (WAL mode) — nothing is uploaded to any third-party service. The database contains two core tables:

- `usage_events` — Per-request usage events (token counts, model, account, masked API key, API key hash, latency, etc.).
- `quota_snapshots` — Provider account quota snapshots for Codex, Gemini, Kimi, Claude, and others (optional).

## Architecture

```text
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
| `GET /api/health` | Yes | Health check and collector status |
| `GET /api/summary?range=today` | Yes | Usage summary grouped by account/model/key/time |
| `GET /api/requests?limit=100&range=today` | Yes | Recent request details |
| `GET /api/quota` | Yes | Account quota snapshots |
| `POST /api/auth` | No | Login verification |
| `GET /api/auth` | No | Check authentication status |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Charts**: Recharts (Area Chart) + framer-motion (custom bar chart)
- **Database**: better-sqlite3 (WAL mode)
- **Styling**: Tailwind CSS + CSS custom properties theme system
- **Icons**: Lucide React
- **Auth**: httpOnly Cookie + Edge Middleware

## License

MIT
