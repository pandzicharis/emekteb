import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipLekcije, Ilmihal } from '@prisma/client';

type PayloadLekcije = {
  SUFARA: string[] | null;
  KURAN: string[] | null;
  ILMIHAL: Array<{
    id?: string;
    naslov: string;
    opis: string;
    tezina: number;
    redoslijed: number;
    aktivan: boolean;
    tip?: 'ILMIHAL';
  }>;
  SKOLA_HIFZA?: string[] | null;
};

type CreateNastavniPlanPayload = {
  id?: string;
  nastavniPlan: {
    naziv: string;
    opis: string;
    datumUsvajanja: string;
    aktivan: boolean;
  };
  razredi: string[];
  lekcije: Record<string, PayloadLekcije>;
};

@Injectable()
export class NastavniPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async save(payload: CreateNastavniPlanPayload) {
    const { nastavniPlan, razredi, lekcije, id } = payload;

    return this.prisma.$transaction(async (tx) => {
      // Pronađi razred "Škola Hifza" i automatski ga dodaj ako nije već u listi
      const skolaHifzaRazred = await tx.razred.findFirst({
        where: {
          ilmihal: Ilmihal.SKOLA_HIFZA,
        },
      });

      let finalRazredi = [...razredi];
      let finalLekcije = { ...lekcije };

      // Ako postoji razred "Škola Hifza", automatski ga dodaj ako nije već u listi
      if (skolaHifzaRazred) {
        const razredJeUListi = finalRazredi.includes(skolaHifzaRazred.id);
        
        if (!razredJeUListi) {
          finalRazredi.push(skolaHifzaRazred.id);
        }

        // Pronađi sve lekcije tipa SKOLA_HIFZA
        const skolaHifzaLekcije = await tx.lekcija.findMany({
          where: {
            tip: TipLekcije.SKOLA_HIFZA,
            aktivan: true,
          },
          orderBy: {
            redoslijed: 'asc',
          },
        });

        // Automatski dodaj lekcije škole hifza ako već nisu dodate u payload-u
        if (skolaHifzaLekcije.length > 0) {
          const skolaHifzaLekcijeIds = skolaHifzaLekcije.map((l) => l.id);
          const existingLekcije = finalLekcije[skolaHifzaRazred.id] || {};
          
          // Ako korisnik već nije dodao SKOLA_HIFZA lekcije, automatski ih dodaj
          if (!existingLekcije.SKOLA_HIFZA || existingLekcije.SKOLA_HIFZA.length === 0) {
            finalLekcije[skolaHifzaRazred.id] = {
              ...existingLekcije,
              SKOLA_HIFZA: skolaHifzaLekcijeIds,
            };
          }
        }
      }
      let planId = id;

      if (planId) {
        const existing = await tx.nastavniPlan.findUnique({ where: { id: planId } });
        if (!existing) {
          throw new Error('Nastavni plan ne postoji');
        }
        await tx.nastavniPlan.update({
          where: { id: planId },
          data: {
            naziv: nastavniPlan.naziv,
            opis: nastavniPlan.opis,
            datumUsvajanja: new Date(nastavniPlan.datumUsvajanja),
            aktivan: nastavniPlan.aktivan ?? true,
          },
        });
        const oldRazredi = await tx.nastavniPlanRazred.findMany({
          where: { nastavniPlanId: planId },
          select: { id: true },
        });
        const oldIds = oldRazredi.map((r) => r.id);
        if (oldIds.length > 0) {
          await tx.nastavniPlanRazredLekcija.deleteMany({
            where: { nastavniPlanRazredId: { in: oldIds } },
          });
        }
        await tx.nastavniPlanRazred.deleteMany({ where: { nastavniPlanId: planId } });
      } else {
        const plan = await tx.nastavniPlan.create({
          data: {
            naziv: nastavniPlan.naziv,
            opis: nastavniPlan.opis,
            datumUsvajanja: new Date(nastavniPlan.datumUsvajanja),
            aktivan: nastavniPlan.aktivan ?? true,
          },
        });
        planId = plan.id;
      }

      for (const razredId of finalRazredi) {
        const npRazred = await tx.nastavniPlanRazred.create({
          data: {
            nastavniPlanId: planId,
            razredId,
          },
        });

        const lekcijeForRazred = finalLekcije?.[razredId];
        if (!lekcijeForRazred) continue;

        const { SUFARA, KURAN, ILMIHAL, SKOLA_HIFZA } = lekcijeForRazred;

        // Poveži postojeće lekcije (KURAN/SUFARA/SKOLA_HIFZA) sa nastavnim planom
        const existingIds = [...(SUFARA ?? []), ...(KURAN ?? []), ...(SKOLA_HIFZA ?? [])];
        for (const lekcijaId of existingIds) {
          // Veza na razred (RazredLekcija) – osiguraj da je lekcija povezana sa ovim razredom
          await tx.razredLekcija.upsert({
            where: {
              razredId_lekcijaId: {
                razredId,
                lekcijaId,
              },
            },
            update: {},
            create: {
              razredId,
              lekcijaId,
            },
          });

          // Veza na nastavni plan / razred
          await tx.nastavniPlanRazredLekcija.upsert({
            where: {
              nastavniPlanRazredId_lekcijaId: {
                nastavniPlanRazredId: npRazred.id,
                lekcijaId,
              },
            },
            update: {},
            create: {
              nastavniPlanRazredId: npRazred.id,
              lekcijaId,
            },
          });
        }

        // Kreiraj/azuriraj i poveži ILMIHAL lekcije
        // - Ako lekcija ima stvarni ID iz baze: azuriramo postojeću lekciju i samo ponovo vežemo relacije
        // - Ako je ID privremeni sa frontenda (npr. "lekcija-...") ili ne postoji: kreiramo novu lekciju i vežemo je
        if (ILMIHAL && ILMIHAL.length > 0) {
          for (const lek of ILMIHAL) {
            let lekcijaId: string;

            const hasRealId = lek.id && !lek.id.startsWith('lekcija-');

            if (hasRealId) {
              // Postojeća ILMIHAL lekcija – azuriraj osnovne podatke
              const updated = await tx.lekcija.update({
                where: { id: lek.id as string },
                data: {
                  naslov: lek.naslov ?? '',
                  opis: lek.opis ?? '',
                  tezina: lek.tezina ?? 1,
                  redoslijed: lek.redoslijed ?? 0,
                  aktivan: lek.aktivan ?? true,
                  tip: TipLekcije.ILMIHAL,
                },
              });
              lekcijaId = updated.id;
            } else {
              // Nova ILMIHAL lekcija – kreiraj zapis (ignoriramo privremeni frontend ID)
              const created = await tx.lekcija.create({
                data: {
                  naslov: lek.naslov ?? '',
                  opis: lek.opis ?? '',
                  tezina: lek.tezina ?? 1,
                  redoslijed: lek.redoslijed ?? 0,
                  aktivan: lek.aktivan ?? true,
                  tip: TipLekcije.ILMIHAL,
                },
              });
              lekcijaId = created.id;
            }

            // Veza na razred (RazredLekcija)
            await tx.razredLekcija.upsert({
              where: {
                razredId_lekcijaId: {
                  razredId,
                  lekcijaId,
                },
              },
              update: {},
              create: {
                razredId,
                lekcijaId,
              },
            });

            // Veza na nastavni plan / razred
            await tx.nastavniPlanRazredLekcija.upsert({
              where: {
                nastavniPlanRazredId_lekcijaId: {
                  nastavniPlanRazredId: npRazred.id,
                  lekcijaId,
                },
              },
              update: {},
              create: {
                nastavniPlanRazredId: npRazred.id,
                lekcijaId,
              },
            });
          }
        }
      }

      return tx.nastavniPlan.findUnique({ where: { id: planId } });
    });
  }

  findAll() {
    return this.prisma.nastavniPlan.findMany({
      orderBy: { kreiran: 'desc' },
      include: {
        _count: {
          select: { razredi: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.nastavniPlan.findUnique({
      where: { id },
      include: {
        razredi: {
          include: {
            lekcije: {
              include: {
                lekcija: true,
              },
            },
          },
        },
      },
    });
    if (!plan) {
      throw new Error('Nastavni plan ne postoji');
    }

    const razrediIds = plan.razredi.map((r) => r.razredId);
    const lekcije: Record<string, PayloadLekcije> = {};

    for (const npR of plan.razredi) {
      const sufaraIds: string[] = [];
      const kuranIds: string[] = [];
      const skolaHifzaIds: string[] = [];
      const ilmihalLekcije: Array<PayloadLekcije['ILMIHAL'][number]> = [];

      for (const rl of npR.lekcije) {
        const l = rl.lekcija;
        if (l.tip === TipLekcije.SUFARA) {
          sufaraIds.push(l.id);
        } else if (l.tip === TipLekcije.KURAN) {
          kuranIds.push(l.id);
        } else if (l.tip === TipLekcije.SKOLA_HIFZA) {
          skolaHifzaIds.push(l.id);
        } else if (l.tip === TipLekcije.ILMIHAL) {
          ilmihalLekcije.push({
            id: l.id,
            naslov: l.naslov,
            opis: l.opis,
            tezina: l.tezina,
            redoslijed: l.redoslijed,
            aktivan: l.aktivan,
            tip: 'ILMIHAL',
          });
        }
      }

      lekcije[npR.razredId] = {
        SUFARA: sufaraIds.length > 0 ? sufaraIds : null,
        KURAN: kuranIds.length > 0 ? kuranIds : null,
        ILMIHAL: ilmihalLekcije,
        SKOLA_HIFZA: skolaHifzaIds.length > 0 ? skolaHifzaIds : null,
      };
    }

    return {
      nastavniPlan: {
        id: plan.id,
        naziv: plan.naziv,
        opis: plan.opis,
        datumUsvajanja: plan.datumUsvajanja.toISOString().slice(0, 10),
        aktivan: plan.aktivan,
      },
      razredi: razrediIds,
      lekcije,
    };
  }
}






