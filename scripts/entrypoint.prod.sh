#!/bin/sh
set -e

# Build DATABASE_URL from individual vars if not already set
if [ -z "$DATABASE_URL" ]; then
  . /usr/src/app/scripts/build-database-url.sh
fi

echo "[terroir] Running Prisma migrations..."
npx prisma migrate deploy

echo "[terroir] Migrations done. Starting app..."
exec "$@"
