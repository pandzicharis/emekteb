import { Module } from '@nestjs/common';
import { MuallimService } from './muallim.service';
import { MuallimController } from './muallim.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MuallimService],
  controllers: [MuallimController],
})
export class MuallimModule {}










