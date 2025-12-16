import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MuallimService } from './muallim.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('muallimi')
export class MuallimController {
  constructor(private readonly muallimService: MuallimService) {}

  @Get('quick-login')
  findForQuickLogin() {
    return this.muallimService.findForQuickLogin();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.muallimService.findAll();
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(
    @Request() req: any,
    @Query('dan') dan?: 'subota' | 'nedjelja',
    @Query('datum') datum?: string,
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Korisnik nije autentifikovan');
    }
    const korisnikId = req.user.id;
    return this.muallimService.getDashboardData(korisnikId, dan, datum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.muallimService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createDto: { ime: string; prezime: string; email: string; lozinka: string; pin?: string }) {
    return this.muallimService.create(createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateDto: { ime?: string; prezime?: string; email?: string; lozinka?: string; pin?: string; aktivan?: boolean },
  ) {
    return this.muallimService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.muallimService.delete(id);
  }

  @Post(':id/photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Fotografija je obavezna');
    }

    // Provjeri tip fajla
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Fajl mora biti slika (JPEG, PNG ili WebP)');
    }

    const photoUrl = await this.muallimService.uploadPhoto(id, file);
    return { photoUrl };
  }
}


