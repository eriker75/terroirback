#!/bin/bash
set -e

echo "[terroir] Syncing database schema..."
npx prisma db push --accept-data-loss

echo "[terroir] Starting NestJS development server..."
exec npm run start:dev
