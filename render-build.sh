#!/usr/bin/env bash
set -e

corepack enable
corepack prepare pnpm@latest --activate

pnpm install --frozen-lockfile

export BASE_PATH=/

pnpm --filter @workspace/chatnow run build
