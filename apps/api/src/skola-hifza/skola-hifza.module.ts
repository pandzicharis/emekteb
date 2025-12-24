import { Module } from '@nestjs/common';
import { SkolaHifzaController } from './skola-hifza.controller';
import { SkolaHifzaService } from './skola-hifza.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SkolaHifzaController],
  providers: [SkolaHifzaService],
  exports: [SkolaHifzaService],
})
export class SkolaHifzaModule {}
