import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { LekcijaService } from './lekcija.service';
import { TipLekcije } from '@prisma/client';

@Controller('lekcije')
export class LekcijaController {
  constructor(private readonly lekcijaService: LekcijaService) {}

  @Get()
  findAll(@Query('tip') tip?: TipLekcije, @Query('razredId') razredId?: string) {
    return this.lekcijaService.findAll(tip, razredId);
  }

  @Post()
  create(@Body() body: { naslov: string; opis: string; tezina: number; redoslijed: number; aktivan: boolean; tip: TipLekcije; brojAjeta?: number }) {
    return this.lekcijaService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ naslov: string; opis: string; tezina: number; redoslijed: number; aktivan: boolean; tip: TipLekcije; brojAjeta?: number }>
  ) {
    return this.lekcijaService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lekcijaService.delete(id);
  }
}
