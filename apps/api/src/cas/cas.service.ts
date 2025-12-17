import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPrisustva, TipCasa } from '@prisma/client';

export type PrisustvoStatus = 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN';
export type TipCasaInput = 'LEKCIJA' | 'PROVJERA' | 'POSEBNO';

export interface CreateCasPayload {
  slotId: string;
  tipoviCasa: TipCasaInput[];
  lekcije: string[];
  prisutni: {
    ucenikId: string;
    status: PrisustvoStatus;
  }[];
  ocjene: {
    ucenikId: string;
    lekcijaId: string;
    ocjena: number;
    komentar?: string;
  }[];
  napomena?: string;
  // Datum časa – za koji vikend dan se čas vodi (subota/nedjelja)
  datum?: string; // ISO string (opcionalno) – ako nije poslano, koristi se današnji datum
  // Datum i vrijeme unosa (kreiranja) sa frontenda – pomaže kod testiranja i debugovanja
  createdAt?: string; // ISO string (opcionalno)
}

@Injectable()
export class CasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kreira novi čas za dati slot (raspored).
   * Slot (raspored) je obavezan i kroz njega vežemo čas na:
   * - nastavnu godinu
   * - razredNastavnaGodina
   * - grupu
   */
  async create(payload: CreateCasPayload) {
    if (!payload.slotId) {
      throw new BadRequestException('slotId je obavezan');
    }

    // Pronađi raspored i sve relacije potrebne za vezu na nastavnu godinu
    const raspored = await this.prisma.raspored.findUnique({
      where: { id: payload.slotId },
      include: {
        grupa: {
          include: {
            razredNastavnaGodina: {
              include: {
                nastavnaGodina: true,
              },
            },
          },
        },
      },
    });

    if (!raspored) {
      throw new NotFoundException('Raspored (slot) nije pronađen');
    }

    if (!raspored.grupa?.razredNastavnaGodina?.nastavnaGodina) {
      throw new BadRequestException(
        'Raspored nije vezan za ispravnu nastavnu godinu / razred. Provjeri konfiguraciju nastavne godine.',
      );
    }

    const nastavnaGodina = raspored.grupa.razredNastavnaGodina.nastavnaGodina;

    // Datum časa – ako nije došao iz payload-a, koristimo današnji dan (bez vremena)
    let datumCas: Date;
    if (payload.datum) {
      const d = new Date(payload.datum);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Neispravan format datuma');
      }
      datumCas = d;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      datumCas = today;
    }

    // Datum kreiranja (createdAt) – ako dođe sa frontenda, koristimo njega, inače default now()
    let createdAt: Date | undefined;
    if (payload.createdAt) {
      const c = new Date(payload.createdAt);
      if (isNaN(c.getTime())) {
        throw new BadRequestException('Neispravan format createdAt datuma');
      }
      createdAt = c;
    }

    // Očisti ulazne nizove (uniq + filtriranje praznih)
    const tipoviCasa: TipCasa[] = Array.from(
      new Set((payload.tipoviCasa || []) as TipCasaInput[]),
    ) as TipCasa[];
    const lekcijaIds = Array.from(new Set(payload.lekcije || [])).filter(Boolean);

    // Transakcija: kreiraj čas + sve povezane zapise
    const result = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.cas.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredNastavnaGodinaId: raspored.grupa.razredNastavnaGodinaId,
          grupaId: raspored.grupaId,
          rasporedId: raspored.id,
          datum: datumCas,
          // Kreiran vrijeme dolazi sa frontenda (ako je poslano), inače ostaje DB default
          ...(createdAt ? { kreiran: createdAt } : {}),
          tipovi: tipoviCasa,
          napomena: payload.napomena?.trim() || null,
          lekcije: {
            create: lekcijaIds.map((lekcijaId) => ({
              lekcija: {
                connect: { id: lekcijaId },
              },
            })),
          },
          prisustva: {
            create: (payload.prisutni || []).map((p) => ({
              ucenik: {
                connect: { id: p.ucenikId },
              },
              status: p.status as StatusPrisustva,
              ...(createdAt ? { kreiran: createdAt } : {}),
            })),
          },
          ocjene: {
            create: (payload.ocjene || []).map((o) => ({
              ucenik: {
                connect: { id: o.ucenikId },
              },
              lekcija: {
                connect: { id: o.lekcijaId },
              },
              ocjena: o.ocjena,
              komentar: o.komentar?.trim() || null,
              // Za ocjene koristimo polje "vrijeme" kao timestamp unosa
              ...(createdAt ? { vrijeme: createdAt } : {}),
            })),
          },
        },
        include: {
          lekcije: {
            include: {
              lekcija: true,
            },
          },
          prisustva: {
            include: {
              ucenik: {
                include: {
                  korisnik: true,
                },
              },
            },
          },
          ocjene: true,
        },
      });

      return cas;
    });

    return result;
  }

  async findOne(id: string) {
    const cas = await this.prisma.cas.findUnique({
      where: { id },
      include: {
        raspored: true,
        grupa: true,
        nastavnaGodina: true,
        lekcije: {
          include: {
            lekcija: true,
          },
        },
        prisustva: {
          include: {
            ucenik: {
              include: {
                korisnik: true,
              },
            },
          },
        },
        ocjene: true,
      },
    });

    if (!cas) {
      throw new NotFoundException('Čas nije pronađen');
    }

    return cas;
  }

  /**
   * Vraća čas za konkretan slot (raspored) i opcionalni datum.
   * Ako datum nije proslijeđen – vraća poslednji čas za taj slot.
   */
  async findBySlot(slotId: string, datum?: string) {
    if (!slotId) {
      throw new BadRequestException('slotId je obavezan');
    }

    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (datum) {
      const d = new Date(datum);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Neispravan format datuma');
      }
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      dateFilter = { gte: start, lt: end };
    }

    const cas = await this.prisma.cas.findFirst({
      where: {
        rasporedId: slotId,
        ...(dateFilter ? { datum: dateFilter } : {}),
      },
      include: {
        raspored: true,
        grupa: true,
        nastavnaGodina: true,
        lekcije: {
          include: {
            lekcija: true,
          },
        },
        prisustva: {
          include: {
            ucenik: {
              include: {
                korisnik: true,
              },
            },
          },
        },
        ocjene: true,
      },
      orderBy: {
        datum: 'desc',
      },
    });

    return cas;
  }

  /**
   * Ažuriranje časa – najjednostavniji i najčistiji pristup:
   * - ažuriraj osnovne podatke
   * - obriši sve lekcije/prisustva/ocjene
   * - ponovo ih kreiraj iz payload-a
   */
  async update(id: string, payload: CreateCasPayload) {
    const existing = await this.prisma.cas.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Čas nije pronađen');
    }

    let datumCas: Date = existing.datum;
    if (payload.datum) {
      const d = new Date(payload.datum);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Neispravan format datuma');
      }
      datumCas = d;
    }

    const tipoviCasa: TipCasa[] = Array.from(
      new Set((payload.tipoviCasa || []) as TipCasaInput[]),
    ) as TipCasa[];
    const lekcijaIds = Array.from(new Set(payload.lekcije || [])).filter(Boolean);

    const result = await this.prisma.$transaction(async (tx) => {
      // Obriši postojeće povezane zapise
      await tx.casLekcija.deleteMany({ where: { casId: id } });
      await tx.casPrisustvo.deleteMany({ where: { casId: id } });
      await tx.casOcjena.deleteMany({ where: { casId: id } });

      const cas = await tx.cas.update({
        where: { id },
        data: {
          tipovi: tipoviCasa,
          datum: datumCas,
          napomena: payload.napomena?.trim() || null,
          lekcije: {
            create: lekcijaIds.map((lekcijaId) => ({
              lekcija: {
                connect: { id: lekcijaId },
              },
            })),
          },
          prisustva: {
            create: (payload.prisutni || []).map((p) => ({
              ucenik: {
                connect: { id: p.ucenikId },
              },
              status: p.status as StatusPrisustva,
            })),
          },
          ocjene: {
            create: (payload.ocjene || []).map((o) => ({
              ucenik: {
                connect: { id: o.ucenikId },
              },
              lekcija: {
                connect: { id: o.lekcijaId },
              },
              ocjena: o.ocjena,
              komentar: o.komentar?.trim() || null,
            })),
          },
        },
        include: {
          raspored: true,
          grupa: true,
          nastavnaGodina: true,
          lekcije: {
            include: {
              lekcija: true,
            },
          },
          prisustva: {
            include: {
              ucenik: {
                include: {
                  korisnik: true,
                },
              },
            },
          },
          ocjene: true,
        },
      });

      return cas;
    });

    return result;
  }

  /**
   * Statistika lekcija i ocjena za sve učenike jedne grupe.
   *
   * Koristi se u Muallim dashboardu za prikaz:
   * - procenta naučenog gradiva po učeniku
   * - broja lekcija koje je učenik imao
   * - prosječne ocjene učenika
   *
   * Vraća agregirane podatke za sve učenike u datoj grupi.
   */
  async getLessonsStatsForGroup(grupaId: string) {
    if (!grupaId) {
      throw new BadRequestException('grupaId je obavezan');
    }

    // Pronađi grupu i ukupan broj lekcija za razred
    const grupa = await this.prisma.grupa.findUnique({
      where: { id: grupaId },
      include: {
        razredNastavnaGodina: {
          include: {
            razred: {
              include: {
                lekcije: true,
              },
            },
            nastavnaGodina: true,
          },
        },
      },
    });

    if (!grupa || !grupa.razredNastavnaGodina?.razred) {
      throw new NotFoundException('Grupa ili razred nisu pronađeni');
    }

    const totalLessonsForRazred = grupa.razredNastavnaGodina.razred.lekcije.length;
    const nastavnaGodinaNaziv =
      grupa.razredNastavnaGodina.nastavnaGodina?.naziv ?? null;

    // Sve ocjene za časove ove grupe
    const ocjene = await this.prisma.casOcjena.findMany({
      where: {
        cas: {
          grupaId,
        },
      },
      include: {
        lekcija: true,
        cas: {
          select: {
            datum: true,
          },
        },
      },
      orderBy: {
        vrijeme: 'asc',
      },
    });

    type StudentStats = {
      ucenikId: string;
      totalLessons: number;
      learnedLessonsCount: number;
      averageGrade: number | null;
      totalGrades: number;
      lessons: {
        lekcijaId: string;
        naslov: string;
        tip: string | null;
        averageGrade: number;
        lastGrade: number;
        gradesCount: number;
        lastDate: Date;
        ocjene: {
          ocjena: number;
          komentar: string | null;
          datum: Date;
        }[];
      }[];
    };

    const statsByStudent = new Map<string, StudentStats>();

    for (const o of ocjene) {
      const ucenikId = o.ucenikId;
      if (!statsByStudent.has(ucenikId)) {
        statsByStudent.set(ucenikId, {
          ucenikId,
          totalLessons: totalLessonsForRazred,
          learnedLessonsCount: 0,
          averageGrade: null,
          totalGrades: 0,
          lessons: [],
        });
      }

      const studentStats = statsByStudent.get(ucenikId)!;
      studentStats.totalGrades += 1;

      // Grupisanje po lekciji
      let lessonStats = studentStats.lessons.find((l) => l.lekcijaId === o.lekcijaId);
      if (!lessonStats) {
        lessonStats = {
          lekcijaId: o.lekcijaId,
          naslov: o.lekcija.naslov,
          tip: o.lekcija.tip,
          averageGrade: 0,
          lastGrade: o.ocjena,
          gradesCount: 0,
          lastDate: o.cas.datum,
          ocjene: [],
        };
        studentStats.lessons.push(lessonStats);
      }

      lessonStats.gradesCount += 1;
      lessonStats.lastGrade = o.ocjena;
      lessonStats.lastDate = o.cas.datum;
      lessonStats.ocjene.push({
        ocjena: o.ocjena,
        komentar: o.komentar,
        datum: o.cas.datum,
      });
    }

    // Izračun prosjeka po lekciji i učeniku
    statsByStudent.forEach((studentStats) => {
      let gradeSum = 0;

      studentStats.lessons.forEach((lessonStats) => {
        const sum = lessonStats.ocjene.reduce((acc, x) => acc + x.ocjena, 0);
        lessonStats.averageGrade = sum / lessonStats.ocjene.length;
        gradeSum += sum;
      });

      studentStats.learnedLessonsCount = studentStats.lessons.length;
      studentStats.averageGrade =
        studentStats.totalGrades > 0 ? gradeSum / studentStats.totalGrades : null;
    });

    // Pretvori mapu u običan objekat (ucenikId -> StudentStats)
    const result: Record<string, StudentStats> = {};
    statsByStudent.forEach((value, key) => {
      result[key] = value;
    });

    return {
      totalLessonsForRazred,
      nastavnaGodinaNaziv,
      students: result,
    };
  }

  /**
   * Vraća broj časova za svaki datum u opsegu za sve slotove određenog muallima.
   * Koristi se za prikaz statistike u date picker-u.
   */
  async getCasoviCountsByDate(
    nastavnaGodinaId: string,
    muallimId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, { total: number; completed: number }>> {
    // Pronađi sve slotove za ovog muallima u ovoj nastavnoj godini
    const rasporedi = await this.prisma.raspored.findMany({
      where: {
        grupa: {
          razredNastavnaGodina: {
            nastavnaGodinaId,
            muallimId,
          },
        },
      },
      select: {
        id: true,
        dan: true,
      },
    });

    // Grupiši slotove po danu (subota/nedjelja)
    const slotsByDay = {
      subota: rasporedi.filter((r) => r.dan === 'subota').map((r) => r.id),
      nedjelja: rasporedi.filter((r) => r.dan === 'nedjelja').map((r) => r.id),
    };

    // Pronađi sve časove u opsegu datuma
    const casovi = await this.prisma.cas.findMany({
      where: {
        nastavnaGodinaId,
        rasporedId: { in: rasporedi.map((r) => r.id) },
        datum: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        datum: true,
        rasporedId: true,
      },
    });

    // Grupiši časove po datumu
    const casoviByDate = new Map<string, Set<string>>();
    casovi.forEach((cas) => {
      const dateKey = cas.datum.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!casoviByDate.has(dateKey)) {
        casoviByDate.set(dateKey, new Set());
      }
      casoviByDate.get(dateKey)!.add(cas.rasporedId);
    });

    // Izračunaj brojeve za svaki vikend dan u opsegu
    const result = new Map<string, { total: number; completed: number }>();
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateKey = current.toISOString().split('T')[0];
        const daySlots = dayOfWeek === 6 ? slotsByDay.subota : slotsByDay.nedjelja;
        const total = daySlots.length;
        const completed = casoviByDate.get(dateKey)?.size || 0;
        result.set(dateKey, { total, completed });
      }
      current.setDate(current.getDate() + 1);
    }

    return result;
  }
}


