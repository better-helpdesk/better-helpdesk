# The marketing site in site/, for Divio Cloud, which builds from a Dockerfile
# at the repository root. The package itself ships no image: it runs inside
# its host's app, and this site is one such host.
FROM node:24-alpine AS build
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
RUN npm install --global pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY site/package.json site/
RUN pnpm install --frozen-lockfile --filter better-helpdesk-site
COPY site/ site/
RUN pnpm --filter better-helpdesk-site build \
 && pnpm --filter better-helpdesk-site deploy --prod --legacy /out \
 && rm -rf /out/.next/cache
# Turbopack links server externals such as pg from .next/node_modules into the
# workspace's pnpm store. pnpm deploy copies neither, so point each link at the
# deployed copy of its package instead.
RUN find site/.next/node_modules -type l | while read -r link; do \
      target="$(readlink "$link")"; \
      dest="/out/${link#site/}"; \
      mkdir -p "$(dirname "$dest")"; \
      ln -s "/app/node_modules/${target##*/node_modules/}" "$dest"; \
    done

FROM node:24-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /out ./
# Divio routes traffic to port 80.
EXPOSE 80
CMD ["node_modules/.bin/next", "start", "--port", "80", "--hostname", "0.0.0.0"]
