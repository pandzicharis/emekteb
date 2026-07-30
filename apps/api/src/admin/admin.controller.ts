import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Uloga } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { DatabaseService } from './database.service';

/** Fraza koju admin mora ukucati da bi truncate prošao. */
export const TRUNCATE_POTVRDA = 'OBRISI SVE';

interface TruncateBody {
  potvrda?: string;
  zadrziAdmine?: boolean;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('dashboard-stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  /** Broj zapisa po tabeli - prikaz stanja baze u admin panelu. */
  @Get('database/stats')
  @UseGuards(RolesGuard)
  @Roles(Uloga.ADMIN)
  async getDatabaseStats() {
    return this.databaseService.getStats();
  }

  /**
   * Briše sve podatke iz svih tabela. Zahtijeva potvrdu u body-ju:
   * { "potvrda": "OBRISI SVE", "zadrziAdmine": true }
   */
  @Post('database/truncate')
  @UseGuards(RolesGuard)
  @Roles(Uloga.ADMIN)
  async truncateDatabase(@Body() body: TruncateBody, @Req() req: any) {
    if (process.env['ALLOW_DB_TRUNCATE'] === 'false') {
      throw new BadRequestException(
        'Brisanje baze je onemogućeno na ovom okruženju (ALLOW_DB_TRUNCATE=false)',
      );
    }

    const potvrda = (body?.potvrda || '').trim().toUpperCase();
    if (potvrda !== TRUNCATE_POTVRDA) {
      throw new BadRequestException(
        `Potvrda nije ispravna. Pošalji { "potvrda": "${TRUNCATE_POTVRDA}" } da potvrdiš brisanje.`,
      );
    }

    // Default je čuvanje admin korisnika da prijava ostane moguća.
    const zadrziAdmine = body?.zadrziAdmine !== false;

    try {
      const rezultat = await this.databaseService.truncateAll(zadrziAdmine, req?.user?.id);
      return { success: true, data: rezultat };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Greška pri brisanju baze',
      );
    }
  }
}
