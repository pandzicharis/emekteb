import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SlobodanDanService } from './slobodan-dan.service';
import { CreateSlobodanDanDto, UpdateSlobodanDanDto } from './dto/create-slobodan-dan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('slobodni-dani')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SlobodanDanController {
  constructor(private readonly slobodanDanService: SlobodanDanService) {}

  @Get()
  @Roles('ADMIN')
  findAll(@Query('nastavnaGodinaId') nastavnaGodinaId?: string) {
    return this.slobodanDanService.findAll(nastavnaGodinaId);
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.slobodanDanService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() createDto: CreateSlobodanDanDto) {
    try {
      return {
        success: true,
        data: await this.slobodanDanService.create(createDto),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri kreiranju slobodnog dana',
      );
    }
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSlobodanDanDto,
  ) {
    try {
      return {
        success: true,
        data: await this.slobodanDanService.update(id, updateDto),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri ažuriranju slobodnog dana',
      );
    }
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    try {
      await this.slobodanDanService.delete(id);
      return {
        success: true,
        message: 'Slobodan dan je uspješno obrisan',
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri brisanju slobodnog dana',
      );
    }
  }
}






