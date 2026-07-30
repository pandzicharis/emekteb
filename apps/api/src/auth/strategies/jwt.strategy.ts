import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.korisnik.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.aktivan) {
      throw new UnauthorizedException('Korisnik nije aktivan ili ne postoji');
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


















