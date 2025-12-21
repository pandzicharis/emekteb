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

echo "  📝 Seeding korisnici (admin i muallim)..."
if ! npm run prisma:seed; then
  echo "❌ Greška pri seed-u korisnika"
  exit 1
fi

echo "  📚 Seeding nastavni plan..."
if ! npm run prisma:seed-nastavni-plan; then
  echo "❌ Greška pri seed-u nastavnog plana"
  exit 1
fi

echo "  📅 Seeding nastavna godina..."
if ! npm run prisma:seed-nastavna-godina; then
  echo "❌ Greška pri seed-u nastavne godine"
  exit 1
fi

echo "  👨‍🎓 Seeding učenici iz CSV..."
if ! npm run prisma:seed-ucenici; then
  echo "⚠️  Upozorenje: Seed učenika nije uspješan (možda CSV fajl nije pronađen)"
  echo "   Ovo je opciono - učenici se mogu importovati i kasnije"
fi

echo "  👥 Seeding grupe..."
if ! npm run prisma:seed-grupe; then
  echo "❌ Greška pri seed-u grupa"
  exit 1
fi

echo "  📖 Seeding casovi..."
if ! npm run prisma:seed-casovi; then
  echo "⚠️  Upozorenje: Seed casova nije uspješan (možda nema učenika u grupama)"
  echo "   Ovo je normalno pri prvom pokretanju - casovi će se kreirati kada se učenici dodaju u grupe"
fi

echo "✅ Database initialization complete!"

