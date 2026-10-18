FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY workers ./workers
ENV NODE_ENV=production
CMD ["node", "--use-env-proxy", "workers/runner.mjs"]
