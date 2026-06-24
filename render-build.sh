#!/usr/bin/env bash
  set -e

  export BASE_PATH=/

  pnpm --filter @workspace/chatnow run build
  