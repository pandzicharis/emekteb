import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Logger,
  Get,
  Param,
} from '@nestjs/common';
import { Response } from 'express';
import { DiplomaService, DiplomaData } from './diploma.service';
import { GenerateDiplomaDto, GenerateBatchDiplomaDto } from './dto/generate-diploma.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Controller('diplome')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiplomaController {
  private readonly logger = new Logger(DiplomaController.name);
  private readonly pdfPath: string;

  constructor(private readonly diplomaService: DiplomaService) {
    // Find PDF directory - try multiple possible paths (works in Docker and local)
    const basePath = process.cwd();
    const possiblePaths = [
      path.join(basePath, 'assets', 'pdf'), // Docker: /app/apps/api/assets/pdf (when cwd is /app/apps/api)
      path.join(basePath, 'apps', 'api', 'assets', 'pdf'), // Local dev (when cwd is project root)
      path.join(basePath, '..', '..', 'assets', 'pdf'), // From /app/apps/api -> /app/assets/pdf
      path.join(__dirname, '..', '..', '..', 'assets', 'pdf'), // From compiled code
      path.join(__dirname, '..', '..', 'assets', 'pdf'), // Alternative
    ];

    let foundPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        foundPath = possiblePath;
        this.logger.log(`✅ PDF directory found: ${foundPath}`);
        break;
      }
    }

    if (!foundPath) {
      this.logger.warn(`⚠️ PDF directory not found. Tried: ${possiblePaths.join(', ')}`);
      // Use first path as default
      this.pdfPath = possiblePaths[0];
    } else {
      this.pdfPath = foundPath;
    }
  }

  @Post('generate')
  @Roles('MUALLIM', 'ADMIN')
  async generateDiploma(
    @Body() dto: GenerateDiplomaDto,
    @Res() res: Response,
  ) {
    try {
      const data: DiplomaData = {
        ime_prezime: dto.ime_prezime,
        datum: dto.datum,
        nastavna_godina: dto.nastavna_godina,
        nivo: dto.nivo,
        kategorija: dto.kategorija,
        godina: dto.godina,
      };

      const pdfBuffer = await this.diplomaService.generateDiploma(
        dto.type,
        data,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="diploma_${dto.type}_${dto.ime_prezime.replace(/\s+/g, '_')}.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (error) {
      this.logger.error('Error generating diploma:', error);
      return res.status(500).json({
        message: 'Greška pri generisanju diplome',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @Post('generate-batch')
  @Roles('MUALLIM', 'ADMIN')
  async generateBatchDiplomas(
    @Body() dto: GenerateBatchDiplomaDto,
    @Res() res: Response,
  ) {
    try {
      const requests = dto.students.map((student) => ({
        type: student.type,
        data: {
          ime_prezime: student.ime_prezime,
          datum: student.datum,
          nastavna_godina: student.nastavna_godina,
          nivo: student.nivo,
          kategorija: student.kategorija,
          godina: student.godina,
        } as DiplomaData,
      }));

      const pdfBuffers = await this.diplomaService.generateBatchDiplomas(
        requests,
      );

      if (pdfBuffers.length === 0) {
        return res.status(400).json({ message: 'Nema diploma za generisanje' });
      }

      // If only one diploma, return it directly
      if (pdfBuffers.length === 1) {
        const student = dto.students[0];
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="diploma_${student.type}_${student.ime_prezime.replace(/\s+/g, '_')}.pdf"`,
        );
        return res.send(pdfBuffers[0]);
      }

      // Multiple diplomas - generate individual PDFs and return them sequentially
      // Frontend will handle multiple downloads
      // For now, return first PDF (frontend will call API multiple times if needed)
      // TODO: Implement ZIP file generation for better UX
      const student = dto.students[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="diploma_${student.type}_${student.ime_prezime.replace(/\s+/g, '_')}.pdf"`,
      );
      return res.send(pdfBuffers[0]);
    } catch (error) {
      this.logger.error('Error generating batch diplomas:', error);
      return res.status(500).json({
        message: 'Greška pri generisanju diploma',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @Get('preview/:type')
  @Roles('MUALLIM', 'ADMIN')
  async previewTemplate(@Param('type') type: string, @Res() res: Response) {
    try {
      const mapping: Record<string, string> = {
        'DOBRI_REZULTATI': 'DOBRI REZULTATI.pdf',
        'ILMIHAL': 'ILMIHAL.pdf',
        'NAJREDOVNIJI_UCENIK': 'NAJREDOVNIJI UCENIK.pdf',
        'POSEBAN_DOPRINOS_I_ZALAGANJE': 'POSEBAN DOPRINOS I ZALAGANJE.pdf',
        'SUFARA': 'SUFARA.pdf',
        'TAKMICENJE': 'TAKMICENJE.pdf',
      };

      const fileName = mapping[type];
      if (!fileName) {
        return res.status(404).json({ message: 'Nepoznat tip diplome' });
      }

      const filePath = path.join(this.pdfPath, fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'PDF fajl nije pronađen' });
      }

      const fileBuffer = fs.readFileSync(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${fileName}"`,
      );
      return res.send(fileBuffer);
    } catch (error) {
      this.logger.error('Error serving PDF preview:', error);
      return res.status(500).json({
        message: 'Greška pri učitavanju PDF-a',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

