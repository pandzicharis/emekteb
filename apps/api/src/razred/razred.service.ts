import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RazredService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.razred.findMany({
      orderBy: { name: 'asc' },
    });
  }
}







