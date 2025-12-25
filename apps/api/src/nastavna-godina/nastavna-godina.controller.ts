import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NastavnaGodinaService } from './nastavna-godina.service';
import { CreateNastavnaGodinaDto } from './dto/create-nastavna-godina.dto';

@Controller('nastavne-godine')
@UseGuards(JwtAuthGuard)
export class NastavnaGodinaController {
  constructor(
    private readonly nastavnaGodinaService: NastavnaGodinaService,
  ) {}

  @Post()
  async create(@Body() createDto: CreateNastavnaGodinaDto) {
    try {
      return {
        success: true,
        data: await this.nastavnaGodinaService.create(createDto),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri kreiranju nastavne godine',
      );
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: CreateNastavnaGodinaDto,
  ) {
    try {
      return {
        success: true,
        data: await this.nastavnaGodinaService.update(id, updateDto),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri ažuriranju nastavne godine',
      );
    }
  }

  @Get()
  async findAll() {
    return this.nastavnaGodinaService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.nastavnaGodinaService.findOne(id);
  }
}








