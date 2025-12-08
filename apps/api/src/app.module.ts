import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ImportModule } from './import/import.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, ImportModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

