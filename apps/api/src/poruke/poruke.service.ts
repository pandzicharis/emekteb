import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PorukeService {
  private readonly logger = new Logger(PorukeService.name);

  constructor(private prisma: PrismaService) {}

  async posaljiPoruku(posiljalacId: string, primalacId: string, naslov: string, sadrzaj: string) {
    // Provjeri da li primalac postoji
    const primalac = await this.prisma.korisnik.findUnique({
      where: { id: primalacId },
    });

    if (!primalac) {
      throw new NotFoundException('Primalac poruke nije pronađen');
    }

    // Provjeri da li je posiljalac isti kao primalac
    if (posiljalacId === primalacId) {
      throw new BadRequestException('Ne možete poslati poruku sami sebi');
    }

    // Kreiraj poruku
    const poruka = await this.prisma.poruka.create({
      data: {
        posiljalacId,
        primalacId,
        naslov,
        sadrzaj,
      },
      include: {
        posiljalac: {
          select: {
            id: true,
            ime: true,
            prezime: true,
            email: true,
            fotografija: true,
          },
        },
        primalac: {
          select: {
            id: true,
            ime: true,
            prezime: true,
            email: true,
          },
        },
      },
    });

    return poruka;
  }

  async getPrimljenePoruke(korisnikId: string) {
    const poruke = await this.prisma.poruka.findMany({
      where: {
        primalacId: korisnikId,
      },
      include: {
        posiljalac: {
          select: {
            id: true,
            ime: true,
            prezime: true,
            email: true,
            fotografija: true,
            uloga: true,
          },
        },
      },
      orderBy: {
        kreiran: 'desc',
      },
    });

    return poruke;
  }

  async getPoslatePoruke(korisnikId: string) {
    const poruke = await this.prisma.poruka.findMany({
      where: {
        posiljalacId: korisnikId,
      },
      include: {
        primalac: {
          select: {
            id: true,
            ime: true,
            prezime: true,
            email: true,
            fotografija: true,
            uloga: true,
          },
        },
      },
      orderBy: {
        kreiran: 'desc',
      },
    });

    return poruke;
  }

  async oznaciKaoProcitano(porukaId: string, korisnikId: string) {
    const poruka = await this.prisma.poruka.findUnique({
      where: { id: porukaId },
    });

    if (!poruka) {
      throw new NotFoundException('Poruka nije pronađena');
    }

    // Provjeri da li korisnik može označiti ovu poruku kao pročitanu (mora biti primalac)
    if (poruka.primalacId !== korisnikId) {
      throw new BadRequestException('Nemate pravo da označite ovu poruku kao pročitanu');
    }

    const azurirana = await this.prisma.poruka.update({
      where: { id: porukaId },
      data: { procitana: true },
    });

    return azurirana;
  }

  async obrisiPoruku(porukaId: string, korisnikId: string) {
    const poruka = await this.prisma.poruka.findUnique({
      where: { id: porukaId },
    });

    if (!poruka) {
      throw new NotFoundException('Poruka nije pronađena');
    }

    // Provjeri da li korisnik može obrisati poruku (mora biti pošiljalac ili primalac)
    if (poruka.posiljalacId !== korisnikId && poruka.primalacId !== korisnikId) {
      throw new BadRequestException('Nemate pravo da obrišete ovu poruku');
    }

    await this.prisma.poruka.delete({
      where: { id: porukaId },
    });

    return { message: 'Poruka je uspješno obrisana' };
  }

  async getMoguciPrimaoci(korisnikId: string, uloga: string) {
    // Ako je RODITELJ, vraća muallime koji predaju njihovoj djeci
    if (uloga === 'RODITELJ') {
      // Pronađi djecu roditelja
      const roditeljKorisnik = await this.prisma.korisnik.findUnique({
        where: { id: korisnikId },
        include: {
          ucenik: {
            include: {
              grupe: {
                include: {
                  grupa: {
                    include: {
                      razredNastavnaGodina: {
                        include: {
                          razred: true,
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

      if (!roditeljKorisnik) {
        return [];
      }

      // Pronađi muallime koji predaju u grupama gdje su djeca roditelja
      // Ovo je kompleksnije, za sada ćemo vratiti sve muallime
      const muallimi = await this.prisma.korisnik.findMany({
        where: {
          uloga: 'MUALLIM',
          aktivan: true,
        },
        select: {
          id: true,
          ime: true,
          prezime: true,
          email: true,
          fotografija: true,
        },
        orderBy: [
          { ime: 'asc' },
          { prezime: 'asc' },
        ],
      });

      return muallimi;
    }

    // Ako je MUALLIM, vraća roditelje učenika koji su u njegovim grupama
    if (uloga === 'MUALLIM') {
      // Pronađi sve roditelje učenika koji su u grupama gdje muallim predaje
      // Za sada ćemo vratiti sve roditelje
      const roditeljiKorisnici = await this.prisma.korisnik.findMany({
        where: {
          uloga: 'RODITELJ',
          aktivan: true,
        },
        select: {
          id: true,
          ime: true,
          prezime: true,
          email: true,
          fotografija: true,
        },
        orderBy: [
          { ime: 'asc' },
          { prezime: 'asc' },
        ],
      });

      return roditeljiKorisnici;
    }

    // Za ADMIN, vraća sve korisnike
    if (uloga === 'ADMIN') {
      const korisnici = await this.prisma.korisnik.findMany({
        where: {
          aktivan: true,
          id: {
            not: korisnikId,
          },
        },
        select: {
          id: true,
          ime: true,
          prezime: true,
          email: true,
          fotografija: true,
          uloga: true,
        },
        orderBy: [
          { uloga: 'asc' },
          { ime: 'asc' },
          { prezime: 'asc' },
        ],
      });

      return korisnici;
    }

    return [];
  }
}

