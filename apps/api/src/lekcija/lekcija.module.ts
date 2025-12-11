import { Module } from '@nestjs/common';
import { LekcijaService } from './lekcija.service';
import { LekcijaController } from './lekcija.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LekcijaController],
  providers: [LekcijaService],
})
export class LekcijaModule {}
