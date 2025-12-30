import { Module } from '@nestjs/common';
import { NotifikacijeController } from './notifikacije.controller';
import { NotifikacijeService } from './notifikacije.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotifikacijeController],
  providers: [NotifikacijeService],
  exports: [NotifikacijeService],
})
export class NotifikacijeModule {}

