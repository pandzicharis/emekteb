#!/bin/bash

# Script to resolve modified migrations
# This resolves checksum mismatches by marking migrations as rolled-back and then re-applied

echo "Resolving checksum mismatches for modified migrations..."

# First mark as rolled-back, then as applied to update checksums
MIGRATIONS=(
  "20251209120000_add_razred"
  "20251211120000_add_nastavni_plan"
  "20251211121500_add_np_razred_lekcije"
  "20251211122000_drop_lekcije_postavke"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "Processing migration: $migration"
  # Mark as rolled-back first (this removes the checksum mismatch issue)
  npx prisma migrate resolve --rolled-back "$migration" 2>/dev/null || true
  # Then mark as applied again with the new checksum
  npx prisma migrate resolve --applied "$migration"
done

echo "Done! All migrations have been resolved."
echo "You can now run 'npm run prisma:migrate' to continue."

