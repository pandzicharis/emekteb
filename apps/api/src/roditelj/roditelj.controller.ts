import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { RoditeljService } from './roditelj.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('roditelj')
export class RoditeljController {
  constructor(private readonly roditeljService: RoditeljService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Request() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Korisnik nije autentifikovan');
    }
    const korisnikId = req.user.id;
    return this.roditeljService.getDashboardData(korisnikId);
  }

  @Get('ucenici')
  @UseGuards(JwtAuthGuard)
  async getUcenici(@Request() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Korisnik nije autentifikovan');
    }
    const korisnikId = req.user.id;
    return this.roditeljService.getUcenici(korisnikId);
  }

  @Get('ucenik/:id/prisustvo')
  @UseGuards(JwtAuthGuard)
  async getPrisustvo(
    @Param('id') ucenikId: string,
    @Query('nastavnaGodinaId') nastavnaGodinaId?: string,
  ) {
    return this.roditeljService.getPrisustvo(ucenikId, nastavnaGodinaId);
  }

  @Get('ucenik/:id/ocjene')
  @UseGuards(JwtAuthGuard)
  async getOcjene(
    @Param('id') ucenikId: string,
    @Query('nastavnaGodinaId') nastavnaGodinaId?: string,
  ) {
    return this.roditeljService.getOcjene(ucenikId, nastavnaGodinaId);
  }

  @Get('ucenik/:id/napredak')
  @UseGuards(JwtAuthGuard)
  async getNapredak(
    @Param('id') ucenikId: string,
    @Query('nastavnaGodinaId') nastavnaGodinaId?: string,
  ) {
    return this.roditeljService.getNapredak(ucenikId, nastavnaGodinaId);
  }

  @Get('ucenik/:id/raspored')
  @UseGuards(JwtAuthGuard)
  async getRaspored(
    @Param('id') ucenikId: string,
    @Query('nastavnaGodinaId') nastavnaGodinaId?: string,
  ) {
    return this.roditeljService.getRaspored(ucenikId, nastavnaGodinaId);
  }
}

