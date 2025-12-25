import { Controller, Get, Query, Post, Body, Param, UseGuards, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { GradeReportDto } from './dto/grade-report.dto';
import { StatisticsDto } from './dto/statistics.dto';
import { ReportOptionsDto } from './dto/report-options.dto';
import { NastavnaGodinaStatsDto } from './dto/nastavna-godina-stats.dto';
import { RazredStatsDto } from './dto/razred-stats.dto';
import { UcenikStatsDto } from './dto/ucenik-stats.dto';
import { ReportsListDto } from './dto/reports-list.dto';
import {
  YearConclusionStudentsDto,
  StudentYearConclusionDataDto,
  GenerateReportDto,
  GenerateDiplomaDto,
} from './dto/year-conclusion.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  async getAttendanceReport(@Query() query: AttendanceReportDto) {
    return this.reportsService.getAttendanceReport(query);
  }

  @Get('grades')
  async getGradeReport(@Query() query: GradeReportDto) {
    return this.reportsService.getGradeReport(query);
  }

  @Get('statistics')
  async getStatistics(@Query() query: StatisticsDto) {
    return this.reportsService.getStatistics(query);
  }

  @Get('options')
  async getReportOptions(@Query() query: ReportOptionsDto) {
    return this.reportsService.getReportOptions(query);
  }

  @Get('nastavna-godina-stats')
  async getNastavnaGodinaStats(@Query() query: NastavnaGodinaStatsDto) {
    return this.reportsService.getNastavnaGodinaStats(query);
  }

  @Get('razred-stats')
  async getRazredStats(@Query() query: RazredStatsDto) {
    return this.reportsService.getRazredStats(query);
  }

  @Get('ucenik-stats')
  async getUcenikStats(@Query() query: UcenikStatsDto) {
    return this.reportsService.getUcenikStats(query);
  }

  @Get('list')
  async getReportsList(@Query() query: ReportsListDto) {
    return this.reportsService.getReportsList(query);
  }

  @Get('year-conclusion/students')
  async getYearConclusionStudents(@Query() query: YearConclusionStudentsDto) {
    return this.reportsService.getYearConclusionStudents(query);
  }

  @Get('year-conclusion/student/:id')
  async getStudentYearConclusionData(
    @Param('id') ucenikId: string,
    @Query() query: { nastavnaGodinaId: string },
  ) {
    return this.reportsService.getStudentYearConclusionData(ucenikId, query.nastavnaGodinaId);
  }

  @Post('year-conclusion/generate-report')
  @Header('Content-Type', 'application/pdf')
  async generateStudentReport(
    @Body() body: GenerateReportDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.generateStudentReportPDF(
      body.ucenikId,
      body.nastavnaGodinaId,
      body.customComments,
    );
    
    res.setHeader('Content-Disposition', `attachment; filename="izvjestaj_${body.ucenikId}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post('year-conclusion/generate-diploma')
  @Header('Content-Type', 'application/pdf')
  async generateDiploma(
    @Body() body: GenerateDiplomaDto,
    @Res() res: Response,
  ) {
    try {
      console.log('Generating diploma with data:', {
        ucenikId: body.ucenikId,
        nastavnaGodinaId: body.nastavnaGodinaId,
        imePrezime: body.imePrezime,
        nivo: body.nivo,
        datum: body.datum,
        godina: body.godina,
      });

      const pdfBuffer = await this.reportsService.generateDiplomaPDF(body.ucenikId, body.nastavnaGodinaId, {
        imePrezime: body.imePrezime,
        nivo: body.nivo,
        datum: body.datum,
        godina: body.godina,
      });

      console.log('Diploma PDF generated, size:', pdfBuffer.length);

      res.setHeader('Content-Disposition', `attachment; filename="diploma_${body.ucenikId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error in generateDiploma controller:', error);
      throw error;
    }
  }
}

