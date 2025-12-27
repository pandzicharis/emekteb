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

  @Get('grupa/:grupaId/ucenici')
  async getUceniciFromGrupa(@Param('grupaId') grupaId: string) {
    return this.casService.getUceniciFromGrupa(grupaId);
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
    // STRICT FILTER: samo rasporedi gdje je muallimId jednak muallimUcenikId
    const rasporedi = await this.prisma.raspored.findMany({
      where: {
        grupa: {
          razredNastavnaGodina: {
            nastavnaGodinaId: nastavnaGodina.id,
            muallimId: muallimUcenikId, // STRICT: samo slotovi ovog muallima
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

    // STRICT FILTER: Dodatna provjera - filtriraj samo rasporede koji stvarno pripadaju ovom muallimu
    // Ovo osigurava da čak i ako Prisma query propusti neki raspored, mi ga filtriramo
    const validRasporedi = rasporedi.filter((r) => {
      const actualMuallimId = r.grupa.razredNastavnaGodina.muallimId;
      const isValid = actualMuallimId === muallimUcenikId;
      if (!isValid) {
        console.error(`[CasController] STRICT FILTER: Removing raspored ${r.id} - belongs to muallim ${actualMuallimId}, not ${muallimUcenikId}`);
      }
      return isValid;
    });
    
    console.log(`[CasController] Found ${rasporedi.length} rasporedi, ${validRasporedi.length} valid for muallim ${muallimUcenikId}`);
    
    // Koristi samo validne rasporede - STRICT FILTER
    const filteredRasporedi = validRasporedi;

    if (filteredRasporedi.length === 0) {
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

    // Pronađi sve časove u nastavnoj godini - samo za validne rasporede
    const rasporedIds = filteredRasporedi.map((r) => r.id);
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

    // Pronađi sve SkolaHifza časove u nastavnoj godini
    // Prvo pronađi SkolaHifza za nastavnu godinu
    const skolaHifza = await this.prisma.skolaHifza.findUnique({
      where: { nastavnaGodinaId: nastavnaGodina.id },
    });

    const skolaHifzaCasoviMap = new Map<string, any>();
    if (skolaHifza) {
      // Pronađi sve SkolaHifza slotove koji pripadaju rasporedima ovog muallima
      // STRICT: koristi samo filteredRasporedi
      const skolaHifzaRasporediIds = filteredRasporedi
        .filter((r) => r.grupa.razredNastavnaGodina.razred.ilmihal === 'SKOLA_HIFZA')
        .map((r) => r.id);

      if (skolaHifzaRasporediIds.length > 0) {
        const skolaHifzaCasovi = await this.prisma.skolaHifzaCas.findMany({
          where: {
            skolaHifzaId: skolaHifza.id,
            slotId: { in: skolaHifzaRasporediIds },
            datum: {
              gte: nastavnaGodina.datumOd,
              lte: nastavnaGodina.datumDo,
            },
          },
          include: {
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
        });

        skolaHifzaCasovi.forEach((cas) => {
          const dateKey = cas.datum.toISOString().split('T')[0];
          const key = `${cas.slotId}-${dateKey}`;
          skolaHifzaCasoviMap.set(key, cas);
        });
      }
    }

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

        // Pronađi sve rasporede za ovaj dan - STRICT: koristi samo filteredRasporedi
        const danRasporedi = filteredRasporedi.filter((r) => r.dan === dan);

        for (const raspored of danRasporedi) {
          const casKey = `${raspored.id}-${dateKey}`;
          const cas = casoviMap.get(casKey);
          const isSkolaHifza = raspored.grupa.razredNastavnaGodina.razred.ilmihal === 'SKOLA_HIFZA';
          
          // Proveri i SkolaHifzaCas ako je SkolaHifza slot
          const skolaHifzaCas = isSkolaHifza ? skolaHifzaCasoviMap.get(casKey) : null;

          if (cas || skolaHifzaCas) {
            // Postoji čas za ovaj raspored i datum (regularni ili SkolaHifza)
            const activeCas = cas || skolaHifzaCas;
            result.push({
              id: activeCas.id,
              datum: dateKey,
              tipovi: cas?.tipovi || [],
              napomena: activeCas.napomena,
              kreiran: activeCas.kreiran ? activeCas.kreiran.toISOString() : null,
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
              lekcije: cas?.lekcije?.map((cl: any) => ({
                id: cl.lekcija.id,
                naslov: cl.lekcija.naslov,
              })) || [],
              prisustva: (cas?.prisustva || skolaHifzaCas?.prisustva || []).map((p: any) => ({
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

    // Dohvati slobodne dane za nastavnu godinu
    const slobodniDani = await this.prisma.slobodanDan.findMany({
      where: { nastavnaGodinaId: nastavnaGodina.id },
      orderBy: { datum: 'asc' },
    });

    return {
      nastavnaGodina: {
        id: nastavnaGodina.id,
        naziv: nastavnaGodina.naziv,
        datumOd: nastavnaGodina.datumOd.toISOString().split('T')[0],
        datumDo: nastavnaGodina.datumDo.toISOString().split('T')[0],
      },
      casovi: result,
      slobodniDani: slobodniDani.map((sd) => ({
        datum: sd.datum.toISOString().split('T')[0], // YYYY-MM-DD format
        razlog: sd.razlog,
      })),
    };
  }
}



