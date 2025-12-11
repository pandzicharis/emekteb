import { Module } from '@nestjs/common';
import { RazredService } from './razred.service';
import { RazredController } from './razred.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RazredController],
  providers: [RazredService],
})
export class RazredModule {}


