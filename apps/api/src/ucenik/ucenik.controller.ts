import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
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
}
