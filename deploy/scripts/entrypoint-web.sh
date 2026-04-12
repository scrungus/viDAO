#!/bin/sh
set -e

cd /app/apps/web
npx prisma migrate deploy

cd /app
exec node apps/web/server.js
