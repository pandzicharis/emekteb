import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PorukeService } from './poruke.service';

@Controller('poruke')
@UseGuards(JwtAuthGuard)
export class PorukeController {
  constructor(private readonly porukeService: PorukeService) {}

  @Post()
  async posaljiPoruku(
    @Request() req: any,
    @Body() body: { primalacId: string; naslov: string; sadrzaj: string },
  ) {
    return this.porukeService.posaljiPoruku(
      req.user.id,
      body.primalacId,
      body.naslov,
      body.sadrzaj,
    );
  }

  @Get('primljene')
  async getPrimljenePoruke(@Request() req: any) {
    return this.porukeService.getPrimljenePoruke(req.user.id);
  }

  @Get('poslate')
  async getPoslatePoruke(@Request() req: any) {
    return this.porukeService.getPoslatePoruke(req.user.id);
  }

  @Get('moguci-primaoci')
  async getMoguciPrimaoci(@Request() req: any) {
    return this.porukeService.getMoguciPrimaoci(req.user.id, req.user.uloga);
  }

  @Post(':id/procitano')
  async oznaciKaoProcitano(@Request() req: any, @Param('id') porukaId: string) {
    return this.porukeService.oznaciKaoProcitano(porukaId, req.user.id);
  }

  @Delete(':id')
  async obrisiPoruku(@Request() req: any, @Param('id') porukaId: string) {
    return this.porukeService.obrisiPoruku(porukaId, req.user.id);
  }
}


