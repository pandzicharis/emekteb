import { Module } from '@nestjs/common';
import { PorukeController } from './poruke.controller';
import { PorukeService } from './poruke.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PorukeController],
  providers: [PorukeService],
  exports: [PorukeService],
})
export class PorukeModule {}


