import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SkolaHifzaService } from './skola-hifza.service';
import { UpdateNapredakDto } from './dto/update-napredak.dto';
import { CreateCasDto } from './dto/create-cas.dto';
import { UpdateCasDto } from './dto/update-cas.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('skola-hifza')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SkolaHifzaController {
  constructor(
    private readonly skolaHifzaService: SkolaHifzaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /skola-hifza/nastavna-godina/:id
   * Dohvati SkolaHifza zapis za nastavnu godinu
   */
  @Get('nastavna-godina/:id')
  @Roles('MUALLIM', 'ADMIN')
  async findByNastavnaGodina(@Param('id') nastavnaGodinaId: string) {
    return this.skolaHifzaService.findByNastavnaGodina(nastavnaGodinaId);
  }

  /**
   * GET /skola-hifza/cas/:casId
   * Dohvati SkolaHifzaCas po ID-u
   */
  @Get('cas/:casId')
  @Roles('MUALLIM', 'ADMIN')
  async getCas(@Param('casId') casId: string) {
    return this.skolaHifzaService.getCas(casId);
  }

  /**
   * GET /skola-hifza/cas/slot/:slotId/date/:datum
   * Pronađi SkolaHifzaCas po slotId i datumu
   */
  @Get('cas/slot/:slotId/date/:datum')
  @Roles('MUALLIM', 'ADMIN')
  async findCasBySlotAndDate(
    @Param('slotId') slotId: string,
    @Param('datum') datum: string,
  ) {
    return this.skolaHifzaService.findCasBySlotAndDate(slotId, datum);
  }

  /**
   * POST /skola-hifza/cas
   * Kreiraj novi SkolaHifzaCas
   */
  @Post('cas')
  @Roles('MUALLIM', 'ADMIN')
  async createCas(@Body() createCasDto: CreateCasDto, @Request() req: any) {
    // createCasDto.rasporedId je ID iz regularnog Raspored tabele (sada slotId)
    // Pronađi SkolaHifza za nastavnu godinu
    const slot = await this.prisma.raspored.findUnique({
      where: { id: createCasDto.rasporedId },
      include: {
        grupa: {
          include: {
            razredNastavnaGodina: {
              include: {
                nastavnaGodina: true,
                razred: true,
              },
            },
          },
        },
      },
    });

    if (!slot || !slot.grupa) {
      throw new NotFoundException(`Raspored sa ID ${createCasDto.rasporedId} nije pronađen`);
    }

    if (slot.grupa.razredNastavnaGodina.razred.ilmihal !== 'SKOLA_HIFZA') {
      throw new BadRequestException('Raspored ne pripada Školi Hifza');
    }

    const nastavnaGodinaId = slot.grupa.razredNastavnaGodina.nastavnaGodinaId;
    const skolaHifza = await this.skolaHifzaService.findByNastavnaGodina(nastavnaGodinaId);

    return this.skolaHifzaService.createCas(
      skolaHifza.id,
      createCasDto.rasporedId, // Koristimo direktno ID iz regularnog Raspored
      createCasDto.datum,
      createCasDto.napomena,
      createCasDto.napredak,
      createCasDto.komentari,
      createCasDto.prisutni,
    );
  }

  /**
   * PUT /skola-hifza/cas/:casId
   * Ažuriraj postojeći SkolaHifzaCas
   */
  @Put('cas/:casId')
  @Roles('MUALLIM', 'ADMIN')
  async updateCas(@Param('casId') casId: string, @Body() updateCasDto: UpdateCasDto) {
    return this.skolaHifzaService.updateCas(
      casId,
      updateCasDto.napomena,
      updateCasDto.napredak,
      updateCasDto.komentari,
      updateCasDto.prisutni,
    );
  }

  /**
   * GET /skola-hifza/:skolaHifzaId/ucenici/:ucenikId/napredak
   * Dohvati napredak učenika
   */
  @Get(':skolaHifzaId/ucenici/:ucenikId/napredak')
  @Roles('MUALLIM', 'ADMIN')
  async getNapredak(
    @Param('skolaHifzaId') skolaHifzaId: string,
    @Param('ucenikId') ucenikId: string,
  ) {
    return this.skolaHifzaService.getNapredak(skolaHifzaId, ucenikId);
  }

  /**
   * POST /skola-hifza/:skolaHifzaId/ucenici/:ucenikId/napredak
   * Ažuriraj napredak učenika
   */
  @Post(':skolaHifzaId/ucenici/:ucenikId/napredak')
  @Roles('MUALLIM', 'ADMIN')
  async updateNapredak(
    @Param('skolaHifzaId') skolaHifzaId: string,
    @Param('ucenikId') ucenikId: string,
    @Body() updateNapredakDto: UpdateNapredakDto,
    @Request() req: any,
  ) {
    // Pronađi muallim ID iz JWT tokena
    const korisnikId = req.user.id;
    const korisnik = await this.prisma.korisnik.findUnique({
      where: { id: korisnikId },
      include: { ucenik: true },
    });

    if (!korisnik || !korisnik.ucenik) {
      throw new NotFoundException('Muallim nije pronađen');
    }

    const muallimId = korisnik.ucenik.id;

    return this.skolaHifzaService.updateNapredak(
      skolaHifzaId,
      ucenikId,
      muallimId,
      updateNapredakDto.napredak,
    );
  }
}
