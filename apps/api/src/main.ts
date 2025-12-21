import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { ImportService } from './import/import.service';

// Set default DATABASE_URL if not provided
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5439/emekteb?schema=public';
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env['FRONTEND_URL'] || 'http://localhost:5173',
    credentials: true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // Auto-import CSV file if it exists
  try {
    const csvPath = join(process.cwd(), 'setup', 'baza_ucenika 20251206-232836.csv');
    if (fs.existsSync(csvPath)) {
      logger.log('📥 Pronađen CSV fajl, pokrećem automatski import...');
      const importService = app.get(ImportService);
      
      const fileBuffer = fs.readFileSync(csvPath);
      const file = {
        buffer: fileBuffer,
        originalname: 'baza_ucenika 20251206-232836.csv',
        mimetype: 'text/csv',
      };
      
      const result = await importService.importCsv(file);
      logger.log(`✅ CSV import završen: ${result.novih} novih, ${result.updateanih} ažuriranih, ${result.gresaka} grešaka`);
    } else {
      logger.log(`ℹ️  CSV fajl nije pronađen na: ${csvPath}`);
    }
  } catch (error) {
    logger.warn(`⚠️  Greška pri automatskom importu CSV: ${error instanceof Error ? error.message : String(error)}`);
    // Ne zaustavljaj aplikaciju ako import ne uspije
  }

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  
  logger.log(`🚀 API server is running on: http://localhost:${port}`);
}

bootstrap();
