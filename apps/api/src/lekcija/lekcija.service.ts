import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipLekcije } from '@prisma/client';

@Injectable()
export class LekcijaService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tip?: TipLekcije, razredId?: string) {
    return this.prisma.lekcija.findMany({
      where: {
        ...(tip ? { tip } : {}),
        ...(razredId
          ? {
              razredi: {
                some: {
                  razredId,
                },
              },
            }
          : {}),
      },
      orderBy: { redoslijed: 'asc' },
    });
  }

  create(data: { naslov: string; opis: string; tezina: number; redoslijed: number; aktivan: boolean; tip: TipLekcije }) {
    return this.prisma.lekcija.create({
      data,
    });
  }

  update(id: string, data: Partial<{ naslov: string; opis: string; tezina: number; redoslijed: number; aktivan: boolean; tip: TipLekcije }>) {
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
