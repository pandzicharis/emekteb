import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotifikacijeService } from './notifikacije.service';

@Controller('notifikacije')
@UseGuards(JwtAuthGuard)
export class NotifikacijeController {
  constructor(private readonly notifikacijeService: NotifikacijeService) {}

  @Get()
  async getNotifikacije(@Request() req: any) {
    return this.notifikacijeService.getNotifikacije(req.user.id);
  }

  @Get('neprocitane')
  async getNeprocitaneNotifikacije(@Request() req: any) {
    return this.notifikacijeService.getNeprocitaneNotifikacije(req.user.id);
  }

  @Get('broj-neprocitanih')
  async getBrojNeprocitanih(@Request() req: any) {
    return this.notifikacijeService.getBrojNeprocitanih(req.user.id);
  }

  @Post(':id/procitano')
  async oznaciKaoProcitano(@Request() req: any, @Param('id') notifikacijaId: string) {
    return this.notifikacijeService.oznaciKaoProcitano(notifikacijaId, req.user.id);
  }

  @Post('sve-procitano')
  async oznaciSveKaoProcitano(@Request() req: any) {
    return this.notifikacijeService.oznaciSveKaoProcitano(req.user.id);
  }

  @Delete(':id')
  async obrisiNotifikaciju(@Request() req: any, @Param('id') notifikacijaId: string) {
    return this.notifikacijeService.obrisiNotifikaciju(notifikacijaId, req.user.id);
  }
}


