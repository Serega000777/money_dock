# syntax=docker/dockerfile:1
# Builds the static web export of the Mini App and serves it with Caddy, which also
# terminates HTTPS (Let's Encrypt, automatic) and proxies /api/* to the API container.
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Baked into the bundle at build time — must be the public URL the Mini App will call.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
ENV NODE_ENV=production
# Build the workspace packages the app imports from their dist/ (api-client, validation,
# ...), then export. `expo export` is called directly: the package's `build` script wraps
# it in `dotenv -e ../../.env`, and there is no .env inside the image.
RUN pnpm --filter "@money-dock/app^..." build
# --clear: Metro's transform cache does not key on env values, so a stale cache can bake
# in a previous EXPO_PUBLIC_API_URL (seen locally: a bundle still calling localhost).
RUN cd apps/app && npx expo export --platform web --clear

FROM caddy:2-alpine AS runtime
COPY infrastructure/docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/app/dist /srv
EXPOSE 80 443
