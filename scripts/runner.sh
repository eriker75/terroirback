#!/bin/bash
set -e

echo "[terroir] Running Prisma migrations..."
npx prisma migrate deploy

echo "[terroir] Starting NestJS development server..."
exec npm run start:dev
