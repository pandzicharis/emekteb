import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipNotifikacije } from '@prisma/client';

@Injectable()
export class NotifikacijeService {
  private readonly logger = new Logger(NotifikacijeService.name);

  constructor(private prisma: PrismaService) {}

  async kreirajNotifikaciju(
    korisnikId: string,
    tip: TipNotifikacije,
    naslov: string,
    poruka: string,
    link?: string,
  ) {
    const notifikacija = await this.prisma.notifikacija.create({
      data: {
        korisnikId,
        tip,
        naslov,
        poruka,
        link,
      },
    });

    return notifikacija;
  }

  async getNotifikacije(korisnikId: string) {
    const notifikacije = await this.prisma.notifikacija.findMany({
      where: {
        korisnikId,
      },
      orderBy: {
        kreiran: 'desc',
      },
      take: 50, // Najnovijih 50
    });

    return notifikacije;
  }

  async getNeprocitaneNotifikacije(korisnikId: string) {
    const notifikacije = await this.prisma.notifikacija.findMany({
      where: {
        korisnikId,
        procitana: false,
      },
      orderBy: {
        kreiran: 'desc',
      },
    });

    return notifikacije;
  }

  async oznaciKaoProcitano(notifikacijaId: string, korisnikId: string) {
    const notifikacija = await this.prisma.notifikacija.findUnique({
      where: { id: notifikacijaId },
    });

    if (!notifikacija) {
      throw new NotFoundException('Notifikacija nije pronađena');
    }

    if (notifikacija.korisnikId !== korisnikId) {
      throw new NotFoundException('Notifikacija nije pronađena');
    }

    const azurirana = await this.prisma.notifikacija.update({
      where: { id: notifikacijaId },
      data: { procitana: true },
    });

    return azurirana;
  }

  async oznaciSveKaoProcitano(korisnikId: string) {
    await this.prisma.notifikacija.updateMany({
      where: {
        korisnikId,
        procitana: false,
      },
      data: {
        procitana: true,
      },
    });

    return { message: 'Sve notifikacije su označene kao pročitane' };
  }

  async obrisiNotifikaciju(notifikacijaId: string, korisnikId: string) {
    const notifikacija = await this.prisma.notifikacija.findUnique({
      where: { id: notifikacijaId },
    });

    if (!notifikacija || notifikacija.korisnikId !== korisnikId) {
      throw new NotFoundException('Notifikacija nije pronađena');
    }

    await this.prisma.notifikacija.delete({
      where: { id: notifikacijaId },
    });

    return { message: 'Notifikacija je uspješno obrisana' };
  }

  async getBrojNeprocitanih(korisnikId: string) {
    const count = await this.prisma.notifikacija.count({
      where: {
        korisnikId,
        procitana: false,
      },
    });

    return { count };
  }
}


