#!/bin/sh
set -e

cd /app

echo "📦 Installing dependencies for @emekteb/web..."
npm install --workspace=@emekteb/web

echo "🚀 Starting dev server..."
exec npm run dev --workspace=@emekteb/web -- --host 0.0.0.0

