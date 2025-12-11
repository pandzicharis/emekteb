import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MuallimService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.korisnik.findMany({
      where: { uloga: 'MUALLIM', aktivan: true },
      select: {
        id: true,
        ime: true,
        prezime: true,
        email: true,
      },
      orderBy: [{ ime: 'asc' }, { prezime: 'asc' }],
    });
  }
}

