import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CasService } from './cas.service';
import { CasController } from './cas.controller';
import { SlobodanDanModule } from '../slobodan-dan/slobodan-dan.module';

@Module({
  imports: [PrismaModule, SlobodanDanModule],
  providers: [CasService],
  controllers: [CasController],
})
export class CasModule {}







