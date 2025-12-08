import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ucenici')
  async getUcenici() {
    const ucenici = await this.prisma.ucenik.findMany({
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
      where: {
        korisnik: {
          aktivan: true,
        },
      },
    });

    return ucenici.map((ucenik) => ({
      id: ucenik.id,
      ime: ucenik.korisnik?.ime || '',
      prezime: ucenik.korisnik?.prezime || '',
      email: ucenik.korisnik?.email || undefined,
    }));
  }
}

