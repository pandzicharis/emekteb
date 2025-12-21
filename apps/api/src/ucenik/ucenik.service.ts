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
        opis: ucenik.posebnePotrebeOpis || null,
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

    // Calculate prosjek and distribution
    const nastavnaGodina = await this.getActiveNastavnaGodina();
    const prosjek = nastavnaGodina ? await this.calculateProsjek(ucenik.id, nastavnaGodina.id) : null;
    
    // Calculate prosjek distribution
    let prosjekDistribution = { excellent: 0, vrlodobar: 0, good: 0, average: 0, poor: 0 };
    if (nastavnaGodina) {
      const ocjene = await this.prisma.casOcjena.findMany({
        where: {
          ucenikId: ucenik.id,
          cas: {
            nastavnaGodinaId: nastavnaGodina.id,
          },
        },
        select: {
          ocjena: true,
        },
      });

      ocjene.forEach((o) => {
        if (o.ocjena === 5) prosjekDistribution.excellent++;
        else if (o.ocjena === 4) prosjekDistribution.vrlodobar++;
        else if (o.ocjena === 3) prosjekDistribution.good++;
        else if (o.ocjena === 2) prosjekDistribution.average++;
        else if (o.ocjena === 1) prosjekDistribution.poor++;
      });
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
      prosjek,
      // Porodični podaci
      imaRoditelje: ucenik.imaRoditelje,
      roditeljiZajedno: ucenik.roditeljiZajedno,
      roditeljiRazdvojeni: ucenik.roditeljiRazdvojeni,
      roditeljiClanoviIz: ucenik.roditeljiClanoviIz,
      brojBrace: ucenik.brojBrace,
      brojSestara: ucenik.brojSestara,
      tipStambenogObjekta: ucenik.tipStambenogObjekta,
      imaPosebnePotrebe: ucenik.imaPosebnePotrebe,
      posebnePotrebeOpis: ucenik.posebnePotrebeOpis,
      idPunktaDzemata: ucenik.idPunktaDzemata,
      clanMrezeMladih: ucenik.clanMrezeMladih,
      ucenikSkoleHifza: ucenik.ucenikSkoleHifza,
      prosjekDistribution,
    };
  }

  async update(id: string, updateData: any) {
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id },
      include: { korisnik: true, obrazovanje: true },
    });

    if (!ucenik) {
      throw new Error('Učenik nije pronađen');
    }

    // Update korisnik data
    if (ucenik.korisnikId && (updateData.ime || updateData.prezime || updateData.email !== undefined)) {
      await this.prisma.korisnik.update({
        where: { id: ucenik.korisnikId },
        data: {
          ...(updateData.ime !== undefined && { ime: updateData.ime }),
          ...(updateData.prezime !== undefined && { prezime: updateData.prezime }),
          ...(updateData.email !== undefined && { email: updateData.email }),
        },
      });
    }

    // Update ucenik data
    const ucenikUpdateData: any = {};
    if (updateData.datumRodjenja !== undefined) ucenikUpdateData.datumRodjenja = updateData.datumRodjenja ? new Date(updateData.datumRodjenja) : null;
    if (updateData.spol !== undefined) ucenikUpdateData.spol = updateData.spol || null;
    if (updateData.mjestoRodjenja !== undefined) ucenikUpdateData.mjestoRodjenja = updateData.mjestoRodjenja || null;
    if (updateData.adresaStanovanja !== undefined) ucenikUpdateData.adresaStanovanja = updateData.adresaStanovanja || null;
    if (updateData.status !== undefined) ucenikUpdateData.status = updateData.status || null;
    if (updateData.imaRoditelje !== undefined) ucenikUpdateData.imaRoditelje = updateData.imaRoditelje || null;
    if (updateData.roditeljiZajedno !== undefined) ucenikUpdateData.roditeljiZajedno = updateData.roditeljiZajedno || null;
    if (updateData.roditeljiRazdvojeni !== undefined) ucenikUpdateData.roditeljiRazdvojeni = updateData.roditeljiRazdvojeni || null;
    if (updateData.roditeljiClanoviIz !== undefined) ucenikUpdateData.roditeljiClanoviIz = updateData.roditeljiClanoviIz || null;
    if (updateData.brojBrace !== undefined) ucenikUpdateData.brojBrace = updateData.brojBrace ?? null;
    if (updateData.brojSestara !== undefined) ucenikUpdateData.brojSestara = updateData.brojSestara ?? null;
    if (updateData.tipStambenogObjekta !== undefined) ucenikUpdateData.tipStambenogObjekta = updateData.tipStambenogObjekta || null;
    if (updateData.imaPosebnePotrebe !== undefined) ucenikUpdateData.imaPosebnePotrebe = updateData.imaPosebnePotrebe;
    if (updateData.posebnePotrebeOpis !== undefined) ucenikUpdateData.posebnePotrebeOpis = updateData.posebnePotrebeOpis || null;
    if (updateData.idPunktaDzemata !== undefined) ucenikUpdateData.idPunktaDzemata = updateData.idPunktaDzemata ?? null;
    if (updateData.clanMrezeMladih !== undefined) ucenikUpdateData.clanMrezeMladih = updateData.clanMrezeMladih || null;
    if (updateData.ucenikSkoleHifza !== undefined) ucenikUpdateData.ucenikSkoleHifza = updateData.ucenikSkoleHifza || null;

    if (Object.keys(ucenikUpdateData).length > 0) {
      await this.prisma.ucenik.update({
        where: { id },
        data: ucenikUpdateData,
      });
    }

    // Update obrazovanje
    if (updateData.obrazovanje && ucenik.obrazovanje) {
      await this.prisma.obrazovanje.update({
        where: { id: ucenik.obrazovanje.id },
        data: {
          ...(updateData.obrazovanje.nivoObrazovanja !== undefined && { nivoObrazovanja: updateData.obrazovanje.nivoObrazovanja || null }),
          ...(updateData.obrazovanje.razred !== undefined && { razred: updateData.obrazovanje.razred ?? null }),
          ...(updateData.obrazovanje.mektebStepen !== undefined && { mektebStepen: updateData.obrazovanje.mektebStepen || null }),
          ...(updateData.obrazovanje.predskolskaNaziv !== undefined && { predskolskaNaziv: updateData.obrazovanje.predskolskaNaziv || null }),
          ...(updateData.obrazovanje.osnovnaNaziv !== undefined && { osnovnaNaziv: updateData.obrazovanje.osnovnaNaziv || null }),
          ...(updateData.obrazovanje.srednjaNaziv !== undefined && { srednjaNaziv: updateData.obrazovanje.srednjaNaziv || null }),
          ...(updateData.obrazovanje.fakultetNaziv !== undefined && { fakultetNaziv: updateData.obrazovanje.fakultetNaziv || null }),
        },
      });
    }

    // Return updated ucenik
    return this.findOne(id);
  }

  async addOcjena(ucenikId: string, body: { casId: string; lekcijaId: string; ocjena: number; komentar?: string }) {
    // Provjeri da li učenik postoji
    const ucenik = await this.prisma.ucenik.findUnique({ where: { id: ucenikId } });
    if (!ucenik) {
      throw new Error('Učenik nije pronađen');
    }

    // Provjeri da li čas postoji
    const cas = await this.prisma.cas.findUnique({ where: { id: body.casId } });
    if (!cas) {
      throw new Error('Čas nije pronađen');
    }

    // Provjeri da li lekcija postoji
    const lekcija = await this.prisma.lekcija.findUnique({ where: { id: body.lekcijaId } });
    if (!lekcija) {
      throw new Error('Lekcija nije pronađena');
    }

    // Provjeri da li već postoji ocjena za ovu kombinaciju
    const existingOcjena = await this.prisma.casOcjena.findFirst({
      where: {
        casId: body.casId,
        ucenikId: ucenikId,
        lekcijaId: body.lekcijaId,
      },
    });

    if (existingOcjena) {
      // Update postojeće ocjene
      return this.prisma.casOcjena.update({
        where: { id: existingOcjena.id },
        data: {
          ocjena: body.ocjena,
          komentar: body.komentar || null,
        },
      });
    } else {
      // Kreiraj novu ocjenu
      return this.prisma.casOcjena.create({
        data: {
          casId: body.casId,
          ucenikId: ucenikId,
          lekcijaId: body.lekcijaId,
          ocjena: body.ocjena,
          komentar: body.komentar || null,
        },
      });
    }
  }

  async addPrisustvo(ucenikId: string, body: { casId: string; status: string }) {
    // Provjeri da li učenik postoji
    const ucenik = await this.prisma.ucenik.findUnique({ where: { id: ucenikId } });
    if (!ucenik) {
      throw new Error('Učenik nije pronađen');
    }

    // Provjeri da li čas postoji
    const cas = await this.prisma.cas.findUnique({ where: { id: body.casId } });
    if (!cas) {
      throw new Error('Čas nije pronađen');
    }

    // Provjeri da li već postoji prisustvo
    const existingPrisustvo = await this.prisma.casPrisustvo.findFirst({
      where: {
        casId: body.casId,
        ucenikId: ucenikId,
      },
    });

    if (existingPrisustvo) {
      // Update postojećeg prisustva
      return this.prisma.casPrisustvo.update({
        where: { id: existingPrisustvo.id },
        data: {
          status: body.status as any,
        },
      });
    } else {
      // Kreiraj novo prisustvo
      return this.prisma.casPrisustvo.create({
        data: {
          casId: body.casId,
          ucenikId: ucenikId,
          status: body.status as any,
        },
      });
    }
  }
}
