import { Module } from '@nestjs/common';
import { UcenikService } from './ucenik.service';
import { UcenikController } from './ucenik.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UcenikService],
  controllers: [UcenikController],
})
export class UcenikModule {}
