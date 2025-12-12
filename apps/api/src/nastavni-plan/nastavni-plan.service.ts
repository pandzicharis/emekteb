import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipLekcije } from '@prisma/client';

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

      for (const razredId of razredi) {
        const npRazred = await tx.nastavniPlanRazred.create({
          data: {
            nastavniPlanId: planId,
            razredId,
          },
        });

        const lekcijeForRazred = lekcije?.[razredId];
        if (!lekcijeForRazred) continue;

        const { SUFARA, KURAN, ILMIHAL } = lekcijeForRazred;

        // Poveži postojeće lekcije (KURAN/SUFARA) sa nastavnim planom
        const existingIds = [...(SUFARA ?? []), ...(KURAN ?? [])];
        for (const lekcijaId of existingIds) {
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

        // Kreiraj i poveži ILMIHAL lekcije (ako ih korisnik unosi)
        if (ILMIHAL && ILMIHAL.length > 0) {
          for (const lek of ILMIHAL) {
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

            // Veza na razred (RazredLekcija)
            await tx.razredLekcija.upsert({
              where: {
                razredId_lekcijaId: {
                  razredId,
                  lekcijaId: created.id,
                },
              },
              update: {},
              create: {
                razredId,
                lekcijaId: created.id,
              },
            });

            // Veza na nastavni plan / razred
            await tx.nastavniPlanRazredLekcija.upsert({
              where: {
                nastavniPlanRazredId_lekcijaId: {
                  nastavniPlanRazredId: npRazred.id,
                  lekcijaId: created.id,
                },
              },
              update: {},
              create: {
                nastavniPlanRazredId: npRazred.id,
                lekcijaId: created.id,
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
      const ilmihalLekcije: Array<PayloadLekcije['ILMIHAL'][number]> = [];

      for (const rl of npR.lekcije) {
        const l = rl.lekcija;
        if (l.tip === TipLekcije.SUFARA) {
          sufaraIds.push(l.id);
        } else if (l.tip === TipLekcije.KURAN) {
          kuranIds.push(l.id);
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






