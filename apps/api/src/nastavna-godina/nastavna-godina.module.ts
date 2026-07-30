import { Module } from '@nestjs/common';
import { NastavnaGodinaController } from './nastavna-godina.controller';
import { NastavnaGodinaService } from './nastavna-godina.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NastavnaGodinaController],
  providers: [NastavnaGodinaService],
  exports: [NastavnaGodinaService],
})
export class NastavnaGodinaModule {}














