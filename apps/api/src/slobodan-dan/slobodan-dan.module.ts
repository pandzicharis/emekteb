import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SlobodanDanService } from './slobodan-dan.service';
import { SlobodanDanController } from './slobodan-dan.controller';

@Module({
  imports: [PrismaModule],
  providers: [SlobodanDanService],
  controllers: [SlobodanDanController],
  exports: [SlobodanDanService],
})
export class SlobodanDanModule {}

