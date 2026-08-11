# CLIProxyAPI Dashboard

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](#license)

[简体中文](README.md) | [English](README_EN.md)

**CLIProxyAPI Dashboard** is a local-first usage and account-quota dashboard for CLIProxyAPI. It polls the CLIProxyAPI Management API, persists usage locally in SQLite, and brings together account, API-key, model, and provider-quota status.

**Important:** This project has only been tested with Antigravity and free Codex accounts; other providers have not been tested due to a lack of available accounts.

> Business data stays in local SQLite. Account-quota refreshes call the relevant provider APIs when configured; protect authentication files and environment variables accordingly.

## Screenshots

![Dashboard screenshot 1](./images/img1.png)

![Dashboard screenshot 2](./images/img2.png)

## Features

- **Usage overview** — Request, success/failure, input/output/reasoning/cache token KPIs and range-based trends.
- **Consumption analysis** — Token and failure aggregates by model, account, and masked API key, plus recent-request latency and status.
- **Account quotas** — Reads JSON auth files from `AUTH_DIR` and shows availability, balances, plans, and reset times for Codex, Antigravity, Kimi, and Claude; the accounts page supports provider filtering and tracks total and auth-failed account counts.
- **Quota management** — Codex accounts are marked disabled after reaching their primary-quota threshold and are periodically retried after reset; failed auth files can be removed in the UI.
- **Two-tab layout** — The Home tab focuses on usage trends and consumption analysis; the Accounts tab manages auth files and quota status.
- **Local-first storage** — Usage events and quota snapshots live in SQLite with WAL mode and can be mounted directly from the host.
- **Access protection** — Setting `ACCESS_KEY` protects the dashboard and API with an httpOnly-cookie login flow.
- **Operational visibility** — Automatic collection, manual refresh, light/dark themes, and collector status in the footer.

## Quick Start

### Prerequisites

- Node.js 18+ (the Docker image uses Node.js 20)
- A running CLIProxyAPI instance whose Management API is reachable from the dashboard
- CLIProxyAPI usage statistics enabled

At minimum, enable the following in CLIProxyAPI:

```yaml
usage-statistics-enabled: true
redis-usage-queue-retention-seconds: 3600
```

### Local Development

```bash
# 1. Enter the project directory
cd cliproxyapi-dashboard

# 2. Install the locked dependency set
npm ci

# 3. Configure the runtime environment
cp .env.example .env
# Edit .env and set MANAGEMENT_KEY at minimum

# 4. Start the development server
npm run dev
```

Open `http://localhost:3000`.

### Docker Compose Deployment

```bash
cp .env.example .env
# Edit .env and set MANAGEMENT_KEY plus a reachable CLIPROXY_URL

docker compose up -d --build
docker compose logs -f
```

The default service mounts SQLite at `./data` and mounts host `./auths` read-only at `/app/auths` in the container.

> **Docker networking:** in bridge mode, `CLIPROXY_URL=http://127.0.0.1:8317` points to the Dashboard container itself, not CLIProxyAPI on the host. Use a LAN address, hostname, or a service name reachable from the Dashboard container instead.

### Prebuilt Image

```bash
cp .env.example .env
# Edit .env

docker run -d \
  --name cliproxyapi-dashboard \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/auths:/app/auths:ro" \
  xiyangai/cliproxyapi-dashboard:latest
```

## Configuration

`CLIPROXY_URL` has the highest priority. When it is unset, the app builds the address from `CLIPROXY_HOST`, `CLIPROXY_PORT`, and `CLIPROXY_HTTPS`.

| Variable | App default | Description |
| --- | --- | --- |
| `CLIPROXY_URL` | — | CLIProxyAPI address, for example `http://192.168.1.10:8317`. Paths and query strings are ignored. |
| `CLIPROXY_HOST` | `127.0.0.1` | Legacy configuration; used only when `CLIPROXY_URL` is unset. |
| `CLIPROXY_PORT` | `8317` | Legacy configuration; used only when `CLIPROXY_URL` is unset. |
| `CLIPROXY_HTTPS` | `false` | Uses HTTPS when set to `true` in legacy configuration mode. |
| `MANAGEMENT_KEY` | — | **Required.** CLIProxyAPI Management API key. |
| `DB_PATH` | `./data/usage.sqlite` | SQLite database path. Docker mounts `./data` at `/app/data` by default. |
| `AUTH_DIR` | unset | Directory containing provider-auth JSON files. Leave it unset to disable account-quota collection. |
| `POLL_INTERVAL_SECONDS` | `2` | CLIProxyAPI usage-queue polling interval in seconds. |
| `QUOTA_REFRESH_SECONDS` | `300` | Account-quota refresh interval in seconds. Invalid values or values below 60 fall back to 300 seconds. |
| `SOCKS5_PROXY_HOST` | — | SOCKS5 proxy host for account-quota requests. |
| `SOCKS5_PROXY_PORT` | `0` | SOCKS5 proxy port; `0` disables the proxy. |
| `SOCKS5_PROXY_USERNAME` | — | SOCKS5 username; must be set together with the password. |
| `SOCKS5_PROXY_PASSWORD` | — | SOCKS5 password; must be set together with the username. |
| `ACCESS_KEY` | — | Dashboard login key; an empty value disables authentication. The current `docker-compose.yml` defaults it to `admin123` when omitted—replace it with a long random value for production. |

## Account Quotas and Auth Files

When `AUTH_DIR` is set, the app reads `*.json` files from the directory's **first level** at startup and refreshes them on `QUOTA_REFRESH_SECONDS`. An auth file needs at least an email, access token, or API key. Providers are identified by `type` or the file-name prefix.

```text
auths/
├── codex-work.json
├── antigravity-main.json
├── kimi.json
└── claude.json
```

Minimal examples:

```json
// Codex: access_token is required; account_id and user_agent are optional
{
  "type": "codex",
  "email": "user@example.com",
  "access_token": "<redacted>",
  "account_id": "<optional>"
}
```

```json
// Antigravity: use OAuth data generated by its client
{
  "type": "antigravity",
  "email": "user@example.com",
  "access_token": "<redacted>",
  "refresh_token": "<redacted>",
  "project_id": "<optional>"
}
```

```json
// Kimi / Claude: api_key is required
{
  "type": "kimi",
  "email": "user@example.com",
  "api_key": "<redacted>"
}
```

```json
{
  "type": "claude",
  "email": "user@example.com",
  "api_key": "<redacted>"
}
```

- Codex reports account quota windows; Kimi reads balance; Claude checks API-key availability; Antigravity shows returned quota groups and reset times.
- Authentication failures, permission failures, and rate limits are shown in the account view. Removing a failed account calls the CLIProxyAPI Management API to delete its auth file and hides the entry for the current process.
- `disabled: true` skips an account manually. Codex accounts may also be automatically marked disabled after reaching their primary-quota threshold and are checked for recovery every 10 minutes.

> **Security:** `auths/*.json` can contain access tokens, refresh tokens, or API keys. Do not commit, share, log, or copy them into Docker images. Restrict permissions on this directory in production.

## Data and API

SQLite uses WAL mode and stores two core datasets:

- `usage_events` — Request events, tokens, models, accounts, masked API keys, latency, and status.
- `quota_snapshots` — Provider quota snapshots, plans, reset times, and raw responses.

When `ACCESS_KEY` is set, every page and API route except `/login` and `/api/auth` requires login. Main endpoints:

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Health check and collector state. |
| `GET /api/summary?range=today` | Usage summary grouped by account, model, key, and time. |
| `GET /api/requests?limit=100&range=today` | Recent request details. |
| `GET /api/quota` | Account quota snapshots, failed accounts, and limited accounts. |
| `DELETE /api/quota/auth-file` | Deletes an auth file for a failed account. |
| `POST /api/auth` | Submits the Dashboard login key. |
| `GET /api/auth` | Returns login status. |

## Tech Stack

- Next.js 14 (App Router) + React 18
- SQLite / `better-sqlite3`
- Tailwind CSS, Recharts, Framer Motion, and Lucide React
- Docker multi-stage build

## License

MIT
