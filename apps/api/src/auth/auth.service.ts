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
    };
  }
}

