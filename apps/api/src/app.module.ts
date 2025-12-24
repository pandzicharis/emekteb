import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ImportModule } from './import/import.module';
import { RazredModule } from './razred/razred.module';
import { LekcijaModule } from './lekcija/lekcija.module';
import { NastavniPlanModule } from './nastavni-plan/nastavni-plan.module';
import { MuallimModule } from './muallim/muallim.module';
import { NastavnaGodinaModule } from './nastavna-godina/nastavna-godina.module';
import { CasModule } from './cas/cas.module';
import { UcenikModule } from './ucenik/ucenik.module';
import { SkolaHifzaModule } from './skola-hifza/skola-hifza.module';

@Module({
  imports: [PrismaModule, ImportModule, AuthModule, RazredModule, LekcijaModule, NastavniPlanModule, MuallimModule, NastavnaGodinaModule, CasModule, UcenikModule, SkolaHifzaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

