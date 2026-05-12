# Stage 1: Install dependencies (needs build tools for better-sqlite3 native compilation)
FROM node:20-alpine AS deps

# Use Alibaba Cloud APK mirror (fast in China)
#RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
#    && apk add --no-cache python3 make g++

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./

# Use npmmirror (China mirror) for faster installs
#RUN npm config set registry https://registry.npmmirror.com \
#    && npm ci --cache /tmp/npm-cache

RUN npm ci --cache /tmp/npm-cache

# Stage 2: Build Next.js (build tools no longer needed — native modules already compiled)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runtime (run as root — no permission issues with volumes)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV PORT=3000
ENV DB_PATH=/app/data/usage.sqlite

# wget is included in Alpine base image (busybox)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
