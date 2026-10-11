FROM node:24.5.0-bookworm-slim AS builder
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1 DOCKER_STANDALONE=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Existing frontend test types import this helper during Next's TypeScript check.
COPY tests/e2e/page-errors.ts /app/tests/e2e/page-errors.ts
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN mkdir -p public && npm run build

FROM node:24.5.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
