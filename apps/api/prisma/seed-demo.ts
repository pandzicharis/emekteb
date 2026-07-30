import {
  PrismaClient,
  Uloga,
  TipLekcije,
  Spol,
  StatusUcenika,
  DanUNedelji,
  StatusPrisustva,
  TipCasa,
  StatusNastavneGodine,
  TipRoditelja,
  TipKontakta,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Helper funkcija za dobijanje dana u nedjelji
function getDayOfWeek(date: Date): number {
  return date.getDay(); // 0 = Sunday, 6 = Saturday
}

// Helper funkcija za provjeru da li je subota (6) ili nedjelja (0)
function isWeekend(date: Date): boolean {
  const day = getDayOfWeek(date);
  return day === 0 || day === 6;
}

// Helper funkcija za dobijanje svih subota i nedjelja između dva datuma
function getWeekendDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWeekend(current)) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Helper funkcija za formatiranje vremena
function formatTime(hours: number, minutes: number = 0): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Helper funkcije za parsiranje CSV podataka
interface CsvRow {
  [key: string]: string;
}

function getValue(row: CsvRow, key: string): string | null {
  const value = row[key];
  return value && value.trim() !== '' ? value.trim() : null;
}

function parseValue(value: string | undefined, type: 'int' | 'datetime' | 'boolean'): any {
  if (!value || value.trim() === '') return null;

  if (type === 'int') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  if (type === 'datetime') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (type === 'boolean') {
    const lower = value.toLowerCase().trim();
    return lower === 'da' || lower === 'yes' || lower === 'true' || lower === '1';
  }

  return null;
}

function transformEnum(value: string | undefined, field: string): any {
  if (!value || value.trim() === '') return null;

  const normalized = value.trim();

  if (field === 'ucenik_spol') {
    if (normalized.toLowerCase() === 'muško' || normalized.toLowerCase() === 'musko') return Spol.MUSKO;
    if (normalized.toLowerCase() === 'žensko' || normalized.toLowerCase() === 'zensko') return Spol.ZENSKO;
  }

  if (field === 'status') {
    if (normalized.toLowerCase() === 'aktivan') return StatusUcenika.AKTIVAN;
    if (normalized.toLowerCase() === 'arhiviran') return StatusUcenika.ARHIVIRAN;
  }

  return null;
}

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function generateEmail(ime: string, prezime: string, prisma: PrismaClient, excludeKorisnikId?: string): Promise<string> {
  if (!ime || !prezime) {
    throw new Error('Ime i prezime su obavezni za generisanje emaila');
  }

  const normalizedIme = normalizeString(ime);
  const normalizedPrezime = normalizeString(prezime);

  if (!normalizedIme || !normalizedPrezime) {
    throw new Error(`Ne mogu normalizovati ime ili prezime. Ime: "${ime}", Prezime: "${prezime}"`);
  }

  const baseEmail = `demo.${normalizedIme}.${normalizedPrezime}@emekteb.ba`;

  let email = baseEmail;
  let counter = 1;
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    try {
      const existing = await prisma.korisnik.findUnique({
        where: { email },
      });

      if (!existing || (excludeKorisnikId && existing.id === excludeKorisnikId)) {
        return email;
      }

      email = `demo.${normalizedIme}.${normalizedPrezime}${counter}@emekteb.ba`;
      counter++;
      attempts++;
    } catch (error) {
      throw new Error(`Greška pri provjeri emaila "${email}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Ne mogu generisati jedinstveni email nakon ${maxAttempts} pokušaja za ${ime} ${prezime}`);
}

// Funkcija za učitavanje učenika iz CSV fajla
async function loadStudentsFromCsv(prisma: PrismaClient): Promise<any[]> {
  console.log('📂 Učitavanje učenika iz CSV fajla...');

  const basePath = process.cwd();
  const possiblePaths = [
    path.join(basePath, 'setup/baza_ucenika 20251206-232836.csv'),
    path.join(__dirname, '../../setup/baza_ucenika 20251206-232836.csv'),
    path.join(__dirname, '../../../setup/baza_ucenika 20251206-232836.csv'),
  ];

  let csvPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      csvPath = possiblePath;
      break;
    }
  }

  if (!csvPath) {
    throw new Error(`Ne mogu pronaći CSV fajl. Tražene putanje: ${possiblePaths.join(', ')}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`✅ Učitano ${records.length} učenika iz CSV fajla`);

  // Odaberi 90 random učenika
  const shuffled = [...records].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 90);

  console.log(`✅ Odabrano ${selected.length} random učenika\n`);

  const hashedPassword = await bcrypt.hash('password123', 10);
  const kreiraniUcenici: any[] = [];

  for (let i = 0; i < selected.length; i++) {
    const row = selected[i];
    const ime = getValue(row, 'ucenik_ime') || '';
    const prezime = getValue(row, 'ucenik_prezime') || '';

    if (!ime || !prezime) {
      console.log(`⚠️  Preskačem red ${i + 1}: nedostaje ime ili prezime`);
      continue;
    }

    try {
      // Generiši email
      const email = await generateEmail(ime, prezime, prisma);
      const pin = String(3000 + i).padStart(4, '0');

      // Kreiraj korisnika
      const korisnik = await prisma.korisnik.create({
        data: {
          email,
          lozinka: hashedPassword,
          ime,
          prezime,
          uloga: Uloga.UCENIK,
          aktivan: true,
          pin,
        },
      });

      // Mapiraj podatke učenika
      const ucenikData: any = {
        korisnikId: korisnik.id,
        eksterniId: parseValue(row['id'], 'int'),
        datumRodjenja: parseValue(row['ucenik_datum_rodjenja'], 'datetime'),
        spol: transformEnum(row['ucenik_spol'], 'ucenik_spol'),
        mjestoRodjenja: getValue(row, 'ucenik_mjesto_rodjenja'),
        adresaStanovanja: getValue(row, 'ucenik_adresa_stanovanja'),
        status: transformEnum(row['status'], 'status') || StatusUcenika.AKTIVAN,
        eksterniDatumKreiran: parseValue(row['date_created'], 'datetime'),
        eksterniDatumAzuriran: parseValue(row['date_updated'], 'datetime'),
        imaRoditelje: getValue(row, 'ima_roditelje'),
        roditeljiZajedno: getValue(row, 'roditelji_zajedno'),
        roditeljiRazdvojeni: getValue(row, 'roditelji_razdvojeni_prebivaliste'),
        roditeljiClanoviIz: getValue(row, 'roditelji_clanovi_iz'),
        brojBrace: parseValue(row['broj_brace'], 'int') || 0,
        brojSestara: parseValue(row['broj_sestara'], 'int') || 0,
        tipStambenogObjekta: getValue(row, 'tip_stambenog_objekta'),
        imaPosebnePotrebe: parseValue(row['ucenik_posebnim_potrebama'], 'boolean') || false,
        posebnePotrebeOpis: getValue(row, 'posebne_potrebe_opis'),
        idPunktaDzemata: parseValue(row['id_punkta_dzemata'], 'int'),
        clanMrezeMladih: getValue(row, 'clan_mreze_mladih'),
        ucenikSkoleHifza: getValue(row, 'ucenik_skole_hifza'),
      };

      const ucenik = await prisma.ucenik.create({
        data: ucenikData,
      });

      // Kreiraj obrazovanje
      const obrazovanjeData = {
        nivoObrazovanja: getValue(row, 'nivo_obrazovanja'),
        razred: parseValue(row['os_razred'], 'int'),
        mektebStepen: getValue(row, 'mekteb_stepen'),
        predskolskaNaziv: getValue(row, 'predskolska_naziv'),
        osnovnaNaziv: getValue(row, 'osnovna_naziv'),
        srednjaNaziv: getValue(row, 'srednja_naziv'),
        fakultetNaziv: getValue(row, 'fakultet_naziv'),
      };

      if (Object.values(obrazovanjeData).some(v => v !== null && v !== undefined)) {
        await prisma.obrazovanje.create({
          data: {
            ...obrazovanjeData,
            ucenikId: ucenik.id,
          },
        });
      }

      // Kreiraj roditelje
      const majkaImePrezime = getValue(row, 'majka_ime_prezime');
      if (majkaImePrezime) {
        await prisma.roditelj.create({
          data: {
            ucenikId: ucenik.id,
            tip: TipRoditelja.MAJKA,
            imePrezime: majkaImePrezime,
            datumRodjenja: parseValue(row['majka_datum_rodjenja'], 'datetime'),
            mjestoRodjenja: getValue(row, 'majka_mjesto_rodjenja'),
            email: getValue(row, 'majka_email'),
            mobitel: getValue(row, 'majka_mobitel'),
            telefon: getValue(row, 'majka_telefon'),
            zaposlen: parseValue(row['majka_zaposlenost'], 'boolean'),
            obrazovanje: getValue(row, 'majka_sprema'),
            zanimanje: getValue(row, 'majka_zanimanje'),
          },
        });
      }

      const otacImePrezime = getValue(row, 'otac_ime_prezime');
      if (otacImePrezime) {
        await prisma.roditelj.create({
          data: {
            ucenikId: ucenik.id,
            tip: TipRoditelja.OTAC,
            imePrezime: otacImePrezime,
            datumRodjenja: parseValue(row['otac_datum_rodjenja'], 'datetime'),
            mjestoRodjenja: getValue(row, 'otac_mjesto_rodjenja'),
            email: getValue(row, 'otac_email'),
            mobitel: getValue(row, 'otac_mobitel'),
            telefon: getValue(row, 'otac_telefon'),
            zaposlen: parseValue(row['otac_zaposlenost'], 'boolean'),
            obrazovanje: getValue(row, 'otac_sprema'),
            zanimanje: getValue(row, 'otac_zanimanje'),
          },
        });
      }

      // Kreiraj kontakte
      const kontakti: any[] = [];
      let primarniIndex = 0;

      const telefon = getValue(row, 'kontakt_telefon');
      if (telefon) {
        kontakti.push({
          ucenikId: ucenik.id,
          tip: TipKontakta.TELEFON,
          vrijednost: telefon,
          primarni: primarniIndex === 0,
        });
        primarniIndex++;
      }

      const mobitel = getValue(row, 'kontakt_mobitel');
      if (mobitel) {
        kontakti.push({
          ucenikId: ucenik.id,
          tip: TipKontakta.MOBITEL,
          vrijednost: mobitel,
          primarni: primarniIndex === 0,
        });
        primarniIndex++;
      }

      const emailKontakt = getValue(row, 'kontakt_email');
      if (emailKontakt) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(emailKontakt)) {
          kontakti.push({
            ucenikId: ucenik.id,
            tip: TipKontakta.EMAIL,
            vrijednost: emailKontakt,
            primarni: primarniIndex === 0,
          });
        }
      }

      if (kontakti.length > 0) {
        await prisma.kontakt.createMany({ data: kontakti });
      }

      kreiraniUcenici.push(ucenik);
    } catch (error) {
      console.log(`⚠️  Greška pri kreiranju učenika ${ime} ${prezime}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return kreiraniUcenici;
}

async function main() {
  console.log('🌱 Starting DEMO seed process...\n');

  // Provjeri da li osnovni seed postoji
  const existingAdmin = await prisma.korisnik.findFirst({
    where: { uloga: Uloga.ADMIN },
  });

  const existingMuallim = await prisma.korisnik.findFirst({
    where: { uloga: Uloga.MUALLIM },
    include: { ucenik: true },
  });

  if (!existingAdmin || !existingMuallim || !existingMuallim.ucenik) {
    console.log('❌ Osnovni seed nije pokrenut!');
    console.log('   Molimo prvo pokrenite: npm run seed:demo\n');
    process.exit(1);
  }

  console.log('✅ Osnovni seed pronađen\n');

  // Provjeri da li demo seed već postoji
  const existingNastavniPlan = await prisma.nastavniPlan.findFirst({
    where: { naziv: { contains: 'Demo' } },
  });

  if (existingNastavniPlan) {
    console.log('⚠️  Demo seed je već napravljen.');
    console.log('   Za ponovni demo seed, prvo pokrenite: npm run prisma:truncate\n');
    return;
  }

  const muallimUcenik = existingMuallim.ucenik;

  // ============================================
  // 1. KREIRANJE NASTAVNOG PLANA
  // ============================================
  console.log('📋 Kreiranje nastavnog plana...');

  const nastavniPlan = await prisma.nastavniPlan.create({
    data: {
      naziv: 'Demo Nastavni Plan',
      opis: 'Nastavni plan za demo podatke',
      datumUsvajanja: new Date('2025-01-01'),
      aktivan: true,
    },
  });

  console.log('✅ Nastavni plan kreiran\n');

  // ============================================
  // 2. DOBIJANJE RAZREDA (1-9, bez Škole Hifza)
  // ============================================
  console.log('📚 Dobijanje razreda...');

  const razredi = await prisma.razred.findMany({
    where: {
      name: {
        not: 'Škola Hifza',
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  if (razredi.length < 9) {
    console.log('❌ Nije pronađeno 9 razreda!');
    process.exit(1);
  }

  const razredi1_9 = razredi.slice(0, 9);
  console.log(`✅ Pronađeno ${razredi1_9.length} razreda\n`);

  // ============================================
  // 3. DOBIJANJE LEKCIJA IZ KURANA I SUFARE
  // ============================================
  console.log('📖 Dobijanje lekcija iz Kurana i Sufare...');

  const kuranLekcije = await prisma.lekcija.findMany({
    where: { tip: TipLekcije.KURAN },
    orderBy: { redoslijed: 'asc' },
  });

  const sufaraLekcije = await prisma.lekcija.findMany({
    where: { tip: TipLekcije.SUFARA },
    orderBy: { redoslijed: 'asc' },
  });

  console.log(`✅ Pronađeno ${kuranLekcije.length} lekcija iz Kurana`);
  console.log(`✅ Pronađeno ${sufaraLekcije.length} lekcija iz Sufare\n`);

  // ============================================
  // 4. KREIRANJE LEKCIJA ZA SVAKI RAZRED
  // ============================================
  console.log('📝 Kreiranje lekcija za svaki razred...');

  const razredLekcijeMap = new Map<string, string[]>(); // razredId -> lekcijaIds[]

  for (const razred of razredi1_9) {
    const razredBroj = razred.name.replace('Razred ', '');
    const lekcijeIds: string[] = [];

    // Kreiraj 20 lekcija za svaki razred
    for (let i = 1; i <= 20; i++) {
      const lekcija = await prisma.lekcija.create({
        data: {
          naslov: `_${razredBroj}_ - lekcija #${i}`,
          opis: `Lekcija ${i} za ${razred.name}`,
          tip: TipLekcije.ILMIHAL,
          tezina: Math.min(Math.ceil(i / 4), 6),
          redoslijed: i,
          aktivan: true,
        },
      });
      lekcijeIds.push(lekcija.id);
    }

    razredLekcijeMap.set(razred.id, lekcijeIds);
    console.log(`  ✅ Kreirano 20 lekcija za ${razred.name}`);
  }

  console.log('\n');

  // ============================================
  // 5. DODAVANJE RAZREDA U NASTAVNI PLAN
  // ============================================
  console.log('📋 Dodavanje razreda u nastavni plan...');

  for (const razred of razredi1_9) {
    const nastavniPlanRazred = await prisma.nastavniPlanRazred.create({
      data: {
        nastavniPlanId: nastavniPlan.id,
        razredId: razred.id,
      },
    });

    // Dodaj lekcije za ovaj razred u nastavni plan
    const lekcijeIds = razredLekcijeMap.get(razred.id) || [];
    for (const lekcijaId of lekcijeIds) {
      await prisma.nastavniPlanRazredLekcija.create({
        data: {
          nastavniPlanRazredId: nastavniPlanRazred.id,
          lekcijaId: lekcijaId,
        },
      });
    }

    // Za razrede 4 i 5, dodaj i Kuran i Sufara lekcije
    const razredBroj = parseInt(razred.name.replace('Razred ', ''));
    if (razredBroj === 4 || razredBroj === 5) {
      // Dodaj sve Kuran lekcije
      for (const kuranLekcija of kuranLekcije) {
        await prisma.nastavniPlanRazredLekcija.create({
          data: {
            nastavniPlanRazredId: nastavniPlanRazred.id,
            lekcijaId: kuranLekcija.id,
          },
        });
      }

      // Dodaj sve Sufara lekcije
      for (const sufaraLekcija of sufaraLekcije) {
        await prisma.nastavniPlanRazredLekcija.create({
          data: {
            nastavniPlanRazredId: nastavniPlanRazred.id,
            lekcijaId: sufaraLekcija.id,
          },
        });
      }
    }

    console.log(`  ✅ ${razred.name} dodan u nastavni plan`);
  }

  // Dodaj Školu Hifza u nastavni plan
  const skolaHifzaRazredForPlan = await prisma.razred.findFirst({
    where: { name: 'Škola Hifza' },
  });

  if (skolaHifzaRazredForPlan) {
    const nastavniPlanRazredSkolaHifza = await prisma.nastavniPlanRazred.create({
      data: {
        nastavniPlanId: nastavniPlan.id,
        razredId: skolaHifzaRazredForPlan.id,
      },
    });

    // Dodaj sve lekcije iz Kurana za Školu Hifza (već postoje u bazi)
    const kuranLekcijeForHifza = await prisma.lekcija.findMany({
      where: { tip: TipLekcije.KURAN },
      orderBy: { redoslijed: 'asc' },
    });

    for (const lekcija of kuranLekcijeForHifza) {
      await prisma.nastavniPlanRazredLekcija.create({
        data: {
          nastavniPlanRazredId: nastavniPlanRazredSkolaHifza.id,
          lekcijaId: lekcija.id,
        },
      });
    }

    console.log(`  ✅ Škola Hifza dodana u nastavni plan sa ${kuranLekcijeForHifza.length} lekcija`);
  }

  console.log('\n');

  // ============================================
  // 6. KREIRANJE NASTAVNE GODINE
  // ============================================
  console.log('📅 Kreiranje nastavne godine...');

  const datumOd = new Date('2025-12-01');
  const datumDo = new Date('2026-02-01');
  const danas = new Date();
  const krajDatum = danas < datumDo ? danas : datumDo;

  const nastavnaGodina = await prisma.nastavnaGodina.create({
    data: {
      naziv: 'Demo Nastavna Godina 2025/2026',
      opis: 'Nastavna godina za demo podatke',
      datumOd: datumOd,
      datumDo: datumDo,
      nastavniPlanId: nastavniPlan.id,
      status: StatusNastavneGodine.ACTIVE,
    },
  });

  console.log(`✅ Nastavna godina kreirana: ${datumOd.toLocaleDateString()} - ${datumDo.toLocaleDateString()}\n`);

  // ============================================
  // 7. KREIRANJE 90 UČENIKA IZ CSV FAJLA
  // ============================================
  console.log('👥 Kreiranje 90 učenika iz CSV fajla...\n');

  const kreiraniUcenici = await loadStudentsFromCsv(prisma);

  if (kreiraniUcenici.length < 90) {
    console.log(`⚠️  Upozorenje: Kreirano je samo ${kreiraniUcenici.length} učenika umjesto 90`);
  }

  console.log(`✅ Kreirano ${kreiraniUcenici.length} učenika\n`);

  // ============================================
  // 8. DODJELA UČENIKA RAZREDIMA (10 po razredu) + ŠKOLA HIFZA
  // ============================================
  console.log('👥 Dodjela učenika razredima...');

  const razredNastavnaGodinaMap = new Map<string, any>();

  for (let i = 0; i < razredi1_9.length; i++) {
    const razred = razredi1_9[i];
    const razredNastavnaGodina = await prisma.razredNastavnaGodina.create({
      data: {
        nastavnaGodinaId: nastavnaGodina.id,
        razredId: razred.id,
        muallimId: muallimUcenik.id,
        split: false,
      },
    });

    razredNastavnaGodinaMap.set(razred.id, razredNastavnaGodina);

    // Dodijeli 10 učenika ovom razredu
    const startIndex = i * 10;
    const uceniciZaRazred = kreiraniUcenici.slice(startIndex, startIndex + 10);

    console.log(`  ✅ ${razred.name}: ${uceniciZaRazred.length} učenika`);
  }

  // Dodaj Školu Hifza u nastavnu godinu
  const skolaHifzaRazred = await prisma.razred.findFirst({
    where: { name: 'Škola Hifza' },
  });

  if (skolaHifzaRazred) {
    const skolaHifzaRazredNastavnaGodina = await prisma.razredNastavnaGodina.create({
      data: {
        nastavnaGodinaId: nastavnaGodina.id,
        razredId: skolaHifzaRazred.id,
        muallimId: muallimUcenik.id,
        split: false,
      },
    });

    razredNastavnaGodinaMap.set(skolaHifzaRazred.id, skolaHifzaRazredNastavnaGodina);
    console.log(`  ✅ Škola Hifza: dodana u nastavnu godinu`);
  }

  console.log('\n');

  // ============================================
  // 9. KREIRANJE GRUPA I RASPOREDA
  // ============================================
  console.log('📅 Kreiranje grupa i rasporeda...');

  const subotaVremena = ['08:00', '09:00', '10:00', '11:00', '12:00'];
  const nedjeljaVremena = ['08:00', '09:00', '10:00', '11:00'];

  const grupeMap = new Map<string, any>(); // razredId -> grupa
  const rasporedMap = new Map<string, any>(); // grupaId -> raspored

  for (let i = 0; i < razredi1_9.length; i++) {
    const razred = razredi1_9[i];
    const razredNastavnaGodina = razredNastavnaGodinaMap.get(razred.id);

    // Kreiraj grupu
    const grupa = await prisma.grupa.create({
      data: {
        razredNastavnaGodinaId: razredNastavnaGodina.id,
        naziv: 'A',
        kuran: false,
        sufara: false,
      },
    });

    grupeMap.set(razred.id, grupa);

    // Kreiraj raspored
    const dan = i < 5 ? DanUNedelji.subota : DanUNedelji.nedjelja;
    const vremena = i < 5 ? subotaVremena : nedjeljaVremena;
    const slotIndex = i < 5 ? i : i - 5;
    const slot = vremena[slotIndex];

    const raspored = await prisma.raspored.create({
      data: {
        grupaId: grupa.id,
        dan: dan,
        slot: slot,
        lokacija: 'učionica',
        trajanje: 45,
      },
    });

    rasporedMap.set(grupa.id, raspored);

    // Dodijeli učenike grupi
    const startIndex = i * 10;
    const uceniciZaRazred = kreiraniUcenici.slice(startIndex, startIndex + 10);

    for (const ucenik of uceniciZaRazred) {
      await prisma.ucenikGrupa.create({
        data: {
          ucenikId: ucenik.id,
          grupaId: grupa.id,
        },
      });
    }

    console.log(`  ✅ ${razred.name}: Grupa ${grupa.naziv}, ${dan} ${slot}`);
  }

  console.log('\n');

  // ============================================
  // 10. KREIRANJE ČASOVA SA PRISUSTVOM I OCJENAMA
  // ============================================
  console.log('📚 Kreiranje časova, prisustva i ocjena...');

  const weekendDates = getWeekendDates(datumOd, krajDatum);
  console.log(`  📅 Kreiranje časova za ${weekendDates.length} dana (subota i nedjelja)\n`);

  let ukupnoCasova = 0;
  let ukupnoPrisustva = 0;
  let ukupnoOcjena = 0;

  for (const razred of razredi1_9) {
    const razredNastavnaGodina = razredNastavnaGodinaMap.get(razred.id);
    const grupa = grupeMap.get(razred.id);
    const raspored = rasporedMap.get(grupa.id);
    const dan = raspored.dan;

    // Filtriraj datume za ovaj dan (subota ili nedjelja)
    const datumiZaRazred = weekendDates.filter((date) => {
      const dayOfWeek = getDayOfWeek(date);
      return (dan === DanUNedelji.subota && dayOfWeek === 6) || (dan === DanUNedelji.nedjelja && dayOfWeek === 0);
    });

    const uceniciZaRazred = await prisma.ucenikGrupa.findMany({
      where: { grupaId: grupa.id },
      include: { ucenik: true },
    });

    const lekcijeIds = razredLekcijeMap.get(razred.id) || [];

    for (const datum of datumiZaRazred) {
      // Kreiraj čas
      const cas = await prisma.cas.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredNastavnaGodinaId: razredNastavnaGodina.id,
          grupaId: grupa.id,
          rasporedId: raspored.id,
          datum: datum,
          tipovi: [TipCasa.LEKCIJA],
          napomena: null,
        },
      });

      ukupnoCasova++;

      // Dodaj 1-3 lekcije u čas
      const brojLekcija = Math.floor(Math.random() * 3) + 1;
      const odabraneLekcije = lekcijeIds.slice(0, Math.min(brojLekcija, lekcijeIds.length));

      for (const lekcijaId of odabraneLekcije) {
        await prisma.casLekcija.create({
          data: {
            casId: cas.id,
            lekcijaId: lekcijaId,
          },
        });
      }

      // Kreiraj prisustvo za sve učenike
      for (const ucenikGrupa of uceniciZaRazred) {
        const random = Math.random();
        let status: StatusPrisustva;

        if (random < 0.8) {
          status = StatusPrisustva.PRISUTAN; // 80% prisutni
        } else if (random < 0.95) {
          status = StatusPrisustva.OPRAVDAN; // 15% opravdani
        } else {
          status = StatusPrisustva.NEOPRAVDAN; // 5% neopravdani
        }

        await prisma.casPrisustvo.create({
          data: {
            casId: cas.id,
            ucenikId: ucenikGrupa.ucenik.id,
            status: status,
            napomena: status !== StatusPrisustva.PRISUTAN ? 'Demo napomena' : null,
          },
        });

        ukupnoPrisustva++;

        // Ako je učenik prisutan, dodaj ocjene za lekcije
        if (status === StatusPrisustva.PRISUTAN) {
          for (const lekcijaId of odabraneLekcije) {
            // Većina ocjena 3-5, rijetko 1-2
            const randomOcjena = Math.random();
            let ocjena: number;

            if (randomOcjena < 0.1) {
              ocjena = 1; // 10% ocjena 1
            } else if (randomOcjena < 0.2) {
              ocjena = 2; // 10% ocjena 2
            } else if (randomOcjena < 0.5) {
              ocjena = 3; // 30% ocjena 3
            } else if (randomOcjena < 0.8) {
              ocjena = 4; // 30% ocjena 4
            } else {
              ocjena = 5; // 20% ocjena 5
            }

            await prisma.casOcjena.create({
              data: {
                casId: cas.id,
                ucenikId: ucenikGrupa.ucenik.id,
                lekcijaId: lekcijaId,
                ocjena: ocjena,
                komentar: Math.random() > 0.7 ? 'Dobar napredak!' : null,
              },
            });

            ukupnoOcjena++;
          }
        }
      }
    }

    console.log(`  ✅ ${razred.name}: ${datumiZaRazred.length} časova kreirano`);
  }

  console.log(`\n✅ Ukupno kreirano: ${ukupnoCasova} časova, ${ukupnoPrisustva} prisustva, ${ukupnoOcjena} ocjena\n`);

  // ============================================
  // 11. KREIRANJE ŠKOLE HIFZA
  // ============================================
  console.log('📖 Kreiranje Škole Hifza...');

  const skolaHifzaRazredForSkolaHifza = await prisma.razred.findFirst({
    where: { name: 'Škola Hifza' },
  });

  if (!skolaHifzaRazredForSkolaHifza) {
    console.log('⚠️  Razred "Škola Hifza" nije pronađen. Preskačem.');
  } else {
    // Kreiraj SkolaHifza zapis
    const skolaHifza = await prisma.skolaHifza.create({
      data: {
        nastavnaGodinaId: nastavnaGodina.id,
        // lekcije je opciono polje, ne postavljamo ga
      },
    });

    // Dodaj muallime
    await prisma.skolaHifzaMuallim.create({
      data: {
        skolaHifzaId: skolaHifza.id,
        muallimId: muallimUcenik.id,
      },
    });

    // Odaberi 10 random učenika za Školu Hifza
    const randomUcenici = [...kreiraniUcenici].sort(() => Math.random() - 0.5).slice(0, 10);

    for (const ucenik of randomUcenici) {
      await prisma.skolaHifzaUcenik.create({
        data: {
          skolaHifzaId: skolaHifza.id,
          ucenikId: ucenik.id,
          muallimId: muallimUcenik.id,
          napredak: {
            'Al-Fatiha': [1, 2, 3, 4, 5, 6, 7],
            'Al-Baqara': [1, 2, 3],
          },
        },
      });
    }

    // Koristi razredNastavnaGodina za Školu Hifza iz mape (već kreirana u sekciji 8)
    const skolaHifzaRazredNastavnaGodina = razredNastavnaGodinaMap.get(skolaHifzaRazredForSkolaHifza.id);

    if (!skolaHifzaRazredNastavnaGodina) {
      console.log('⚠️  RazredNastavnaGodina za Školu Hifza nije pronađena u mapi. Preskačem.');
    } else {
      // Kreiraj grupu za Školu Hifza
      const skolaHifzaGrupa = await prisma.grupa.create({
        data: {
          razredNastavnaGodinaId: skolaHifzaRazredNastavnaGodina.id,
          naziv: 'A',
          kuran: false,
          sufara: false,
        },
      });

      // Dodaj učenike u grupu
      for (const ucenik of randomUcenici) {
        await prisma.ucenikGrupa.create({
          data: {
            ucenikId: ucenik.id,
            grupaId: skolaHifzaGrupa.id,
          },
        });
      }

      // Kreiraj raspored za Školu Hifza
      const skolaHifzaRaspored = await prisma.raspored.create({
        data: {
          grupaId: skolaHifzaGrupa.id,
          dan: DanUNedelji.subota,
          slot: '13:00',
          lokacija: 'učionica',
          trajanje: 45,
        },
      });

      // Kreiraj časove za nekoliko subota
      const skolaHifzaDatumi = weekendDates
        .filter((date) => getDayOfWeek(date) === 6)
        .slice(0, 5); // Prvih 5 subota

      for (const datum of skolaHifzaDatumi) {
        const cas = await prisma.skolaHifzaCas.create({
          data: {
            skolaHifzaId: skolaHifza.id,
            slotId: skolaHifzaRaspored.id,
            datum: datum,
            napomena: 'Demo čas',
            napredak: {
              'Al-Fatiha': [1, 2, 3, 4, 5, 6, 7],
            },
            komentari: {},
          },
        });

        // Dodaj prisustvo
        for (const ucenik of randomUcenici) {
          const random = Math.random();
          let status: StatusPrisustva;

          if (random < 0.85) {
            status = StatusPrisustva.PRISUTAN;
          } else if (random < 0.95) {
            status = StatusPrisustva.OPRAVDAN;
          } else {
            status = StatusPrisustva.NEOPRAVDAN;
          }

          await prisma.skolaHifzaPrisustvo.create({
            data: {
              casId: cas.id,
              ucenikId: ucenik.id,
              status: status,
              napomena: status !== StatusPrisustva.PRISUTAN ? 'Demo napomena' : null,
            },
          });
        }
      }

      console.log(`✅ Škola Hifza kreirana sa ${randomUcenici.length} učenika i ${skolaHifzaDatumi.length} časova\n`);
    }
  }

  // ============================================
  // 12. STATISTIKA
  // ============================================
  console.log('\n🎉 DEMO seeding završen!\n');
  console.log('📊 Statistika:');
  console.log(`   - Nastavni plan: 1`);
  console.log(`   - Nastavna godina: 1`);
  console.log(`   - Razredi u planu: ${razredi1_9.length}`);
  console.log(`   - Lekcije po razredu: 20`);
  console.log(`   - Učenici: ${kreiraniUcenici.length}`);
  console.log(`   - Grupe: ${razredi1_9.length}`);
  console.log(`   - Časovi: ${ukupnoCasova}`);
  console.log(`   - Prisustva: ${ukupnoPrisustva}`);
  console.log(`   - Ocjene: ${ukupnoOcjena}`);
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding demo database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

