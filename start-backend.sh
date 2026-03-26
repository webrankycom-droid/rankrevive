#!/bin/bash
cd "$(dirname "$0")/backend"
if [ ! -d "node_modules" ]; then
  npm install --no-audit --no-fund
fi
exec npm run dev
