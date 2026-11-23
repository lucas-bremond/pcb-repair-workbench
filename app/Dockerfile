# The scenario viewer: the built app and the server that lists, serves and saves scenarios, with
# the Python scripts it runs to validate them and regenerate their outputs. Build from the
# repository root (`make build`). Scenario folders are mounted at run time (`make start`).

# 1. The app: React + shadcn/ui, bundled by Vite into web/dist.
FROM node:22-bookworm-slim AS web
WORKDIR /src/app/web
COPY app/web/package.json app/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/web/ ./
RUN npm run build

# 2. Python for the scripts, with Node.js for the server.
FROM python:3.13-slim AS base
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/
COPY app/scripts/requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ENV PYTHONDONTWRITEBYTECODE=1

# Live reload (`make dev`, not part of the served image): the repository is mounted at /src.
# The server runs on 8787 (restarted when its code changes); the Vite dev server on 5173 hot
# reloads the app and forwards /api and /files to it.
FROM base AS dev
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
# the dependencies live in the image; make dev mounts an anonymous volume over the host's node_modules
WORKDIR /src/app/web
COPY app/web/package.json app/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
ENV HOST=127.0.0.1 PORT=8787 STATIC_DIR= PYTHON=python3
EXPOSE 5173
CMD ["sh", "-c", "node --watch-path=../server ../server/server.mjs & exec node_modules/.bin/vite --host 0.0.0.0 --port 5173 --strictPort"]

# 3. Serve (the default stage).
FROM base
WORKDIR /app
COPY app/scripts/ scripts/
COPY app/schema/ schema/
COPY app/server/ server/
COPY --from=web /src/app/web/dist/ web/dist/
ENV HOST=0.0.0.0 PORT=8080 PYTHON=python3 SCENARIO_ROOTS=scenarios=/data/scenarios
EXPOSE 8080
CMD ["node", "server/server.mjs"]
