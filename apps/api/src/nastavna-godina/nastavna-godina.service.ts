import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNastavnaGodinaDto,
  RazredNastavnaGodinaDto,
} from './dto/create-nastavna-godina.dto';
import { StatusNastavneGodine, DanUNedelji } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class NastavnaGodinaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateNastavnaGodinaDto) {
    const { nastavnaGodina, razredi } = payload;

    return this.prisma.$transaction(async (tx) => {
      // Validacija nastavnog plana
      const nastavniPlan = await tx.nastavniPlan.findUnique({
        where: { id: nastavnaGodina.nastavniPlanId },
      });

      if (!nastavniPlan) {
        throw new BadRequestException('Nastavni plan ne postoji');
      }

      // Validacija datuma
      const datumOd = new Date(nastavnaGodina.period.od);
      const datumDo = new Date(nastavnaGodina.period.do);

      if (datumOd >= datumDo) {
        throw new BadRequestException('Datum od mora biti prije datuma do');
      }

      // Kreiranje nastavne godine
      const novaNastavnaGodina = await tx.nastavnaGodina.create({
        data: {
          naziv: nastavnaGodina.naziv,
          opis: nastavnaGodina.opis,
          datumOd,
          datumDo,
          nastavniPlanId: nastavnaGodina.nastavniPlanId,
          status:
            nastavnaGodina.status as StatusNastavneGodine ||
            StatusNastavneGodine.ACTIVE,
        },
      });

      // Validacija i kreiranje razreda
      for (const razredDto of razredi) {
        // Validacija razreda
        const razred = await tx.razred.findUnique({
          where: { id: razredDto.razredId },
        });

        if (!razred) {
          throw new BadRequestException(
            `Razred sa ID ${razredDto.razredId} ne postoji`,
          );
        }

        // Validacija muallima - prvo provjeravamo da li je Korisnik sa ulogom MUALLIM
        const muallimKorisnik = await tx.korisnik.findUnique({
          where: { id: razredDto.muallimId },
          include: { ucenik: true },
        });

        if (!muallimKorisnik || muallimKorisnik.uloga !== 'MUALLIM') {
          throw new BadRequestException(
            `Muallim sa ID ${razredDto.muallimId} ne postoji ili nije muallim`,
          );
        }

        // Ako muallim nema Ucenik zapis, kreiramo ga
        let muallimUcenikId: string;
        if (muallimKorisnik.ucenik) {
          muallimUcenikId = muallimKorisnik.ucenik.id;
        } else {
          // Kreiranje Ucenik zapisa za muallima
          const noviUcenik = await tx.ucenik.create({
            data: {
              korisnikId: muallimKorisnik.id,
              status: 'AKTIVAN',
            },
          });
          muallimUcenikId = noviUcenik.id;
          
          // Ažuriranje Korisnik zapisa da ima lozinku "password" ako nema
          const hashedPassword = await bcrypt.hash('password', 10);
          await tx.korisnik.update({
            where: { id: muallimKorisnik.id },
            data: { lozinka: hashedPassword },
          });
        }

        // Provjera da li razred već postoji u ovoj nastavnoj godini
        const existingRazred = await tx.razredNastavnaGodina.findUnique({
          where: {
            nastavnaGodinaId_razredId: {
              nastavnaGodinaId: novaNastavnaGodina.id,
              razredId: razredDto.razredId,
            },
          },
        });

        if (existingRazred) {
          throw new BadRequestException(
            `Razred ${razred.name} već postoji u ovoj nastavnoj godini`,
          );
        }

        // Kreiranje RazredNastavnaGodina
        const razredNastavnaGodina = await tx.razredNastavnaGodina.create({
          data: {
            nastavnaGodinaId: novaNastavnaGodina.id,
            razredId: razredDto.razredId,
            muallimId: muallimUcenikId, // Koristimo ucenikId, ne korisnikId
            split: razredDto.split,
          },
        });

        // Validacija i kreiranje grupa
        const grupeToCreate = razredDto.split
          ? [
              { naziv: 'A', ucenici: razredDto.ucenici.grupaA },
              {
                naziv: 'B',
                ucenici: razredDto.ucenici.grupaB || [],
              },
            ]
          : [{ naziv: 'A', ucenici: razredDto.ucenici.grupaA }];

        for (const grupaData of grupeToCreate) {
          const postavke =
            grupaData.naziv === 'A'
              ? razredDto.postavkeGrupe.grupaA
              : razredDto.postavkeGrupe.grupaB;

          const raspored =
            grupaData.naziv === 'A'
              ? razredDto.raspored.grupaA
              : razredDto.raspored.grupaB;

          if (!postavke || !raspored) {
            throw new BadRequestException(
              `Nedostaju postavke ili raspored za grupu ${grupaData.naziv}`,
            );
          }

          // Kreiranje grupe
          const grupa = await tx.grupa.create({
            data: {
              razredNastavnaGodinaId: razredNastavnaGodina.id,
              naziv: grupaData.naziv,
              kuran: postavke.kuran,
              sufara: postavke.sufara,
            },
          });

          // Kreiranje rasporeda
          await tx.raspored.create({
            data: {
              grupaId: grupa.id,
              dan: raspored.day as DanUNedelji,
              slot: raspored.slot,
              lokacija: raspored.location,
              trajanje: raspored.duration,
            },
          });

          // Validacija i povezivanje učenika sa grupom
          for (const ucenikId of grupaData.ucenici) {
            // Validacija da učenik postoji
            const ucenik = await tx.ucenik.findUnique({
              where: { id: ucenikId },
            });

            if (!ucenik) {
              throw new BadRequestException(
                `Učenik sa ID ${ucenikId} ne postoji`,
              );
            }

            // Provjera da učenik nije već dodijeljen u drugoj grupi u ovoj nastavnoj godini
            const existingUcenikGrupa = await tx.ucenikGrupa.findFirst({
              where: {
                ucenikId,
                grupa: {
                  razredNastavnaGodina: {
                    nastavnaGodinaId: novaNastavnaGodina.id,
                  },
                },
              },
            });

            if (existingUcenikGrupa) {
              throw new BadRequestException(
                `Učenik sa ID ${ucenikId} je već dodijeljen u drugoj grupi u ovoj nastavnoj godini`,
              );
            }

            // Kreiranje veze učenik-grupa
            await tx.ucenikGrupa.create({
              data: {
                ucenikId,
                grupaId: grupa.id,
              },
            });
          }
        }
      }

      // Vraćanje kreirane nastavne godine sa svim podacima
      return tx.nastavnaGodina.findUnique({
        where: { id: novaNastavnaGodina.id },
        include: {
          nastavniPlan: true,
          razredi: {
            include: {
              razred: true,
              muallim: {
                include: {
                  korisnik: {
                    select: {
                      id: true,
                      ime: true,
                      prezime: true,
                      email: true,
                    },
                  },
                },
              },
              grupe: {
                include: {
                  raspored: true,
                  ucenici: {
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
                },
              },
            },
          },
        },
      });
    });
  }

  async findAll() {
    return this.prisma.nastavnaGodina.findMany({
      orderBy: { kreiran: 'desc' },
      include: {
        nastavniPlan: {
          select: {
            id: true,
            naziv: true,
          },
        },
        razredi: {
          include: {
            razred: true,
            muallim: {
              include: {
                korisnik: {
                  select: {
                    id: true,
                    ime: true,
                    prezime: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, payload: CreateNastavnaGodinaDto) {
    const { nastavnaGodina, razredi } = payload;

    return this.prisma.$transaction(async (tx) => {
      // Provjera da nastavna godina postoji
      const existingGodina = await tx.nastavnaGodina.findUnique({
        where: { id },
      });

      if (!existingGodina) {
        throw new BadRequestException('Nastavna godina ne postoji');
      }

      // Validacija nastavnog plana
      const nastavniPlan = await tx.nastavniPlan.findUnique({
        where: { id: nastavnaGodina.nastavniPlanId },
      });

      if (!nastavniPlan) {
        throw new BadRequestException('Nastavni plan ne postoji');
      }

      // Validacija datuma
      const datumOd = new Date(nastavnaGodina.period.od);
      const datumDo = new Date(nastavnaGodina.period.do);

      if (datumOd >= datumDo) {
        throw new BadRequestException('Datum od mora biti prije datuma do');
      }

      // Ažuriranje osnovnih podataka nastavne godine
      await tx.nastavnaGodina.update({
        where: { id },
        data: {
          naziv: nastavnaGodina.naziv,
          opis: nastavnaGodina.opis,
          datumOd,
          datumDo,
          nastavniPlanId: nastavnaGodina.nastavniPlanId,
          status:
            nastavnaGodina.status as StatusNastavneGodine ||
            StatusNastavneGodine.ACTIVE,
        },
      });

      // Brisanje postojećih razreda (kaskadno će obrisati grupe, rasporede i veze učenik-grupa)
      await tx.razredNastavnaGodina.deleteMany({
        where: { nastavnaGodinaId: id },
      });

      // Kreiranje novih razreda (isti kod kao u create metodi)
      for (const razredDto of razredi) {
        // Validacija razreda
        const razred = await tx.razred.findUnique({
          where: { id: razredDto.razredId },
        });

        if (!razred) {
          throw new BadRequestException(
            `Razred sa ID ${razredDto.razredId} ne postoji`,
          );
        }

        // Validacija muallima - prvo provjeravamo da li je Korisnik sa ulogom MUALLIM
        const muallimKorisnik = await tx.korisnik.findUnique({
          where: { id: razredDto.muallimId },
          include: { ucenik: true },
        });

        if (!muallimKorisnik || muallimKorisnik.uloga !== 'MUALLIM') {
          throw new BadRequestException(
            `Muallim sa ID ${razredDto.muallimId} ne postoji ili nije muallim`,
          );
        }

        // Ako muallim nema Ucenik zapis, kreiramo ga
        let muallimUcenikId: string;
        if (muallimKorisnik.ucenik) {
          muallimUcenikId = muallimKorisnik.ucenik.id;
        } else {
          // Kreiranje Ucenik zapisa za muallima
          const noviUcenik = await tx.ucenik.create({
            data: {
              korisnikId: muallimKorisnik.id,
              status: 'AKTIVAN',
            },
          });
          muallimUcenikId = noviUcenik.id;
          
          // Ažuriranje Korisnik zapisa da ima lozinku "password" ako nema
          const hashedPassword = await bcrypt.hash('password', 10);
          await tx.korisnik.update({
            where: { id: muallimKorisnik.id },
            data: { lozinka: hashedPassword },
          });
        }

        // Kreiranje RazredNastavnaGodina
        const razredNastavnaGodina = await tx.razredNastavnaGodina.create({
          data: {
            nastavnaGodinaId: id,
            razredId: razredDto.razredId,
            muallimId: muallimUcenikId,
            split: razredDto.split,
          },
        });

        // Validacija i kreiranje grupa
        const grupeToCreate = razredDto.split
          ? [
              { naziv: 'A', ucenici: razredDto.ucenici.grupaA },
              {
                naziv: 'B',
                ucenici: razredDto.ucenici.grupaB || [],
              },
            ]
          : [{ naziv: 'A', ucenici: razredDto.ucenici.grupaA }];

        for (const grupaData of grupeToCreate) {
          const postavke =
            grupaData.naziv === 'A'
              ? razredDto.postavkeGrupe.grupaA
              : razredDto.postavkeGrupe.grupaB;

          const raspored =
            grupaData.naziv === 'A'
              ? razredDto.raspored.grupaA
              : razredDto.raspored.grupaB;

          if (!postavke || !raspored) {
            throw new BadRequestException(
              `Nedostaju postavke ili raspored za grupu ${grupaData.naziv}`,
            );
          }

          // Kreiranje grupe
          const grupa = await tx.grupa.create({
            data: {
              razredNastavnaGodinaId: razredNastavnaGodina.id,
              naziv: grupaData.naziv,
              kuran: postavke.kuran,
              sufara: postavke.sufara,
            },
          });

          // Kreiranje rasporeda
          await tx.raspored.create({
            data: {
              grupaId: grupa.id,
              dan: raspored.day as DanUNedelji,
              slot: raspored.slot,
              lokacija: raspored.location,
              trajanje: raspored.duration,
            },
          });

          // Validacija i povezivanje učenika sa grupom
          for (const ucenikId of grupaData.ucenici) {
            // Validacija da učenik postoji
            const ucenik = await tx.ucenik.findUnique({
              where: { id: ucenikId },
            });

            if (!ucenik) {
              throw new BadRequestException(
                `Učenik sa ID ${ucenikId} ne postoji`,
              );
            }

            // Provjera da učenik nije već dodijeljen u drugoj grupi u ovoj nastavnoj godini
            const existingUcenikGrupa = await tx.ucenikGrupa.findFirst({
              where: {
                ucenikId,
                grupa: {
                  razredNastavnaGodina: {
                    nastavnaGodinaId: id,
                  },
                },
              },
            });

            if (existingUcenikGrupa) {
              throw new BadRequestException(
                `Učenik sa ID ${ucenikId} je već dodijeljen u drugoj grupi u ovoj nastavnoj godini`,
              );
            }

            // Kreiranje veze učenik-grupa
            await tx.ucenikGrupa.create({
              data: {
                ucenikId,
                grupaId: grupa.id,
              },
            });
          }
        }
      }

      // Vraćanje ažurirane nastavne godine sa svim podacima
      return tx.nastavnaGodina.findUnique({
        where: { id },
        include: {
          nastavniPlan: true,
          razredi: {
            include: {
              razred: true,
              muallim: {
                include: {
                  korisnik: {
                    select: {
                      id: true,
                      ime: true,
                      prezime: true,
                      email: true,
                    },
                  },
                },
              },
              grupe: {
                include: {
                  raspored: true,
                  ucenici: {
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
                },
              },
            },
          },
        },
      });
    });
  }

  async findOne(id: string) {
    const nastavnaGodina = await this.prisma.nastavnaGodina.findUnique({
      where: { id },
      include: {
        nastavniPlan: true,
        razredi: {
          include: {
            razred: true,
            muallim: {
              include: {
                korisnik: {
                  select: {
                    id: true,
                    ime: true,
                    prezime: true,
                    email: true,
                  },
                },
              },
            },
            grupe: {
              include: {
                raspored: true,
                ucenici: {
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
              },
            },
          },
        },
      },
    });

    if (!nastavnaGodina) {
      throw new BadRequestException('Nastavna godina ne postoji');
    }

    return nastavnaGodina;
  }
}



