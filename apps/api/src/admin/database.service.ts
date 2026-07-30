import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Ilmihal, Korisnik, Uloga } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Razredi su fiksna struktura mekteba i ne kreiraju se kroz UI, pa se
 * osiguravaju automatski (na startu i nakon brisanja baze).
 */
const OSNOVNI_RAZREDI: Array<{ name: string; ilmihal: Ilmihal }> = [
  { name: 'Razred 1', ilmihal: Ilmihal.ILMIHAL_I },
  { name: 'Razred 2', ilmihal: Ilmihal.ILMIHAL_I },
  { name: 'Razred 3', ilmihal: Ilmihal.ILMIHAL_I },
  { name: 'Razred 4', ilmihal: Ilmihal.ILMIHAL_II },
  { name: 'Razred 5', ilmihal: Ilmihal.ILMIHAL_II },
  { name: 'Razred 6', ilmihal: Ilmihal.ILMIHAL_II },
  { name: 'Razred 7', ilmihal: Ilmihal.ILMIHAL_III },
  { name: 'Razred 8', ilmihal: Ilmihal.ILMIHAL_III },
  { name: 'Razred 9', ilmihal: Ilmihal.ILMIHAL_III },
  { name: 'Škola Hifza', ilmihal: Ilmihal.SKOLA_HIFZA },
];

export interface TabelaStat {
  tabela: string;
  brojZapisa: number;
}

export interface DbStats {
  ukupnoZapisa: number;
  tabele: TabelaStat[];
}

export interface TruncateResult {
  obrisanoTabela: number;
  obrisanoZapisa: number;
  zadrzanoAdmina: number;
  kreiranDefaultAdmin: string | null;
  kreiranoRazreda: number;
  statsPrije: DbStats;
  statsPoslije: DbStats;
}

/**
 * Održavanje baze iz admin panela:
 *  - pregled broja zapisa po tabeli
 *  - truncate cijele baze (opcionalno uz čuvanje admin korisnika)
 *  - kreiranje default admin korisnika ako baza nema nijednog (da app ostane upotrebljiva)
 */
@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['SKIP_ADMIN_BOOTSTRAP'] === 'true') {
      return;
    }

    try {
      await this.ensureDefaultAdmin();
      await this.ensureOsnovniRazredi();
    } catch (error) {
      // Ne rušimo start aplikacije - baza možda još nije migrirana.
      this.logger.warn(
        `⚠️  Provjera default admin korisnika nije uspjela: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Kreira default admin korisnika samo ako u bazi ne postoji nijedan ADMIN.
   * Kredencijali se čitaju iz ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_PIN.
   */
  async ensureDefaultAdmin(): Promise<string | null> {
    const postojeciAdmin = await this.prisma.korisnik.findFirst({
      where: { uloga: Uloga.ADMIN },
      select: { id: true },
    });

    if (postojeciAdmin) {
      return null;
    }

    const email = process.env['ADMIN_EMAIL'] || 'admin@emekteb.ba';
    const lozinka = process.env['ADMIN_PASSWORD'] || 'password123';
    const pin = process.env['ADMIN_PIN'] || '0000';

    await this.prisma.korisnik.create({
      data: {
        email,
        lozinka: await bcrypt.hash(lozinka, 10),
        ime: 'Admin',
        prezime: 'Emekteb',
        uloga: Uloga.ADMIN,
        aktivan: true,
        pin,
      },
    });

    this.logger.log(`👤 Kreiran default admin korisnik: ${email}`);
    if (!process.env['ADMIN_PASSWORD']) {
      this.logger.warn(
        '⚠️  ADMIN_PASSWORD nije postavljen - koristi se default lozinka. Promijeni je nakon prve prijave.',
      );
    }

    return email;
  }

  /** Kreira razrede koji ne postoje (Razred 1-9 + Škola Hifza). Vraća broj kreiranih. */
  async ensureOsnovniRazredi(): Promise<number> {
    const postojeci = await this.prisma.razred.findMany({ select: { name: true } });
    const postojeciNazivi = new Set(postojeci.map((razred) => razred.name));
    const zaKreiranje = OSNOVNI_RAZREDI.filter((razred) => !postojeciNazivi.has(razred.name));

    if (zaKreiranje.length === 0) {
      return 0;
    }

    await this.prisma.razred.createMany({ data: zaKreiranje });
    this.logger.log(`📚 Kreirano ${zaKreiranje.length} osnovnih razreda`);

    return zaKreiranje.length;
  }

  /** Broj zapisa po svakoj tabeli u public schemi. */
  async getStats(): Promise<DbStats> {
    const tabele = await this.getTableNames();

    if (tabele.length === 0) {
      return { ukupnoZapisa: 0, tabele: [] };
    }

    // Jedan upit za sve tabele umjesto N round-tripova (važno na Supabase pooleru).
    const unionQuery = tabele
      .map((tabela) => `SELECT '${tabela}' AS tabela, COUNT(*)::int AS "brojZapisa" FROM "public"."${tabela}"`)
      .join(' UNION ALL ');

    const rezultat = await this.prisma.$queryRawUnsafe<TabelaStat[]>(unionQuery);
    const sortirano = [...rezultat].sort((a, b) => a.tabela.localeCompare(b.tabela));

    return {
      ukupnoZapisa: sortirano.reduce((suma, red) => suma + Number(red.brojZapisa), 0),
      tabele: sortirano.map((red) => ({ tabela: red.tabela, brojZapisa: Number(red.brojZapisa) })),
    };
  }

  /**
   * Briše SVE podatke iz svih tabela (TRUNCATE ... CASCADE). Struktura tabela i
   * historija migracija ostaju nepromijenjene.
   *
   * @param zadrziAdmine ako je true, admin korisnici se vraćaju nakon brisanja
   *                     (inače se kreira default admin da prijava ostane moguća)
   */
  async truncateAll(zadrziAdmine: boolean, izvrsioKorisnikId?: string): Promise<TruncateResult> {
    const statsPrije = await this.getStats();
    const tabele = await this.getTableNames();

    if (tabele.length === 0) {
      throw new Error('Nema tabela u public schemi - je li baza migrirana?');
    }

    const admini: Korisnik[] = zadrziAdmine
      ? await this.prisma.korisnik.findMany({ where: { uloga: Uloga.ADMIN } })
      : [];

    this.logger.warn(
      `🗑️  TRUNCATE baze: ${tabele.length} tabela, ${statsPrije.ukupnoZapisa} zapisa` +
        `${zadrziAdmine ? `, čuvam ${admini.length} admin korisnika` : ''}` +
        `${izvrsioKorisnikId ? ` (pokrenuo korisnik ${izvrsioKorisnikId})` : ''}`,
    );

    const lista = tabele.map((tabela) => `"public"."${tabela}"`).join(', ');
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);

    for (const admin of admini) {
      await this.prisma.korisnik.create({
        data: {
          id: admin.id,
          email: admin.email,
          lozinka: admin.lozinka,
          ime: admin.ime,
          prezime: admin.prezime,
          uloga: admin.uloga,
          aktivan: admin.aktivan,
          fotografija: admin.fotografija,
          pin: admin.pin,
          poslednjeLogiranje: admin.poslednjeLogiranje,
          kreiran: admin.kreiran,
        },
      });
    }

    const kreiranDefaultAdmin = await this.ensureDefaultAdmin();
    const kreiranoRazreda = await this.ensureOsnovniRazredi();
    const statsPoslije = await this.getStats();

    this.logger.log(`✅ Baza je ispražnjena (${statsPrije.ukupnoZapisa} zapisa obrisano)`);

    return {
      obrisanoTabela: tabele.length,
      obrisanoZapisa: statsPrije.ukupnoZapisa,
      zadrzanoAdmina: admini.length,
      kreiranDefaultAdmin,
      kreiranoRazreda,
      statsPrije,
      statsPoslije,
    };
  }

  /** Sve tabele u public schemi osim Prisma migration historyja. */
  private async getTableNames(): Promise<string[]> {
    const redovi = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `;

    // Sigurnosna provjera jer se imena ubacuju u raw SQL.
    return redovi
      .map((red) => red.tablename)
      .filter((tablename) => /^[A-Za-z0-9_]+$/.test(tablename));
  }
}
