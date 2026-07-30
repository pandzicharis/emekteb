import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Lokalni razvoj: pročitaj apps/api/.env (komande se pokreću iz apps/api).
// Na hostingu varijable dolaze iz okruženja i ovo ništa ne mijenja.
dotenv.config({ path: join(process.cwd(), '.env') });

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  if (!process.env['DATABASE_URL']) {
    throw new Error(
      'DATABASE_URL nije postavljen. Postavi ga u .env (lokalno) ili u env varijablama hostinga.',
    );
  }

  if (process.env['NODE_ENV'] === 'production' && !process.env['JWT_SECRET']) {
    throw new Error('JWT_SECRET je obavezan u produkciji.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env['NODE_ENV'] === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // CORS - lista dozvoljenih originâ iz FRONTEND_URL (odvojeni zapetom).
  // Podržan je i wildcard po domenu, npr. "*.vercel.app" za Vercel preview deploymente.
  const allowedOrigins = (process.env['FRONTEND_URL'] || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const isOriginAllowed = (origin: string): boolean =>
    allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      if (allowed.startsWith('*.')) {
        const suffix = allowed.slice(1); // "*.vercel.app" -> ".vercel.app"
        try {
          return new URL(origin).hostname.endsWith(suffix);
        } catch {
          return false;
        }
      }
      return allowed === origin;
    });

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Bez origin headera (curl, health check, server-to-server) - dozvoli.
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      // Ne bacamo Error (to bi dalo 500 koji sakrije pravi razlog) - origin samo
      // ne dobije CORS header, pa ga browser blokira sa jasnom CORS porukom.
      logger.warn(
        `⛔ CORS: origin "${origin}" nije u FRONTEND_URL listi (${allowedOrigins.join(', ')})`,
      );
      callback(null, false);
    },
    credentials: true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  const port = Number(process.env['PORT']) || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 API sluša na portu ${port}`);
  logger.log(`🌐 Dozvoljeni CORS origini: ${allowedOrigins.join(', ')}`);
}

bootstrap();
