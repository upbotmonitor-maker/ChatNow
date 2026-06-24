#!/usr/bin/env bash
set -e

npm install -g pnpm

pnpm install

export BASE_PATH=/

pnpm --filter @workspace/chatnow run build
