#!/bin/sh
set -e

echo "🔄 Waiting for database to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

# Wait a bit for postgres to fully start
sleep 3

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Try to connect using pg_isready first (faster check)
  if pg_isready -h postgres -p 5432 -U postgres > /dev/null 2>&1; then
    # Then try actual connection with psql
    if PGPASSWORD=postgres psql -h postgres -p 5432 -U postgres -d emekteb -c "SELECT 1" > /dev/null 2>&1; then
      echo "✅ Database is ready!"
      break
    fi
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $((RETRY_COUNT % 5)) -eq 0 ]; then
    echo "⏳ Database is unavailable - sleeping (attempt $RETRY_COUNT/$MAX_RETRIES)"
  fi
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

echo "  📝 Seeding korisnici, razredi i lekcije (KURAN i SUFARA)..."
if ! npm run prisma:seed; then
  echo "❌ Greška pri seed-u"
  exit 1
fi

echo "✅ Database initialization complete!"

