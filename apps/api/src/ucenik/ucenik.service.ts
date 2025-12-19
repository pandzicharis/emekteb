import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UcenikService {
  private readonly logger = new Logger(UcenikService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getActiveNastavnaGodina() {
    const nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        kreiran: 'desc',
      },
    });
    return nastavnaGodina;
  }

  private async calculateProsjek(ucenikId: string, nastavnaGodinaId: string): Promise<number | null> {
    const ocjene = await this.prisma.casOcjena.findMany({
      where: {
        ucenikId,
        cas: {
          nastavnaGodinaId,
        },
      },
      select: {
        ocjena: true,
      },
    });

    if (ocjene.length === 0) {
      return null;
    }

    const suma = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjek = suma / ocjene.length;
    return Math.round(prosjek * 100) / 100; // Zaokruži na 2 decimale
  }

  async findAll(page: number = 1, limit: number = 20, razredNaziv?: string) {
    const skip = (page - 1) * limit;
    
    this.logger.log(`findAll called with page=${page}, limit=${limit}, skip=${skip}, razredNaziv=${razredNaziv}`);
    
    // Dohvati aktivnu nastavnu godinu
    const nastavnaGodina = await this.getActiveNastavnaGodina();
    if (!nastavnaGodina) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Ako je prosleđen razredNaziv, filtriraj učenike po razredu
    let whereClause: any = {};
    if (razredNaziv) {
      // Pronađi razredNastavnaGodina za ovaj razred
      const razredNastavnaGodina = await this.prisma.razredNastavnaGodina.findFirst({
        where: {
          nastavnaGodinaId: nastavnaGodina.id,
          razred: {
            name: razredNaziv,
          },
        },
        include: {
          grupe: {
            select: {
              id: true,
            },
          },
        },
      });

      if (razredNastavnaGodina && razredNastavnaGodina.grupe.length > 0) {
        const grupeIds = razredNastavnaGodina.grupe.map(g => g.id);
        whereClause = {
          grupe: {
            some: {
              grupa: {
                id: {
                  in: grupeIds,
                },
              },
            },
          },
        };
      } else {
        // Ako nema grupa za ovaj razred, vrati prazan rezultat
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    }

    // Prvo proveri total count
    const total = await this.prisma.ucenik.count({
      where: whereClause,
    });
    this.logger.log(`Total ucenici in DB: ${total}`);
    
    // Dohvati učenike sa paginacijom - koristi eksplicitne vrednosti
    const skipValue = Number(skip);
    const takeValue = Number(limit);
    
    this.logger.log(`Executing query with skip=${skipValue}, take=${takeValue}`);
    
    const uceniciRaw = await this.prisma.ucenik.findMany({
      where: whereClause,
      skip: skipValue,
      take: takeValue,
      include: {
        korisnik: {
          select: {
            id: true,
            ime: true,
            prezime: true,
            email: true,
            fotografija: true,
            aktivan: true,
          },
        },
        obrazovanje: {
          select: {
            nivoObrazovanja: true,
            razred: true,
            mektebStepen: true,
          },
        },
      },
    });

    this.logger.log(`Query returned ${uceniciRaw.length} ucenici`);

    // Sortiraj u memoriji (samo za trenutnu stranicu)
    uceniciRaw.sort((a, b) => {
      const prezimeA = a.korisnik?.prezime || '';
      const prezimeB = b.korisnik?.prezime || '';
      if (prezimeA !== prezimeB) {
        return prezimeA.localeCompare(prezimeB);
      }
      const imeA = a.korisnik?.ime || '';
      const imeB = b.korisnik?.ime || '';
      return imeA.localeCompare(imeB);
    });

    // Izračunaj prosjek i dohvati razred za svakog učenika
    const uceniciWithProsjek = await Promise.all(
      uceniciRaw.map(async (ucenik) => {
        const prosjek = await this.calculateProsjek(ucenik.id, nastavnaGodina.id);
        
        // Dohvati razred za ovog učenika kroz UcenikGrupa -> Grupa -> RazredNastavnaGodina -> Razred
        const ucenikGrupa = await this.prisma.ucenikGrupa.findFirst({
          where: {
            ucenikId: ucenik.id,
            grupa: {
              razredNastavnaGodina: {
                nastavnaGodinaId: nastavnaGodina.id,
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
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const razredNaziv = ucenikGrupa?.grupa?.razredNastavnaGodina?.razred?.name || null;

        return {
          ...ucenik,
          prosjek,
          razredNaziv,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`Found ${uceniciRaw.length} ucenici (total: ${total}, totalPages: ${totalPages})`);

    const result = {
      data: uceniciWithProsjek.map((ucenik) => ({
        id: ucenik.id,
        ime: ucenik.korisnik?.ime || null,
        prezime: ucenik.korisnik?.prezime || null,
        email: ucenik.korisnik?.email || null,
        fotografija: ucenik.korisnik?.fotografija || null,
        aktivan: ucenik.korisnik?.aktivan ?? true,
        datumRodjenja: ucenik.datumRodjenja,
        spol: ucenik.spol,
        mjestoRodjenja: ucenik.mjestoRodjenja,
        adresaStanovanja: ucenik.adresaStanovanja,
        status: ucenik.status,
        obrazovanje: ucenik.obrazovanje,
        prosjek: ucenik.prosjek,
        razredNaziv: ucenik.razredNaziv,
        eksterniId: ucenik.eksterniId,
      })),
      total,
      page,
      limit,
      totalPages,
    };
    
    this.logger.log(`Returning paginated response with ${result.data.length} items`);
    return result;
  }

  async getRazrediWithCount() {
    // Dohvati aktivnu nastavnu godinu
    const nastavnaGodina = await this.getActiveNastavnaGodina();
    if (!nastavnaGodina) {
      return [];
    }

    // Dohvati sve razrede za aktivnu nastavnu godinu
    const razrediNastavnaGodina = await this.prisma.razredNastavnaGodina.findMany({
      where: {
        nastavnaGodinaId: nastavnaGodina.id,
      },
      include: {
        razred: true,
        grupe: {
          include: {
            ucenici: true,
          },
        },
      },
      orderBy: {
        razred: {
          name: 'asc',
        },
      },
    });

    // Izračunaj broj učenika za svaki razred
    const razrediWithCount = razrediNastavnaGodina.map((rng) => {
      const totalUcenici = rng.grupe.reduce((acc, grupa) => acc + grupa.ucenici.length, 0);
      return {
        id: rng.razred.name, // Koristimo naziv razreda kao ID (npr. "Razred 1")
        naziv: rng.razred.name,
        brojUcenika: totalUcenici,
      };
    });

    return razrediWithCount;
  }

  async findOne(id: string) {
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id },
      include: {
        korisnik: {
          select: {
            id: true,
            ime: true,
            prezime: true,
            email: true,
            fotografija: true,
            aktivan: true,
          },
        },
        obrazovanje: true,
        roditelji: true,
        kontakti: true,
      },
    });

    if (!ucenik) {
      return null;
    }

    return {
      id: ucenik.id,
      ime: ucenik.korisnik?.ime || null,
      prezime: ucenik.korisnik?.prezime || null,
      email: ucenik.korisnik?.email || null,
      fotografija: ucenik.korisnik?.fotografija || null,
      aktivan: ucenik.korisnik?.aktivan ?? true,
      datumRodjenja: ucenik.datumRodjenja,
      spol: ucenik.spol,
      mjestoRodjenja: ucenik.mjestoRodjenja,
      adresaStanovanja: ucenik.adresaStanovanja,
      status: ucenik.status,
      obrazovanje: ucenik.obrazovanje,
      roditelji: ucenik.roditelji,
      kontakti: ucenik.kontakti,
      eksterniId: ucenik.eksterniId,
    };
  }
}
