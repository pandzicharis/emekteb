import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipLekcije } from '@prisma/client';

@Injectable()
export class LekcijaService {
  private readonly logger = new Logger(LekcijaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tip?: TipLekcije, razredId?: string) {
    // Ako je razredId prosleđen, filtriraj samo lekcije koje su dodjeljene tom razredu
    if (razredId) {
      this.logger.log(`🔍 Filtriranje lekcija za razredId: ${razredId}, tip: ${tip || 'svi'}`);
      
      // Prvo pronađi sve lekcije koje su dodjeljene ovom razredu preko join tabele
      const razredLekcije = await this.prisma.razredLekcija.findMany({
        where: {
          razredId: String(razredId), // Osiguraj da je string
        },
        select: {
          lekcijaId: true,
        },
      });

      this.logger.log(`📊 Pronađeno ${razredLekcije.length} veza u razred_lekcije tabeli za razred ${razredId}`);

      const lekcijaIds = razredLekcije.map((rl) => rl.lekcijaId);

      // Ako nema lekcija dodjeljenih razredu, vrati prazan array
      if (lekcijaIds.length === 0) {
        this.logger.warn(`⚠️  Nema lekcija dodjeljenih razredu ${razredId} u razred_lekcije tabeli. Vraćam prazan array.`);
        this.logger.warn(`💡 Provjerite da li su lekcije dodjeljene ovom razredu u nastavnom planu.`);
        return [];
      }

      // Vrati lekcije koje su u listi ID-ova i zadovoljavaju filter po tipu
      // VAŽNO: Filtrirati samo lekcije koje su eksplicitno dodjeljene razredu
      const lekcije = await this.prisma.lekcija.findMany({
        where: {
          id: {
            in: lekcijaIds,
          },
          ...(tip ? { tip } : {}),
        },
        orderBy: { redoslijed: 'asc' },
      });

      this.logger.log(`✅ Vraćam ${lekcije.length} lekcija za razred ${razredId}${tip ? ` (tip: ${tip})` : ''}`);
      
      // Dodatna provjera - loguj tipove lekcija koje vraćamo
      const tipoviLekcija = lekcije.reduce((acc, l) => {
        acc[l.tip] = (acc[l.tip] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      this.logger.log(`📚 Tipovi lekcija: ${JSON.stringify(tipoviLekcija)}`);
      
      return lekcije;
    }
    
    // Ako nije prosleđen razredId, vrati sve lekcije (filtrirane po tipu ako je prosleđen)
    return this.prisma.lekcija.findMany({
      where: {
        ...(tip ? { tip } : {}),
      },
      orderBy: { redoslijed: 'asc' },
    });
  }

  create(data: { naslov: string; opis: string; tezina: number; redoslijed: number; aktivan: boolean; tip: TipLekcije; brojAjeta?: number }) {
    return this.prisma.lekcija.create({
      data,
    });
  }

  update(id: string, data: Partial<{ naslov: string; opis: string; tezina: number; redoslijed: number; aktivan: boolean; tip: TipLekcije; brojAjeta?: number }>) {
    return this.prisma.lekcija.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.lekcija.delete({
      where: { id },
    });
  }
}
