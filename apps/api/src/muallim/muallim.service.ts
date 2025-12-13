import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MuallimService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'muallimi');

  constructor(private readonly prisma: PrismaService) {
    // Kreiraj uploads direktorijum ako ne postoji
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private async generateUniquePin(): Promise<string> {
    let pin: string = '';
    let exists = true;
    
    while (exists) {
      // Generiši 4-cifreni PIN
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      const existing = await this.prisma.korisnik.findUnique({
        where: { pin },
      });
      exists = !!existing;
    }
    
    return pin;
  }

  findAll() {
    return this.prisma.korisnik.findMany({
      where: { uloga: 'MUALLIM' },
      select: {
        id: true,
        ime: true,
        prezime: true,
        email: true,
        aktivan: true,
        fotografija: true,
        pin: true,
        kreiran: true,
        azuriran: true,
      },
      orderBy: [{ ime: 'asc' }, { prezime: 'asc' }],
    });
  }

  findForQuickLogin() {
    return this.prisma.korisnik.findMany({
      where: { 
        uloga: 'MUALLIM',
        aktivan: true,
        pin: { not: null },
        poslednjeLogiranje: { not: null }, // Samo korisnici koji su se logirali
      },
      select: {
        id: true,
        ime: true,
        prezime: true,
        fotografija: true,
        pin: true,
        poslednjeLogiranje: true,
      },
      orderBy: { poslednjeLogiranje: 'desc' }, // Sortiraj po vremenu logiranja (najnoviji prvo)
    });
  }

  async findOne(id: string) {
    const muallim = await this.prisma.korisnik.findFirst({
      where: { id },
      select: {
        id: true,
        ime: true,
        prezime: true,
        email: true,
        aktivan: true,
        fotografija: true,
        pin: true,
        uloga: true,
        kreiran: true,
        azuriran: true,
      },
    });

    if (!muallim) {
      throw new NotFoundException('Muallim nije pronađen');
    }

    return muallim;
  }

  async create(data: {
    ime: string;
    prezime: string;
    email: string;
    lozinka: string;
    pin?: string;
  }) {
    // Provjeri da li email već postoji
    const existing = await this.prisma.korisnik.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('Email već postoji');
    }

    // Hash lozinke
    const hashedPassword = await bcrypt.hash(data.lozinka, 10);

    // Koristi proslijeđeni PIN ili generiši jedinstveni PIN
    let pin: string;
    if (data.pin && data.pin.trim()) {
      // Provjeri da li PIN već postoji
      const existingPin = await this.prisma.korisnik.findUnique({
        where: { pin: data.pin.trim() },
      });
      if (existingPin) {
        throw new BadRequestException('PIN već postoji');
      }
      pin = data.pin.trim();
    } else {
      pin = await this.generateUniquePin();
    }

    return this.prisma.korisnik.create({
      data: {
        ime: data.ime,
        prezime: data.prezime,
        email: data.email,
        lozinka: hashedPassword,
        uloga: 'MUALLIM',
        aktivan: true,
        pin,
      },
      select: {
        id: true,
        ime: true,
        prezime: true,
        email: true,
        aktivan: true,
        fotografija: true,
        pin: true,
        kreiran: true,
        azuriran: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      ime?: string;
      prezime?: string;
      email?: string;
      lozinka?: string;
      pin?: string;
      aktivan?: boolean;
      uloga?: never; // Eksplicitno zabranjeno - uloga se nikad ne mijenja kroz update
    },
  ) {
    const muallim = await this.findOne(id);

    // Ukloni uloga iz data ako je poslato (ne smije se mijenjati)
    const { uloga, ...updateDataWithoutUloga } = data as any;

    // Provjeri email ako se mijenja
    if (updateDataWithoutUloga.email && updateDataWithoutUloga.email !== muallim.email) {
      const existing = await this.prisma.korisnik.findUnique({
        where: { email: updateDataWithoutUloga.email },
      });

      if (existing) {
        throw new BadRequestException('Email već postoji');
      }
    }

    // Provjeri PIN ako se mijenja
    if (updateDataWithoutUloga.pin && updateDataWithoutUloga.pin.trim() && updateDataWithoutUloga.pin !== muallim.pin) {
      const existingPin = await this.prisma.korisnik.findUnique({
        where: { pin: updateDataWithoutUloga.pin.trim() },
      });
      if (existingPin) {
        throw new BadRequestException('PIN već postoji');
      }
    }

    const updateData: any = {
      ...(updateDataWithoutUloga.ime && { ime: updateDataWithoutUloga.ime }),
      ...(updateDataWithoutUloga.prezime && { prezime: updateDataWithoutUloga.prezime }),
      ...(updateDataWithoutUloga.email && { email: updateDataWithoutUloga.email }),
      ...(updateDataWithoutUloga.aktivan !== undefined && { aktivan: updateDataWithoutUloga.aktivan }),
    };

    // Hash lozinke ako se mijenja
    if (data.lozinka) {
      updateData.lozinka = await bcrypt.hash(data.lozinka, 10);
    }

    // Ažuriraj PIN ako je proslijeđen
    if (data.pin !== undefined && data.pin !== null) {
      if (data.pin.trim()) {
        updateData.pin = data.pin.trim();
      } else {
        // Ako je prazan string, generiši novi PIN
        updateData.pin = await this.generateUniquePin();
      }
    }

    return this.prisma.korisnik.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        ime: true,
        prezime: true,
        email: true,
        aktivan: true,
        fotografija: true,
        pin: true,
        kreiran: true,
        azuriran: true,
      },
    });
  }

  async delete(id: string) {
    const muallim = await this.findOne(id);

    // Obriši fotografiju ako postoji
    if (muallim.fotografija) {
      const filePath = path.join(this.uploadsDir, path.basename(muallim.fotografija));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.korisnik.delete({
      where: { id },
    });

    return { message: 'Muallim je uspješno obrisan' };
  }

  async uploadPhoto(id: string, file: any): Promise<string> {
    const muallim = await this.findOne(id);

    // Obriši staru fotografiju ako postoji
    if (muallim.fotografija) {
      const oldFilePath = path.join(this.uploadsDir, path.basename(muallim.fotografija));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Generiši jedinstveno ime fajla
    // Koristi ekstenziju iz originalname ili mimetype
    let fileExt = '.jpg'; // default
    if (file.originalname) {
      const ext = path.extname(file.originalname);
      if (ext) {
        fileExt = ext;
      }
    } else if (file.mimetype) {
      // Ako nema originalname, koristi mimetype
      if (file.mimetype.includes('png')) fileExt = '.png';
      else if (file.mimetype.includes('webp')) fileExt = '.webp';
      else if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) fileExt = '.jpg';
    }
    
    const fileName = `${id}-${Date.now()}${fileExt}`;
    const filePath = path.join(this.uploadsDir, fileName);

    // Sačuvaj fajl
    fs.writeFileSync(filePath, file.buffer);

    // Ažuriraj muallima sa novom fotografijom
    const photoUrl = `/uploads/muallimi/${fileName}`;
    await this.prisma.korisnik.update({
      where: { id },
      data: { fotografija: photoUrl },
    });

    return photoUrl;
  }

  async getDashboardData(korisnikId: string, selectedDay?: 'subota' | 'nedjelja') {
    if (!korisnikId) {
      throw new BadRequestException('Korisnik ID je obavezan');
    }

    // Pronađi muallim korisnika i njegov Ucenik zapis
    const korisnik = await this.prisma.korisnik.findUnique({
      where: { id: korisnikId },
      include: { ucenik: true },
    });

    if (!korisnik) {
      throw new NotFoundException(`Korisnik sa ID ${korisnikId} nije pronađen`);
    }

    if (korisnik.uloga !== 'MUALLIM') {
      throw new BadRequestException(
        `Korisnik sa ID ${korisnikId} nije muallim. Trenutna uloga: ${korisnik.uloga}. Dashboard je dostupan samo za muallime.`,
      );
    }

    // Ako muallim nema Ucenik zapis, kreiramo ga (kao što se radi u nastavna-godina.service.ts)
    let muallimUcenikId: string;
    if (korisnik.ucenik) {
      muallimUcenikId = korisnik.ucenik.id;
    } else {
      // Kreiranje Ucenik zapisa za muallima
      const noviUcenik = await this.prisma.ucenik.create({
        data: {
          korisnikId: korisnik.id,
          status: 'AKTIVAN',
        },
      });
      muallimUcenikId = noviUcenik.id;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pronađi aktivnu nastavnu godinu gdje je danasnji datum između datumOd i datumDo
    const nastavnaGodina = await this.prisma.nastavnaGodina.findFirst({
      where: {
        status: 'ACTIVE',
        datumOd: { lte: today },
        datumDo: { gte: today },
      },
      include: {
        nastavniPlan: {
          select: {
            id: true,
            naziv: true,
            opis: true,
          },
        },
      },
      orderBy: { kreiran: 'desc' },
    });

    if (!nastavnaGodina) {
      return {
        nastavnaGodina: null,
        razredi: [],
        raspored: [],
        statistike: {
          ukupnoRazreda: 0,
          ukupnoUcenika: 0,
          ukupnoGrupa: 0,
        },
      };
    }

    // Pronađi sve razrede dodijeljene ovom muallimu u ovoj nastavnoj godini
    const razrediNastavneGodine = await this.prisma.razredNastavnaGodina.findMany({
      where: {
        nastavnaGodinaId: nastavnaGodina.id,
        muallimId: muallimUcenikId,
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
            raspored: true,
            ucenici: {
              include: {
                ucenik: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Pripremi podatke o razredima sa brojem djece
    const razredi = razrediNastavneGodine.map((rng) => {
      const ukupnoUcenika = rng.grupe.reduce((sum, grupa) => sum + grupa.ucenici.length, 0);
      
      return {
        id: rng.id,
        razred: {
          id: rng.razred.id,
          name: rng.razred.name,
          ilmihal: rng.razred.ilmihal,
        },
        split: rng.split,
        ukupnoUcenika,
        grupe: rng.grupe.map((grupa) => ({
          id: grupa.id,
          naziv: grupa.naziv,
          kuran: grupa.kuran,
          sufara: grupa.sufara,
          brojUcenika: grupa.ucenici.length,
          raspored: grupa.raspored,
        })),
      };
    });

    // Odredi dan za raspored (subota ili nedjelja)
    // Ako je selectedDay proslijeđen, koristi ga, inače koristi trenutni dan
    let danZaRaspored: 'subota' | 'nedjelja';
    if (selectedDay) {
      danZaRaspored = selectedDay;
    } else {
      const dayOfWeek = today.getDay(); // 0 = nedjelja, 6 = subota
      danZaRaspored = dayOfWeek === 6 ? 'subota' : 'nedjelja';
    }

    // Pronađi SVE rasporede (za statistike i ukupne sate), bez obzira na dan
    const sviRasporedi = await this.prisma.raspored.findMany({
      where: {
        grupa: {
          razredNastavnaGodina: {
            nastavnaGodinaId: nastavnaGodina.id,
            muallimId: muallimUcenikId,
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
      orderBy: {
        slot: 'asc',
      },
    });

    // Helper funkcija za mapiranje rasporeda
    const mapRaspored = (r: any) => {
      const [hours, minutes] = r.slot.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + (r.trajanje || 45));

      return {
        id: r.id,
        grupa: {
          id: r.grupa.id,
          naziv: r.grupa.naziv,
          razred: {
            id: r.grupa.razredNastavnaGodina.razred.id,
            name: r.grupa.razredNastavnaGodina.razred.name,
            ilmihal: r.grupa.razredNastavnaGodina.razred.ilmihal,
          },
          kuran: r.grupa.kuran,
          sufara: r.grupa.sufara,
          brojUcenika: r.grupa.ucenici.length,
        },
        dan: r.dan,
        slot: r.slot,
        lokacija: r.lokacija,
        trajanje: r.trajanje,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
    };

    // Pripremi timeline podatke - filtriraj po danu za prikaz kalendara
    const raspored = sviRasporedi
      .filter((r) => r.dan === danZaRaspored)
      .map(mapRaspored);

    // Svi rasporedi za statistike (bez filtriranja po danu)
    const sviRasporediZaStatistike = sviRasporedi.map(mapRaspored);

    // Izračunaj statistike - koristi SVE rasporede za tačne statistike
    const statistike = {
      ukupnoRazreda: razredi.length,
      ukupnoUcenika: razredi.reduce((sum, r) => sum + r.ukupnoUcenika, 0),
      ukupnoGrupa: razredi.reduce((sum, r) => sum + r.grupe.length, 0),
      danasnjiCasovi: raspored.length, // Filtrirani raspored za odabrani dan
    };

    return {
      nastavnaGodina: {
        id: nastavnaGodina.id,
        naziv: nastavnaGodina.naziv,
        opis: nastavnaGodina.opis,
        datumOd: nastavnaGodina.datumOd,
        datumDo: nastavnaGodina.datumDo,
        nastavniPlan: nastavnaGodina.nastavniPlan,
      },
      razredi,
      raspored, // Filtrirano po danu za prikaz kalendara
      sviRasporedi: sviRasporediZaStatistike, // Svi slotovi za statistike
      statistike,
      odabraniDan: danZaRaspored,
    };
  }
}


