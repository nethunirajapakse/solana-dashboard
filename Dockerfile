# syntax=docker/dockerfile:1
#
# Multi-stage build producing a small, non-root image from Next.js'
# "standalone" output.
#
#   docker build -t solana-dashboard .
#   docker run --rm -p 3000:3000 -e SOLANA_TRACKER_API_KEY=your_key solana-dashboard

FROM node:22-alpine AS base
WORKDIR /app

# --- install dependencies (cached until package*.json changes)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- build
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime: only the traced server bundle + static assets
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# This project has no /public folder today. If you add one, also:
#   COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000

# /api/health reports 503 when SOLANA_TRACKER_API_KEY is missing, so a
# misconfigured container is flagged unhealthy instead of serving errors.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
