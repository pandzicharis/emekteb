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

  @Get('grupa/:grupaId/lekcije-stats')
  async getLessonsStatsForGroup(@Param('grupaId') grupaId: string) {
    return this.casService.getLessonsStatsForGroup(grupaId);
  }

  @Get('muallim/range')
  async getCasoviForMuallim(@Request() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Korisnik nije autentifikovan');
    }

    // Pronađi muallim korisnika i njegov Ucenik zapis
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
      // Kreiranje Ucenik zapisa za muallima
      const noviUcenik = await this.prisma.ucenik.create({
        data: {
          korisnikId: korisnik.id,
          status: 'AKTIVAN',
        },
      });
      muallimUcenikId = noviUcenik.id;
    }

    // Pronađi aktivnu nastavnu godinu
    const nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
      where: {
        status: 'ACTIVE',
      },
      orderBy: { kreiran: 'desc' },
    });

    if (!nastavnaGodina) {
      return {
        nastavnaGodina: null,
        casovi: [],
      };
    }

    // Pronađi SVE rasporede za ovog muallima u ovoj nastavnoj godini
    const rasporedi = await this.prisma.raspored.findMany({
      where: {
        grupa: {
          razredNastavnaGodina: {
            nastavnaGodinaId: nastavnaGodina.id,
            muallimId: muallimUcenikId,
          },
        },
      },
      include: {
        grupa: {
          include: {
            razredNastavnaGodina: {
              include: {
                razred: {
                  select: {
                    id: true,
                    name: true,
                    ilmihal: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        slot: 'asc',
      },
    });

    if (rasporedi.length === 0) {
      return {
        nastavnaGodina: {
          id: nastavnaGodina.id,
          naziv: nastavnaGodina.naziv,
          datumOd: nastavnaGodina.datumOd.toISOString().split('T')[0],
          datumDo: nastavnaGodina.datumDo.toISOString().split('T')[0],
        },
        casovi: [],
      };
    }

    // Pronađi sve časove u nastavnoj godini
    const rasporedIds = rasporedi.map((r) => r.id);
    const casovi = await this.prisma.cas.findMany({
      where: {
        rasporedId: { in: rasporedIds },
        datum: {
          gte: nastavnaGodina.datumOd,
          lte: nastavnaGodina.datumDo,
        },
      },
      include: {
        lekcije: {
          include: {
            lekcija: {
              select: {
                id: true,
                naslov: true,
              },
            },
          },
        },
        prisustva: {
          include: {
            ucenik: {
              include: {
                korisnik: {
                  select: {
                    ime: true,
                    prezime: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        datum: 'asc',
      },
    });

    // Mapa časova po rasporedId i datumu (YYYY-MM-DD format)
    const casoviMap = new Map<string, any>();
    casovi.forEach((cas) => {
      const dateKey = cas.datum.toISOString().split('T')[0];
      const key = `${cas.rasporedId}-${dateKey}`;
      casoviMap.set(key, cas);
    });

    // Generiši sve subote i nedjelje od početka do kraja nastavne godine
    const result: any[] = [];
    const nastavnaGodinaStart = new Date(nastavnaGodina.datumOd);
    nastavnaGodinaStart.setHours(0, 0, 0, 0);
    const nastavnaGodinaEnd = new Date(nastavnaGodina.datumDo);
    nastavnaGodinaEnd.setHours(23, 59, 59, 999);

    const current = new Date(nastavnaGodinaStart);

    while (current <= nastavnaGodinaEnd) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 6 || dayOfWeek === 0) { // Subota ili nedjelja
        const dateKey = current.toISOString().split('T')[0];
        const dan = dayOfWeek === 6 ? 'subota' : 'nedjelja';

        // Pronađi sve rasporede za ovaj dan
        const danRasporedi = rasporedi.filter((r) => r.dan === dan);

        for (const raspored of danRasporedi) {
          const casKey = `${raspored.id}-${dateKey}`;
          const cas = casoviMap.get(casKey);

          if (cas) {
            // Postoji čas za ovaj raspored i datum
            result.push({
              id: cas.id,
              datum: dateKey,
              tipovi: cas.tipovi,
              napomena: cas.napomena,
              kreiran: cas.kreiran.toISOString(),
              raspored: {
                id: raspored.id,
                dan: raspored.dan,
                slot: raspored.slot,
                lokacija: raspored.lokacija,
                trajanje: raspored.trajanje,
                grupa: {
                  id: raspored.grupa.id,
                  naziv: raspored.grupa.naziv,
                  razred: {
                    id: raspored.grupa.razredNastavnaGodina.razred.id,
                    name: raspored.grupa.razredNastavnaGodina.razred.name,
                    ilmihal: raspored.grupa.razredNastavnaGodina.razred.ilmihal,
                  },
                },
              },
              lekcije: cas.lekcije.map((cl: any) => ({
                id: cl.lekcija.id,
                naslov: cl.lekcija.naslov,
              })),
              prisustva: cas.prisustva.map((p: any) => ({
                ucenikId: p.ucenikId,
                status: p.status,
                ucenik: {
                  ime: p.ucenik.korisnik?.ime || '',
                  prezime: p.ucenik.korisnik?.prezime || '',
                },
              })),
              imaCas: true,
            });
          } else {
            // Nema časa, ali postoji raspored (zakazan termin)
            result.push({
              id: null,
              datum: dateKey,
              tipovi: [],
              napomena: null,
              kreiran: null,
              raspored: {
                id: raspored.id,
                dan: raspored.dan,
                slot: raspored.slot,
                lokacija: raspored.lokacija,
                trajanje: raspored.trajanje,
                grupa: {
                  id: raspored.grupa.id,
                  naziv: raspored.grupa.naziv,
                  razred: {
                    id: raspored.grupa.razredNastavnaGodina.razred.id,
                    name: raspored.grupa.razredNastavnaGodina.razred.name,
                    ilmihal: raspored.grupa.razredNastavnaGodina.razred.ilmihal,
                  },
                },
              },
              lekcije: [],
              prisustva: [],
              imaCas: false,
            });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return {
      nastavnaGodina: {
        id: nastavnaGodina.id,
        naziv: nastavnaGodina.naziv,
        datumOd: nastavnaGodina.datumOd.toISOString().split('T')[0],
        datumDo: nastavnaGodina.datumDo.toISOString().split('T')[0],
      },
      casovi: result,
    };
  }
}



