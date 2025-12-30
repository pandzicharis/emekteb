import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPrisustva, StatusUcenika, Spol } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    // Get active nastavna godina
    const aktivnaNastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { kreiran: 'desc' },
      include: {
        nastavniPlan: true,
      },
    });

    // Student Statistics
    const ukupnoUcenika = await this.prisma.ucenik.count();
    const aktivnihUcenika = await this.prisma.ucenik.count({
      where: { status: StatusUcenika.AKTIVAN },
    });
    const arhiviranihUcenika = await this.prisma.ucenik.count({
      where: { status: StatusUcenika.ARHIVIRAN },
    });

    const uceniciBySpol = await this.prisma.ucenik.groupBy({
      by: ['spol'],
      _count: true,
      where: {
        status: StatusUcenika.AKTIVAN,
      },
    });

    const muskiUcenici = uceniciBySpol.find((g) => g.spol === Spol.MUSKO)?._count || 0;
    const zenskiUcenici = uceniciBySpol.find((g) => g.spol === Spol.ZENSKO)?._count || 0;

    // Students by razred (active year)
    let uceniciByRazred: Array<{ razred: string; count: number }> = [];
    if (aktivnaNastavnaGodina) {
      const razrediNastavneGodine = await this.prisma.razredNastavnaGodina.findMany({
        where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        include: {
          razred: true,
          grupe: {
            include: {
              ucenici: true,
            },
          },
        },
      });

      const razredCountMap = new Map<string, number>();
      razrediNastavneGodine.forEach((rng) => {
        const razredName = rng.razred.name;
        const ucenikIds = new Set<string>();
        rng.grupe.forEach((grupa) => {
          grupa.ucenici.forEach((ug) => {
            ucenikIds.add(ug.ucenikId);
          });
        });
        razredCountMap.set(razredName, ucenikIds.size);
      });

      uceniciByRazred = Array.from(razredCountMap.entries()).map(([razred, count]) => ({
        razred,
        count,
      }));
    }

    // Teacher Statistics (Muallimi)
    const ukupnoMuallima = await this.prisma.korisnik.count({
      where: { uloga: 'MUALLIM' },
    });
    const aktivnihMuallima = await this.prisma.korisnik.count({
      where: { uloga: 'MUALLIM', aktivan: true },
    });

    // Teachers by razred
    let muallimiByRazred: Array<{ razred: string; count: number }> = [];
    if (aktivnaNastavnaGodina) {
      const razrediWithMuallimi = await this.prisma.razredNastavnaGodina.findMany({
        where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        include: {
          razred: true,
        },
      });

      const muallimCountMap = new Map<string, number>();
      razrediWithMuallimi.forEach((rng) => {
        const razredName = rng.razred.name;
        muallimCountMap.set(razredName, (muallimCountMap.get(razredName) || 0) + 1);
      });

      muallimiByRazred = Array.from(muallimCountMap.entries()).map(([razred, count]) => ({
        razred,
        count,
      }));
    }

    // Class/Group Statistics
    const ukupnoRazreda = await this.prisma.razred.count();
    const aktivnihRazreda = aktivnaNastavnaGodina
      ? await this.prisma.razredNastavnaGodina.count({
          where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        })
      : 0;

    const ukupnoGrupa = aktivnaNastavnaGodina
      ? await this.prisma.grupa.count({
          where: {
            razredNastavnaGodina: {
              nastavnaGodinaId: aktivnaNastavnaGodina.id,
            },
          },
        })
      : 0;

    // Groups by razred
    let grupeByRazred: Array<{ razred: string; count: number }> = [];
    if (aktivnaNastavnaGodina) {
      const razrediNastavneGodine = await this.prisma.razredNastavnaGodina.findMany({
        where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        include: {
          razred: true,
          grupe: true,
        },
      });

      grupeByRazred = razrediNastavneGodine.map((rng) => ({
        razred: rng.razred.name,
        count: rng.grupe.length,
      }));
    }

    // Razredi list with details
    let razrediList: Array<{ razred: string; grupe: number; ucenici: number }> = [];
    if (aktivnaNastavnaGodina) {
      const razrediNastavneGodine = await this.prisma.razredNastavnaGodina.findMany({
        where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        include: {
          razred: true,
          grupe: {
            include: {
              ucenici: true,
            },
          },
        },
      });

      razrediList = razrediNastavneGodine.map((rng) => {
        const ucenikIds = new Set<string>();
        rng.grupe.forEach((grupa) => {
          grupa.ucenici.forEach((ug) => {
            ucenikIds.add(ug.ucenikId);
          });
        });
        return {
          razred: rng.razred.name,
          grupe: rng.grupe.length,
          ucenici: ucenikIds.size,
        };
      });
    }

    // Lesson Statistics
    const ukupnoLekcija = await this.prisma.lekcija.count();
    const aktivnihLekcija = await this.prisma.lekcija.count({
      where: { aktivan: true },
    });

    const lekcijeByTip = await this.prisma.lekcija.groupBy({
      by: ['tip'],
      _count: true,
    });

    const lekcijeByTipFormatted = lekcijeByTip.map((g) => ({
      tip: g.tip,
      count: g._count,
    }));

    // Attendance Statistics
    const ukupnoCasova = aktivnaNastavnaGodina
      ? await this.prisma.cas.count({
          where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        })
      : 0;

    const prisustva = aktivnaNastavnaGodina
      ? await this.prisma.casPrisustvo.findMany({
          where: {
            cas: {
              nastavnaGodinaId: aktivnaNastavnaGodina.id,
            },
          },
        })
      : [];

    const ukupnoPrisustva = prisustva.length;
    const prisutni = prisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
    const opravdani = prisustva.filter((p) => p.status === StatusPrisustva.OPRAVDAN).length;
    const neopravdani = prisustva.filter((p) => p.status === StatusPrisustva.NEOPRAVDAN).length;
    const procenatPrisustva =
      ukupnoPrisustva > 0
        ? Math.round((prisutni / ukupnoPrisustva) * 100 * 100) / 100
        : 0;

    // Attendance by razred
    let prisustvoByRazred: Array<{ razred: string; procenat: number }> = [];
    if (aktivnaNastavnaGodina) {
      const razrediNastavneGodine = await this.prisma.razredNastavnaGodina.findMany({
        where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        include: {
          razred: true,
          cas: {
            include: {
              prisustva: true,
            },
          },
        },
      });

      prisustvoByRazred = razrediNastavneGodine.map((rng) => {
        const svaPrisustva = rng.cas.flatMap((c) => c.prisustva);
        const ukupno = svaPrisustva.length;
        const prisutniCount = svaPrisustva.filter(
          (p) => p.status === StatusPrisustva.PRISUTAN,
        ).length;
        const procenat = ukupno > 0 ? Math.round((prisutniCount / ukupno) * 100 * 100) / 100 : 0;
        return {
          razred: rng.razred.name,
          procenat,
        };
      });
    }

    // Monthly attendance trend (last 6 months)
    let monthlyTrend: Array<{ mjesec: string; prisutni: number; ukupno: number }> = [];
    if (aktivnaNastavnaGodina) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const casoviLast6Months = await this.prisma.cas.findMany({
        where: {
          nastavnaGodinaId: aktivnaNastavnaGodina.id,
          datum: {
            gte: sixMonthsAgo,
          },
        },
        include: {
          prisustva: true,
        },
      });

      const monthMap = new Map<string, { prisutni: number; ukupno: number; label: string }>();

      casoviLast6Months.forEach((cas) => {
        const monthKey = `${cas.datum.getFullYear()}-${String(cas.datum.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthMap.has(monthKey)) {
          const monthLabel = new Date(cas.datum.getFullYear(), cas.datum.getMonth(), 1).toLocaleDateString('bs-BA', {
            month: 'short',
            year: 'numeric',
          });
          monthMap.set(monthKey, { prisutni: 0, ukupno: 0, label: monthLabel });
        }

        const monthData = monthMap.get(monthKey);
        if (monthData) {
          monthData.ukupno += cas.prisustva.length;
          monthData.prisutni += cas.prisustva.filter(
            (p) => p.status === StatusPrisustva.PRISUTAN,
          ).length;
        }
      });

      monthlyTrend = Array.from(monthMap.entries())
        .map(([key, data]) => ({
          key,
          mjesec: data.label,
          prisutni: data.prisutni,
          ukupno: data.ukupno,
        }))
        .sort((a, b) => {
          // Sort by key (YYYY-MM format) which ensures proper chronological order
          return a.key.localeCompare(b.key);
        })
        .map(({ key, ...rest }) => rest); // Remove key from final output
    }

    // Grade Statistics
    const ocjene = aktivnaNastavnaGodina
      ? await this.prisma.casOcjena.findMany({
          where: {
            cas: {
              nastavnaGodinaId: aktivnaNastavnaGodina.id,
            },
          },
        })
      : [];

    const ukupnoOcjena = ocjene.length;
    const sumaOcjena = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjekOcjena = ukupnoOcjena > 0 ? Math.round((sumaOcjena / ukupnoOcjena) * 100) / 100 : 0;

    const ocjeneDistribucija = {
      '1': ocjene.filter((o) => o.ocjena === 1).length,
      '2': ocjene.filter((o) => o.ocjena === 2).length,
      '3': ocjene.filter((o) => o.ocjena === 3).length,
      '4': ocjene.filter((o) => o.ocjena === 4).length,
      '5': ocjene.filter((o) => o.ocjena === 5).length,
    };

    // Grades by razred
    let ocjeneByRazred: Array<{ razred: string; prosjek: number }> = [];
    if (aktivnaNastavnaGodina) {
      const razrediNastavneGodine = await this.prisma.razredNastavnaGodina.findMany({
        where: { nastavnaGodinaId: aktivnaNastavnaGodina.id },
        include: {
          razred: true,
          cas: {
            include: {
              ocjene: true,
            },
          },
        },
      });

      ocjeneByRazred = razrediNastavneGodine.map((rng) => {
        const sveOcjene = rng.cas.flatMap((c) => c.ocjene);
        const suma = sveOcjene.reduce((acc, o) => acc + o.ocjena, 0);
        const prosjek = sveOcjene.length > 0 ? Math.round((suma / sveOcjene.length) * 100) / 100 : 0;
        return {
          razred: rng.razred.name,
          prosjek,
        };
      });
    }

    // Import Statistics
    const imports = await this.prisma.import.findMany({
      orderBy: { kreiran: 'desc' },
    });

    const ukupnoImporta = imports.length;
    const uspjesniImporti = imports.filter((i) => i.status === 'USPJESAN').length;
    const neuspesniImporti = imports.filter((i) => i.status === 'NEUSPJESAN').length;

    const recentImports = imports.slice(0, 5).map((imp) => ({
      id: imp.id,
      nazivFajla: imp.nazivFajla,
      status: imp.status,
      ukupnoRedova: imp.ukupnoRedova,
      uspjesnoSacuvano: imp.uspjesnoSacuvano,
      novih: imp.novih,
      updateanih: imp.updateanih,
      gresaka: imp.gresaka,
      kreiran: imp.kreiran,
    }));

    // Nastavna Godina Statistics
    const ukupnoNastavnihGodina = await this.prisma.nastavnaGodina.count();

    return {
      overview: {
        ukupnoUcenika,
        aktivnihUcenika,
        ukupnoMuallima,
        aktivnihMuallima,
        ukupnoRazreda,
        aktivnihRazreda,
        ukupnoGrupa,
        ukupnoLekcija,
        ukupnoCasova,
        ukupnoPrisustva,
        ukupnoOcjena,
        prosjekOcjena,
        ukupnoImporta,
      },
      ucenici: {
        byStatus: {
          aktivni: aktivnihUcenika,
          arhivirani: arhiviranihUcenika,
        },
        bySpol: {
          muski: muskiUcenici,
          zenski: zenskiUcenici,
        },
        byRazred: uceniciByRazred,
      },
      muallimi: {
        aktivni: aktivnihMuallima,
        byRazred: muallimiByRazred,
      },
      razredi: {
        ukupno: ukupnoRazreda,
        aktivni: aktivnihRazreda,
        list: razrediList,
      },
      grupe: {
        ukupno: ukupnoGrupa,
        byRazred: grupeByRazred,
      },
      lekcije: {
        ukupno: ukupnoLekcija,
        aktivne: aktivnihLekcija,
        byTip: lekcijeByTipFormatted,
      },
      prisustvo: {
        ukupno: ukupnoPrisustva,
        prisutni,
        opravdani,
        neopravdani,
        procenatPrisustva,
        byRazred: prisustvoByRazred,
        monthlyTrend,
      },
      ocjene: {
        ukupno: ukupnoOcjena,
        prosjek: prosjekOcjena,
        distribucija: ocjeneDistribucija,
        byRazred: ocjeneByRazred,
      },
      imports: {
        ukupno: ukupnoImporta,
        uspjesni: uspjesniImporti,
        neuspesni: neuspesniImporti,
        recent: recentImports,
      },
      nastavnaGodina: {
        aktivna: aktivnaNastavnaGodina
          ? {
              id: aktivnaNastavnaGodina.id,
              naziv: aktivnaNastavnaGodina.naziv,
              opis: aktivnaNastavnaGodina.opis,
              datumOd: aktivnaNastavnaGodina.datumOd,
              datumDo: aktivnaNastavnaGodina.datumDo,
              status: aktivnaNastavnaGodina.status,
              nastavniPlan: {
                id: aktivnaNastavnaGodina.nastavniPlan.id,
                naziv: aktivnaNastavnaGodina.nastavniPlan.naziv,
              },
            }
          : null,
        ukupno: ukupnoNastavnihGodina,
      },
    };
  }
}

