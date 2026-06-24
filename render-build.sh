#!/usr/bin/env bash
  set -e

  export BASE_PATH=/
  export NODE_ENV=production

  pnpm --filter @workspace/chatnow run build
  