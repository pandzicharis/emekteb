import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkolaHifzaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pronađi ili kreiraj SkolaHifza zapis za nastavnu godinu
   */
  async findByNastavnaGodina(nastavnaGodinaId: string) {
    const nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
      where: { id: nastavnaGodinaId },
    });

    if (!nastavnaGodina) {
      throw new NotFoundException(`Nastavna godina sa ID ${nastavnaGodinaId} nije pronađena`);
    }

    // Pronađi ili kreiraj SkolaHifza zapis
    let skolaHifza = await this.prisma.skolaHifza.findUnique({
      where: { nastavnaGodinaId },
    });

    if (!skolaHifza) {
      // Kreiraj novi SkolaHifza zapis
      skolaHifza = await this.prisma.skolaHifza.create({
        data: {
          nastavnaGodinaId,
        },
      });
    }

    return skolaHifza;
  }

  /**
   * Dohvati sve učenike za Školu Hifza u nastavnoj godini
   * Učenici se dobijaju iz grupa koje pripadaju SkolaHifza razredu
   */
  async getUcenici(nastavnaGodinaId: string, muallimId?: string) {
    // Pronađi SkolaHifza razred u nastavnoj godini
    const skolaHifzaRazred = await this.prisma.razred.findFirst({
      where: {
        ilmihal: 'SKOLA_HIFZA',
      },
    });

    if (!skolaHifzaRazred) {
      return [];
    }

    // Pronađi razred u nastavnoj godini
    const razredNastavnaGodina = await this.prisma.razredNastavnaGodina.findFirst({
      where: {
        nastavnaGodinaId,
        razredId: skolaHifzaRazred.id,
        ...(muallimId && { muallimId }),
      },
      include: {
        grupe: {
          include: {
            ucenici: {
              include: {
                ucenik: {
                  include: {
                    korisnik: {
                      select: {
                        id: true,
                        ime: true,
                        prezime: true,
                        fotografija: true,
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

    if (!razredNastavnaGodina) {
      return [];
    }

    // Prikupi sve učenike iz grupa
    const ucenici: any[] = [];
    const seenUcenikIds = new Set<string>();

    for (const grupa of razredNastavnaGodina.grupe) {
      for (const ucenikGrupa of grupa.ucenici) {
        if (!seenUcenikIds.has(ucenikGrupa.ucenik.id)) {
          seenUcenikIds.add(ucenikGrupa.ucenik.id);
          ucenici.push({
            id: ucenikGrupa.ucenik.id,
            ime: ucenikGrupa.ucenik.korisnik?.ime || null,
            prezime: ucenikGrupa.ucenik.korisnik?.prezime || null,
            godinaRodjenja: ucenikGrupa.ucenik.datumRodjenja
              ? new Date(ucenikGrupa.ucenik.datumRodjenja).getFullYear()
              : null,
          });
        }
      }
    }

    return ucenici;
  }

  /**
   * Dohvati napredak učenika u Školi Hifza
   */
  async getNapredak(skolaHifzaId: string, ucenikId: string) {
    const skolaHifzaUcenik = await this.prisma.skolaHifzaUcenik.findUnique({
      where: {
        skolaHifzaId_ucenikId: {
          skolaHifzaId,
          ucenikId,
        },
      },
    });

    if (!skolaHifzaUcenik) {
      // Ako ne postoji zapis, vrati prazan napredak
      return {
        id: null,
        ucenikId,
        napredak: null,
      };
    }

    return {
      id: skolaHifzaUcenik.id,
      ucenikId: skolaHifzaUcenik.ucenikId,
      napredak: skolaHifzaUcenik.napredak as { [suraName: string]: number[] } | null,
    };
  }

  /**
   * Ažuriraj ili kreiraj napredak učenika u Školi Hifza
   */
  async updateNapredak(
    skolaHifzaId: string,
    ucenikId: string,
    muallimId: string,
    napredak: { [suraName: string]: number[] },
  ) {
    // Provjeri da li SkolaHifza postoji
    const skolaHifza = await this.prisma.skolaHifza.findUnique({
      where: { id: skolaHifzaId },
    });

    if (!skolaHifza) {
      throw new NotFoundException(`Škola Hifza sa ID ${skolaHifzaId} nije pronađena`);
    }

    // Provjeri da li učenik postoji
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id: ucenikId },
    });

    if (!ucenik) {
      throw new NotFoundException(`Učenik sa ID ${ucenikId} nije pronađen`);
    }

    // Provjeri da li muallim postoji
    const muallim = await this.prisma.ucenik.findUnique({
      where: { id: muallimId },
    });

    if (!muallim) {
      throw new NotFoundException(`Muallim sa ID ${muallimId} nije pronađen`);
    }

    // Ažuriraj ili kreiraj SkolaHifzaUcenik zapis
    const skolaHifzaUcenik = await this.prisma.skolaHifzaUcenik.upsert({
      where: {
        skolaHifzaId_ucenikId: {
          skolaHifzaId,
          ucenikId,
        },
      },
      update: {
        napredak: napredak as any,
        muallimId,
      },
      create: {
        skolaHifzaId,
        ucenikId,
        muallimId,
        napredak: napredak as any,
      },
    });

    return {
      id: skolaHifzaUcenik.id,
      ucenikId: skolaHifzaUcenik.ucenikId,
      napredak: skolaHifzaUcenik.napredak as { [suraName: string]: number[] } | null,
    };
  }

  /**
   * Kreiraj novi SkolaHifzaCas
   */
  async createCas(
    skolaHifzaId: string,
    slotId: string,
    datum: string,
    napomena?: string,
    napredak?: { [studentId: string]: { [suraName: string]: number[] } },
    komentari?: { [studentId: string]: { [suraName: string]: string } },
    prisutni?: Array<{ ucenikId: string; status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN' }>,
  ) {
    // Provjeri da li SkolaHifza postoji
    const skolaHifza = await this.prisma.skolaHifza.findUnique({
      where: { id: skolaHifzaId },
    });

    if (!skolaHifza) {
      throw new NotFoundException(`Škola Hifza sa ID ${skolaHifzaId} nije pronađena`);
    }

    // Provjeri da li regularni Raspored postoji
    const raspored = await this.prisma.raspored.findUnique({
      where: { id: slotId },
    });

    if (!raspored) {
      throw new NotFoundException(`Raspored sa ID ${slotId} nije pronađen`);
    }

    // Parsiraj datum
    const datumObj = new Date(datum);

    // Kreiraj cas
    const cas = await this.prisma.skolaHifzaCas.create({
      data: {
        skolaHifzaId,
        slotId,
        datum: datumObj,
        napomena: napomena || null,
        napredak: napredak ? (napredak as any) : null,
        komentari: komentari ? (komentari as any) : null,
      },
    });

    // Kreiraj prisustva
    if (prisutni && prisutni.length > 0) {
      await Promise.all(
        prisutni.map((p) =>
          this.prisma.skolaHifzaPrisustvo.create({
            data: {
              casId: cas.id,
              ucenikId: p.ucenikId,
              status: p.status,
            },
          }),
        ),
      );
    }

    // Ažuriraj napredak za sve učenike
    if (napredak) {
      await Promise.all(
        Object.entries(napredak).map(async ([studentId, studentNapredak]) => {
          // Pronađi muallim ID iz SkolaHifzaUcenik ili kreiraj novi zapis
          const existingUcenik = await this.prisma.skolaHifzaUcenik.findUnique({
            where: {
              skolaHifzaId_ucenikId: {
                skolaHifzaId,
                ucenikId: studentId,
              },
            },
          });

          if (existingUcenik) {
            // Ažuriraj postojeći napredak - kombinuj sa novim
            const currentNapredak = (existingUcenik.napredak as { [suraName: string]: number[] }) || {};
            const updatedNapredak: { [suraName: string]: number[] } = { ...currentNapredak };

            Object.entries(studentNapredak).forEach(([sura, ajeta]) => {
              const existingAjeta = updatedNapredak[sura] || [];
              const allAjeta = Array.from(new Set([...existingAjeta, ...ajeta])).sort((a, b) => a - b);
              updatedNapredak[sura] = allAjeta;
            });

            await this.prisma.skolaHifzaUcenik.update({
              where: { id: existingUcenik.id },
              data: { napredak: updatedNapredak as any },
            });
          }
        }),
      );
    }

    return cas;
  }

  /**
   * Ažuriraj postojeći SkolaHifzaCas
   */
  async updateCas(
    casId: string,
    napomena?: string,
    napredak?: { [studentId: string]: { [suraName: string]: number[] } },
    komentari?: { [studentId: string]: { [suraName: string]: string } },
    prisutni?: Array<{ ucenikId: string; status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN' }>,
  ) {
    const cas = await this.prisma.skolaHifzaCas.findUnique({
      where: { id: casId },
      include: { prisustva: true },
    });

    if (!cas) {
      throw new NotFoundException(`Čas sa ID ${casId} nije pronađen`);
    }

    // Ažuriraj cas
    const updateData: any = {};
    if (napomena !== undefined) updateData.napomena = napomena || null;
    if (napredak !== undefined) updateData.napredak = napredak ? (napredak as any) : null;
    if (komentari !== undefined) updateData.komentari = komentari ? (komentari as any) : null;

    await this.prisma.skolaHifzaCas.update({
      where: { id: casId },
      data: updateData,
    });

    // Ažuriraj prisustva
    if (prisutni) {
      // Obriši postojeća prisustva
      await this.prisma.skolaHifzaPrisustvo.deleteMany({
        where: { casId },
      });

      // Kreiraj nova prisustva
      if (prisutni.length > 0) {
        await Promise.all(
          prisutni.map((p) =>
            this.prisma.skolaHifzaPrisustvo.create({
              data: {
                casId,
                ucenikId: p.ucenikId,
                status: p.status,
              },
            }),
          ),
        );
      }
    }

    // Ažuriraj napredak za sve učenike
    if (napredak) {
      await Promise.all(
        Object.entries(napredak).map(async ([studentId, studentNapredak]) => {
          const existingUcenik = await this.prisma.skolaHifzaUcenik.findUnique({
            where: {
              skolaHifzaId_ucenikId: {
                skolaHifzaId: cas.skolaHifzaId,
                ucenikId: studentId,
              },
            },
          });

          if (existingUcenik) {
            const currentNapredak = (existingUcenik.napredak as { [suraName: string]: number[] }) || {};
            const updatedNapredak: { [suraName: string]: number[] } = { ...currentNapredak };

            Object.entries(studentNapredak).forEach(([sura, ajeta]) => {
              const existingAjeta = updatedNapredak[sura] || [];
              const allAjeta = Array.from(new Set([...existingAjeta, ...ajeta])).sort((a, b) => a - b);
              updatedNapredak[sura] = allAjeta;
            });

            await this.prisma.skolaHifzaUcenik.update({
              where: { id: existingUcenik.id },
              data: { napredak: updatedNapredak as any },
            });
          }
        }),
      );
    }

    return this.prisma.skolaHifzaCas.findUnique({
      where: { id: casId },
      include: { prisustva: true },
    });
  }

  /**
   * Pronađi SkolaHifzaCas po slotId i datumu
   */
  async findCasBySlotAndDate(slotId: string, datum: string | Date) {
    const datumObj = typeof datum === 'string' ? new Date(datum) : datum;
    const startOfDay = new Date(datumObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(datumObj);
    endOfDay.setHours(23, 59, 59, 999);

    const cas = await this.prisma.skolaHifzaCas.findFirst({
      where: {
        slotId,
        datum: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        prisustva: {
          include: {
            ucenik: {
              include: {
                korisnik: {
                  select: {
                    id: true,
                    ime: true,
                    prezime: true,
                  },
                },
              },
            },
          },
        },
        slot: true,
      },
    });

    return cas;
  }

  /**
   * Dohvati SkolaHifzaCas po ID-u
   */
  async getCas(casId: string) {
    const cas = await this.prisma.skolaHifzaCas.findUnique({
      where: { id: casId },
      include: {
        prisustva: {
          include: {
            ucenik: {
              include: {
                korisnik: {
                  select: {
                    id: true,
                    ime: true,
                    prezime: true,
                  },
                },
              },
            },
          },
        },
        slot: true,
      },
    });

    if (!cas) {
      throw new NotFoundException(`Čas sa ID ${casId} nije pronađen`);
    }

    return cas;
  }

}
