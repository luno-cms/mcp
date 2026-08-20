# For Glama / containerized MCP introspection (stdio).
# Set real LUNO_* at runtime; placeholders allow process start for introspection.
FROM node:22-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV LUNO_API_URL=https://api.luno.rest/admin
ENV LUNO_AGENT_KEY=sk-agent-glama-placeholder

ENTRYPOINT ["node", "dist/cli.js"]
