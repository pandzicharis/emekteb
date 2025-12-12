import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

// Set default DATABASE_URL if not provided
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5439/emekteb?schema=public';
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env['FRONTEND_URL'] || 'http://localhost:5173',
    credentials: true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  
  console.log(`🚀 API server is running on: http://localhost:${port}`);
}

bootstrap();
