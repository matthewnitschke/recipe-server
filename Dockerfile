# syntax=docker/dockerfile:1

FROM ghcr.io/typst/typst:latest AS typst

FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3-alpine
COPY --from=typst /bin/typst /usr/local/bin/typst
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production \
    PORT=8080 \
    TYPST_BIN=/usr/local/bin/typst \
    DB_PATH=/data/recipes.db

EXPOSE 8080
VOLUME ["/data"]

CMD ["bun", "run", "src/index.ts"]
