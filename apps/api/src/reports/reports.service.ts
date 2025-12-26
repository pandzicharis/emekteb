import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { GradeReportDto } from './dto/grade-report.dto';
import { StatisticsDto } from './dto/statistics.dto';
import { ReportOptionsDto } from './dto/report-options.dto';
import { StatusPrisustva } from '@prisma/client';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttendanceReport(filters: AttendanceReportDto) {
    // Get active nastavna godina if not specified
    let nastavnaGodinaId = filters.nastavnaGodinaId;
    if (!nastavnaGodinaId) {
      const active = await this.prisma.nastavnaGodina.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { kreiran: 'desc' },
      });
      nastavnaGodinaId = active?.id;
    }

    const casWhere: any = {};

    // Filter by razred/grupa through cas
    if (filters.razredNastavnaGodinaId) {
      casWhere.razredNastavnaGodinaId = filters.razredNastavnaGodinaId;
    }

    if (filters.grupaId) {
      casWhere.grupaId = filters.grupaId;
    }

    // Filter by date range
    if (filters.datumOd || filters.datumDo) {
      casWhere.datum = {};
      if (filters.datumOd) {
        const dateFrom = new Date(filters.datumOd);
        dateFrom.setHours(0, 0, 0, 0);
        casWhere.datum.gte = dateFrom;
      }
      if (filters.datumDo) {
        const dateTo = new Date(filters.datumDo);
        dateTo.setHours(23, 59, 59, 999);
        casWhere.datum.lte = dateTo;
      }
    }

    // Filter by nastavna godina (use default if not provided)
    if (nastavnaGodinaId) {
      casWhere.nastavnaGodinaId = nastavnaGodinaId;
    }

    const where: any = {
      ...(Object.keys(casWhere).length > 0 && { cas: casWhere }),
    };

    // Filter by ucenik
    if (filters.ucenikId) {
      where.ucenikId = filters.ucenikId;
    }

    const prisustva = await this.prisma.casPrisustvo.findMany({
      where,
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
        cas: {
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
            grupa: {
              select: {
                id: true,
                naziv: true,
              },
            },
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
          },
        },
      },
      orderBy: {
        cas: {
          datum: 'desc',
        },
      },
    });

    // Calculate statistics
    const total = prisustva.length;
    const prisutni = prisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
    const opravdani = prisustva.filter((p) => p.status === StatusPrisustva.OPRAVDAN).length;
    const neopravdani = prisustva.filter((p) => p.status === StatusPrisustva.NEOPRAVDAN).length;
    const procenatPrisustva = total > 0 ? Math.round((prisutni / total) * 100 * 100) / 100 : 0;

    // Group by student for summary view
    const summaryByStudent = new Map<string, {
      ucenikId: string;
      ime: string;
      prezime: string;
      total: number;
      prisutni: number;
      opravdani: number;
      neopravdani: number;
      procenatPrisustva: number;
    }>();

    prisustva.forEach((p) => {
      const ucenikId = p.ucenik.id;
      const ime = p.ucenik.korisnik?.ime || '';
      const prezime = p.ucenik.korisnik?.prezime || '';

      if (!summaryByStudent.has(ucenikId)) {
        summaryByStudent.set(ucenikId, {
          ucenikId,
          ime,
          prezime,
          total: 0,
          prisutni: 0,
          opravdani: 0,
          neopravdani: 0,
          procenatPrisustva: 0,
        });
      }

      const summary = summaryByStudent.get(ucenikId)!;
      summary.total++;
      if (p.status === StatusPrisustva.PRISUTAN) summary.prisutni++;
      else if (p.status === StatusPrisustva.OPRAVDAN) summary.opravdani++;
      else if (p.status === StatusPrisustva.NEOPRAVDAN) summary.neopravdani++;
    });

    // Calculate percentages for each student
    summaryByStudent.forEach((summary) => {
      summary.procenatPrisustva = summary.total > 0
        ? Math.round((summary.prisutni / summary.total) * 100 * 100) / 100
        : 0;
    });

    // Calculate comparison stats if ucenik is selected
    let comparisonStats: any = null;
    if (filters.ucenikId) {
      const studentSummary = summaryByStudent.get(filters.ucenikId);
      if (studentSummary) {
        // Get razred and grupa from first prisustvo
        const firstPrisustvo = prisustva.find((p) => p.ucenik.id === filters.ucenikId);
        const razredNastavnaGodinaId = firstPrisustvo?.cas.razredNastavnaGodinaId;
        const grupaId = firstPrisustvo?.cas.grupaId;

        // Calculate razred average
        let razredAverage = 0;
        let totalStudentsInRazred = 0;
        let razredRank = 0;

        if (razredNastavnaGodinaId) {
          // Get all prisustva for this razred
          const razredPrisustva = await this.prisma.casPrisustvo.findMany({
            where: {
              cas: {
                razredNastavnaGodinaId,
                ...(nastavnaGodinaId && { nastavnaGodinaId }),
                ...(filters.datumOd || filters.datumDo ? {
                  datum: {
                    ...(filters.datumOd ? { gte: new Date(filters.datumOd) } : {}),
                    ...(filters.datumDo ? { lte: new Date(filters.datumDo) } : {}),
                  },
                } : {}),
              },
            },
            include: {
              ucenik: true,
            },
          });

          // Group by student for razred
          const razredSummary = new Map<string, { total: number; prisutni: number }>();
          razredPrisustva.forEach((p) => {
            const ucenikId = p.ucenik.id;
            if (!razredSummary.has(ucenikId)) {
              razredSummary.set(ucenikId, { total: 0, prisutni: 0 });
            }
            const summary = razredSummary.get(ucenikId)!;
            summary.total++;
            if (p.status === StatusPrisustva.PRISUTAN) summary.prisutni++;
          });

          // Calculate average for razred
          const razredPercentages: number[] = [];
          razredSummary.forEach((summary) => {
            if (summary.total > 0) {
              razredPercentages.push((summary.prisutni / summary.total) * 100);
            }
          });

          if (razredPercentages.length > 0) {
            razredAverage = Math.round(
              (razredPercentages.reduce((a, b) => a + b, 0) / razredPercentages.length) * 100
            ) / 100;
            totalStudentsInRazred = razredPercentages.length;

            // Calculate rank (1 = best, higher number = worse)
            const studentPercentage = studentSummary.procenatPrisustva;
            razredRank = razredPercentages.filter((p) => p > studentPercentage).length + 1;
          }
        }

        // Calculate grupa average
        let grupaAverage = 0;
        let totalStudentsInGrupa = 0;
        let grupaRank = 0;

        if (grupaId) {
          // Get all prisustva for this grupa
          const grupaPrisustva = await this.prisma.casPrisustvo.findMany({
            where: {
              cas: {
                grupaId,
                ...(nastavnaGodinaId && { nastavnaGodinaId }),
                ...(filters.datumOd || filters.datumDo ? {
                  datum: {
                    ...(filters.datumOd ? { gte: new Date(filters.datumOd) } : {}),
                    ...(filters.datumDo ? { lte: new Date(filters.datumDo) } : {}),
                  },
                } : {}),
              },
            },
            include: {
              ucenik: true,
            },
          });

          // Group by student for grupa
          const grupaSummary = new Map<string, { total: number; prisutni: number }>();
          grupaPrisustva.forEach((p) => {
            const ucenikId = p.ucenik.id;
            if (!grupaSummary.has(ucenikId)) {
              grupaSummary.set(ucenikId, { total: 0, prisutni: 0 });
            }
            const summary = grupaSummary.get(ucenikId)!;
            summary.total++;
            if (p.status === StatusPrisustva.PRISUTAN) summary.prisutni++;
          });

          // Calculate average for grupa
          const grupaPercentages: number[] = [];
          grupaSummary.forEach((summary) => {
            if (summary.total > 0) {
              grupaPercentages.push((summary.prisutni / summary.total) * 100);
            }
          });

          if (grupaPercentages.length > 0) {
            grupaAverage = Math.round(
              (grupaPercentages.reduce((a, b) => a + b, 0) / grupaPercentages.length) * 100
            ) / 100;
            totalStudentsInGrupa = grupaPercentages.length;

            // Calculate rank
            const studentPercentage = studentSummary.procenatPrisustva;
            grupaRank = grupaPercentages.filter((p) => p > studentPercentage).length + 1;
          }
        }

        comparisonStats = {
          razredAverage,
          grupaAverage,
          razredRank,
          grupaRank,
          totalStudentsInRazred,
          totalStudentsInGrupa,
        };
      }
    }

    return {
      data: prisustva.map((p) => ({
        id: p.id,
        datum: p.cas.datum,
        ucenik: {
          id: p.ucenik.id,
          ime: p.ucenik.korisnik?.ime || '',
          prezime: p.ucenik.korisnik?.prezime || '',
        },
        status: p.status,
        napomena: p.napomena,
        razred: p.cas.razredNastavnaGodina?.razred?.name || '',
        grupa: p.cas.grupa?.naziv || '',
        lekcije: p.cas.lekcije.map((l) => ({
          id: l.lekcija.id,
          naslov: l.lekcija.naslov,
        })),
      })),
      statistics: {
        total,
        prisutni,
        opravdani,
        neopravdani,
        procenatPrisustva,
      },
      summaryByStudent: Array.from(summaryByStudent.values()).sort((a, b) => {
        // Sort by prezime, then ime
        const prezimeCompare = a.prezime.localeCompare(b.prezime);
        if (prezimeCompare !== 0) return prezimeCompare;
        return a.ime.localeCompare(b.ime);
      }),
      comparisonStats,
    };
  }

  async getGradeReport(filters: GradeReportDto) {
    const casWhere: any = {};

    // Filter by razred/grupa through cas
    if (filters.razredNastavnaGodinaId) {
      casWhere.razredNastavnaGodinaId = filters.razredNastavnaGodinaId;
    }

    if (filters.grupaId) {
      casWhere.grupaId = filters.grupaId;
    }

    // Filter by date range
    if (filters.datumOd || filters.datumDo) {
      casWhere.datum = {};
      if (filters.datumOd) {
        const dateFrom = new Date(filters.datumOd);
        dateFrom.setHours(0, 0, 0, 0);
        casWhere.datum.gte = dateFrom;
      }
      if (filters.datumDo) {
        const dateTo = new Date(filters.datumDo);
        dateTo.setHours(23, 59, 59, 999);
        casWhere.datum.lte = dateTo;
      }
    }

    // Filter by nastavna godina
    if (filters.nastavnaGodinaId) {
      casWhere.nastavnaGodinaId = filters.nastavnaGodinaId;
    }

    const where: any = {
      ...(Object.keys(casWhere).length > 0 && { cas: casWhere }),
    };

    // Filter by ucenik
    if (filters.ucenikId) {
      where.ucenikId = filters.ucenikId;
    }

    // Filter by lekcija
    if (filters.lekcijaId) {
      where.lekcijaId = filters.lekcijaId;
    }

    const ocjene = await this.prisma.casOcjena.findMany({
      where,
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
        lekcija: {
          select: {
            id: true,
            naslov: true,
            tip: true,
          },
        },
        cas: {
          include: {
            razredNastavnaGodina: {
              include: {
                razred: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            grupa: {
              select: {
                id: true,
                naziv: true,
              },
            },
          },
        },
      },
      orderBy: {
        cas: {
          datum: 'desc',
        },
      },
    });

    // Calculate statistics
    const total = ocjene.length;
    const suma = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjek = total > 0 ? Math.round((suma / total) * 100) / 100 : 0;

    // Grade distribution
    const distribucija: Record<number, number> = {};
    ocjene.forEach((o) => {
      distribucija[o.ocjena] = (distribucija[o.ocjena] || 0) + 1;
    });

    // Calculate comparison stats if ucenik is selected
    let comparisonStats: any = null;
    if (filters.ucenikId) {
      const studentOcjene = ocjene.filter((o) => o.ucenik.id === filters.ucenikId);
      if (studentOcjene.length > 0) {
        const studentProsjek = studentOcjene.length > 0
          ? Math.round((studentOcjene.reduce((acc, o) => acc + o.ocjena, 0) / studentOcjene.length) * 100) / 100
          : 0;

        // Get razred and grupa from first ocjena
        const firstOcjena = studentOcjene[0];
        const razredNastavnaGodinaId = firstOcjena.cas.razredNastavnaGodinaId;
        const grupaId = firstOcjena.cas.grupaId;
        const nastavnaGodinaId = firstOcjena.cas.nastavnaGodinaId;

        // Calculate razred average and distribution
        let razredAverage = 0;
        let razredRank = 0;
        let razredDistribution: Record<number, number> = {};
        let totalStudentsInRazred = 0;

        if (razredNastavnaGodinaId) {
          // Get all ocjene for this razred
          const razredOcjene = await this.prisma.casOcjena.findMany({
            where: {
              cas: {
                razredNastavnaGodinaId,
                ...(nastavnaGodinaId && { nastavnaGodinaId }),
                ...(filters.datumOd || filters.datumDo ? {
                  datum: {
                    ...(filters.datumOd ? { gte: new Date(filters.datumOd) } : {}),
                    ...(filters.datumDo ? { lte: new Date(filters.datumDo) } : {}),
                  },
                } : {}),
              },
            },
            include: {
              ucenik: true,
            },
          });

          // Group by student for razred
          const razredSummary = new Map<string, number[]>();
          razredOcjene.forEach((o) => {
            const ucenikId = o.ucenik.id;
            if (!razredSummary.has(ucenikId)) {
              razredSummary.set(ucenikId, []);
            }
            razredSummary.get(ucenikId)!.push(o.ocjena);
          });

          // Calculate average for razred
          const razredAverages: number[] = [];
          razredSummary.forEach((ocjene) => {
            if (ocjene.length > 0) {
              const avg = ocjene.reduce((a, b) => a + b, 0) / ocjene.length;
              razredAverages.push(avg);
            }
          });

          if (razredAverages.length > 0) {
            razredAverage = Math.round(
              (razredAverages.reduce((a, b) => a + b, 0) / razredAverages.length) * 100
            ) / 100;
            totalStudentsInRazred = razredAverages.length;

            // Calculate rank
            razredRank = razredAverages.filter((a) => a > studentProsjek).length + 1;
          }

          // Calculate distribution for razred
          razredOcjene.forEach((o) => {
            razredDistribution[o.ocjena] = (razredDistribution[o.ocjena] || 0) + 1;
          });
        }

        // Calculate grupa average and distribution
        let grupaAverage = 0;
        let grupaRank = 0;
        let grupaDistribution: Record<number, number> = {};
        let totalStudentsInGrupa = 0;

        if (grupaId) {
          // Get all ocjene for this grupa
          const grupaOcjene = await this.prisma.casOcjena.findMany({
            where: {
              cas: {
                grupaId,
                ...(nastavnaGodinaId && { nastavnaGodinaId }),
                ...(filters.datumOd || filters.datumDo ? {
                  datum: {
                    ...(filters.datumOd ? { gte: new Date(filters.datumOd) } : {}),
                    ...(filters.datumDo ? { lte: new Date(filters.datumDo) } : {}),
                  },
                } : {}),
              },
            },
            include: {
              ucenik: true,
            },
          });

          // Group by student for grupa
          const grupaSummary = new Map<string, number[]>();
          grupaOcjene.forEach((o) => {
            const ucenikId = o.ucenik.id;
            if (!grupaSummary.has(ucenikId)) {
              grupaSummary.set(ucenikId, []);
            }
            grupaSummary.get(ucenikId)!.push(o.ocjena);
          });

          // Calculate average for grupa
          const grupaAverages: number[] = [];
          grupaSummary.forEach((ocjene) => {
            if (ocjene.length > 0) {
              const avg = ocjene.reduce((a, b) => a + b, 0) / ocjene.length;
              grupaAverages.push(avg);
            }
          });

          if (grupaAverages.length > 0) {
            grupaAverage = Math.round(
              (grupaAverages.reduce((a, b) => a + b, 0) / grupaAverages.length) * 100
            ) / 100;
            totalStudentsInGrupa = grupaAverages.length;

            // Calculate rank
            grupaRank = grupaAverages.filter((a) => a > studentProsjek).length + 1;
          }

          // Calculate distribution for grupa
          grupaOcjene.forEach((o) => {
            grupaDistribution[o.ocjena] = (grupaDistribution[o.ocjena] || 0) + 1;
          });
        }

        comparisonStats = {
          razredAverage,
          grupaAverage,
          razredRank,
          grupaRank,
          razredDistribution,
          grupaDistribution,
          totalStudentsInRazred,
          totalStudentsInGrupa,
        };
      }
    }

    return {
      data: ocjene.map((o) => ({
        id: o.id,
        datum: o.cas.datum,
        ucenik: {
          id: o.ucenik.id,
          ime: o.ucenik.korisnik?.ime || '',
          prezime: o.ucenik.korisnik?.prezime || '',
        },
        lekcija: {
          id: o.lekcija.id,
          naslov: o.lekcija.naslov,
          tip: o.lekcija.tip,
        },
        ocjena: o.ocjena,
        komentar: o.komentar,
        razred: o.cas.razredNastavnaGodina?.razred?.name || '',
        grupa: o.cas.grupa?.naziv || '',
      })),
      statistics: {
        total,
        prosjek,
        distribucija,
      },
      comparisonStats,
    };
  }

  async getStatistics(filters: StatisticsDto) {
    // Get active nastavna godina if not specified
    let nastavnaGodinaId = filters.nastavnaGodinaId;
    if (!nastavnaGodinaId) {
      const active = await this.prisma.nastavnaGodina.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { kreiran: 'desc' },
      });
      nastavnaGodinaId = active?.id;
    }

    if (!nastavnaGodinaId) {
      throw new BadRequestException('Nastavna godina nije pronađena');
    }

    const where: any = {
      nastavnaGodinaId,
    };

    if (filters.razredNastavnaGodinaId) {
      where.razredNastavnaGodinaId = filters.razredNastavnaGodinaId;
    }

    if (filters.grupaId) {
      where.grupaId = filters.grupaId;
    }

    // Get total students
    const ucenici = await this.prisma.ucenikGrupa.findMany({
      where: {
        grupa: {
          razredNastavnaGodina: {
            nastavnaGodinaId,
            ...(filters.razredNastavnaGodinaId && {
              id: filters.razredNastavnaGodinaId,
            }),
          },
          ...(filters.grupaId && { id: filters.grupaId }),
        },
      },
      select: {
        ucenikId: true,
      },
      distinct: ['ucenikId'],
    });

    const ukupnoUcenika = ucenici.length;

    // Get total casovi
    const ukupnoCasova = await this.prisma.cas.count({
      where,
    });

    // Get attendance statistics
    const prisustva = await this.prisma.casPrisustvo.findMany({
      where: {
        cas: where,
      },
    });

    const ukupnoPrisustva = prisustva.length;
    const prisutni = prisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
    const procenatPrisustva =
      ukupnoPrisustva > 0 ? Math.round((prisutni / ukupnoPrisustva) * 100 * 100) / 100 : 0;

    // Get grade statistics
    const ocjene = await this.prisma.casOcjena.findMany({
      where: {
        cas: where,
      },
    });

    const ukupnoOcjena = ocjene.length;
    const sumaOcjena = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjekOcjena = ukupnoOcjena > 0 ? Math.round((sumaOcjena / ukupnoOcjena) * 100) / 100 : 0;

    // Get total muallimi
    const muallimi = await this.prisma.razredNastavnaGodina.findMany({
      where: {
        nastavnaGodinaId,
        ...(filters.razredNastavnaGodinaId && { id: filters.razredNastavnaGodinaId }),
      },
      select: {
        muallimId: true,
      },
      distinct: ['muallimId'],
    });

    const ukupnoMuallima = muallimi.length;

    // Statistics by razred
    const razredi = await this.prisma.razredNastavnaGodina.findMany({
      where: {
        nastavnaGodinaId,
      },
      include: {
        razred: {
          select: {
            id: true,
            name: true,
            ilmihal: true,
          },
        },
        grupe: {
          include: {
            ucenici: {
              select: {
                ucenikId: true,
              },
            },
          },
        },
      },
    });

    const statistikePoRazredu = razredi.map((r) => {
      const uceniciURazredu = new Set(
        r.grupe.flatMap((g) => g.ucenici.map((u) => u.ucenikId)),
      ).size;

      return {
        razredId: r.razred.id,
        razredNaziv: r.razred.name,
        ilmihal: r.razred.ilmihal,
        brojUcenika: uceniciURazredu,
      };
    });

    return {
      opste: {
        ukupnoUcenika,
        ukupnoMuallima,
        ukupnoCasova,
        procenatPrisustva,
        prosjekOcjena,
        ukupnoOcjena,
      },
      statistikePoRazredu,
    };
  }

  async getReportOptions(filters: ReportOptionsDto) {
    // Get all nastavne godine
    const nastavneGodine = await this.prisma.nastavnaGodina.findMany({
      orderBy: { kreiran: 'desc' },
      select: {
        id: true,
        naziv: true,
        status: true,
      },
    });

    // Mark active one
    const activeNastavnaGodina = nastavneGodine.find((ng) => ng.status === 'ACTIVE');
    const nastavneGodineWithActive = nastavneGodine.map((ng) => ({
      ...ng,
      aktivan: ng.status === 'ACTIVE',
    }));

    // Get razredi - filtered by nastavnaGodinaId if provided
    const razrediWhere: any = {};
    if (filters.nastavnaGodinaId) {
      razrediWhere.nastavnaGodinaId = filters.nastavnaGodinaId;
    } else if (activeNastavnaGodina) {
      // If no filter, use active nastavna godina
      razrediWhere.nastavnaGodinaId = activeNastavnaGodina.id;
    }

    const razredi = await this.prisma.razredNastavnaGodina.findMany({
      where: razrediWhere,
      include: {
        razred: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        razred: {
          name: 'asc',
        },
      },
    });

    // Get grupe - filtered by razredNastavnaGodinaId if provided
    const grupeWhere: any = {};
    if (filters.razredNastavnaGodinaId) {
      grupeWhere.razredNastavnaGodinaId = filters.razredNastavnaGodinaId;
    } else if (filters.nastavnaGodinaId || activeNastavnaGodina) {
      // If razred not specified but nastavna godina is, get all grupe from that year
      const nastavnaGodinaId = filters.nastavnaGodinaId || activeNastavnaGodina?.id;
      if (nastavnaGodinaId) {
        grupeWhere.razredNastavnaGodina = {
          nastavnaGodinaId,
        };
      }
    }

    const grupe = await this.prisma.grupa.findMany({
      where: grupeWhere,
      select: {
        id: true,
        naziv: true,
      },
      orderBy: {
        naziv: 'asc',
      },
    });

    // Get ucenici - filtered by grupaId, razredNastavnaGodinaId, or nastavnaGodinaId
    let ucenici: Array<{ id: string; ime: string; prezime: string }> = [];

    // Build where clause for ucenik search
    const ucenikWhere: any = {};
    if (filters.ime) {
      ucenikWhere.korisnik = {
        ...ucenikWhere.korisnik,
        ime: { contains: filters.ime, mode: 'insensitive' },
      };
    }
    if (filters.prezime) {
      ucenikWhere.korisnik = {
        ...ucenikWhere.korisnik,
        prezime: { contains: filters.prezime, mode: 'insensitive' },
      };
    }

    if (filters.grupaId) {
      // Get ucenici from specific grupa
      const ucenikGrupe = await this.prisma.ucenikGrupa.findMany({
        where: {
          grupaId: filters.grupaId,
          ...(Object.keys(ucenikWhere).length > 0 && {
            ucenik: ucenikWhere,
          }),
        },
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
      });

      ucenici = ucenikGrupe.map((ug) => ({
        id: ug.ucenik.id,
        ime: ug.ucenik.korisnik?.ime || '',
        prezime: ug.ucenik.korisnik?.prezime || '',
      }));
    } else if (filters.razredNastavnaGodinaId) {
      // Get all ucenici from razred (all grupe in that razred)
      const grupeURazredu = await this.prisma.grupa.findMany({
        where: {
          razredNastavnaGodinaId: filters.razredNastavnaGodinaId,
        },
        include: {
          ucenici: {
            where: Object.keys(ucenikWhere).length > 0 ? { ucenik: ucenikWhere } : undefined,
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

      const ucenikSet = new Set<string>();
      grupeURazredu.forEach((grupa) => {
        grupa.ucenici.forEach((ug) => {
          if (!ucenikSet.has(ug.ucenik.id)) {
            ucenikSet.add(ug.ucenik.id);
            ucenici.push({
              id: ug.ucenik.id,
              ime: ug.ucenik.korisnik?.ime || '',
              prezime: ug.ucenik.korisnik?.prezime || '',
            });
          }
        });
      });
    } else if (filters.nastavnaGodinaId || activeNastavnaGodina) {
      // Get all ucenici from nastavna godina
      const nastavnaGodinaId = filters.nastavnaGodinaId || activeNastavnaGodina?.id;
      if (nastavnaGodinaId) {
        const grupeUNastavnojGodini = await this.prisma.grupa.findMany({
          where: {
            razredNastavnaGodina: {
              nastavnaGodinaId,
            },
          },
          include: {
            ucenici: {
              where: Object.keys(ucenikWhere).length > 0 ? { ucenik: ucenikWhere } : undefined,
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

        const ucenikSet = new Set<string>();
        grupeUNastavnojGodini.forEach((grupa) => {
          grupa.ucenici.forEach((ug) => {
            if (!ucenikSet.has(ug.ucenik.id)) {
              ucenikSet.add(ug.ucenik.id);
              ucenici.push({
                id: ug.ucenik.id,
                ime: ug.ucenik.korisnik?.ime || '',
                prezime: ug.ucenik.korisnik?.prezime || '',
              });
            }
          });
        });
      }
    } else {
      // Get all active ucenici (limited to 1000)
      const allUcenici = await this.prisma.ucenik.findMany({
        where: {
          status: 'AKTIVAN',
          ...ucenikWhere,
        },
        include: {
          korisnik: {
            select: {
              ime: true,
              prezime: true,
            },
          },
        },
        take: 1000,
        orderBy: {
          korisnik: {
            prezime: 'asc',
          },
        },
      });

      ucenici = allUcenici
        .filter((u) => u.korisnik)
        .map((u) => ({
          id: u.id,
          ime: u.korisnik?.ime || '',
          prezime: u.korisnik?.prezime || '',
        }));
    }

    // Sort ucenici by prezime, then ime
    ucenici.sort((a, b) => {
      const prezimeCompare = a.prezime.localeCompare(b.prezime);
      if (prezimeCompare !== 0) return prezimeCompare;
      return a.ime.localeCompare(b.ime);
    });

    return {
      nastavneGodine: nastavneGodineWithActive,
      razredi: razredi.map((r) => ({
        id: r.id,
        razred: r.razred,
      })),
      grupe: grupe,
      ucenici: ucenici,
    };
  }

  async getNastavnaGodinaStats(filters: { nastavnaGodinaId?: string }) {
    // Get active nastavna godina if not specified
    let nastavnaGodinaId = filters.nastavnaGodinaId;
    if (!nastavnaGodinaId) {
      const active = await this.prisma.nastavnaGodina.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { kreiran: 'desc' },
      });
      nastavnaGodinaId = active?.id;
    }

    if (!nastavnaGodinaId) {
      throw new BadRequestException('Nastavna godina nije pronađena');
    }

    // Get all razredi in nastavna godina
    const razredi = await this.prisma.razredNastavnaGodina.findMany({
      where: { nastavnaGodinaId },
      include: {
        razred: {
          select: {
            id: true,
            name: true,
          },
        },
        grupe: {
          include: {
            ucenici: {
              select: {
                ucenikId: true,
              },
            },
          },
        },
      },
    });

    const brojRazreda = razredi.length;

    // Count unique students
    const ucenikSet = new Set<string>();
    razredi.forEach((r) => {
      r.grupe.forEach((g) => {
        g.ucenici.forEach((u) => {
          ucenikSet.add(u.ucenikId);
        });
      });
    });
    const brojUcenika = ucenikSet.size;

    // Get total casovi
    const ukupnoCasova = await this.prisma.cas.count({
      where: { nastavnaGodinaId },
    });

    // Get attendance statistics
    const prisustva = await this.prisma.casPrisustvo.findMany({
      where: {
        cas: {
          nastavnaGodinaId,
        },
      },
    });

    const ukupnoPrisustva = prisustva.length;
    const prisutni = prisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
    const opravdani = prisustva.filter((p) => p.status === StatusPrisustva.OPRAVDAN).length;
    const neopravdani = prisustva.filter((p) => p.status === StatusPrisustva.NEOPRAVDAN).length;
    const prosjekPrisustva = ukupnoPrisustva > 0 ? Math.round((prisutni / ukupnoPrisustva) * 100 * 100) / 100 : 0;

    // Get grade statistics
    const ocjene = await this.prisma.casOcjena.findMany({
      where: {
        cas: {
          nastavnaGodinaId,
        },
      },
    });

    const ukupnoOcjena = ocjene.length;
    const sumaOcjena = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjekOcjena = ukupnoOcjena > 0 ? Math.round((sumaOcjena / ukupnoOcjena) * 100) / 100 : 0;

    // Calculate stats per razred
    const razrediStats = await Promise.all(
      razredi.map(async (r) => {
        const brojGrupa = r.grupe.length;
        const uceniciURazredu = new Set(r.grupe.flatMap((g) => g.ucenici.map((u) => u.ucenikId))).size;

        // Get attendance for this razred
        const razredPrisustva = await this.prisma.casPrisustvo.findMany({
          where: {
            cas: {
              razredNastavnaGodinaId: r.id,
            },
          },
        });

        const razredUkupnoPrisustva = razredPrisustva.length;
        const razredPrisutni = razredPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
        const razredProsjekPrisustva =
          razredUkupnoPrisustva > 0 ? Math.round((razredPrisutni / razredUkupnoPrisustva) * 100 * 100) / 100 : 0;

        // Get grades for this razred
        const razredOcjene = await this.prisma.casOcjena.findMany({
          where: {
            cas: {
              razredNastavnaGodinaId: r.id,
            },
          },
        });

        const razredUkupnoOcjena = razredOcjene.length;
        const razredSumaOcjena = razredOcjene.reduce((acc, o) => acc + o.ocjena, 0);
        const razredProsjekOcjena =
          razredUkupnoOcjena > 0 ? Math.round((razredSumaOcjena / razredUkupnoOcjena) * 100) / 100 : 0;

        return {
          id: r.id,
          naziv: r.razred.name,
          brojGrupa,
          brojUcenika: uceniciURazredu,
          prosjekPrisustva: razredProsjekPrisustva,
          prosjekOcjena: razredProsjekOcjena,
        };
      }),
    );

    return {
      brojRazreda,
      brojUcenika,
      ukupnoCasova,
      ukupnoPrisustva,
      prosjekPrisustva,
      ukupnoOcjena,
      prosjekOcjena,
      razredi: razrediStats,
    };
  }

  async getRazredStats(filters: { nastavnaGodinaId: string; razredNastavnaGodinaId: string; mjesec?: number }) {
    const { razredNastavnaGodinaId, mjesec } = filters;

    // Build date filter for mjesec if provided
    const casWhere: any = {
      razredNastavnaGodinaId,
    };

    if (mjesec) {
      const year = new Date().getFullYear();
      const startDate = new Date(year, mjesec - 1, 1);
      const endDate = new Date(year, mjesec, 0, 23, 59, 59, 999);
      casWhere.datum = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Get razred info
    const razred = await this.prisma.razredNastavnaGodina.findUnique({
      where: { id: razredNastavnaGodinaId },
      include: {
        razred: {
          include: {
            lekcije: {
              include: {
                lekcija: true,
              },
            },
          },
        },
        grupe: {
          include: {
            ucenici: {
              select: {
                ucenikId: true,
              },
            },
          },
        },
      },
    });

    if (!razred) {
      throw new BadRequestException('Razred nije pronađen');
    }

    const brojGrupa = razred.grupe.length;
    const ucenikSet = new Set<string>();
    razred.grupe.forEach((g) => {
      g.ucenici.forEach((u) => {
        ucenikSet.add(u.ucenikId);
      });
    });
    const brojUcenika = ucenikSet.size;

    // Get total casovi (održani/zabilježeni)
    const ukupnoCasova = await this.prisma.cas.count({
      where: casWhere,
    });

    // Calculate planned classes (raspored) based on date range
    // Get all grupe in this razred
    const grupeIds = razred.grupe.map((g) => g.id);
    
    // Get date range - if mjesec is provided, use it, otherwise use nastavna godina dates
    let startDate: Date;
    let endDate: Date;
    
    if (mjesec) {
      const year = new Date().getFullYear();
      startDate = new Date(year, mjesec - 1, 1);
      endDate = new Date(year, mjesec, 0, 23, 59, 59, 999);
    } else {
      // Get nastavna godina dates
      const nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
        where: { id: filters.nastavnaGodinaId },
        select: { datumOd: true, datumDo: true },
      });
      startDate = nastavnaGodina?.datumOd ? new Date(nastavnaGodina.datumOd) : new Date();
      endDate = nastavnaGodina?.datumDo ? new Date(nastavnaGodina.datumDo) : new Date();
      // Only count up to today
      const today = new Date();
      if (endDate > today) {
        endDate = today;
      }
    }

    // Calculate number of planned classes based on raspored
    // Get all raspored entries for grupe in this razred
    const rasporedi = await this.prisma.raspored.findMany({
      where: {
        grupaId: { in: grupeIds },
      },
    });

    // Calculate number of weekends (subota + nedjelja) in date range
    let planiraniCasovi = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDateCopy = new Date(endDate);
    endDateCopy.setHours(23, 59, 59, 999);
    
    while (currentDate <= endDateCopy) {
      const dayOfWeek = currentDate.getDay();
      // Count subota (6) and nedjelja (0)
      if (dayOfWeek === 6 || dayOfWeek === 0) {
        const dayName = dayOfWeek === 6 ? 'subota' : 'nedjelja';
        // Count raspored entries for this day
        const slotsForDay = rasporedi.filter((r) => r.dan === dayName).length;
        planiraniCasovi += slotsForDay;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const postotakOdrzanihCasova = planiraniCasovi > 0 
      ? Math.round((ukupnoCasova / planiraniCasovi) * 100 * 100) / 100 
      : 0;
    const neodrzaniCasovi = Math.max(0, planiraniCasovi - ukupnoCasova);

    // Get attendance statistics
    const prisustva = await this.prisma.casPrisustvo.findMany({
      where: {
        cas: casWhere,
      },
    });

    const ukupnoPrisustva = prisustva.length;
    const prisutni = prisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
    const opravdani = prisustva.filter((p) => p.status === StatusPrisustva.OPRAVDAN).length;
    const neopravdani = prisustva.filter((p) => p.status === StatusPrisustva.NEOPRAVDAN).length;
    const prosjekPrisustva = ukupnoPrisustva > 0 ? Math.round((prisutni / ukupnoPrisustva) * 100 * 100) / 100 : 0;

    // Get grade statistics
    const ocjene = await this.prisma.casOcjena.findMany({
      where: {
        cas: casWhere,
      },
    });

    const ukupnoOcjena = ocjene.length;
    const sumaOcjena = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjekOcjena = ukupnoOcjena > 0 ? Math.round((sumaOcjena / ukupnoOcjena) * 100) / 100 : 0;

    // Get statistics per grupa
    const grupeStats = await Promise.all(
      razred.grupe.map(async (grupa) => {
        const grupaUcenici = new Set(grupa.ucenici.map((u) => u.ucenikId)).size;

        const grupaCasWhere = {
          ...casWhere,
          grupaId: grupa.id,
        };

        const grupaCasovi = await this.prisma.cas.count({
          where: grupaCasWhere,
        });

        const grupaPrisustva = await this.prisma.casPrisustvo.findMany({
          where: {
            cas: grupaCasWhere,
          },
        });

        const grupaUkupnoPrisustva = grupaPrisustva.length;
        const grupaPrisutni = grupaPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
        const grupaProsjekPrisustva =
          grupaUkupnoPrisustva > 0 ? Math.round((grupaPrisutni / grupaUkupnoPrisustva) * 100 * 100) / 100 : 0;

        const grupaOcjene = await this.prisma.casOcjena.findMany({
          where: {
            cas: grupaCasWhere,
          },
        });

        const grupaUkupnoOcjena = grupaOcjene.length;
        const grupaSumaOcjena = grupaOcjene.reduce((acc, o) => acc + o.ocjena, 0);
        const grupaProsjekOcjena =
          grupaUkupnoOcjena > 0 ? Math.round((grupaSumaOcjena / grupaUkupnoOcjena) * 100) / 100 : 0;

        return {
          id: grupa.id,
          naziv: grupa.naziv,
          brojUcenika: grupaUcenici,
          prosjekPrisustva: grupaProsjekPrisustva,
          prosjekOcjena: grupaProsjekOcjena,
          brojCasova: grupaCasovi,
          brojOcjena: grupaUkupnoOcjena,
        };
      }),
    );

    // Get lekcija statistics
    const ukupnoLekcija = razred.razred.lekcije.length;
    const ocjenjeneLekcije = await this.prisma.casOcjena.findMany({
      where: {
        cas: casWhere,
      },
      select: {
        lekcijaId: true,
      },
      distinct: ['lekcijaId'],
    });
    const ocjenjenoLekcija = ocjenjeneLekcije.length;
    const postotakPredjenogGradiva = ukupnoLekcija > 0 ? Math.round((ocjenjenoLekcija / ukupnoLekcija) * 100 * 100) / 100 : 0;

    // Get top students by attendance
    const ucenikPrisustva = new Map<string, { prisutni: number; ukupno: number }>();
    prisustva.forEach((p) => {
      const ucenikId = p.ucenikId;
      if (!ucenikPrisustva.has(ucenikId)) {
        ucenikPrisustva.set(ucenikId, { prisutni: 0, ukupno: 0 });
      }
      const stats = ucenikPrisustva.get(ucenikId)!;
      stats.ukupno++;
      if (p.status === StatusPrisustva.PRISUTAN) {
        stats.prisutni++;
      }
    });

    const najredovnijiUcenici = Array.from(ucenikPrisustva.entries())
      .map(([ucenikId, stats]) => ({
        ucenikId,
        stopaPrisustva: stats.ukupno > 0 ? Math.round((stats.prisutni / stats.ukupno) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.stopaPrisustva - a.stopaPrisustva)
      .slice(0, 5);

    // Get student names for najredovniji
    const najredovnijiWithNames = await Promise.all(
      najredovnijiUcenici.map(async (item) => {
        const ucenik = await this.prisma.ucenik.findUnique({
          where: { id: item.ucenikId },
          include: {
            korisnik: {
              select: {
                ime: true,
                prezime: true,
              },
            },
          },
        });
        return {
          id: item.ucenikId,
          ime: ucenik?.korisnik?.ime || '',
          prezime: ucenik?.korisnik?.prezime || '',
          stopaPrisustva: item.stopaPrisustva,
        };
      }),
    );

    // Get top students by grades
    const ucenikOcjene = new Map<string, number[]>();
    ocjene.forEach((o) => {
      const ucenikId = o.ucenikId;
      if (!ucenikOcjene.has(ucenikId)) {
        ucenikOcjene.set(ucenikId, []);
      }
      ucenikOcjene.get(ucenikId)!.push(o.ocjena);
    });

    const najboljiUcenici = Array.from(ucenikOcjene.entries())
      .map(([ucenikId, ocjeneList]) => ({
        ucenikId,
        prosjekOcjena: ocjeneList.length > 0 ? ocjeneList.reduce((a, b) => a + b, 0) / ocjeneList.length : 0,
      }))
      .sort((a, b) => b.prosjekOcjena - a.prosjekOcjena)
      .slice(0, 5);

    // Get student names for najbolji
    const najboljiWithNames = await Promise.all(
      najboljiUcenici.map(async (item) => {
        const ucenik = await this.prisma.ucenik.findUnique({
          where: { id: item.ucenikId },
          include: {
            korisnik: {
              select: {
                ime: true,
                prezime: true,
              },
            },
          },
        });
        return {
          id: item.ucenikId,
          ime: ucenik?.korisnik?.ime || '',
          prezime: ucenik?.korisnik?.prezime || '',
          prosjekOcjena: Math.round(item.prosjekOcjena * 100) / 100,
        };
      }),
    );

    // Get students who need help
    const uceniciKojiTrebajuPomoc: Array<{
      id: string;
      ime: string;
      prezime: string;
      prosjekOcjena: number;
      stopaPrisustva: number;
      razlog: string;
    }> = [];

    for (const ucenikId of Array.from(ucenikSet)) {
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

      if (!ucenik) continue;

      const prisustvoStats = ucenikPrisustva.get(ucenikId);
      const ocjeneList = ucenikOcjene.get(ucenikId) || [];

      const stopaPrisustva = prisustvoStats
        ? prisustvoStats.ukupno > 0
          ? Math.round((prisustvoStats.prisutni / prisustvoStats.ukupno) * 100 * 100) / 100
          : 0
        : 0;
      const prosjekOcjena = ocjeneList.length > 0 ? ocjeneList.reduce((a, b) => a + b, 0) / ocjeneList.length : 0;

      const razlozi: string[] = [];
      if (prosjekOcjena > 0 && prosjekOcjena < 3.0) {
        razlozi.push('Niska prosječna ocjena');
      }
      if (stopaPrisustva < 70) {
        razlozi.push('Niska stopa prisustva');
      }
      if (ucenik.imaPosebnePotrebe) {
        razlozi.push('Posebne potrebe');
      }

      if (razlozi.length > 0) {
        uceniciKojiTrebajuPomoc.push({
          id: ucenikId,
          ime: ucenik.korisnik?.ime || '',
          prezime: ucenik.korisnik?.prezime || '',
          prosjekOcjena: Math.round(prosjekOcjena * 100) / 100,
          stopaPrisustva,
          razlog: razlozi.join(', '),
        });
      }
    }

    // Get grade distribution
    const distribucijaOcjena: Record<number, number> = {};
    ocjene.forEach((o) => {
      distribucijaOcjena[o.ocjena] = (distribucijaOcjena[o.ocjena] || 0) + 1;
    });

    // Get attendance distribution
    const distribucijaPrisustva = {
      visoka: 0,
      srednja: 0,
      niska: 0,
    };

    ucenikPrisustva.forEach((stats) => {
      const stopa = stats.ukupno > 0 ? (stats.prisutni / stats.ukupno) * 100 : 0;
      if (stopa >= 90) {
        distribucijaPrisustva.visoka++;
      } else if (stopa >= 70) {
        distribucijaPrisustva.srednja++;
      } else {
        distribucijaPrisustva.niska++;
      }
    });

    // Calculate average casovi per ucenik
    const prosjekCasovaPoUceniku = brojUcenika > 0 ? Math.round((ukupnoCasova / brojUcenika) * 100) / 100 : 0;

    return {
      brojGrupa,
      brojUcenika,
      ukupnoCasova,
      planiraniCasovi,
      neodrzaniCasovi,
      postotakOdrzanihCasova,
      prosjekCasovaPoUceniku,
      ukupnoPrisustva,
      prisutni,
      opravdani,
      neopravdani,
      prosjekPrisustva,
      ukupnoOcjena,
      prosjekOcjena,
      grupe: grupeStats,
      ukupnoLekcija,
      ocjenjenoLekcija,
      postotakPredjenogGradiva,
      najredovnijiUcenici: najredovnijiWithNames,
      najboljiUcenici: najboljiWithNames,
      uceniciKojiTrebajuPomoc,
      distribucijaOcjena,
      distribucijaPrisustva,
    };
  }

  async getUcenikStats(filters: {
    ucenikId: string;
    nastavnaGodinaId?: string;
    razredNastavnaGodinaId?: string;
    grupaId?: string;
    mjesec?: number;
  }) {
    const { ucenikId } = filters;

    // Build cas where clause
    const casWhere: any = {};

    if (filters.grupaId) {
      casWhere.grupaId = filters.grupaId;
    } else if (filters.razredNastavnaGodinaId) {
      casWhere.razredNastavnaGodinaId = filters.razredNastavnaGodinaId;
    } else if (filters.nastavnaGodinaId) {
      casWhere.nastavnaGodinaId = filters.nastavnaGodinaId;
    }

    if (filters.mjesec) {
      const year = new Date().getFullYear();
      const startDate = new Date(year, filters.mjesec - 1, 1);
      const endDate = new Date(year, filters.mjesec, 0, 23, 59, 59, 999);
      casWhere.datum = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Get student info
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
      throw new BadRequestException('Učenik nije pronađen');
    }

    // Get all casovi for this student
    const casovi = await this.prisma.cas.findMany({
      where: casWhere,
      include: {
        prisustva: {
          where: {
            ucenikId,
          },
        },
        ocjene: {
          where: {
            ucenikId,
          },
          include: {
            lekcija: true,
          },
        },
      },
      orderBy: {
        datum: 'asc',
      },
    });

    const ukupnoCasova = casovi.length;
    const prisustva = casovi.flatMap((c) => c.prisustva);
    const prisutni = prisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
    const odsutni = prisustva.filter((p) => p.status === StatusPrisustva.NEOPRAVDAN).length;
    const opravdani = prisustva.filter((p) => p.status === StatusPrisustva.OPRAVDAN).length;
    const stopaPrisustva = ukupnoCasova > 0 ? Math.round((prisutni / ukupnoCasova) * 100 * 100) / 100 : 0;

    // Get all ocjene
    const ocjene = casovi.flatMap((c) => c.ocjene);
    const ukupnoOcjena = ocjene.length;
    const sumaOcjena = ocjene.reduce((acc, o) => acc + o.ocjena, 0);
    const prosjekOcjena = ukupnoOcjena > 0 ? Math.round((sumaOcjena / ukupnoOcjena) * 100) / 100 : 0;

    // Get lekcija statistics
    let ukupnoLekcija = 0;
    if (filters.grupaId) {
      const grupa = await this.prisma.grupa.findUnique({
        where: { id: filters.grupaId },
        include: {
          razredNastavnaGodina: {
            include: {
              razred: {
                include: {
                  lekcije: true,
                },
              },
            },
          },
        },
      });
      ukupnoLekcija = grupa?.razredNastavnaGodina.razred.lekcije.length || 0;
    } else if (filters.razredNastavnaGodinaId) {
      const razred = await this.prisma.razredNastavnaGodina.findUnique({
        where: { id: filters.razredNastavnaGodinaId },
        include: {
          razred: {
            include: {
              lekcije: true,
            },
          },
        },
      });
      ukupnoLekcija = razred?.razred.lekcije.length || 0;
    }

    const ocjenjeneLekcije = new Set(ocjene.map((o) => o.lekcijaId));
    const ocjenjenoLekcija = ocjenjeneLekcije.size;
    const postotakPredjenogGradiva = ukupnoLekcija > 0 ? Math.round((ocjenjenoLekcija / ukupnoLekcija) * 100 * 100) / 100 : 0;

    // Get lekcije by tezina
    const lekcijePoTeziniMap = new Map<number, { ukupno: number; ocjenjeno: number; ocjene: number[] }>();
    ocjene.forEach((o) => {
      const tezina = o.lekcija.tezina;
      if (!lekcijePoTeziniMap.has(tezina)) {
        lekcijePoTeziniMap.set(tezina, { ukupno: 0, ocjenjeno: 0, ocjene: [] });
      }
      const stats = lekcijePoTeziniMap.get(tezina)!;
      stats.ocjenjeno++;
      stats.ocjene.push(o.ocjena);
    });

    // Get all lekcije for this razred/grupa to count total
    if (filters.grupaId || filters.razredNastavnaGodinaId) {
      let razredId: string | undefined;
      
      if (filters.razredNastavnaGodinaId) {
        const razredNG = await this.prisma.razredNastavnaGodina.findUnique({
          where: { id: filters.razredNastavnaGodinaId },
          select: { razredId: true },
        });
        razredId = razredNG?.razredId;
      } else if (filters.grupaId) {
        const grupa = await this.prisma.grupa.findUnique({
          where: { id: filters.grupaId },
          include: {
            razredNastavnaGodina: {
              select: { razredId: true },
            },
          },
        });
        razredId = grupa?.razredNastavnaGodina.razredId;
      }

      if (razredId) {
        const lekcije = await this.prisma.razredLekcija.findMany({
          where: {
            razredId,
          },
          include: {
            lekcija: true,
          },
        });

        lekcije.forEach((rl) => {
          const tezina = rl.lekcija.tezina;
          if (!lekcijePoTeziniMap.has(tezina)) {
            lekcijePoTeziniMap.set(tezina, { ukupno: 0, ocjenjeno: 0, ocjene: [] });
          }
          lekcijePoTeziniMap.get(tezina)!.ukupno++;
        });
      }
    }

    const lekcijePoTezini = Array.from(lekcijePoTeziniMap.entries())
      .map(([tezina, stats]) => ({
        tezina,
        ukupno: stats.ukupno,
        ocjenjeno: stats.ocjenjeno,
        prosjekOcjena: stats.ocjene.length > 0 ? Math.round((stats.ocjene.reduce((a, b) => a + b, 0) / stats.ocjene.length) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.tezina - b.tezina);

    // Calculate comparison stats (similar to existing methods)
    let razredAverage = 0;
    let grupaAverage = 0;
    let razredRank = 0;
    let grupaRank = 0;

    if (filters.razredNastavnaGodinaId) {
      const razredOcjene = await this.prisma.casOcjena.findMany({
        where: {
          cas: {
            razredNastavnaGodinaId: filters.razredNastavnaGodinaId,
            ...(filters.mjesec && {
              datum: {
                gte: new Date(new Date().getFullYear(), filters.mjesec - 1, 1),
                lte: new Date(new Date().getFullYear(), filters.mjesec, 0, 23, 59, 59, 999),
              },
            }),
          },
        },
        include: {
          ucenik: true,
        },
      });

      const razredSummary = new Map<string, number[]>();
      razredOcjene.forEach((o) => {
        const ucenikId = o.ucenik.id;
        if (!razredSummary.has(ucenikId)) {
          razredSummary.set(ucenikId, []);
        }
        razredSummary.get(ucenikId)!.push(o.ocjena);
      });

      const razredAverages: number[] = [];
      razredSummary.forEach((ocjene) => {
        if (ocjene.length > 0) {
          const avg = ocjene.reduce((a, b) => a + b, 0) / ocjene.length;
          razredAverages.push(avg);
        }
      });

      if (razredAverages.length > 0) {
        razredAverage = Math.round((razredAverages.reduce((a, b) => a + b, 0) / razredAverages.length) * 100) / 100;
        razredRank = razredAverages.filter((a) => a > prosjekOcjena).length + 1;
      }
    }

    if (filters.grupaId) {
      const grupaOcjene = await this.prisma.casOcjena.findMany({
        where: {
          cas: {
            grupaId: filters.grupaId,
            ...(filters.mjesec && {
              datum: {
                gte: new Date(new Date().getFullYear(), filters.mjesec - 1, 1),
                lte: new Date(new Date().getFullYear(), filters.mjesec, 0, 23, 59, 59, 999),
              },
            }),
          },
        },
        include: {
          ucenik: true,
        },
      });

      const grupaSummary = new Map<string, number[]>();
      grupaOcjene.forEach((o) => {
        const ucenikId = o.ucenik.id;
        if (!grupaSummary.has(ucenikId)) {
          grupaSummary.set(ucenikId, []);
        }
        grupaSummary.get(ucenikId)!.push(o.ocjena);
      });

      const grupaAverages: number[] = [];
      grupaSummary.forEach((ocjene) => {
        if (ocjene.length > 0) {
          const avg = ocjene.reduce((a, b) => a + b, 0) / ocjene.length;
          grupaAverages.push(avg);
        }
      });

      if (grupaAverages.length > 0) {
        grupaAverage = Math.round((grupaAverages.reduce((a, b) => a + b, 0) / grupaAverages.length) * 100) / 100;
        grupaRank = grupaAverages.filter((a) => a > prosjekOcjena).length + 1;
      }
    }

    // Calculate longest streaks
    let najduziNizPrisustva = 0;
    let najduziNizOdsutnosti = 0;
    let trenutniNizPrisustva = 0;
    let trenutniNizOdsutnosti = 0;

    prisustva
      .sort((a, b) => {
        const casA = casovi.find((c) => c.id === a.casId);
        const casB = casovi.find((c) => c.id === b.casId);
        if (!casA || !casB) return 0;
        return casA.datum.getTime() - casB.datum.getTime();
      })
      .forEach((p) => {
        if (p.status === StatusPrisustva.PRISUTAN) {
          trenutniNizPrisustva++;
          trenutniNizOdsutnosti = 0;
          najduziNizPrisustva = Math.max(najduziNizPrisustva, trenutniNizPrisustva);
        } else {
          trenutniNizOdsutnosti++;
          trenutniNizPrisustva = 0;
          najduziNizOdsutnosti = Math.max(najduziNizOdsutnosti, trenutniNizOdsutnosti);
        }
      });

    // Calculate monthly averages
    const prosjekPoMjesecuMap = new Map<number, { ocjene: number[]; prisustva: { prisutni: number; ukupno: number } }>();

    casovi.forEach((cas) => {
      const mjesec = cas.datum.getMonth() + 1;
      if (!prosjekPoMjesecuMap.has(mjesec)) {
        prosjekPoMjesecuMap.set(mjesec, { ocjene: [], prisustva: { prisutni: 0, ukupno: 0 } });
      }
      const stats = prosjekPoMjesecuMap.get(mjesec)!;

      const prisustvo = cas.prisustva.find((p) => p.ucenikId === ucenikId);
      if (prisustvo) {
        stats.prisustva.ukupno++;
        if (prisustvo.status === StatusPrisustva.PRISUTAN) {
          stats.prisustva.prisutni++;
        }
      }

      const casOcjene = cas.ocjene.filter((o) => o.ucenikId === ucenikId);
      casOcjene.forEach((o) => {
        stats.ocjene.push(o.ocjena);
      });
    });

    const prosjekPoMjesecu = Array.from(prosjekPoMjesecuMap.entries())
      .map(([mjesec, stats]) => ({
        mjesec,
        prosjekOcjena: stats.ocjene.length > 0 ? Math.round((stats.ocjene.reduce((a, b) => a + b, 0) / stats.ocjene.length) * 100) / 100 : 0,
        stopaPrisustva: stats.prisustva.ukupno > 0 ? Math.round((stats.prisustva.prisutni / stats.prisustva.ukupno) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => a.mjesec - b.mjesec);

    // Get detailed lekcije list
    const lekcijeDetaljno = ocjene.map((o) => {
      const cas = casovi.find((c) => c.id === o.casId);
      return {
        id: o.lekcija.id,
        naslov: o.lekcija.naslov,
        tezina: o.lekcija.tezina,
        ocjena: o.ocjena,
        datum: cas?.datum || new Date(),
      };
    });

    return {
      ukupnoCasova,
      prisutni,
      odsutni,
      opravdani,
      stopaPrisustva,
      ukupnoOcjena,
      prosjekOcjena,
      ukupnoLekcija,
      ocjenjenoLekcija,
      postotakPredjenogGradiva,
      lekcijePoTezini,
      razredAverage,
      grupaAverage,
      razredRank,
      grupaRank,
      najduziNizPrisustva,
      najduziNizOdsutnosti,
      prosjekPoMjesecu,
      lekcijeDetaljno,
    };
  }

  async getReportsList(filters: {
    nastavnaGodinaId?: string;
    razredNastavnaGodinaId?: string;
    grupaId?: string;
    mjesec?: number;
  }) {
    // Get active nastavna godina if not specified
    let nastavnaGodinaId = filters.nastavnaGodinaId;
    if (!nastavnaGodinaId) {
      const active = await this.prisma.nastavnaGodina.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { kreiran: 'desc' },
      });
      nastavnaGodinaId = active?.id;
    }

    if (!nastavnaGodinaId) {
      return {
        razredi: [],
        grupe: [],
        ucenici: [],
      };
    }

    // Build date filter for mjesec if provided
    const casWhere: any = {
      nastavnaGodinaId,
    };

    if (filters.mjesec) {
      const year = new Date().getFullYear();
      const startDate = new Date(year, filters.mjesec - 1, 1);
      const endDate = new Date(year, filters.mjesec, 0, 23, 59, 59, 999);
      casWhere.datum = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Get razredi
    const razrediWhere: any = {
      nastavnaGodinaId,
    };
    if (filters.razredNastavnaGodinaId) {
      razrediWhere.id = filters.razredNastavnaGodinaId;
    }

    const razredi = await this.prisma.razredNastavnaGodina.findMany({
      where: razrediWhere,
      include: {
        razred: {
          select: {
            id: true,
            name: true,
          },
        },
        grupe: {
          include: {
            ucenici: {
              select: {
                ucenikId: true,
              },
            },
          },
        },
      },
    });

    const razrediStats = await Promise.all(
      razredi.map(async (r) => {
        const brojGrupa = r.grupe.length;
        const ucenikSet = new Set(r.grupe.flatMap((g) => g.ucenici.map((u) => u.ucenikId)));
        const brojUcenika = ucenikSet.size;

        // Get attendance for this razred
        const razredCasWhere = {
          ...casWhere,
          razredNastavnaGodinaId: r.id,
        };

        const razredPrisustva = await this.prisma.casPrisustvo.findMany({
          where: {
            cas: razredCasWhere,
          },
        });

        const razredUkupnoPrisustva = razredPrisustva.length;
        const razredPrisutni = razredPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
        const razredProsjekPrisustva =
          razredUkupnoPrisustva > 0 ? Math.round((razredPrisutni / razredUkupnoPrisustva) * 100 * 100) / 100 : 0;

        // Get grades for this razred
        const razredOcjene = await this.prisma.casOcjena.findMany({
          where: {
            cas: razredCasWhere,
          },
        });

        const razredUkupnoOcjena = razredOcjene.length;
        const razredSumaOcjena = razredOcjene.reduce((acc, o) => acc + o.ocjena, 0);
        const razredProsjekOcjena =
          razredUkupnoOcjena > 0 ? Math.round((razredSumaOcjena / razredUkupnoOcjena) * 100) / 100 : 0;

        return {
          id: r.id,
          naziv: r.razred.name,
          brojGrupa,
          brojUcenika,
          prosjekPrisustva: razredProsjekPrisustva,
          prosjekOcjena: razredProsjekOcjena,
        };
      }),
    );

    // Get grupe
    const grupeWhere: any = {};
    if (filters.grupaId) {
      grupeWhere.id = filters.grupaId;
    } else if (filters.razredNastavnaGodinaId) {
      grupeWhere.razredNastavnaGodinaId = filters.razredNastavnaGodinaId;
    } else {
      grupeWhere.razredNastavnaGodina = {
        nastavnaGodinaId,
      };
    }

    const grupe = await this.prisma.grupa.findMany({
      where: grupeWhere,
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
        ucenici: {
          select: {
            ucenikId: true,
          },
        },
      },
    });

    const grupeStats = await Promise.all(
      grupe.map(async (grupa) => {
        const brojUcenika = new Set(grupa.ucenici.map((u) => u.ucenikId)).size;

        const grupaCasWhere = {
          ...casWhere,
          grupaId: grupa.id,
        };

        const grupaPrisustva = await this.prisma.casPrisustvo.findMany({
          where: {
            cas: grupaCasWhere,
          },
        });

        const grupaUkupnoPrisustva = grupaPrisustva.length;
        const grupaPrisutni = grupaPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
        const grupaProsjekPrisustva =
          grupaUkupnoPrisustva > 0 ? Math.round((grupaPrisutni / grupaUkupnoPrisustva) * 100 * 100) / 100 : 0;

        const grupaOcjene = await this.prisma.casOcjena.findMany({
          where: {
            cas: grupaCasWhere,
          },
        });

        const grupaUkupnoOcjena = grupaOcjene.length;
        const grupaSumaOcjena = grupaOcjene.reduce((acc, o) => acc + o.ocjena, 0);
        const grupaProsjekOcjena =
          grupaUkupnoOcjena > 0 ? Math.round((grupaSumaOcjena / grupaUkupnoOcjena) * 100) / 100 : 0;

        return {
          id: grupa.id,
          naziv: grupa.naziv,
          razredNaziv: grupa.razredNastavnaGodina.razred.name,
          brojUcenika,
          prosjekPrisustva: grupaProsjekPrisustva,
          prosjekOcjena: grupaProsjekOcjena,
        };
      }),
    );

    // Get ucenici
    let ucenici: Array<{
      id: string;
      ime: string;
      prezime: string;
      grupaNaziv: string;
      razredNaziv: string;
      prosjekPrisustva: number;
      prosjekOcjena: number;
    }> = [];

    // Only load ucenici if grupaId or razredNastavnaGodinaId is specified
    // (to avoid loading all ucenici from entire nastavna godina)
    if (filters.grupaId) {
      const ucenikGrupe = await this.prisma.ucenikGrupa.findMany({
        where: {
          grupaId: filters.grupaId,
        },
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

      ucenici = await Promise.all(
        ucenikGrupe.map(async (ug) => {
          const ucenikCasWhere = {
            ...casWhere,
            grupaId: ug.grupaId,
          };

          const ucenikPrisustva = await this.prisma.casPrisustvo.findMany({
            where: {
              cas: ucenikCasWhere,
              ucenikId: ug.ucenikId,
            },
          });

          const ucenikUkupnoPrisustva = ucenikPrisustva.length;
          const ucenikPrisutni = ucenikPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
          const ucenikProsjekPrisustva =
            ucenikUkupnoPrisustva > 0 ? Math.round((ucenikPrisutni / ucenikUkupnoPrisustva) * 100 * 100) / 100 : 0;

          const ucenikOcjene = await this.prisma.casOcjena.findMany({
            where: {
              cas: ucenikCasWhere,
              ucenikId: ug.ucenikId,
            },
          });

          const ucenikUkupnoOcjena = ucenikOcjene.length;
          const ucenikSumaOcjena = ucenikOcjene.reduce((acc, o) => acc + o.ocjena, 0);
          const ucenikProsjekOcjena =
            ucenikUkupnoOcjena > 0 ? Math.round((ucenikSumaOcjena / ucenikUkupnoOcjena) * 100) / 100 : 0;

          return {
            id: ug.ucenik.id,
            ime: ug.ucenik.korisnik?.ime || '',
            prezime: ug.ucenik.korisnik?.prezime || '',
            grupaNaziv: ug.grupa.naziv,
            razredNaziv: ug.grupa.razredNastavnaGodina.razred.name,
            prosjekPrisustva: ucenikProsjekPrisustva,
            prosjekOcjena: ucenikProsjekOcjena,
          };
        }),
      );
    } else if (filters.razredNastavnaGodinaId) {
      const grupeURazredu = await this.prisma.grupa.findMany({
        where: {
          razredNastavnaGodinaId: filters.razredNastavnaGodinaId,
        },
        include: {
          ucenici: {
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
      });

      const ucenikSet = new Set<string>();
      for (const grupa of grupeURazredu) {
        for (const ug of grupa.ucenici) {
          if (!ucenikSet.has(ug.ucenikId)) {
            ucenikSet.add(ug.ucenikId);

            const ucenikCasWhere = {
              ...casWhere,
              razredNastavnaGodinaId: filters.razredNastavnaGodinaId,
              grupaId: grupa.id,
            };

            const ucenikPrisustva = await this.prisma.casPrisustvo.findMany({
              where: {
                cas: ucenikCasWhere,
                ucenikId: ug.ucenikId,
              },
            });

            const ucenikUkupnoPrisustva = ucenikPrisustva.length;
            const ucenikPrisutni = ucenikPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
            const ucenikProsjekPrisustva =
              ucenikUkupnoPrisustva > 0 ? Math.round((ucenikPrisutni / ucenikUkupnoPrisustva) * 100 * 100) / 100 : 0;

            const ucenikOcjene = await this.prisma.casOcjena.findMany({
              where: {
                cas: ucenikCasWhere,
                ucenikId: ug.ucenikId,
              },
            });

            const ucenikUkupnoOcjena = ucenikOcjene.length;
            const ucenikSumaOcjena = ucenikOcjene.reduce((acc, o) => acc + o.ocjena, 0);
            const ucenikProsjekOcjena =
              ucenikUkupnoOcjena > 0 ? Math.round((ucenikSumaOcjena / ucenikUkupnoOcjena) * 100) / 100 : 0;

            ucenici.push({
              id: ug.ucenik.id,
              ime: ug.ucenik.korisnik?.ime || '',
              prezime: ug.ucenik.korisnik?.prezime || '',
              grupaNaziv: grupa.naziv,
              razredNaziv: grupa.razredNastavnaGodina.razred.name,
              prosjekPrisustva: ucenikProsjekPrisustva,
              prosjekOcjena: ucenikProsjekOcjena,
            });
          }
        }
      }
    }

    // Sort ucenici by prezime, then ime
    ucenici.sort((a, b) => {
      const prezimeCompare = a.prezime.localeCompare(b.prezime);
      if (prezimeCompare !== 0) return prezimeCompare;
      return a.ime.localeCompare(b.ime);
    });

    return {
      razredi: razrediStats,
      grupe: grupeStats,
      ucenici,
    };
  }

  async getYearConclusionStudents(filters: { nastavnaGodinaId?: string }) {
    // Get all academic years or filter by specific one
    const nastavneGodine = await this.prisma.nastavnaGodina.findMany({
      where: filters.nastavnaGodinaId ? { id: filters.nastavnaGodinaId } : {},
      orderBy: { kreiran: 'desc' },
      include: {
        razredi: {
          include: {
            razred: {
              select: {
                id: true,
                name: true,
                ilmihal: true,
              },
            },
            grupe: {
              include: {
                ucenici: {
                  include: {
                    ucenik: {
                      include: {
                        korisnik: {
                          select: {
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
        },
      },
    });

    // Format response: group by academic year, then by razred, then list students
    return nastavneGodine.map((ng) => ({
      id: ng.id,
      naziv: ng.naziv,
      opis: ng.opis,
      datumOd: ng.datumOd,
      datumDo: ng.datumDo,
      status: ng.status,
      razredi: ng.razredi.map((rng) => {
        // Get unique students from all grupe in this razred
        const ucenikSet = new Map<string, any>();
        rng.grupe.forEach((grupa) => {
          grupa.ucenici.forEach((ug) => {
            if (!ucenikSet.has(ug.ucenik.id)) {
              ucenikSet.set(ug.ucenik.id, {
                id: ug.ucenik.id,
                ime: ug.ucenik.korisnik?.ime || '',
                prezime: ug.ucenik.korisnik?.prezime || '',
                fotografija: ug.ucenik.korisnik?.fotografija || null,
              });
            }
          });
        });

        return {
          id: rng.id,
          razred: {
            id: rng.razred.id,
            name: rng.razred.name,
            ilmihal: rng.razred.ilmihal,
          },
          ucenici: Array.from(ucenikSet.values()).sort((a, b) => {
            const prezimeCompare = a.prezime.localeCompare(b.prezime);
            if (prezimeCompare !== 0) return prezimeCompare;
            return a.ime.localeCompare(b.ime);
          }),
        };
      }),
    }));
  }

  async getStudentYearConclusionData(ucenikId: string, nastavnaGodinaId: string) {
    // Get student basic info
    const ucenik = await this.prisma.ucenik.findUnique({
      where: { id: ucenikId },
      include: {
        korisnik: {
          select: {
            ime: true,
            prezime: true,
            fotografija: true,
          },
        },
        obrazovanje: true,
        roditelji: true,
        kontakti: true,
      },
    });

    if (!ucenik) {
      throw new BadRequestException('Učenik nije pronađen');
    }

    // Get academic year info
    const nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
      where: { id: nastavnaGodinaId },
      include: {
        nastavniPlan: {
          select: {
            id: true,
            naziv: true,
          },
        },
      },
    });

    if (!nastavnaGodina) {
      throw new BadRequestException('Nastavna godina nije pronađena');
    }

    // Get student's attendance data for this academic year
    const attendanceData = await this.getAttendanceReport({
      ucenikId,
      nastavnaGodinaId,
    });

    // Get student's grade data for this academic year
    const gradeData = await this.getGradeReport({
      ucenikId,
      nastavnaGodinaId,
    });

    // Get student's detailed stats
    const studentStats = await this.getUcenikStats({
      ucenikId,
      nastavnaGodinaId,
    });

    // Check if student is in Hifz school
    const skolaHifzaUcenik = await this.prisma.skolaHifzaUcenik.findFirst({
      where: {
        ucenikId,
        skolaHifza: {
          nastavnaGodinaId,
        },
      },
      include: {
        skolaHifza: {
          include: {
            nastavnaGodina: {
              select: {
                id: true,
                naziv: true,
              },
            },
          },
        },
      },
    });

    // Get Hifz attendance if applicable
    let hifzAttendance = null;
    if (skolaHifzaUcenik) {
      const hifzPrisustva = await this.prisma.skolaHifzaPrisustvo.findMany({
        where: {
          ucenikId,
          cas: {
            skolaHifzaId: skolaHifzaUcenik.skolaHifzaId,
          },
        },
        include: {
          cas: {
            select: {
              id: true,
              datum: true,
            },
          },
        },
        orderBy: {
          cas: {
            datum: 'desc',
          },
        },
      });

      const hifzTotal = hifzPrisustva.length;
      const hifzPrisutni = hifzPrisustva.filter((p) => p.status === StatusPrisustva.PRISUTAN).length;
      const hifzProcenat = hifzTotal > 0 ? Math.round((hifzPrisutni / hifzTotal) * 100 * 100) / 100 : 0;

      hifzAttendance = {
        total: hifzTotal,
        prisutni: hifzPrisutni,
        procenat: hifzProcenat,
        napredak: skolaHifzaUcenik.napredak,
      };
    }

    // Get which razred/grupa the student was in
    const ucenikGrupe = await this.prisma.ucenikGrupa.findMany({
      where: {
        ucenikId,
        grupa: {
          razredNastavnaGodina: {
            nastavnaGodinaId,
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
    });

    return {
      ucenik: {
        id: ucenik.id,
        ime: ucenik.korisnik?.ime || '',
        prezime: ucenik.korisnik?.prezime || '',
        fotografija: ucenik.korisnik?.fotografija || null,
        datumRodjenja: ucenik.datumRodjenja,
        spol: ucenik.spol,
        mjestoRodjenja: ucenik.mjestoRodjenja,
        adresaStanovanja: ucenik.adresaStanovanja,
        obrazovanje: ucenik.obrazovanje,
        roditelji: ucenik.roditelji,
        kontakti: ucenik.kontakti,
      },
      nastavnaGodina: {
        id: nastavnaGodina.id,
        naziv: nastavnaGodina.naziv,
        opis: nastavnaGodina.opis,
        datumOd: nastavnaGodina.datumOd,
        datumDo: nastavnaGodina.datumDo,
        nastavniPlan: nastavnaGodina.nastavniPlan,
      },
      razredi: ucenikGrupe.map((ug) => ({
        razred: ug.grupa.razredNastavnaGodina.razred,
        grupa: {
          id: ug.grupa.id,
          naziv: ug.grupa.naziv,
        },
      })),
      attendance: attendanceData,
      grades: gradeData,
      stats: studentStats,
      hifz: skolaHifzaUcenik
        ? {
            ucenik: skolaHifzaUcenik,
            attendance: hifzAttendance,
          }
        : null,
    };
  }

  async generateStudentReportPDF(ucenikId: string, nastavnaGodinaId: string, customComments?: Record<string, string>): Promise<Buffer> {
    const data = await this.getStudentYearConclusionData(ucenikId, nastavnaGodinaId);
    
    // Create PDF document (A4 size)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Get razred from razredi array or from napredak field
    let razredText = '';
    if (data.razredi.length > 0) {
      razredText = data.razredi.map((r: any) => r.razred?.name || '').filter(Boolean).join(', ');
    }
    
    // Fallback: try to get razred from napredak field if razredi is empty
    if (!razredText && data.ucenik) {
      const ucenik = await this.prisma.ucenik.findUnique({
        where: { id: data.ucenik.id },
        select: { napredak: true },
      });
      
      if (ucenik?.napredak && typeof ucenik.napredak === 'object') {
        const napredak = ucenik.napredak as Record<string, any>;
        const napredakEntry = napredak[nastavnaGodinaId];
        if (napredakEntry?.razred) {
          const razred = await this.prisma.razred.findUnique({
            where: { id: napredakEntry.razred },
            select: { name: true },
          });
          if (razred) {
            razredText = razred.name;
          }
        }
      }
    }

    // Function to add header on each page
    const addHeader = () => {
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246); // indigo-600
      doc.text('IZVJEŠTAJ O UČENIKU', pageWidth / 2, 15, { align: 'center' });

      // Student Information
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`${data.ucenik.ime} ${data.ucenik.prezime}`, pageWidth / 2, 23, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nastavna godina: ${data.nastavnaGodina.naziv}`, 20, 30);
      
      if (razredText) {
        doc.text(`Razred: ${razredText}`, 20, 36);
      }

      if (data.ucenik.datumRodjenja) {
        const datumRodjenja = new Date(data.ucenik.datumRodjenja).toLocaleDateString('bs-BA');
        const yPos = razredText ? 42 : 36;
        doc.text(`Datum rođenja: ${datumRodjenja}`, 20, yPos);
      }

      // Draw a line under header
      doc.setDrawColor(200, 200, 200);
      const headerBottomY = data.ucenik.datumRodjenja ? (razredText ? 48 : 42) : (razredText ? 42 : 36);
      doc.line(20, headerBottomY, pageWidth - 20, headerBottomY);
    };

    // Add header on first page
    addHeader();
    yPosition = (data.ucenik.datumRodjenja ? (razredText ? 54 : 48) : (razredText ? 48 : 42)) + 5;

    // Attendance Statistics
    const attendanceData = data.attendance?.summaryByStudent?.[0] || {
      total: 0,
      prisutni: 0,
      opravdani: 0,
      neopravdani: 0,
      procenatPrisustva: 0,
    };

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Prisustvo', 20, yPosition);
    yPosition += 8;

    const attendanceTableData = [
      ['Ukupno časova', attendanceData.total.toString()],
      ['Prisutni', attendanceData.prisutni.toString()],
      ['Opravdani', attendanceData.opravdani.toString()],
      ['Neopravdani', attendanceData.neopravdani.toString()],
      ['Procenat prisustva', `${attendanceData.procenatPrisustva}%`],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Kategorija', 'Vrijednost']],
      body: attendanceTableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Grade Statistics
    const gradeStats = data.grades?.statistics || { total: 0, prosjek: 0, distribucija: {} };
    
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      addHeader();
      yPosition = (data.ucenik.datumRodjenja ? (razredText ? 54 : 48) : (razredText ? 48 : 42)) + 5;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Ocjene', 20, yPosition);
    yPosition += 8;

    const gradeTableData = [
      ['Ukupno ocjena', gradeStats.total.toString()],
      ['Prosječna ocjena', gradeStats.prosjek?.toFixed(2) || '0.00'],
    ];

    // Add grade distribution
    const distribucija = gradeStats.distribucija || {};
    Object.entries(distribucija).forEach(([grade, count]) => {
      gradeTableData.push([`Ocjena ${grade}`, (count as number).toString()]);
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Kategorija', 'Vrijednost']],
      body: gradeTableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }, // green-500
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Lesson Progress
    const stats = data.stats || {};
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      addHeader();
      yPosition = (data.ucenik.datumRodjenja ? (razredText ? 54 : 48) : (razredText ? 48 : 42)) + 5;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Progres lekcija', 20, yPosition);
    yPosition += 8;

    const progressTableData = [
      ['Ukupno lekcija', (stats.ukupnoLekcija || 0).toString()],
      ['Ocjenjeno lekcija', (stats.ocjenjenoLekcija || 0).toString()],
      ['Procenat', `${stats.postotakPredjenogGradiva || 0}%`],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Kategorija', 'Vrijednost']],
      body: progressTableData,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] }, // purple-500
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Comments
    if (customComments && Object.keys(customComments).length > 0) {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        addHeader();
        yPosition = (data.ucenik.datumRodjenja ? (razredText ? 54 : 48) : (razredText ? 48 : 42)) + 5;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Komentari i napomene', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      Object.entries(customComments).forEach(([key, value]) => {
        if (value) {
          const lines = doc.splitTextToSize(value, pageWidth - 40);
          doc.text(lines, 20, yPosition);
          yPosition += lines.length * 5;
        }
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Stranica ${i} od ${totalPages} - ${data.nastavnaGodina.naziv}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Return PDF as Buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
  }

  async generateDiplomaPDF(ucenikId: string, nastavnaGodinaId: string, diplomaData: {
    imePrezime: string;
    nivo: string;
    datum: string;
    godina: string;
  }): Promise<Buffer> {
    console.log('=== generateDiplomaPDF called ===');
    console.log('Parameters:', {
      ucenikId,
      nastavnaGodinaId,
      diplomaData,
    });
    
    // Validate required parameters
    if (!ucenikId || !nastavnaGodinaId) {
      throw new BadRequestException('ucenikId i nastavnaGodinaId su obavezni');
    }
    
    if (!diplomaData.imePrezime || !diplomaData.nivo || !diplomaData.datum || !diplomaData.godina) {
      throw new BadRequestException('Svi podaci za diplomu su obavezni (imePrezime, nivo, datum, godina)');
    }
    
    try {
      // Load the template PDF
      // In Docker: working_dir is /app/apps/api, so we need to go up to /app
      // Try multiple possible paths
      const possiblePaths = [
        path.join(process.cwd(), '..', '..', 'pdf', 'ILMIHAL.pdf'), // /app/pdf/ILMIHAL.pdf from /app/apps/api
        path.join(process.cwd(), '..', 'pdf', 'ILMIHAL.pdf'),
        path.join(process.cwd(), 'pdf', 'ILMIHAL.pdf'),
        path.join(process.cwd(), '..', '..', 'apps', 'web', 'public', 'ILMIHAL.pdf'), // /app/apps/web/public/ILMIHAL.pdf
        path.join(__dirname, '..', '..', '..', '..', 'pdf', 'ILMIHAL.pdf'),
        path.join(__dirname, '..', '..', '..', '..', '..', 'pdf', 'ILMIHAL.pdf'),
        path.join(__dirname, '..', '..', '..', '..', '..', 'apps', 'web', 'public', 'ILMIHAL.pdf'),
      ];
      
      console.log('Searching for PDF template...');
      console.log('Current working directory:', process.cwd());
      console.log('__dirname:', __dirname);
      
      let templatePath: string | undefined;
      for (const possiblePath of possiblePaths) {
        const normalizedPath = path.resolve(possiblePath);
        console.log(`Checking path: ${normalizedPath} (exists: ${fs.existsSync(normalizedPath)})`);
        if (fs.existsSync(normalizedPath)) {
          templatePath = normalizedPath;
          console.log(`✅ Found PDF template at: ${templatePath}`);
          break;
        }
      }
      
      if (!templatePath) {
        console.error('PDF template not found. Tried paths:', possiblePaths.map(p => path.resolve(p)));
        console.error('Current working directory:', process.cwd());
        throw new BadRequestException(`PDF template not found. Searched in: ${possiblePaths.map(p => path.resolve(p)).join(', ')}`);
      }

      console.log(`Loading PDF template from: ${templatePath}`);
      
      let templateBytes: Buffer;
      try {
        templateBytes = fs.readFileSync(templatePath);
        console.log(`PDF template loaded, size: ${templateBytes.length} bytes`);
      } catch (readError) {
        console.error('Error reading PDF file:', readError);
        throw new BadRequestException(`Greška pri čitanju PDF template fajla: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
      
      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(templateBytes);
        console.log('PDF document loaded successfully');
      } catch (loadError) {
        console.error('Error loading PDF document:', loadError);
        throw new BadRequestException(`Greška pri učitavanju PDF dokumenta: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
      }

      // Get the first page
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Helper function to replace Bosnian characters for WinAnsi compatibility
      const replaceBosnianChars = (text: string): string => {
        return text
          .replace(/Č/g, 'C')
          .replace(/Ć/g, 'C')
          .replace(/Đ/g, 'D')
          .replace(/Š/g, 'S')
          .replace(/Ž/g, 'Z')
          .replace(/č/g, 'c')
          .replace(/ć/g, 'c')
          .replace(/đ/g, 'd')
          .replace(/š/g, 's')
          .replace(/ž/g, 'z');
      };

      // Try to get form fields first
      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        if (fields.length > 0) {
          // Map fields based on actual PDF field names
          // Replace Bosnian characters for WinAnsi compatibility
          const dateObj = new Date(diplomaData.datum);
          const formattedDate = dateObj.toLocaleDateString('bs-BA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          
          const fieldMapping: Record<string, string> = {
            'ime_prezime': replaceBosnianChars(diplomaData.imePrezime),
            'nivo': replaceBosnianChars(diplomaData.nivo),
            'datum': replaceBosnianChars(formattedDate),
            'nastavna_godina': replaceBosnianChars(diplomaData.godina),
          };

          // Try to find and fill form fields
          const allFields = form.getFields();
          for (const field of allFields) {
            const fieldName = field.getName();
            
            // Try exact match
            if (fieldMapping[fieldName]) {
              try {
                const textField = form.getTextField(fieldName);
                textField.setText(fieldMapping[fieldName]);
              } catch (e) {
                // Field type mismatch, continue
              }
            }
            
            // Try variations
            if (fieldName.includes('ime') || fieldName.includes('name')) {
              try {
                const textField = form.getTextField(fieldName);
                textField.setText(replaceBosnianChars(diplomaData.imePrezime));
              } catch (e) {
                // Skip
              }
            } else if (fieldName.includes('nivo') || fieldName.includes('level')) {
              try {
                const textField = form.getTextField(fieldName);
                textField.setText(replaceBosnianChars(diplomaData.nivo));
              } catch (e) {
                // Skip
              }
            } else if (fieldName.includes('datum') || fieldName.includes('date')) {
              try {
                const textField = form.getTextField(fieldName);
                const dateObj = new Date(diplomaData.datum);
                const formattedDate = dateObj.toLocaleDateString('bs-BA', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                textField.setText(replaceBosnianChars(formattedDate));
              } catch (e) {
                // Skip
              }
            } else if (fieldName.includes('nastavna_godina') || fieldName.includes('godina') || fieldName.includes('year')) {
              try {
                const textField = form.getTextField(fieldName);
                textField.setText(replaceBosnianChars(diplomaData.godina));
              } catch (e) {
                // Skip
              }
            }
          }

          // Save PDF first
          console.log('Saving PDF with form fields...');
          let pdfBytes: Uint8Array;
          try {
            pdfBytes = await pdfDoc.save();
            console.log(`PDF saved successfully, size: ${pdfBytes.length} bytes`);
          } catch (saveError) {
            console.error('Error saving PDF with form fields:', saveError);
            throw new BadRequestException(`Greška pri čuvanju PDF-a sa form fields: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
          }
          
          // Update student's progress (napredak) BEFORE returning PDF
          console.log('═══════════════════════════════════════════════════════════');
          console.log('📝 START: Updating napredak for ucenik (form fields path)');
          console.log('  ucenikId:', ucenikId);
          console.log('  nastavnaGodinaId:', nastavnaGodinaId);
          console.log('═══════════════════════════════════════════════════════════');
          
          await this.updateNapredak(ucenikId, nastavnaGodinaId);
          
          console.log('Returning PDF buffer from form fields path, size:', pdfBytes.length);
          return Buffer.from(pdfBytes);
        }
      } catch (formError) {
        // PDF doesn't have form fields, use drawText method
        console.log('PDF does not have form fields, using drawText method');
        console.log('Form error details:', formError instanceof Error ? formError.message : String(formError));
      }

      // Fallback: Draw text on the PDF using coordinates
      // Note: replaceBosnianChars function is already defined above

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Replace Bosnian characters for compatibility
      const imePrezimeSafe = replaceBosnianChars(diplomaData.imePrezime);
      const nivoSafe = replaceBosnianChars(diplomaData.nivo);
      const godinaSafe = replaceBosnianChars(diplomaData.godina);

      // Calculate text width for centering name
      const textSize = 14;
      const textWidth = boldFont.widthOfTextAtSize(imePrezimeSafe, textSize);
      const centeredX = (width - textWidth) / 2;

      // Draw text (coordinates need to be adjusted based on actual PDF)
      // These are placeholder coordinates
      firstPage.drawText(imePrezimeSafe, {
        x: centeredX,
        y: height - 200, // Adjust based on actual PDF
        size: textSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      firstPage.drawText(nivoSafe, {
        x: width / 2 - 50, // Adjust based on actual PDF
        y: height - 250,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      const dateObj = new Date(diplomaData.datum);
      const formattedDate = dateObj.toLocaleDateString('bs-BA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const formattedDateSafe = replaceBosnianChars(formattedDate);

      firstPage.drawText(formattedDateSafe, {
        x: width / 2 - 50,
        y: height - 300,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      firstPage.drawText(godinaSafe, {
        x: width / 2 - 50,
        y: height - 350,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Save PDF first
      console.log('Saving PDF with drawText method...');
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await pdfDoc.save();
        console.log(`PDF saved successfully, size: ${pdfBytes.length} bytes`);
      } catch (saveError) {
        console.error('Error saving PDF with drawText:', saveError);
        throw new BadRequestException(`Greška pri čuvanju PDF-a: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
      }
      
      // Update student's progress (napredak) BEFORE returning PDF
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📝 START: Updating napredak for ucenik (drawText path)');
      console.log('  ucenikId:', ucenikId);
      console.log('  nastavnaGodinaId:', nastavnaGodinaId);
      console.log('═══════════════════════════════════════════════════════════');
      
      await this.updateNapredak(ucenikId, nastavnaGodinaId);
      
      console.log('Returning PDF buffer from drawText path, size:', pdfBytes.length);
      return Buffer.from(pdfBytes);
    } catch (error) {
      console.error('Error generating diploma PDF:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Error details:', {
        message: errorMessage,
        stack: errorStack,
        errorType: error?.constructor?.name,
      });
      throw new BadRequestException(
        `Greška pri generisanju diplome: ${errorMessage}`
      );
    }
  }

  private async updateNapredak(ucenikId: string, nastavnaGodinaId: string): Promise<void> {
    try {
        // Get student's razred for this nastavna godina
        console.log('🔍 Step 1: Finding ucenikGrupa...');
        const ucenikGrupa = await this.prisma.ucenikGrupa.findFirst({
          where: {
            ucenikId: ucenikId,
            grupa: {
              razredNastavnaGodina: {
                nastavnaGodinaId: nastavnaGodinaId,
              },
            },
          },
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
          },
        });

        console.log('  ucenikGrupa found:', ucenikGrupa ? '✅ YES' : '❌ NO');
        if (ucenikGrupa) {
          console.log('  grupa.id:', ucenikGrupa.grupa?.id);
          console.log('  razredNastavnaGodina:', ucenikGrupa.grupa?.razredNastavnaGodina ? '✅ EXISTS' : '❌ MISSING');
          if (ucenikGrupa.grupa?.razredNastavnaGodina) {
            console.log('    razredNastavnaGodina.id:', ucenikGrupa.grupa.razredNastavnaGodina.id);
            console.log('    razredNastavnaGodina.razredId:', ucenikGrupa.grupa.razredNastavnaGodina.razredId);
            console.log('    razredNastavnaGodina.nastavnaGodinaId:', ucenikGrupa.grupa.razredNastavnaGodina.nastavnaGodinaId);
          }
        } else {
          console.log('  ⚠️  ucenikGrupa is null - student might not be in a group for this nastavna godina');
        }

        if (ucenikGrupa?.grupa?.razredNastavnaGodina?.razredId) {
          console.log('✅ Step 2: Found razredId:', ucenikGrupa.grupa.razredNastavnaGodina.razredId);
          const razredId = ucenikGrupa.grupa.razredNastavnaGodina.razredId;
          
          // Get current napredak or initialize empty object
          console.log('🔍 Step 3: Getting current napredak from database...');
          const ucenik = await this.prisma.ucenik.findUnique({
            where: { id: ucenikId },
            select: { napredak: true },
          });

          console.log('  Current napredak:', ucenik?.napredak ? JSON.stringify(ucenik.napredak, null, 2) : 'null/undefined');
          const currentNapredak = (ucenik?.napredak as Record<string, any>) || {};
          console.log('  Parsed currentNapredak:', JSON.stringify(currentNapredak, null, 2));
          
          // Get all SUFARA lessons learned by student in this nastavna godina
          console.log('🔍 Step 4: Getting SUFARA ocjene...');
          const sufaraOcjene = await this.prisma.casOcjena.findMany({
            where: {
              ucenikId: ucenikId,
              cas: {
                nastavnaGodinaId: nastavnaGodinaId,
              },
              lekcija: {
                tip: 'SUFARA',
              },
            },
            select: {
              lekcijaId: true,
            },
            distinct: ['lekcijaId'],
          });
          const sufaraLekcijeIds = sufaraOcjene.map(o => o.lekcijaId);
          console.log('  Found SUFARA ocjene:', sufaraOcjene.length);
          console.log('  SUFARA lekcije IDs:', sufaraLekcijeIds);
          
          // Get Skola Hifza napredak for this nastavna godina
          console.log('🔍 Step 5: Getting Skola Hifza napredak...');
          const skolaHifzaUcenik = await this.prisma.skolaHifzaUcenik.findFirst({
            where: {
              ucenikId: ucenikId,
              skolaHifza: {
                nastavnaGodinaId: nastavnaGodinaId,
              },
            },
            select: {
              napredak: true,
            },
          });
          const skolaHifzaNapredak = skolaHifzaUcenik?.napredak as Record<string, number[]> | null || null;
          console.log('  Skola Hifza ucenik found:', skolaHifzaUcenik ? '✅ YES' : '❌ NO');
          console.log('  Skola Hifza napredak:', skolaHifzaNapredak ? JSON.stringify(skolaHifzaNapredak, null, 2) : 'null');
          
          // Update napredak for this nastavna godina
          console.log('🔍 Step 6: Building updated napredak object...');
          const updatedNapredak = {
            ...currentNapredak,
            [nastavnaGodinaId]: {
              razred: razredId,
              pohvaleIPriznanja: [],
              sufaraLekcije: sufaraLekcijeIds,
              skolaHifzaNapredak: skolaHifzaNapredak,
            },
          };
          console.log('  Updated napredak object:', JSON.stringify(updatedNapredak, null, 2));

          // Save updated napredak
          console.log('💾 Step 7: Saving to database (Ucenik table, napredak field)...');
          console.log('  Table: ucenici');
          console.log('  Field: napredak (JSON)');
          console.log('  Where: id =', ucenikId);
          console.log('  Data:', JSON.stringify({ napredak: updatedNapredak }, null, 2));
          
          const updatedUcenik = await this.prisma.ucenik.update({
            where: { id: ucenikId },
            data: { napredak: updatedNapredak },
          });

          console.log('✅ Step 8: Database update completed!');
          console.log('  Updated ucenik.id:', updatedUcenik.id);
          console.log('  Updated napredak in DB:', JSON.stringify(updatedUcenik.napredak, null, 2));
          console.log(`✅ Successfully updated napredak for ucenik ${ucenikId}, nastavnaGodina ${nastavnaGodinaId}, razred ${razredId}, sufara lekcije: ${sufaraLekcijeIds.length}, skola hifza: ${skolaHifzaNapredak ? 'yes' : 'no'}`);
        } else {
          console.warn('❌ Step 2: Could not find razred for ucenik');
          console.warn('  ucenikId:', ucenikId);
          console.warn('  nastavnaGodinaId:', nastavnaGodinaId);
          console.warn('  ucenikGrupa:', ucenikGrupa ? 'exists but missing razred' : 'null');
          if (ucenikGrupa) {
            console.warn('  grupa:', ucenikGrupa.grupa ? 'exists' : 'null');
            console.warn('  razredNastavnaGodina:', ucenikGrupa.grupa?.razredNastavnaGodina ? 'exists' : 'null');
            console.warn('  razredId:', ucenikGrupa.grupa?.razredNastavnaGodina?.razredId || 'missing');
          }
        }
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📝 END: Updating napredak');
        console.log('═══════════════════════════════════════════════════════════');
      } catch (napredakError) {
        // Log error but don't fail the diploma generation
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ ERROR updating napredak:');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('  Error message:', napredakError instanceof Error ? napredakError.message : String(napredakError));
        console.error('  Error stack:', napredakError instanceof Error ? napredakError.stack : undefined);
        console.error('  Error type:', napredakError?.constructor?.name);
        console.error('  Full error:', napredakError);
        console.error('═══════════════════════════════════════════════════════════');
      }
  }
}

