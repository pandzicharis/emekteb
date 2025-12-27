import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlobodanDanDto, UpdateSlobodanDanDto } from './dto/create-slobodan-dan.dto';

@Injectable()
export class SlobodanDanService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(nastavnaGodinaId?: string) {
    const where = nastavnaGodinaId ? { nastavnaGodinaId } : {};
    
    return this.prisma.slobodanDan.findMany({
      where,
      include: {
        nastavnaGodina: {
          select: {
            id: true,
            naziv: true,
            datumOd: true,
            datumDo: true,
          },
        },
      },
      orderBy: {
        datum: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const slobodanDan = await this.prisma.slobodanDan.findUnique({
      where: { id },
      include: {
        nastavnaGodina: {
          select: {
            id: true,
            naziv: true,
            datumOd: true,
            datumDo: true,
          },
        },
      },
    });

    if (!slobodanDan) {
      throw new NotFoundException('Slobodan dan nije pronađen');
    }

    return slobodanDan;
  }

  async create(dto: CreateSlobodanDanDto) {
    // Provjeri da li nastavna godina postoji
    const nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
      where: { id: dto.nastavnaGodinaId },
    });

    if (!nastavnaGodina) {
      throw new NotFoundException('Nastavna godina nije pronađena');
    }

    // Parse datum i postavi na početak dana (bez vremena)
    const datum = new Date(dto.datum);
    if (isNaN(datum.getTime())) {
      throw new BadRequestException('Neispravan format datuma');
    }
    datum.setHours(0, 0, 0, 0);

    // Provjeri da li datum već postoji za tu nastavnu godinu
    const existing = await this.prisma.slobodanDan.findFirst({
      where: {
        nastavnaGodinaId: dto.nastavnaGodinaId,
        datum: datum,
      },
    });

    if (existing) {
      throw new BadRequestException('Ovaj datum je već označen kao slobodan dan za ovu nastavnu godinu');
    }

    return this.prisma.slobodanDan.create({
      data: {
        nastavnaGodinaId: dto.nastavnaGodinaId,
        datum: datum,
        razlog: dto.razlog.trim(),
      },
      include: {
        nastavnaGodina: {
          select: {
            id: true,
            naziv: true,
            datumOd: true,
            datumDo: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateSlobodanDanDto) {
    const existing = await this.findOne(id);

    const updateData: any = {};

    if (dto.datum !== undefined) {
      const datum = new Date(dto.datum);
      if (isNaN(datum.getTime())) {
        throw new BadRequestException('Neispravan format datuma');
      }
      datum.setHours(0, 0, 0, 0);

      // Provjeri da li novi datum već postoji za tu nastavnu godinu (osim trenutnog)
      const duplicate = await this.prisma.slobodanDan.findFirst({
        where: {
          nastavnaGodinaId: existing.nastavnaGodinaId,
          datum: datum,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new BadRequestException('Ovaj datum je već označen kao slobodan dan za ovu nastavnu godinu');
      }

      updateData.datum = datum;
    }

    if (dto.razlog !== undefined) {
      if (dto.razlog.trim().length < 3) {
        throw new BadRequestException('Razlog mora imati najmanje 3 karaktera');
      }
      updateData.razlog = dto.razlog.trim();
    }

    return this.prisma.slobodanDan.update({
      where: { id },
      data: updateData,
      include: {
        nastavnaGodina: {
          select: {
            id: true,
            naziv: true,
            datumOd: true,
            datumDo: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id); // Provjeri da postoji

    return this.prisma.slobodanDan.delete({
      where: { id },
    });
  }

  /**
   * Helper metoda za provjeru da li je datum slobodan dan
   */
  async isSlobodanDan(nastavnaGodinaId: string, datum: Date): Promise<{ isSlobodan: boolean; razlog?: string }> {
    const datumOnly = new Date(datum);
    datumOnly.setHours(0, 0, 0, 0);

    const slobodanDan = await this.prisma.slobodanDan.findFirst({
      where: {
        nastavnaGodinaId,
        datum: datumOnly,
      },
    });

    if (slobodanDan) {
      return {
        isSlobodan: true,
        razlog: slobodanDan.razlog,
      };
    }

    return {
      isSlobodan: false,
    };
  }
}

