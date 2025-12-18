import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CasService } from './cas.service';
import { CasController } from './cas.controller';

@Module({
  imports: [PrismaModule],
  providers: [CasService],
  controllers: [CasController],
})
export class CasModule {}





