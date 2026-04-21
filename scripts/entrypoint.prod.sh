#!/bin/sh
set -e

. /usr/src/app/scripts/build-database-url.sh

echo "[terroir] Running Prisma migrations..."
npx prisma migrate deploy

exec "$@"
