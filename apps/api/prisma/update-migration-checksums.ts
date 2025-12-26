import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function updateMigrationChecksums() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationsToUpdate = [
    '20251209120000_add_razred',
    '20251211120000_add_nastavni_plan',
    '20251211121500_add_np_razred_lekcije',
    '20251211122000_drop_lekcije_postavke',
  ];

  console.log('Updating migration checksums...\n');

  for (const migrationName of migrationsToUpdate) {
    const migrationPath = path.join(migrationsDir, migrationName, 'migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`⚠️  Migration file not found: ${migrationPath}`);
      continue;
    }

    // Read migration file content
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Calculate SHA-256 checksum (Prisma uses SHA-256)
    const checksum = crypto.createHash('sha256').update(migrationContent, 'utf8').digest('hex');

    try {
      // Update checksum in _prisma_migrations table
      // Prisma stores checksum as bytea (binary), so we need to convert hex to bytea
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "_prisma_migrations" 
         SET checksum = decode('${checksum}', 'hex')
         WHERE migration_name = '${migrationName}'`
      );

      console.log(`✓ Updated checksum for: ${migrationName}`);
    } catch (error) {
      console.error(`✗ Error updating ${migrationName}:`, error);
      throw error;
    }
  }

  console.log('\nDone! You can now run "npm run prisma:migrate" without issues.');
}

updateMigrationChecksums()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

