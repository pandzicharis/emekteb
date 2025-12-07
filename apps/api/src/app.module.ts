import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [PrismaModule, ImportModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

