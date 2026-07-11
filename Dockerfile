# app/workerで共用するイメージ。devDependencies(tsx等)込みでビルドし、
# worker側はscripts/配下のTSバッチをtsx経由でそのまま実行する(別途コンパイル手順を持たない)。
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
# prisma generateはDB接続はしないが、prisma.config.tsのenv("DATABASE_URL")解決のため
# ビルド時点でダミー値が必要(実際の接続情報は実行時にランタイム環境変数として渡す)。
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 10001 -S appgroup && adduser -u 10001 -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app /app
USER appuser
EXPOSE 3000
CMD ["npm", "run", "start"]
