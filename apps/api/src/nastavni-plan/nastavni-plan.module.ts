import { Module } from '@nestjs/common';
import { NastavniPlanService } from './nastavni-plan.service';
import { NastavniPlanController } from './nastavni-plan.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NastavniPlanController],
  providers: [NastavniPlanService],
})
export class NastavniPlanModule {}






