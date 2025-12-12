import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.korisnik.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Neispravni podaci za prijavu');
    }

    if (!user.aktivan) {
      throw new UnauthorizedException('Korisnički nalog nije aktivan');
    }

    const isPasswordValid = await compare(loginDto.lozinka, user.lozinka);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Neispravni podaci za prijavu');
    }

    // Ažuriraj vreme poslednjeg logiranja
    await this.prisma.korisnik.update({
      where: { id: user.id },
      data: { poslednjeLogiranje: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email!,
      uloga: user.uloga,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        uloga: user.uloga,
        ime: user.ime,
        prezime: user.prezime,
        fotografija: user.fotografija,
        pin: user.uloga === 'MUALLIM' ? user.pin : undefined,
      },
    };
  }

  async loginWithPin(pin: string, userId?: string) {
    console.log('🔐 loginWithPin called with:', { pin, userId });
    
    // Ako je userId proslijeđen, provjeri i PIN i ID
    // Ako nije, koristi samo PIN (fallback za kompatibilnost)
    const whereClause = userId 
      ? { id: userId, pin: pin }
      : { pin: pin };
    
    console.log('🔍 Searching for user with:', whereClause);
    
    const user = await this.prisma.korisnik.findFirst({
      where: whereClause,
    });

    console.log('👤 User found:', user ? { id: user.id, ime: user.ime, prezime: user.prezime, pin: user.pin } : 'null');

    if (!user) {
      throw new UnauthorizedException('Neispravan PIN ili korisnik');
    }

    if (!user.aktivan) {
      throw new UnauthorizedException('Korisnički nalog nije aktivan');
    }

    // Ažuriraj vreme poslednjeg logiranja
    await this.prisma.korisnik.update({
      where: { id: user.id },
      data: { poslednjeLogiranje: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email!,
      uloga: user.uloga,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        uloga: user.uloga,
        ime: user.ime,
        prezime: user.prezime,
        fotografija: user.fotografija,
        pin: user.uloga === 'MUALLIM' ? user.pin : undefined,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.korisnik.findUnique({
      where: { id: userId },
    });

    if (!user || !user.aktivan) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      uloga: user.uloga,
      ime: user.ime,
      prezime: user.prezime,
      fotografija: user.fotografija,
    };
  }
}

