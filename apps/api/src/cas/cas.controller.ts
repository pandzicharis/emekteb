import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, BadRequestException, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasService, CreateCasPayload } from './cas.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('cas')
@UseGuards(JwtAuthGuard)
export class CasController {
  constructor(
    private readonly casService: CasService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() body: CreateCasPayload) {
    return this.casService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: CreateCasPayload) {
    return this.casService.update(id, body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.casService.findOne(id);
  }

  @Get('slot/:slotId')
  async findBySlot(@Param('slotId') slotId: string, @Query('datum') datum?: string) {
    return this.casService.findBySlot(slotId, datum);
  }

  @Get('counts/by-date')
  async getCasoviCountsByDate(
    @Request() req: any,
    @Query('nastavnaGodinaId') nastavnaGodinaId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Korisnik nije autentifikovan');
    }

    if (!nastavnaGodinaId || !startDate || !endDate) {
      throw new BadRequestException('Svi parametri su obavezni');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Neispravan format datuma');
    }

    // Pronađi muallim korisnika i njegov Ucenik zapis (kao u muallim.service.ts)
    const korisnik = await this.prisma.korisnik.findUnique({
      where: { id: req.user.id },
      include: { ucenik: true },
    });

    if (!korisnik || korisnik.uloga !== 'MUALLIM') {
      throw new BadRequestException('Korisnik nije muallim');
    }

    let muallimUcenikId: string;
    if (korisnik.ucenik) {
      muallimUcenikId = korisnik.ucenik.id;
    } else {
      // Kreiranje Ucenik zapisa za muallima (kao u muallim.service.ts)
      const noviUcenik = await this.prisma.ucenik.create({
        data: {
          korisnikId: korisnik.id,
          status: 'AKTIVAN',
        },
      });
      muallimUcenikId = noviUcenik.id;
    }

    const counts = await this.casService.getCasoviCountsByDate(
      nastavnaGodinaId,
      muallimUcenikId,
      start,
      end,
    );

    // Konvertuj Map u običan objekat za JSON response
    const result: Record<string, { total: number; completed: number }> = {};
    counts.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }
}



