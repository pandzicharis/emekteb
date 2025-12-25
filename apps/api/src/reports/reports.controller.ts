import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}

