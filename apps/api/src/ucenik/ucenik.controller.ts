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
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    
    this.logger.log(`Fetching ucenici - page: ${pageNum}, limit: ${limitNum}, razredNaziv: ${razredNaziv}`);
    
    return this.ucenikService.findAll(pageNum, limitNum, razredNaziv);
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
}
