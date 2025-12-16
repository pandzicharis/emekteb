import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { Spol, StatusUcenika, TipRoditelja, TipKontakta, StatusImporta } from '@prisma/client';

interface CsvRow {
  [key: string]: string;
}

interface ImportLog {
  uspjesni: string[]; // IDs učenika
  novi: string[];
  updateani: string[];
  greske: Array<{
    red: number;
    eksterniId?: number;
    greska: string;
    stack?: string;
    kontekst?: string;
    podaci?: any;
  }>;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private mapping: any;
  private metadata: any;

  constructor(private prisma: PrismaService) {
    // Učitaj mapiranje - koristi putanju koja radi i u Docker-u i lokalno
    const basePath = process.cwd();
    const possiblePaths = [
      path.join(basePath, 'apps/api/prisma/csv-field-mapping.json'),
      path.join(__dirname, '../../prisma/csv-field-mapping.json'),
      path.join(__dirname, '../../../apps/api/prisma/csv-field-mapping.json'),
    ];
    
    let mappingPath: string | null = null;
    let metadataPath: string | null = null;
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        mappingPath = possiblePath;
        metadataPath = possiblePath.replace('csv-field-mapping.json', 'csv-field-mapping-metadata.json');
        break;
      }
    }
    
    if (!mappingPath || !metadataPath || !fs.existsSync(mappingPath) || !fs.existsSync(metadataPath)) {
      throw new Error(`Ne mogu pronaći CSV mapping fajlove. Tražene putanje: ${possiblePaths.join(', ')}`);
    }
    
    try {
      this.mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
      this.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      this.logger.log(`✅ CSV mapping fajlovi učitani: ${mappingPath}`);
    } catch (error) {
      this.logger.error(`❌ Greška pri učitavanju mapping fajlova: ${error}`);
      throw new Error('Ne mogu učitati CSV mapping konfiguraciju');
    }
  }

  async importCsv(file: any): Promise<any> {
    // Kreiraj Import zapis
    const importRecord = await this.prisma.import.create({
      data: {
        nazivFajla: file.originalname,
        status: StatusImporta.U_TOKU,
        ukupnoRedova: 0,
        logovi: {},
      },
    });

    const log: ImportLog = {
      uspjesni: [],
      novi: [],
      updateani: [],
      greske: [],
    };

    try {
      // Parse CSV
      const records: CsvRow[] = parse(file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      await this.prisma.import.update({
        where: { id: importRecord.id },
        data: { ukupnoRedova: records.length },
      });

      // Procesiraj svaki red
      this.logger.log(`📊 Počinje procesiranje ${records.length} redova...`);
      
      for (let i = 0; i < records.length; i++) {
        let row = records[i];
        // Primijeni automatske fix-ove
        row = this.fixCommonDataIssues(row);
        const redBroj = i + 1;
        const eksterniId = this.parseValue(row['id'], 'int');
        
        this.logger.debug(`[${redBroj}/${records.length}] Procesiranje reda - Eksterni ID: ${eksterniId || 'N/A'}, Ime: ${row['ucenik_ime'] || 'N/A'}, Prezime: ${row['ucenik_prezime'] || 'N/A'}`);
        
        const result = await this.processRow(row, redBroj);
        
        // Ako je učenik kreiran/ažuriran (ima ID), smatra se uspješnim
        if (result.ucenikId) {
          if (result.isNew) {
            log.novi.push(result.ucenikId);
            this.logger.debug(`✅ Uspješno kreiran novi učenik (ID: ${result.ucenikId})`);
          } else {
            log.updateani.push(result.ucenikId);
            this.logger.debug(`✅ Uspješno ažuriran postojeći učenik (ID: ${result.ucenikId})`);
          }
          log.uspjesni.push(result.ucenikId);
          
          // Ako ima greške, dodaj ih u log
          if (result.greske && Object.keys(result.greske).length > 0) {
            log.greske.push({
              red: redBroj,
              eksterniId: eksterniId || undefined,
              greska: `Učenik kreiran sa greškama: ${Object.keys(result.greske).join(', ')}`,
              kontekst: 'Djelomično uspješan',
              podaci: {
                ime: row['ucenik_ime'] || null,
                prezime: row['ucenik_prezime'] || null,
                eksterniId: eksterniId || null,
                greske: result.greske,
              },
            });
            this.logger.warn(`⚠️  Učenik kreiran sa greškama: ${Object.keys(result.greske).join(', ')}`);
          }
        } else {
          // Ako nije kreiran učenik, dodaj u greške
          const errorDetails = {
            red: redBroj,
            eksterniId: eksterniId || undefined,
            greska: result.greske ? Object.values(result.greske).join('; ') : 'Nije moguće kreirati učenika',
            kontekst: 'Kreiranje učenika',
            podaci: {
              ime: row['ucenik_ime'] || null,
              prezime: row['ucenik_prezime'] || null,
              eksterniId: eksterniId || null,
              greske: result.greske || {},
            },
          };
          
          log.greske.push(errorDetails);
          
          this.logger.error(`❌ Nije moguće kreirati učenika (Red ${redBroj}): ${errorDetails.greska}`);
        }
      }
      
      this.logger.log(`📈 Završeno procesiranje: ✅ Uspješno: ${log.uspjesni.length}, 🆕 Novi: ${log.novi.length}, 🔄 Ažurirani: ${log.updateani.length}, ❌ Greške: ${log.greske.length}`);
      
      // Detaljni sažetak grešaka
      if (log.greske.length > 0) {
        this.logger.warn(`📋 DETALJNI SAŽETAK GREŠAKA (${log.greske.length} grešaka):`);
        log.greske.forEach((greska, index) => {
          this.logger.warn(`${index + 1}. Red ${greska.red} (Eksterni ID: ${greska.eksterniId || 'N/A'}): ${greska.greska}`);
        });
        
        // Grupisanje grešaka po tipu
        const greskePoKontekstu: { [key: string]: number } = {};
        log.greske.forEach(g => {
          const kontekst = g.kontekst || 'Nepoznat';
          greskePoKontekstu[kontekst] = (greskePoKontekstu[kontekst] || 0) + 1;
        });
        
        this.logger.warn(`📊 GREŠKE PO KONTEKSTU: ${JSON.stringify(greskePoKontekstu)}`);
      }

      // Ažuriraj Import zapis
      const status = log.greske.length === 0 
        ? StatusImporta.USPJESAN 
        : log.uspjesni.length > 0 
        ? StatusImporta.DJELOMICNO_USPJESAN 
        : StatusImporta.NEUSPJESAN;

      // Izračunaj procenat uspješnosti
      const ukupnoRedova = records.length;
      const uspjesnoSacuvano = log.uspjesni.length;
      const procenatUspjesnosti = ukupnoRedova > 0 
        ? Math.round((uspjesnoSacuvano / ukupnoRedova) * 100 * 100) / 100 
        : 0;

      // Grupisanje grešaka po tipu za summary
      const greskeSummary: { [key: string]: number } = {};
      log.greske.forEach(g => {
        if (g.podaci?.greske) {
          Object.keys(g.podaci.greske).forEach(tipGreske => {
            greskeSummary[tipGreske] = (greskeSummary[tipGreske] || 0) + 1;
          });
        } else {
          const kontekst = g.kontekst || 'Nepoznat';
          greskeSummary[kontekst] = (greskeSummary[kontekst] || 0) + 1;
        }
      });

      await this.prisma.import.update({
        where: { id: importRecord.id },
        data: {
          status,
          uspjesnoSacuvano: log.uspjesni.length,
          novih: log.novi.length,
          updateanih: log.updateani.length,
          gresaka: log.greske.length,
          logovi: log as any,
        },
      });

      return {
        id: importRecord.id,
        status,
        ukupnoRedova,
        uspjesnoSacuvano: log.uspjesni.length,
        novih: log.novi.length,
        updateanih: log.updateani.length,
        gresaka: log.greske.length,
        procenatUspjesnosti,
        greskeSummary,
      };
    } catch (error) {
      await this.prisma.import.update({
        where: { id: importRecord.id },
        data: {
          status: StatusImporta.NEUSPJESAN,
          logovi: {
            greska: error instanceof Error ? error.message : String(error),
          } as any,
        },
      });
      throw error;
    }
  }

  private async processRow(row: CsvRow, rowNumber: number): Promise<{ ucenikId: string; isNew: boolean; greske: any }> {
    const greske: { [key: string]: string } = {};
    let ucenikId: string | null = null;
    let korisnikId: string | null = null;
    const isNew = false;

    // Provjeri obavezna polja
    const ime = this.getValue(row, 'ucenik_ime') || '';
    const prezime = this.getValue(row, 'ucenik_prezime') || '';
    
    if (!ime || !prezime) {
      greske['ime_prezime'] = `Ime i prezime su obavezni. Ime: "${ime}", Prezime: "${prezime}"`;
      // Ako nema ime i prezime, ne možemo nastaviti
      return { ucenikId: '', isNew: false, greske };
    }

    const eksterniId = this.parseValue(row['id'], 'int');
    if (!eksterniId) {
      greske['eksterniId'] = 'Eksterni ID je obavezan';
    }

    // Provjeri da li učenik već postoji
    let existingUcenik = null;
    if (eksterniId) {
      try {
        existingUcenik = await this.prisma.ucenik.findUnique({
          where: { eksterniId },
          include: { korisnik: true },
        });
      } catch (error) {
        greske['provjera_postojeceg'] = `Greška pri provjeri postojećeg učenika: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    // Kreiraj ili update-uj Korisnik
    let email: string | null = null;
    try {
      email = await this.generateEmail(ime, prezime, existingUcenik?.korisnikId || undefined);
    } catch (error) {
      greske['email'] = `Greška pri generisanju emaila: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (email) {
      try {
        if (existingUcenik?.korisnikId) {
          // Update postojećeg korisnika
          await this.prisma.korisnik.update({
            where: { id: existingUcenik.korisnikId },
            data: {
              ime: ime || undefined,
              prezime: prezime || undefined,
              email: email || undefined,
            },
          });
          korisnikId = existingUcenik.korisnikId;
        } else {
          // Kreiraj novog korisnika
          // Generiši default lozinku (korisnik će je morati promijeniti pri prvoj prijavi)
          const defaultPassword = await bcrypt.hash('password123', 10);
          const korisnik = await this.prisma.korisnik.create({
            data: {
              ime: ime || undefined,
              prezime: prezime || undefined,
              email: email || undefined,
              lozinka: defaultPassword,
              uloga: 'UCENIK',
              aktivan: true,
            },
          });
          korisnikId = korisnik.id;
        }
      } catch (error) {
        greske['korisnik'] = `Greška pri kreiranju/ažuriranju korisnika: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    // Kreiraj ili update-uj Ucenik
    let ucenikData: any = {};
    try {
      ucenikData = this.mapUcenikData(row, greske);
    } catch (error) {
      greske['mapiranje_podataka'] = `Greška pri mapiranju podataka učenika: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    if (korisnikId) {
      try {
        if (existingUcenik) {
          await this.prisma.ucenik.update({
            where: { id: existingUcenik.id },
            data: {
              ...ucenikData,
              korisnikId,
              greske: Object.keys(greske).length > 0 ? greske : undefined,
            },
          });
          ucenikId = existingUcenik.id;
        } else if (eksterniId) {
          const ucenik = await this.prisma.ucenik.create({
            data: {
              ...ucenikData,
              eksterniId,
              korisnikId,
              greske: Object.keys(greske).length > 0 ? greske : undefined,
            },
          });
          ucenikId = ucenik.id;
        }
      } catch (error) {
        greske['ucenik'] = `Greška pri kreiranju/ažuriranju učenika: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    // Kreiraj ili update-uj Obrazovanje
    if (ucenikId) {
      try {
        await this.upsertObrazovanje(ucenikId, row);
      } catch (error) {
        greske['obrazovanje'] = `Greška pri kreiranju/ažuriranju obrazovanja: ${error instanceof Error ? error.message : String(error)}`;
      }

      // Kreiraj ili update-uj Roditelje
      try {
        await this.upsertRoditelji(ucenikId, row);
      } catch (error) {
        greske['roditelji'] = `Greška pri kreiranju/ažuriranju roditelja: ${error instanceof Error ? error.message : String(error)}`;
      }

      // Kreiraj ili update-uj Kontakte
      try {
        await this.upsertKontakti(ucenikId, row);
      } catch (error) {
        greske['kontakti'] = `Greška pri kreiranju/ažuriranju kontakata: ${error instanceof Error ? error.message : String(error)}`;
      }

      // Ažuriraj greške ako ih ima
      if (Object.keys(greske).length > 0) {
        try {
          await this.prisma.ucenik.update({
            where: { id: ucenikId },
            data: { greske: greske as any },
          });
        } catch (error) {
          this.logger.error(`Greška pri ažuriranju grešaka za učenika ${ucenikId}: ${error}`);
        }
      }
    }

    return { 
      ucenikId: ucenikId || '', 
      isNew: !existingUcenik, 
      greske: Object.keys(greske).length > 0 ? greske : undefined 
    };
  }

  private mapUcenikData(row: CsvRow, greske: { [key: string]: string }): any {
    const data: any = {};

    // Datum rođenja
    try {
      data.datumRodjenja = this.parseValue(row['ucenik_datum_rodjenja'], 'datetime');
    } catch (error) {
      greske['datumRodjenja'] = `Neispravan format datuma: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Spol
    try {
      const spolValue = this.transformEnum(row['ucenik_spol'], 'ucenik_spol');
      if (spolValue) {
        data.spol = spolValue as Spol;
      }
    } catch (error) {
      greske['spol'] = `Neispravna vrijednost spola: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Status - može biti null
    try {
      const statusValue = this.transformEnum(row['status'], 'status');
      // Postavi status samo ako ima validnu vrijednost, inače će biti null (ne dodaj u data)
      if (statusValue) {
        data.status = statusValue as StatusUcenika;
      }
      // Ako nema vrijednosti ili nije validna, ne dodaj status u data - bit će null u bazi
    } catch (error) {
      greske['status'] = `Neispravna vrijednost statusa: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Ostala polja - bez validacije, samo parsiranje
    data.mjestoRodjenja = this.getValue(row, 'ucenik_mjesto_rodjenja');
    data.adresaStanovanja = this.getValue(row, 'ucenik_adresa_stanovanja');
    data.eksterniDatumKreiran = this.parseValue(row['date_created'], 'datetime');
    data.eksterniDatumAzuriran = this.parseValue(row['date_updated'], 'datetime');
    data.imaRoditelje = this.getValue(row, 'ima_roditelje');
    data.roditeljiZajedno = this.getValue(row, 'roditelji_zajedno');
    data.roditeljiRazdvojeni = this.getValue(row, 'roditelji_razdvojeni_prebivaliste');
    data.roditeljiClanoviIz = this.getValue(row, 'roditelji_clanovi_iz');
    data.brojBrace = this.parseValue(row['broj_brace'], 'int') || 0;
    data.brojSestara = this.parseValue(row['broj_sestara'], 'int') || 0;
    data.tipStambenogObjekta = this.getValue(row, 'tip_stambenog_objekta');
    data.imaPosebnePotrebe = this.transformBoolean(row['ucenik_posebnim_potrebama']);
    data.posebnePotrebeOpis = this.getValue(row, 'posebne_potrebe_opis');
    data.idPunktaDzemata = this.parseValue(row['id_punkta_dzemata'], 'int');
    data.clanMrezeMladih = this.getValue(row, 'clan_mreze_mladih');
    data.ucenikSkoleHifza = this.getValue(row, 'ucenik_skole_hifza');

    return data;
  }

  private async upsertObrazovanje(ucenikId: string, row: CsvRow): Promise<void> {
    const obrazovanjeData = {
      nivoObrazovanja: this.getValue(row, 'nivo_obrazovanja'),
      razred: this.parseValue(row['os_razred'], 'int'),
      mektebStepen: this.getValue(row, 'mekteb_stepen'),
      predskolskaNaziv: this.getValue(row, 'predskolska_naziv'),
      osnovnaNaziv: this.getValue(row, 'osnovna_naziv'),
      srednjaNaziv: this.getValue(row, 'srednja_naziv'),
      fakultetNaziv: this.getValue(row, 'fakultet_naziv'),
    };

    await this.prisma.obrazovanje.upsert({
      where: { ucenikId },
      update: obrazovanjeData,
      create: {
        ...obrazovanjeData,
        ucenikId,
      },
    });
  }

  private async upsertRoditelji(ucenikId: string, row: CsvRow): Promise<void> {
    // Majka
    const majkaImePrezime = this.getValue(row, 'majka_ime_prezime');
    if (majkaImePrezime) {
      const majkaData: any = {
        tip: TipRoditelja.MAJKA,
        imePrezime: majkaImePrezime,
        datumRodjenja: this.parseValue(row['majka_datum_rodjenja'], 'datetime'),
        mjestoRodjenja: this.getValue(row, 'majka_mjesto_rodjenja'),
        email: this.getValue(row, 'majka_email'),
        mobitel: this.getValue(row, 'majka_mobitel'),
        telefon: this.getValue(row, 'majka_telefon'),
        zaposlen: this.transformBoolean(row['majka_zaposlenost']),
        obrazovanje: this.getValue(row, 'majka_sprema'),
        zanimanje: this.getValue(row, 'majka_zanimanje'),
      };

      // Provjeri da li majka već postoji
      const existingMajka = await this.prisma.roditelj.findFirst({
        where: { ucenikId, tip: TipRoditelja.MAJKA },
      });

      if (existingMajka) {
        await this.prisma.roditelj.update({
          where: { id: existingMajka.id },
          data: majkaData,
        });
      } else {
        await this.prisma.roditelj.create({
          data: {
            ...majkaData,
            ucenikId,
          },
        });
      }
    }

    // Otac
    const otacImePrezime = this.getValue(row, 'otac_ime_prezime');
    if (otacImePrezime) {
      const otacData: any = {
        tip: TipRoditelja.OTAC,
        imePrezime: otacImePrezime,
        datumRodjenja: this.parseValue(row['otac_datum_rodjenja'], 'datetime'),
        mjestoRodjenja: this.getValue(row, 'otac_mjesto_rodjenja'),
        email: this.getValue(row, 'otac_email'),
        mobitel: this.getValue(row, 'otac_mobitel'),
        telefon: this.getValue(row, 'otac_telefon'),
        zaposlen: this.transformBoolean(row['otac_zaposlenost']),
        obrazovanje: this.getValue(row, 'otac_sprema'),
        zanimanje: this.getValue(row, 'otac_zanimanje'),
      };

      // Provjeri da li otac već postoji
      const existingOtac = await this.prisma.roditelj.findFirst({
        where: { ucenikId, tip: TipRoditelja.OTAC },
      });

      if (existingOtac) {
        await this.prisma.roditelj.update({
          where: { id: existingOtac.id },
          data: otacData,
        });
      } else {
        await this.prisma.roditelj.create({
          data: {
            ...otacData,
            ucenikId,
          },
        });
      }
    }
  }

  private async upsertKontakti(ucenikId: string, row: CsvRow): Promise<void> {
    try {
      // Obriši postojeće kontakte
      await this.prisma.kontakt.deleteMany({ where: { ucenikId } });

      // Kreiraj nove kontakte
      const kontakti: any[] = [];
      let primarniIndex = 0;

      const telefon = this.getValue(row, 'kontakt_telefon');
      if (telefon && telefon.trim() !== '') {
        kontakti.push({
          ucenikId,
          tip: TipKontakta.TELEFON,
          vrijednost: telefon.trim(),
          primarni: primarniIndex === 0,
        });
        primarniIndex++;
      }

      const mobitel = this.getValue(row, 'kontakt_mobitel');
      if (mobitel && mobitel.trim() !== '') {
        kontakti.push({
          ucenikId,
          tip: TipKontakta.MOBITEL,
          vrijednost: mobitel.trim(),
          primarni: primarniIndex === 0,
        });
        primarniIndex++;
      }

      const email = this.getValue(row, 'kontakt_email');
      if (email && email.trim() !== '') {
        // Validacija email formata (opciono)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          this.logger.warn(`⚠️  Neispravan format emaila za kontakt: "${email}" - preskače se`);
        } else {
          kontakti.push({
            ucenikId,
            tip: TipKontakta.EMAIL,
            vrijednost: email.trim(),
            primarni: primarniIndex === 0,
          });
          primarniIndex++;
        }
      }

      if (kontakti.length > 0) {
        // Validacija da svi kontakti imaju vrijednost
        const validKontakti = kontakti.filter(k => k.vrijednost && k.vrijednost.trim() !== '');
        
        if (validKontakti.length > 0) {
          await this.prisma.kontakt.createMany({ data: validKontakti });
        }
      }
    } catch (error) {
      throw new Error(`Greška pri kreiranju kontakata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateEmail(ime: string, prezime: string, excludeKorisnikId?: string): Promise<string> {
    if (!ime || !prezime) {
      throw new Error('Ime i prezime su obavezni za generisanje emaila');
    }
    
    const normalizedIme = this.normalizeString(ime);
    const normalizedPrezime = this.normalizeString(prezime);
    
    if (!normalizedIme || !normalizedPrezime) {
      throw new Error(`Ne mogu normalizovati ime ili prezime. Ime: "${ime}", Prezime: "${prezime}"`);
    }
    
    const baseEmail = `${normalizedIme}.${normalizedPrezime}@grbavica2.com`;
    
    // Provjeri da li email već postoji
    let email = baseEmail;
    let counter = 1;
    let attempts = 0;
    const maxAttempts = 1000; // Zaštita od beskonačne petlje
    
    while (attempts < maxAttempts) {
      try {
        const existing = await this.prisma.korisnik.findUnique({
          where: { email },
        });

        if (!existing || (excludeKorisnikId && existing.id === excludeKorisnikId)) {
          return email;
        }

        email = `${normalizedIme}.${normalizedPrezime}${counter}@grbavica2.com`;
        counter++;
        attempts++;
      } catch (error) {
        throw new Error(`Greška pri provjeri emaila "${email}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new Error(`Ne mogu generisati jedinstveni email nakon ${maxAttempts} pokušaja za ${ime} ${prezime}`);
  }

  private normalizeString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Ukloni dijakritike
      .replace(/[^a-z0-9]/g, '') // Ukloni sve što nije slovo ili broj
      .substring(0, 50); // Limitiraj dužinu
  }

  private getValue(row: CsvRow, key: string): string | null {
    const value = row[key];
    if (!value || value.trim() === '' || value.trim().toLowerCase() === 'null' || value.trim() === 'undefined') {
      return null;
    }
    return value.trim();
  }
  
  private fixCommonDataIssues(row: CsvRow): CsvRow {
    const fixedRow = { ...row };
    
    // Fix praznih stringova koji bi trebali biti null
    Object.keys(fixedRow).forEach(key => {
      const value = fixedRow[key];
      if (value === '' || value === 'null' || value === 'undefined' || value === 'NULL' || value === 'UNDEFINED') {
        fixedRow[key] = '';
      }
    });
    
    // Fix datuma - ukloni neispravne formate
    const dateFields = ['ucenik_datum_rodjenja', 'majka_datum_rodjenja', 'otac_datum_rodjenja', 'date_created', 'date_updated'];
    dateFields.forEach(field => {
      if (fixedRow[field]) {
        const dateValue = fixedRow[field].trim();
        // Ako datum nije u validnom formatu, postavi na null
        if (dateValue && dateValue !== '') {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) {
            this.logger.warn(`⚠️  Neispravan format datuma za ${field}: "${dateValue}" - postavljeno na null`);
            fixedRow[field] = '';
          }
        }
      }
    });
    
    // Fix enum vrijednosti - normalizuj spol
    if (fixedRow['ucenik_spol']) {
      const spol = fixedRow['ucenik_spol'].trim().toLowerCase();
      if (spol === 'žensko' || spol === 'zensko' || spol === 'z') {
        fixedRow['ucenik_spol'] = 'ZENSKO';
      } else if (spol === 'muško' || spol === 'musko' || spol === 'm') {
        fixedRow['ucenik_spol'] = 'MUSKO';
      }
    }
    
    // Fix status - normalizuj
    if (fixedRow['status']) {
      const status = fixedRow['status'].trim().toLowerCase();
      if (status === 'aktivan' || status === 'active') {
        fixedRow['status'] = 'AKTIVAN';
      } else if (status === 'neaktivan' || status === 'inactive') {
        fixedRow['status'] = 'NEAKTIVAN';
      }
    }
    
    return fixedRow;
  }

  private parseValue(value: string | undefined, type: 'int' | 'datetime'): any {
    if (!value || value.trim() === '' || value.trim().toLowerCase() === 'null' || value.trim() === 'undefined') {
      return null;
    }

    const trimmedValue = value.trim();

    if (type === 'int') {
      // Ukloni sve što nije broj (npr. "123abc" -> "123")
      const numericValue = trimmedValue.replace(/[^0-9-]/g, '');
      if (!numericValue || numericValue === '-') return null;
      
      const parsed = parseInt(numericValue, 10);
      if (isNaN(parsed)) {
        this.logger.warn(`⚠️  Neispravna numerička vrijednost: "${value}" -> postavljeno na null`);
        return null;
      }
      return parsed;
    }

    if (type === 'datetime') {
      // Pokušaj različite formate datuma
      let date = new Date(trimmedValue);
      
      // Ako standardni format ne radi, pokušaj sa različitim separatorima
      if (isNaN(date.getTime())) {
        // Pokušaj format YYYY-MM-DD
        const dateMatch = trimmedValue.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          date = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
        }
      }
      
      if (isNaN(date.getTime())) {
        this.logger.warn(`⚠️  Neispravan format datuma: "${value}" -> postavljeno na null`);
        return null;
      }
      
      return date;
    }

    return null;
  }

  private transformEnum(value: string | undefined, field: string): string | null {
    if (!value || value.trim() === '') return null;
    
    const trimmedValue = value.trim();
    const transformation = this.metadata.transformations[field];
    
    if (!transformation || transformation.type !== 'enum') {
      // Ako nema transformacije, vrati null (ne pokušavaj normalizaciju)
      return null;
    }
    
    // Pokušaj direktno mapiranje
    if (transformation.mapping[trimmedValue]) {
      return transformation.mapping[trimmedValue];
    }
    
    // Pokušaj case-insensitive mapiranje
    const lowerValue = trimmedValue.toLowerCase();
    for (const [key, mappedValue] of Object.entries(transformation.mapping)) {
      if (key.toLowerCase() === lowerValue) {
        return mappedValue as string;
      }
    }
    
    // Ako nema mapiranja, vrati null umjesto da pokušava normalizaciju
    // Ovo će rezultovati da se polje postavi na null u bazi
    this.logger.warn(`⚠️  Nema mapiranja za enum vrijednost "${trimmedValue}" u polju "${field}" - postavljeno na null`);
    return null;
  }

  private transformBoolean(value: string | undefined): boolean {
    if (!value || value.trim() === '') return false;
    const lower = value.toLowerCase().trim();
    return lower === 'da' || lower === 'yes' || lower === 'true' || lower === '1';
  }

  private getErrorContext(error: unknown): string | undefined {
    if (!(error instanceof Error)) return undefined;
    
    const message = error.message.toLowerCase();
    
    if (message.includes('eksterni id')) return 'Validacija - Eksterni ID';
    if (message.includes('ime i prezime')) return 'Validacija - Ime i prezime';
    if (message.includes('email')) return 'Generisanje emaila';
    if (message.includes('korisnik')) return 'Kreiranje/ažuriranje korisnika';
    if (message.includes('učenik') || message.includes('ucenik')) return 'Kreiranje/ažuriranje učenika';
    if (message.includes('obrazovanje')) return 'Kreiranje/ažuriranje obrazovanja';
    if (message.includes('roditelj')) return 'Kreiranje/ažuriranje roditelja';
    if (message.includes('kontakt')) return 'Kreiranje/ažuriranje kontakata';
    if (message.includes('mapiranje')) return 'Mapiranje podataka';
    if (message.includes('prisma') || message.includes('database') || message.includes('constraint')) return 'Greška baze podataka';
    
    return 'Nepoznat kontekst';
  }
}

