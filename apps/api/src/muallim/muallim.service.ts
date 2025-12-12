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
}


