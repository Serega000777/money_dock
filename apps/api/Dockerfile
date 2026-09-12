# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @money-dock/api... build
RUN pnpm --filter @money-dock/api deploy /out --prod

FROM base AS runtime
ENV NODE_ENV=production
# The image applies its own migrations on boot (see CMD) — this is where they live here.
ENV MIGRATIONS_DIR=/app/infrastructure/migrations
WORKDIR /app
COPY --from=build /out/dist ./dist
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/infrastructure/migrations ./infrastructure/migrations
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrate, seed the system categories (both idempotent), then serve. Doing it in the
# container instead of a separate step means a fresh VPS needs exactly one command.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/main.js"]
