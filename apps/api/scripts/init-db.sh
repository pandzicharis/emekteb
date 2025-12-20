#!/bin/sh
set -e

echo "🔄 Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Try to connect using psql (postgresql-client is installed in Dockerfile)
  if PGPASSWORD=postgres psql -h postgres -U postgres -d emekteb -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "⏳ Database is unavailable - sleeping (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Database failed to become ready after $MAX_RETRIES attempts"
  exit 1
fi

echo "📦 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Running database migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database..."
npm run prisma:seed

echo "✅ Database initialization complete!"

