FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@10.24.0 --activate

FROM base AS development-dependencies-env
COPY package.json pnpm-lock.yaml /app/
RUN pnpm install

FROM base AS production-dependencies-env
COPY package.json pnpm-lock.yaml /app/
RUN pnpm install --prod

FROM base AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
RUN ./node_modules/.bin/prisma generate
RUN pnpm run build

FROM base
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/instrument.server.mjs /app/instrument.server.mjs
COPY --from=build-env /app/app/prisma /app/app/prisma
COPY prisma /app/prisma
COPY prisma.config.ts docker-entrypoint.sh /app/
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh
CMD ["/app/docker-entrypoint.sh"]
