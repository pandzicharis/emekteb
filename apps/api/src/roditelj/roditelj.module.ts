import { Module } from '@nestjs/common';
import { RoditeljService } from './roditelj.service';
import { RoditeljController } from './roditelj.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RoditeljService],
  controllers: [RoditeljController],
})
export class RoditeljModule {}





