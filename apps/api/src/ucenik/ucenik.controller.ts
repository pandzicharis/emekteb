import { Controller, Get, Put, Post, Param, Query, Body, UseGuards, Logger } from '@nestjs/common';
import { UcenikService } from './ucenik.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ucenici')
export class UcenikController {
  private readonly logger = new Logger(UcenikController.name);

  constructor(private readonly ucenikService: UcenikService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('razredNaziv') razredNaziv?: string,
    @Query('all') all?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const allUcenici = all === 'true';
    
    this.logger.log(`Fetching ucenici - page: ${pageNum}, limit: ${limitNum}, razredNaziv: ${razredNaziv}, all: ${allUcenici}`);
    
    return this.ucenikService.findAll(pageNum, limitNum, razredNaziv, allUcenici);
  }

  @Get('razredi')
  @UseGuards(JwtAuthGuard)
  getRazredi() {
    return this.ucenikService.getRazrediWithCount();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.ucenikService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.ucenikService.update(id, updateData);
  }

  @Post(':id/ocjena')
  @UseGuards(JwtAuthGuard)
  addOcjena(@Param('id') id: string, @Body() body: { casId: string; lekcijaId: string; ocjena: number; komentar?: string }) {
    return this.ucenikService.addOcjena(id, body);
  }

  @Post(':id/prisustvo')
  @UseGuards(JwtAuthGuard)
  addPrisustvo(@Param('id') id: string, @Body() body: { casId: string; status: string }) {
    return this.ucenikService.addPrisustvo(id, body);
  }

  @Get(':id/ocjene')
  @UseGuards(JwtAuthGuard)
  getOcjeneWithLekcije(@Param('id') id: string) {
    return this.ucenikService.getOcjeneWithLekcije(id);
  }

  @Get(':id/prisustvo')
  @UseGuards(JwtAuthGuard)
  getPrisustvoStats(@Param('id') id: string) {
    return this.ucenikService.getPrisustvoStats(id);
  }

  @Post(':id/ocjena-with-date')
  @UseGuards(JwtAuthGuard)
  addOcjenaWithDate(@Param('id') id: string, @Body() body: { datum: string; lekcijaId: string; ocjena: number; komentar?: string }) {
    return this.ucenikService.addOcjenaWithDate(id, body);
  }

  @Post(':id/prisustvo-with-date')
  @UseGuards(JwtAuthGuard)
  addPrisustvoWithDate(
    @Param('id') id: string,
    @Body() body: { datum: string; status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN'; napomena?: string },
  ) {
    return this.ucenikService.addPrisustvoWithDate(id, body);
  }

  @Get(':id/allowed-days')
  @UseGuards(JwtAuthGuard)
  getAllowedDays(@Param('id') id: string) {
    return this.ucenikService.getAllowedDaysForUcenik(id);
  }

  @Post(':id/ocjene/:ocjenaId/delete')
  @UseGuards(JwtAuthGuard)
  deleteOcjena(@Param('ocjenaId') ocjenaId: string) {
    return this.ucenikService.deleteOcjena(ocjenaId);
  }

  @Post(':id/prisustvo/:prisustvoId/delete')
  @UseGuards(JwtAuthGuard)
  deletePrisustvo(@Param('prisustvoId') prisustvoId: string) {
    return this.ucenikService.deletePrisustvo(prisustvoId);
  }
}
