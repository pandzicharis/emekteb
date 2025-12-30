import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoditeljService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pronađi sve učenike povezane sa roditeljem preko korisnik ID-a
   * Roditelj se loguje sa email-om djeteta (npr. ahmed.hasanovic@emekteb.ba)
   * Sistem pronalazi učenika sa tim email-om, zatim sve Roditelj zapise za tog učenika,
   * i konačno sve učenike gdje postoji Roditelj zapis sa istim email-om roditelja
   */
  async getUcenici(korisnikId: string) {
    const korisnik = await this.prisma.korisnik.findUnique({
      where: { id: korisnikId },
    });

    if (!korisnik || !korisnik.email) {
      throw new BadRequestException('Roditelj nema email adresu');
    }

    // Email roditelja može biti u formatu roditelj.ime.prezime@emekteb.ba ili ime.prezime@emekteb.ba
    // Ako počinje sa "roditelj.", ukloni prefiks i traži učenika
    let ucenikEmail = korisnik.email;
    if (ucenikEmail.startsWith('roditelj.')) {
      ucenikEmail = ucenikEmail.replace(/^roditelj\./, '');
    }

    // Pronađi učenika sa tim email-om
    const ucenikKorisnik = await this.prisma.korisnik.findFirst({
      where: {
        email: ucenikEmail,
        uloga: 'UCENIK',
      },
      include: {
        ucenik: true,
      },
    });

    if (!ucenikKorisnik || !ucenikKorisnik.ucenik) {
      // Ako nema učenika sa tim email-om, vrati praznu listu
      return [];
    }

    // Pronađi sve Roditelj zapise za ovog učenika
    const roditeljiZapisi = await this.prisma.roditelj.findMany({
      where: {
        ucenikId: ucenikKorisnik.ucenik.id,
      },
    });

    if (roditeljiZapisi.length === 0) {
      return [];
    }

    // Uzmi email roditelja iz prvog zapisa (majka ili otac - obično imaju isti email)
    const roditeljEmail = roditeljiZapisi[0].email;

    if (!roditeljEmail) {
      // Ako roditelj nema email, vrati samo ovog učenika
      return [ucenikKorisnik.ucenik];
    }

    // Pronađi sve učenike gdje postoji Roditelj zapis sa istim email-om roditelja
    const sviRoditeljiZapisi = await this.prisma.roditelj.findMany({
      where: {
        email: roditeljEmail,
      },
      include: {
        ucenik: {
          include: {
            korisnik: {
              select: {
                id: true,
                ime: true,
                prezime: true,
                email: true,
                fotografija: true,
              },
            },
            obrazovanje: true,
            grupe: {
              include: {
                grupa: {
                  include: {
                    razredNastavnaGodina: {
                      include: {
                        razred: true,
                        nastavnaGodina: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Vrati sve jedinstvene učenike
    const ucenici = sviRoditeljiZapisi
      .map((r) => r.ucenik)
      .filter((u): u is NonNullable<typeof u> => u !== null);

    // Ukloni duplikate po ID-u
    const uniqueUcenici = Array.from(new Map(ucenici.map((u) => [u.id, u])).values());

    return uniqueUcenici;
  }

  /**
   * Dashboard podaci za roditelja - svi učenici sa statistikama
   */
  async getDashboardData(korisnikId: string) {
    const korisnik = await this.prisma.korisnik.findUnique({
      where: { id: korisnikId },
    });

    if (!korisnik) {
      throw new NotFoundException(`Korisnik sa ID ${korisnikId} nije pronađen`);
    }

    if (korisnik.uloga !== 'RODITELJ') {
      throw new BadRequestException(
        `Korisnik sa ID ${korisnikId} nije roditelj. Trenutna uloga: ${korisnik.uloga}`,
      );
    }

    if (!korisnik.email) {
      throw new BadRequestException('Roditelj nema email adresu');
    }

    // Pronađi sve učenike povezane sa ovim roditeljem
    // Koristi istu logiku kao getUcenici
    let ucenikEmail = korisnik.email;
    if (ucenikEmail && ucenikEmail.startsWith('roditelj.')) {
      ucenikEmail = ucenikEmail.replace(/^roditelj\./, '');
    }

    const ucenikKorisnik = await this.prisma.korisnik.findFirst({
      where: {
        email: ucenikEmail,
        uloga: 'UCENIK',
      },
      include: {
        ucenik: true,
      },
    });

    let ucenici: any[] = [];
    
    if (ucenikKorisnik && ucenikKorisnik.ucenik) {
      // Pronađi sve Roditelj zapise za ovog učenika
      const roditeljiZapisi = await this.prisma.roditelj.findMany({
        where: {
          ucenikId: ucenikKorisnik.ucenik.id,
        },
      });

      if (roditeljiZapisi.length > 0 && roditeljiZapisi[0].email) {
        const roditeljEmail = roditeljiZapisi[0].email;
        
        // Pronađi sve učenike gdje postoji Roditelj zapis sa istim email-om roditelja
        const sviRoditeljiZapisi = await this.prisma.roditelj.findMany({
          where: {
            email: roditeljEmail,
          },
          include: {
            ucenik: {
              include: {
                korisnik: {
                  select: {
                    id: true,
                    ime: true,
                    prezime: true,
                    email: true,
                    fotografija: true,
                  },
                },
                obrazovanje: true,
                grupe: {
                  include: {
                    grupa: {
                      include: {
                        razredNastavnaGodina: {
                          include: {
                            razred: true,
                            nastavnaGodina: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        ucenici = sviRoditeljiZapisi
          .map((r) => r.ucenik)
          .filter((u): u is NonNullable<typeof u> => u !== null);
        
        // Ukloni duplikate
        ucenici = Array.from(new Map(ucenici.map((u) => [u.id, u])).values());
      } else if (ucenikKorisnik.ucenik) {
        // Ako nema roditelj zapisa, vrati samo ovog učenika
        ucenici = [ucenikKorisnik.ucenik];
      }
    }

    if (ucenici.length === 0) {
      return {
        ucenici: [],
        statistike: {
          ukupnoUcenika: 0,
          prosjekPrisustva: 0,
          prosjekOcjena: 0,
        },
      };
    }

    // Pronađi aktivnu nastavnu godinu
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
      where: {
        status: 'ACTIVE',
        datumOd: { lte: today },
        datumDo: { gte: today },
      },
    });

    // Za svakog učenika, prikupi podatke
    const uceniciData = await Promise.all(
      ucenici.map(async (ucenik) => {
        // Pronađi aktivnu grupu učenika
        const aktivnaGrupa = ucenik.grupe.find((ug: any) => {
          return ug.grupa.razredNastavnaGodina.nastavnaGodina?.id === nastavnaGodina?.id &&
                 ug.grupa.razredNastavnaGodina.nastavnaGodina?.status === 'ACTIVE';
        });

        // Statistike prisustva
        const prisustva = await this.prisma.casPrisustvo.findMany({
          where: {
            ucenikId: ucenik.id,
            cas: {
              nastavnaGodinaId: nastavnaGodina?.id,
            },
          },
        });

        const ukupnoPrisustva = prisustva.length;
        const prisutni = prisustva.filter((p) => p.status === 'PRISUTAN').length;
        const opravdani = prisustva.filter((p) => p.status === 'OPRAVDAN').length;
        const neopravdani = prisustva.filter((p) => p.status === 'NEOPRAVDAN').length;
        const procenatPrisustva =
          ukupnoPrisustva > 0 ? Math.round(((prisutni + opravdani) / ukupnoPrisustva) * 100) : 0;

        // Statistike ocjena
        const ocjene = await this.prisma.casOcjena.findMany({
          where: {
            ucenikId: ucenik.id,
            cas: {
              nastavnaGodinaId: nastavnaGodina?.id,
            },
          },
          include: {
            lekcija: true,
            cas: {
              select: {
                id: true,
                datum: true,
              },
            },
          },
        });

        const prosjekOcjena =
          ocjene.length > 0
            ? Math.round((ocjene.reduce((sum, o) => sum + o.ocjena, 0) / ocjene.length) * 100) / 100
            : 0;

        // Napredak
        const napredak = ucenik.napredak as any;
        const napredakZaGodinu = nastavnaGodina
          ? napredak?.[nastavnaGodina.id] || null
          : null;

        // Razred i grupa
        const razredInfo = aktivnaGrupa
          ? {
              id: aktivnaGrupa.grupa.razredNastavnaGodina.razred.id,
              name: aktivnaGrupa.grupa.razredNastavnaGodina.razred.name,
              ilmihal: aktivnaGrupa.grupa.razredNastavnaGodina.razred.ilmihal,
              grupa: aktivnaGrupa.grupa.naziv,
            }
          : null;

        return {
          id: ucenik.id,
          ime: ucenik.korisnik?.ime || '',
          prezime: ucenik.korisnik?.prezime || '',
          fotografija: ucenik.korisnik?.fotografija || null,
          razred: razredInfo,
          statistike: {
            procenatPrisustva,
            prosjekOcjena,
            ukupnoPrisustva,
            prisutni,
            opravdani,
            neopravdani,
            ukupnoOcjena: ocjene.length,
          },
          napredak: napredakZaGodinu,
        };
      }),
    );

    // Ukupne statistike
    const ukupnoUcenika = uceniciData.length;
    const prosjekPrisustva =
      ukupnoUcenika > 0
        ? Math.round(
            (uceniciData.reduce((sum, u) => sum + u.statistike.procenatPrisustva, 0) /
              ukupnoUcenika) *
              100,
          ) / 100
        : 0;
    const prosjekOcjena =
      ukupnoUcenika > 0
        ? Math.round(
            (uceniciData.reduce((sum, u) => sum + u.statistike.prosjekOcjena, 0) / ukupnoUcenika) *
              100,
          ) / 100
        : 0;

    return {
      nastavnaGodina: nastavnaGodina
        ? {
            id: nastavnaGodina.id,
            naziv: nastavnaGodina.naziv,
            opis: nastavnaGodina.opis,
            datumOd: nastavnaGodina.datumOd,
            datumDo: nastavnaGodina.datumDo,
          }
        : null,
      ucenici: uceniciData,
      statistike: {
        ukupnoUcenika,
        prosjekPrisustva,
        prosjekOcjena,
      },
    };
  }

  /**
   * Detaljno prisustvo za određenog učenika
   */
  async getPrisustvo(ucenikId: string, nastavnaGodinaId?: string) {
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id: ucenikId },
      include: {
        korisnik: {
          select: {
            ime: true,
            prezime: true,
          },
        },
      },
    });

    if (!ucenik) {
      throw new NotFoundException('Učenik nije pronađen');
    }

    // Ako nije proslijeđena nastavna godina, koristi aktivnu
    let nastavnaGodina;
    if (nastavnaGodinaId) {
      nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
        where: { id: nastavnaGodinaId },
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
        where: {
          status: 'ACTIVE',
          datumOd: { lte: today },
          datumDo: { gte: today },
        },
      });
    }

    if (!nastavnaGodina) {
      return {
        ucenik: {
          id: ucenik.id,
          ime: ucenik.korisnik?.ime || '',
          prezime: ucenik.korisnik?.prezime || '',
        },
        prisustva: [],
        statistike: {
          ukupno: 0,
          prisutni: 0,
          opravdani: 0,
          neopravdani: 0,
          procenat: 0,
        },
      };
    }

    const prisustva = await this.prisma.casPrisustvo.findMany({
      where: {
        ucenikId: ucenik.id,
        cas: {
          nastavnaGodinaId: nastavnaGodina.id,
        },
      },
      include: {
        cas: {
          include: {
            grupa: {
              include: {
                razredNastavnaGodina: {
                  include: {
                    razred: true,
                  },
                },
              },
            },
            raspored: true,
          },
        },
      },
      orderBy: {
        cas: {
          datum: 'desc',
        },
      },
    });

    const ukupno = prisustva.length;
    const prisutni = prisustva.filter((p) => p.status === 'PRISUTAN').length;
    const opravdani = prisustva.filter((p) => p.status === 'OPRAVDAN').length;
    const neopravdani = prisustva.filter((p) => p.status === 'NEOPRAVDAN').length;
    const procenat = ukupno > 0 ? Math.round(((prisutni + opravdani) / ukupno) * 100) : 0;

    return {
      ucenik: {
        id: ucenik.id,
        ime: ucenik.korisnik?.ime || '',
        prezime: ucenik.korisnik?.prezime || '',
      },
      prisustva: prisustva.map((p) => ({
        id: p.id,
        datum: p.cas.datum,
        status: p.status,
        napomena: p.napomena,
        razred: p.cas.grupa.razredNastavnaGodina.razred.name,
        slot: p.cas.raspored.slot,
        dan: p.cas.raspored.dan,
      })),
      statistike: {
        ukupno,
        prisutni,
        opravdani,
        neopravdani,
        procenat,
      },
    };
  }

  /**
   * Detaljne ocjene za određenog učenika
   */
  async getOcjene(ucenikId: string, nastavnaGodinaId?: string) {
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id: ucenikId },
      include: {
        korisnik: {
          select: {
            ime: true,
            prezime: true,
          },
        },
      },
    });

    if (!ucenik) {
      throw new NotFoundException('Učenik nije pronađen');
    }

    // Ako nije proslijeđena nastavna godina, koristi aktivnu
    let nastavnaGodina;
    if (nastavnaGodinaId) {
      nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
        where: { id: nastavnaGodinaId },
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
        where: {
          status: 'ACTIVE',
          datumOd: { lte: today },
          datumDo: { gte: today },
        },
      });
    }

    if (!nastavnaGodina) {
      return {
        ucenik: {
          id: ucenik.id,
          ime: ucenik.korisnik?.ime || '',
          prezime: ucenik.korisnik?.prezime || '',
        },
        ocjene: [],
        statistike: {
          ukupno: 0,
          prosjek: 0,
          distribucija: {},
        },
      };
    }

    const ocjene = await this.prisma.casOcjena.findMany({
      where: {
        ucenikId: ucenik.id,
        cas: {
          nastavnaGodinaId: nastavnaGodina.id,
        },
      },
      include: {
        lekcija: true,
        cas: {
          include: {
            grupa: {
              include: {
                razredNastavnaGodina: {
                  include: {
                    razred: true,
                  },
                },
              },
            },
            raspored: true,
          },
        },
      },
      orderBy: {
        vrijeme: 'desc',
      },
    });

    const ukupno = ocjene.length;
    const prosjek =
      ukupno > 0
        ? Math.round((ocjene.reduce((sum, o) => sum + o.ocjena, 0) / ukupno) * 100) / 100
        : 0;

    // Distribucija ocjena
    const distribucija: { [key: number]: number } = {};
    ocjene.forEach((o) => {
      distribucija[o.ocjena] = (distribucija[o.ocjena] || 0) + 1;
    });

    return {
      ucenik: {
        id: ucenik.id,
        ime: ucenik.korisnik?.ime || '',
        prezime: ucenik.korisnik?.prezime || '',
      },
      ocjene: ocjene.map((o) => ({
        id: o.id,
        ocjena: o.ocjena,
        komentar: o.komentar,
        vrijeme: o.vrijeme,
        lekcija: {
          id: o.lekcija.id,
          naslov: o.lekcija.naslov,
          tip: o.lekcija.tip,
        },
        razred: o.cas.grupa.razredNastavnaGodina.razred.name,
        datum: o.cas.datum,
      })),
      statistike: {
        ukupno,
        prosjek,
        distribucija,
      },
    };
  }

  /**
   * Napredak za određenog učenika
   */
  async getNapredak(ucenikId: string, nastavnaGodinaId?: string) {
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id: ucenikId },
      include: {
        korisnik: {
          select: {
            ime: true,
            prezime: true,
          },
        },
        obrazovanje: true,
        grupe: {
          include: {
            grupa: {
              include: {
                razredNastavnaGodina: {
                  include: {
                    razred: true,
                    nastavnaGodina: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ucenik) {
      throw new NotFoundException('Učenik nije pronađen');
    }

    // Ako nije proslijeđena nastavna godina, koristi aktivnu
    let nastavnaGodina;
    if (nastavnaGodinaId) {
      nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
        where: { id: nastavnaGodinaId },
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
        where: {
          status: 'ACTIVE',
          datumOd: { lte: today },
          datumDo: { gte: today },
        },
      });
    }

    const napredak = ucenik.napredak as any;
    const napredakZaGodinu = nastavnaGodina ? napredak?.[nastavnaGodina.id] || null : null;

    // Pronađi aktivnu grupu
    const aktivnaGrupa = ucenik.grupe.find((ug) => {
      return ug.grupa.razredNastavnaGodina.nastavnaGodina?.id === nastavnaGodina?.id;
    });

    return {
      ucenik: {
        id: ucenik.id,
        ime: ucenik.korisnik?.ime || '',
        prezime: ucenik.korisnik?.prezime || '',
      },
      razred: aktivnaGrupa
        ? {
            id: aktivnaGrupa.grupa.razredNastavnaGodina.razred.id,
            name: aktivnaGrupa.grupa.razredNastavnaGodina.razred.name,
            ilmihal: aktivnaGrupa.grupa.razredNastavnaGodina.razred.ilmihal,
          }
        : null,
      napredak: napredakZaGodinu,
      obrazovanje: ucenik.obrazovanje,
    };
  }

  /**
   * Raspored časova za određenog učenika
   */
  async getRaspored(ucenikId: string, nastavnaGodinaId?: string) {
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id: ucenikId },
      include: {
        korisnik: {
          select: {
            ime: true,
            prezime: true,
          },
        },
        grupe: {
          include: {
            grupa: {
              include: {
                razredNastavnaGodina: {
                  include: {
                    razred: true,
                    nastavnaGodina: true,
                  },
                },
                raspored: true,
              },
            },
          },
        },
      },
    });

    if (!ucenik) {
      throw new NotFoundException('Učenik nije pronađen');
    }

    // Ako nije proslijeđena nastavna godina, koristi aktivnu
    let nastavnaGodina;
    if (nastavnaGodinaId) {
      nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
        where: { id: nastavnaGodinaId },
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
        where: {
          status: 'ACTIVE',
          datumOd: { lte: today },
          datumDo: { gte: today },
        },
      });
    }

    // Pronađi aktivnu grupu
    const aktivnaGrupa = ucenik.grupe.find((ug) => {
      return ug.grupa.razredNastavnaGodina.nastavnaGodina?.id === nastavnaGodina?.id;
    });

    if (!aktivnaGrupa || !aktivnaGrupa.grupa.raspored) {
      return {
        ucenik: {
          id: ucenik.id,
          ime: ucenik.korisnik?.ime || '',
          prezime: ucenik.korisnik?.prezime || '',
        },
        raspored: null,
        razred: null,
      };
    }

    const raspored = aktivnaGrupa.grupa.raspored;

    return {
      ucenik: {
        id: ucenik.id,
        ime: ucenik.korisnik?.ime || '',
        prezime: ucenik.korisnik?.prezime || '',
      },
      razred: {
        id: aktivnaGrupa.grupa.razredNastavnaGodina.razred.id,
        name: aktivnaGrupa.grupa.razredNastavnaGodina.razred.name,
        ilmihal: aktivnaGrupa.grupa.razredNastavnaGodina.razred.ilmihal,
      },
      grupa: {
        id: aktivnaGrupa.grupa.id,
        naziv: aktivnaGrupa.grupa.naziv,
        kuran: aktivnaGrupa.grupa.kuran,
        sufara: aktivnaGrupa.grupa.sufara,
      },
      raspored: {
        id: raspored.id,
        dan: raspored.dan,
        slot: raspored.slot,
        lokacija: raspored.lokacija,
        trajanje: raspored.trajanje,
      },
    };
  }
}

