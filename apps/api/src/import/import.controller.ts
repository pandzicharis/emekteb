import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Uloga } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ImportService } from './import.service';

const MAX_CSV_SIZE_MB = Number(process.env['MAX_CSV_SIZE_MB']) || 20;

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Uloga.ADMIN)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /** Očekivane CSV kolone i njihovo mapiranje na model baze. */
  @Get('mapping')
  getMapping() {
    return this.importService.getMapping();
  }

  /** Historija importa. */
  @Get()
  async getImports(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.importService.getImports(parsedLimit);
  }

  /** Detalji jednog importa (uključuje logove grešaka po redu). */
  @Get(':id')
  async getImport(@Param('id') id: string) {
    const zapis = await this.importService.getImportById(id);
    if (!zapis) {
      throw new NotFoundException('Import zapis nije pronađen');
    }
    return zapis;
  }

  @Post('csv')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CSV_SIZE_MB * 1024 * 1024 },
    }),
  )
  async uploadCsv(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('CSV fajl je obavezan');
    }

    if (!file.originalname?.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Fajl mora biti CSV format');
    }

    try {
      const result = await this.importService.importCsv(file);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri importu',
      );
    }
  }
}
