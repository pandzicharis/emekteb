import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportService } from './import.service';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('CSV fajl je obavezan');
    }

    if (!file.originalname.endsWith('.csv')) {
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

