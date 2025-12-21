import { PrismaClient, Spol, StatusUcenika, TipRoditelja, TipKontakta } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface CsvRow {
  [key: string]: string;
}

async function main() {
  console.log('🌱 Seeding učenici iz CSV fajla...');

  // Pronađi CSV fajl
  const possiblePaths = [
    path.join(process.cwd(), '..', '..', 'setup', 'baza_ucenika 20251206-232836.csv'), // Docker: /app/apps/api -> /app/setup
    path.join(process.cwd(), '..', 'setup', 'baza_ucenika 20251206-232836.csv'), // Docker alternativna: /app/apps/api -> /app/apps/setup
    path.join(__dirname, '..', '..', '..', 'setup', 'baza_ucenika 20251206-232836.csv'), // Relativna putanja
    path.join(process.cwd(), 'setup', 'baza_ucenika 20251206-232836.csv'), // Lokalno: ako je u apps/api/setup
    '/app/setup/baza_ucenika 20251206-232836.csv', // Apsolutna putanja u Docker-u
  ];

  console.log(`🔍 Tražim CSV fajl... (cwd: ${process.cwd()}, __dirname: ${__dirname})`);

  let csvPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      csvPath = possiblePath;
      break;
    }
  }

  if (!csvPath) {
    console.error('❌ Ne mogu pronaći CSV fajl. Tražene putanje:');
    possiblePaths.forEach(p => {
      const exists = fs.existsSync(p);
      console.error(`   ${exists ? '✅' : '❌'} ${p}`);
    });
    return;
  }

  console.log(`✅ Pronađen CSV fajl: ${csvPath}`);

  // Učitaj CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Pronađeno ${records.length} redova u CSV fajlu`);

  let uspjesno = 0;
  let novih = 0;
  let updateanih = 0;
  let gresaka = 0;

  // Procesiraj svaki red
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNumber = i + 2; // +2 jer CSV ima header i index počinje od 0

    try {
      const result = await processRow(row, rowNumber);
      if (result.ucenikId) {
        uspjesno++;
        if (result.isNew) {
          novih++;
        } else {
          updateanih++;
        }
      } else {
        gresaka++;
        console.log(`⚠️  Red ${rowNumber}: Nije kreiran učenik (nema ime/prezime ili eksterni ID)`);
      }
    } catch (error) {
      gresaka++;
      console.error(`❌ Greška na redu ${rowNumber}:`, error instanceof Error ? error.message : String(error));
    }

    // Progress indicator
    if ((i + 1) % 50 === 0) {
      console.log(`   Procesirano ${i + 1}/${records.length} redova...`);
    }
  }

  console.log('\n🎉 Seeding učenika završen!');
  console.log(`📊 Statistika:`);
  console.log(`   - Ukupno redova: ${records.length}`);
  console.log(`   - Uspješno: ${uspjesno}`);
  console.log(`   - Novih: ${novih}`);
  console.log(`   - Ažuriranih: ${updateanih}`);
  console.log(`   - Grešaka: ${gresaka}`);
}

async function processRow(row: CsvRow, rowNumber: number): Promise<{ ucenikId: string; isNew: boolean }> {
  const ime = getValue(row, 'ucenik_ime') || '';
  const prezime = getValue(row, 'ucenik_prezime') || '';

  if (!ime || !prezime) {
    return { ucenikId: '', isNew: false };
  }

  const eksterniId = parseValue(row['id'], 'int');
  if (!eksterniId) {
    return { ucenikId: '', isNew: false };
  }

  // Provjeri da li učenik već postoji
  let existingUcenik = await prisma.ucenik.findUnique({
    where: { eksterniId },
    include: { korisnik: true },
  });

  const isNew = !existingUcenik;

  // Generiši email
  const email = await generateEmail(ime, prezime, existingUcenik?.korisnikId || undefined);

  // Kreiraj ili update-uj Korisnik
  let korisnikId: string;
  if (existingUcenik?.korisnikId) {
    await prisma.korisnik.update({
      where: { id: existingUcenik.korisnikId },
      data: {
        ime: ime || undefined,
        prezime: prezime || undefined,
        email: email || undefined,
      },
    });
    korisnikId = existingUcenik.korisnikId;
  } else {
    const defaultPassword = await bcrypt.hash('password123', 10);
    const korisnik = await prisma.korisnik.create({
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

  // Mapiraj podatke učenika
  const ucenikData = mapUcenikData(row);

  // Kreiraj ili update-uj Ucenik
  let ucenikId: string;
  if (existingUcenik) {
    await prisma.ucenik.update({
      where: { id: existingUcenik.id },
      data: {
        ...ucenikData,
        korisnikId,
      },
    });
    ucenikId = existingUcenik.id;
  } else {
    const ucenik = await prisma.ucenik.create({
      data: {
        ...ucenikData,
        eksterniId,
        korisnikId,
      },
    });
    ucenikId = ucenik.id;
  }

  // Kreiraj ili update-uj Obrazovanje
  await upsertObrazovanje(ucenikId, row);

  // Kreiraj ili update-uj Roditelje
  await upsertRoditelji(ucenikId, row);

  // Kreiraj ili update-uj Kontakte
  await upsertKontakti(ucenikId, row);

  return { ucenikId, isNew };
}

function mapUcenikData(row: CsvRow): any {
  const data: any = {};

  data.datumRodjenja = parseValue(row['ucenik_datum_rodjenja'], 'datetime');
  
  const spolValue = getValue(row, 'ucenik_spol');
  if (spolValue) {
    const spol = spolValue.trim().toLowerCase();
    if (spol === 'žensko' || spol === 'zensko' || spol === 'z') {
      data.spol = Spol.ZENSKO;
    } else if (spol === 'muško' || spol === 'musko' || spol === 'm') {
      data.spol = Spol.MUSKO;
    }
  }

  const statusValue = getValue(row, 'status');
  if (statusValue) {
    const status = statusValue.trim().toLowerCase();
    if (status === 'aktivan' || status === 'active') {
      data.status = StatusUcenika.AKTIVAN;
    }
  }

  data.mjestoRodjenja = getValue(row, 'ucenik_mjesto_rodjenja');
  data.adresaStanovanja = getValue(row, 'ucenik_adresa_stanovanja');
  data.eksterniDatumKreiran = parseValue(row['date_created'], 'datetime');
  data.eksterniDatumAzuriran = parseValue(row['date_updated'], 'datetime');
  data.imaRoditelje = getValue(row, 'ima_roditelje');
  data.roditeljiZajedno = getValue(row, 'roditelji_zajedno');
  data.roditeljiRazdvojeni = getValue(row, 'roditelji_razdvojeni_prebivaliste');
  data.roditeljiClanoviIz = getValue(row, 'roditelji_clanovi_iz');
  data.brojBrace = parseValue(row['broj_brace'], 'int') || 0;
  data.brojSestara = parseValue(row['broj_sestara'], 'int') || 0;
  data.tipStambenogObjekta = getValue(row, 'tip_stambenog_objekta');
  data.imaPosebnePotrebe = transformBoolean(row['ucenik_posebnim_potrebama']);
  data.posebnePotrebeOpis = getValue(row, 'posebne_potrebe_opis');
  data.idPunktaDzemata = parseValue(row['id_punkta_dzemata'], 'int');
  data.clanMrezeMladih = getValue(row, 'clan_mreze_mladih');
  data.ucenikSkoleHifza = getValue(row, 'ucenik_skole_hifza');

  return data;
}

async function upsertObrazovanje(ucenikId: string, row: CsvRow): Promise<void> {
  const obrazovanjeData: any = {
    nivoObrazovanja: getValue(row, 'nivo_obrazovanja'),
    razred: parseValue(row['os_razred'], 'int'),
    mektebStepen: getValue(row, 'mekteb_stepen'),
    predskolskaNaziv: getValue(row, 'predskolska_naziv'),
    osnovnaNaziv: getValue(row, 'osnovna_naziv'),
    srednjaNaziv: getValue(row, 'srednja_naziv'),
    fakultetNaziv: getValue(row, 'fakultet_naziv'),
  };

  await prisma.obrazovanje.upsert({
    where: { ucenikId },
    update: obrazovanjeData,
    create: {
      ...obrazovanjeData,
      ucenikId,
    },
  });
}

async function upsertRoditelji(ucenikId: string, row: CsvRow): Promise<void> {
  // Majka
  const majkaImePrezime = getValue(row, 'majka_ime_prezime');
  if (majkaImePrezime) {
    const majkaData: any = {
      tip: TipRoditelja.MAJKA,
      imePrezime: majkaImePrezime,
      datumRodjenja: parseValue(row['majka_datum_rodjenja'], 'datetime'),
      mjestoRodjenja: getValue(row, 'majka_mjesto_rodjenja'),
      email: getValue(row, 'majka_email'),
      mobitel: getValue(row, 'majka_mobitel'),
      telefon: getValue(row, 'majka_telefon'),
      zaposlen: transformBoolean(row['majka_zaposlenost']),
      obrazovanje: getValue(row, 'majka_sprema'),
      zanimanje: getValue(row, 'majka_zanimanje'),
    };

    const existingMajka = await prisma.roditelj.findFirst({
      where: { ucenikId, tip: TipRoditelja.MAJKA },
    });

    if (existingMajka) {
      await prisma.roditelj.update({
        where: { id: existingMajka.id },
        data: majkaData,
      });
    } else {
      await prisma.roditelj.create({
        data: {
          ...majkaData,
          ucenikId,
        },
      });
    }
  }

  // Otac
  const otacImePrezime = getValue(row, 'otac_ime_prezime');
  if (otacImePrezime) {
    const otacData: any = {
      tip: TipRoditelja.OTAC,
      imePrezime: otacImePrezime,
      datumRodjenja: parseValue(row['otac_datum_rodjenja'], 'datetime'),
      mjestoRodjenja: getValue(row, 'otac_mjesto_rodjenja'),
      email: getValue(row, 'otac_email'),
      mobitel: getValue(row, 'otac_mobitel'),
      telefon: getValue(row, 'otac_telefon'),
      zaposlen: transformBoolean(row['otac_zaposlenost']),
      obrazovanje: getValue(row, 'otac_sprema'),
      zanimanje: getValue(row, 'otac_zanimanje'),
    };

    const existingOtac = await prisma.roditelj.findFirst({
      where: { ucenikId, tip: TipRoditelja.OTAC },
    });

    if (existingOtac) {
      await prisma.roditelj.update({
        where: { id: existingOtac.id },
        data: otacData,
      });
    } else {
      await prisma.roditelj.create({
        data: {
          ...otacData,
          ucenikId,
        },
      });
    }
  }
}

async function upsertKontakti(ucenikId: string, row: CsvRow): Promise<void> {
  // Obriši postojeće kontakte
  await prisma.kontakt.deleteMany({ where: { ucenikId } });

  const kontakti: any[] = [];
  let primarniIndex = 0;

  const telefon = getValue(row, 'kontakt_telefon');
  if (telefon && telefon.trim() !== '') {
    kontakti.push({
      ucenikId,
      tip: TipKontakta.TELEFON,
      vrijednost: telefon.trim(),
      primarni: primarniIndex === 0,
    });
    primarniIndex++;
  }

  const mobitel = getValue(row, 'kontakt_mobitel');
  if (mobitel && mobitel.trim() !== '') {
    kontakti.push({
      ucenikId,
      tip: TipKontakta.MOBITEL,
      vrijednost: mobitel.trim(),
      primarni: primarniIndex === 0,
    });
    primarniIndex++;
  }

  const email = getValue(row, 'kontakt_email');
  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email.trim())) {
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
    await prisma.kontakt.createMany({ data: kontakti });
  }
}

async function generateEmail(ime: string, prezime: string, excludeKorisnikId?: string): Promise<string> {
  const normalizedIme = normalizeString(ime);
  const normalizedPrezime = normalizeString(prezime);

  if (!normalizedIme || !normalizedPrezime) {
    throw new Error(`Ne mogu normalizovati ime ili prezime. Ime: "${ime}", Prezime: "${prezime}"`);
  }

  const baseEmail = `${normalizedIme}.${normalizedPrezime}@grbavica2.com`;
  let email = baseEmail;
  let counter = 1;
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    const existing = await prisma.korisnik.findUnique({
      where: { email },
    });

    if (!existing || (excludeKorisnikId && existing.id === excludeKorisnikId)) {
      return email;
    }

    email = `${normalizedIme}.${normalizedPrezime}${counter}@grbavica2.com`;
    counter++;
    attempts++;
  }

  throw new Error(`Ne mogu generisati jedinstveni email nakon ${maxAttempts} pokušaja za ${ime} ${prezime}`);
}

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50);
}

function getValue(row: CsvRow, key: string): string | null {
  const value = row[key];
  if (!value || value.trim() === '' || value.trim().toLowerCase() === 'null' || value.trim() === 'undefined') {
    return null;
  }
  return value.trim();
}

function parseValue(value: string | undefined, type: 'int' | 'datetime'): any {
  if (!value || value.trim() === '' || value.trim().toLowerCase() === 'null' || value.trim() === 'undefined') {
    return null;
  }

  const trimmedValue = value.trim();

  if (type === 'int') {
    const numericValue = trimmedValue.replace(/[^0-9-]/g, '');
    if (!numericValue || numericValue === '-') return null;
    const parsed = parseInt(numericValue, 10);
    return isNaN(parsed) ? null : parsed;
  }

  if (type === 'datetime') {
    let date = new Date(trimmedValue);
    if (isNaN(date.getTime())) {
      const dateMatch = trimmedValue.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        date = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
      }
    }
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function transformBoolean(value: string | undefined): boolean {
  if (!value || value.trim() === '') return false;
  const lower = value.toLowerCase().trim();
  return lower === 'da' || lower === 'yes' || lower === 'true' || lower === '1';
}

main()
  .catch((e) => {
    console.error('❌ Error seeding učenici:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

