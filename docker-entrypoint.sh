#!/bin/sh
set -e

./node_modules/.bin/prisma db push
export NODE_OPTIONS='--import ./instrument.server.mjs'
exec pnpm run start
