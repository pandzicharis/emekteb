import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Set default DATABASE_URL if not provided
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5439/emekteb?schema=public';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env['FRONTEND_URL'] || 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  
  console.log(`🚀 API server is running on: http://localhost:${port}`);
}

bootstrap();
