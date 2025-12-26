import { PrismaClient, TipCasa } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// Helper function to parse CSV file
function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true,
  });
  return records;
}

// Helper function to parse date strings
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === '' || dateStr === 'null') return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}

// Helper function to parse JSON strings
function parseJSON(jsonStr: string | null | undefined): any {
  if (!jsonStr || jsonStr === '' || jsonStr === 'null') return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// Helper function to parse array strings (e.g., "LEKCIJA,PROVJERA")
function parseArray(arrayStr: string | null | undefined): string[] {
  if (!arrayStr || arrayStr === '' || arrayStr === 'null') return [];
  try {
    // Try to parse as JSON array first
    const parsed = JSON.parse(arrayStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // If not JSON, try comma-separated
    if (arrayStr.includes(',')) {
      return arrayStr.split(',').map((s) => s.trim()).filter((s) => s);
    }
  }
  return arrayStr ? [arrayStr] : [];
}

// Helper function to parse TipCasa array
function parseTipCasaArray(arrayStr: string | null | undefined): TipCasa[] {
  const parsed = parseArray(arrayStr);
  return parsed.filter((val): val is TipCasa => {
    return Object.values(TipCasa).includes(val as TipCasa);
  }) as TipCasa[];
}

// Helper function to parse boolean
function parseBoolean(value: any): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return null;
}

// Helper function to parse integer
function parseInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function main() {
  console.log('🌱 Seeding database from CSV files...\n');

  const seedDir = path.join(__dirname, '../../../seed');
  
  if (!fs.existsSync(seedDir)) {
    console.error(`❌ Seed directory not found: ${seedDir}`);
    process.exit(1);
  }

  const stats = {
    korisnici: 0,
    razredi: 0,
    lekcije: 0,
    nastavniPlanovi: 0,
    nastavniPlanRazredi: 0,
    nastavniPlanRazredLekcije: 0,
    nastavneGodine: 0,
    razredNastavneGodine: 0,
    grupe: 0,
    rasporedi: 0,
    ucenici: 0,
    obrazovanje: 0,
    roditelji: 0,
    kontakti: 0,
    ucenikGrupe: 0,
    skolaHifza: 0,
    skolaHifzaMuallimi: 0,
    skolaHifzaUcenici: 0,
    casovi: 0,
    casLekcije: 0,
    casPrisustva: 0,
    casOcjene: 0,
    skolaHifzaCasovi: 0,
    skolaHifzaPrisustva: 0,
    imports: 0,
  };

  try {
    // 1. KORISNICI
    console.log('📝 Importing Korisnici...');
    const korisniciFile = path.join(seedDir, 'harispandzic-1766524417623.csv');
    if (fs.existsSync(korisniciFile)) {
      const records = parseCSV(korisniciFile);
      for (const record of records) {
        try {
          await prisma.korisnik.upsert({
            where: { id: record.id },
            update: {
              email: record.email || null,
              lozinka: record.lozinka,
              ime: record.ime || null,
              prezime: record.prezime || null,
              uloga: record.uloga,
              aktivan: parseBoolean(record.aktivan) ?? true,
              fotografija: record.fotografija || null,
              pin: record.pin || null,
              poslednjeLogiranje: parseDate(record.poslednjeLogiranje),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              email: record.email || null,
              lozinka: record.lozinka,
              ime: record.ime || null,
              prezime: record.prezime || null,
              uloga: record.uloga,
              aktivan: parseBoolean(record.aktivan) ?? true,
              fotografija: record.fotografija || null,
              pin: record.pin || null,
              poslednjeLogiranje: parseDate(record.poslednjeLogiranje),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.korisnici++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing korisnik ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.korisnici} korisnici`);
    }

    // 2. RAZREDI
    console.log('\n📚 Importing Razredi...');
    const razrediFile = path.join(seedDir, 'harispandzic-1766524417675.csv');
    if (fs.existsSync(razrediFile)) {
      const records = parseCSV(razrediFile);
      for (const record of records) {
        try {
          await prisma.razred.upsert({
            where: { id: record.id },
            update: {
              name: record.name,
              ilmihal: record.ilmihal,
              status: parseBoolean(record.status) ?? true,
            },
            create: {
              id: record.id,
              name: record.name,
              ilmihal: record.ilmihal,
              status: parseBoolean(record.status) ?? true,
            },
          });
          stats.razredi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing razred ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.razredi} razredi`);
    }

    // 3. LEKCIJE
    console.log('\n📖 Importing Lekcije...');
    const lekcijeFile = path.join(seedDir, 'harispandzic-1766524417636.csv');
    if (fs.existsSync(lekcijeFile)) {
      const records = parseCSV(lekcijeFile);
      for (const record of records) {
        try {
          await prisma.lekcija.upsert({
            where: { id: record.id },
            update: {
              naslov: record.naslov,
              opis: record.opis,
              tezina: parseInt(record.tezina) ?? 1,
              redoslijed: parseInt(record.redoslijed) ?? 0,
              aktivan: parseBoolean(record.aktivan) ?? true,
              tip: record.tip,
              brojAjeta: parseInt(record.brojAjeta),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              naslov: record.naslov,
              opis: record.opis,
              tezina: parseInt(record.tezina) ?? 1,
              redoslijed: parseInt(record.redoslijed) ?? 0,
              aktivan: parseBoolean(record.aktivan) ?? true,
              tip: record.tip,
              brojAjeta: parseInt(record.brojAjeta),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.lekcije++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing lekcija ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.lekcije} lekcije`);
    }

    // 4. RAZRED_LEKCIJE
    console.log('\n🔗 Importing RazredLekcije...');
    const razredLekcijeFile = path.join(seedDir, 'harispandzic-1766524417668.csv');
    if (fs.existsSync(razredLekcijeFile)) {
      const records = parseCSV(razredLekcijeFile);
      for (const record of records) {
        try {
          await prisma.razredLekcija.upsert({
            where: {
              razredId_lekcijaId: {
                razredId: record.razredId,
                lekcijaId: record.lekcijaId,
              },
            },
            update: {},
            create: {
              id: record.id,
              razredId: record.razredId,
              lekcijaId: record.lekcijaId,
            },
          });
        } catch (error: any) {
          console.error(`  ⚠️  Error importing razredLekcija ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${records.length} razredLekcije`);
    }

    // 5. NASTAVNI PLANOVI
    console.log('\n📋 Importing NastavniPlanovi...');
    const nastavniPlanoviFile = path.join(seedDir, 'harispandzic-1766524417652.csv');
    if (fs.existsSync(nastavniPlanoviFile)) {
      const records = parseCSV(nastavniPlanoviFile);
      for (const record of records) {
        try {
          await prisma.nastavniPlan.upsert({
            where: { id: record.id },
            update: {
              naziv: record.naziv,
              opis: record.opis,
              datumUsvajanja: parseDate(record.datumUsvajanja) || new Date(),
              aktivan: parseBoolean(record.aktivan) ?? true,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              naziv: record.naziv,
              opis: record.opis,
              datumUsvajanja: parseDate(record.datumUsvajanja) || new Date(),
              aktivan: parseBoolean(record.aktivan) ?? true,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.nastavniPlanovi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing nastavniPlan ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.nastavniPlanovi} nastavniPlanovi`);
    }

    // 6. NASTAVNI PLAN RAZREDI
    console.log('\n🔗 Importing NastavniPlanRazredi...');
    const nastavniPlanRazrediFile = path.join(seedDir, 'harispandzic-1766524417650.csv');
    if (fs.existsSync(nastavniPlanRazrediFile)) {
      const records = parseCSV(nastavniPlanRazrediFile);
      for (const record of records) {
        try {
          await prisma.nastavniPlanRazred.upsert({
            where: {
              nastavniPlanId_razredId: {
                nastavniPlanId: record.nastavniPlanId,
                razredId: record.razredId,
              },
            },
            update: {},
            create: {
              id: record.id,
              nastavniPlanId: record.nastavniPlanId,
              razredId: record.razredId,
            },
          });
          stats.nastavniPlanRazredi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing nastavniPlanRazred ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.nastavniPlanRazredi} nastavniPlanRazredi`);
    }

    // 7. NASTAVNI PLAN RAZRED LEKCIJE
    console.log('\n🔗 Importing NastavniPlanRazredLekcije...');
    const nastavniPlanRazredLekcijeFile = path.join(seedDir, 'harispandzic-1766524417647.csv');
    if (fs.existsSync(nastavniPlanRazredLekcijeFile)) {
      const records = parseCSV(nastavniPlanRazredLekcijeFile);
      for (const record of records) {
        try {
          await prisma.nastavniPlanRazredLekcija.upsert({
            where: {
              nastavniPlanRazredId_lekcijaId: {
                nastavniPlanRazredId: record.nastavniPlanRazredId,
                lekcijaId: record.lekcijaId,
              },
            },
            update: {},
            create: {
              id: record.id,
              nastavniPlanRazredId: record.nastavniPlanRazredId,
              lekcijaId: record.lekcijaId,
            },
          });
          stats.nastavniPlanRazredLekcije++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing nastavniPlanRazredLekcija ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.nastavniPlanRazredLekcije} nastavniPlanRazredLekcije`);
    }

    // 8. NASTAVNE GODINE
    console.log('\n📅 Importing NastavneGodine...');
    const nastavneGodineFile = path.join(seedDir, 'harispandzic-1766524417642.csv');
    if (fs.existsSync(nastavneGodineFile)) {
      const records = parseCSV(nastavneGodineFile);
      for (const record of records) {
        try {
          await prisma.nastavnaGodina.upsert({
            where: { id: record.id },
            update: {
              naziv: record.naziv,
              opis: record.opis || null,
              datumOd: parseDate(record.datumOd) || new Date(),
              datumDo: parseDate(record.datumDo) || new Date(),
              nastavniPlanId: record.nastavniPlanId,
              status: record.status,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              naziv: record.naziv,
              opis: record.opis || null,
              datumOd: parseDate(record.datumOd) || new Date(),
              datumDo: parseDate(record.datumDo) || new Date(),
              nastavniPlanId: record.nastavniPlanId,
              status: record.status,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.nastavneGodine++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing nastavnaGodina ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.nastavneGodine} nastavneGodine`);
    }

    // 9. UCENICI
    console.log('\n👥 Importing Ucenici...');
    const uceniciFile = path.join(seedDir, 'harispandzic-1766524417712.csv');
    if (fs.existsSync(uceniciFile)) {
      const records = parseCSV(uceniciFile);
      for (const record of records) {
        try {
          await prisma.ucenik.upsert({
            where: { id: record.id },
            update: {
              korisnikId: record.korisnikId || null,
              eksterniId: parseInt(record.eksterniId),
              datumRodjenja: parseDate(record.datumRodjenja),
              spol: record.spol || null,
              mjestoRodjenja: record.mjestoRodjenja || null,
              adresaStanovanja: record.adresaStanovanja || null,
              status: record.status || null,
              eksterniDatumKreiran: parseDate(record.eksterniDatumKreiran),
              eksterniDatumAzuriran: parseDate(record.eksterniDatumAzuriran),
              greske: parseJSON(record.greske),
              imaRoditelje: record.imaRoditelje || null,
              roditeljiZajedno: record.roditeljiZajedno || null,
              roditeljiRazdvojeni: record.roditeljiRazdvojeni || null,
              roditeljiClanoviIz: record.roditeljiClanoviIz || null,
              brojBrace: parseInt(record.brojBrace) ?? 0,
              brojSestara: parseInt(record.brojSestara) ?? 0,
              tipStambenogObjekta: record.tipStambenogObjekta || null,
              imaPosebnePotrebe: parseBoolean(record.imaPosebnePotrebe) ?? false,
              posebnePotrebeOpis: record.posebnePotrebeOpis || null,
              idPunktaDzemata: parseInt(record.idPunktaDzemata),
              clanMrezeMladih: record.clanMrezeMladih || null,
              ucenikSkoleHifza: record.ucenikSkoleHifza || null,
            },
            create: {
              id: record.id,
              korisnikId: record.korisnikId || null,
              eksterniId: parseInt(record.eksterniId),
              datumRodjenja: parseDate(record.datumRodjenja),
              spol: record.spol || null,
              mjestoRodjenja: record.mjestoRodjenja || null,
              adresaStanovanja: record.adresaStanovanja || null,
              status: record.status || null,
              eksterniDatumKreiran: parseDate(record.eksterniDatumKreiran),
              eksterniDatumAzuriran: parseDate(record.eksterniDatumAzuriran),
              greske: parseJSON(record.greske),
              imaRoditelje: record.imaRoditelje || null,
              roditeljiZajedno: record.roditeljiZajedno || null,
              roditeljiRazdvojeni: record.roditeljiRazdvojeni || null,
              roditeljiClanoviIz: record.roditeljiClanoviIz || null,
              brojBrace: parseInt(record.brojBrace) ?? 0,
              brojSestara: parseInt(record.brojSestara) ?? 0,
              tipStambenogObjekta: record.tipStambenogObjekta || null,
              imaPosebnePotrebe: parseBoolean(record.imaPosebnePotrebe) ?? false,
              posebnePotrebeOpis: record.posebnePotrebeOpis || null,
              idPunktaDzemata: parseInt(record.idPunktaDzemata),
              clanMrezeMladih: record.clanMrezeMladih || null,
              ucenikSkoleHifza: record.ucenikSkoleHifza || null,
            },
          });
          stats.ucenici++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing ucenik ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.ucenici} ucenici`);
    }

    // 10. OBRAZOVANJE
    console.log('\n🎓 Importing Obrazovanje...');
    const obrazovanjeFile = path.join(seedDir, 'harispandzic-1766524417657.csv');
    if (fs.existsSync(obrazovanjeFile)) {
      const records = parseCSV(obrazovanjeFile);
      for (const record of records) {
        try {
          await prisma.obrazovanje.upsert({
            where: { ucenikId: record.ucenikId },
            update: {
              nivoObrazovanja: record.nivoObrazovanja || null,
              razred: parseInt(record.razred),
              mektebStepen: record.mektebStepen || null,
              predskolskaNaziv: record.predskolskaNaziv || null,
              osnovnaNaziv: record.osnovnaNaziv || null,
              srednjaNaziv: record.srednjaNaziv || null,
              fakultetNaziv: record.fakultetNaziv || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              ucenikId: record.ucenikId,
              nivoObrazovanja: record.nivoObrazovanja || null,
              razred: parseInt(record.razred),
              mektebStepen: record.mektebStepen || null,
              predskolskaNaziv: record.predskolskaNaziv || null,
              osnovnaNaziv: record.osnovnaNaziv || null,
              srednjaNaziv: record.srednjaNaziv || null,
              fakultetNaziv: record.fakultetNaziv || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.obrazovanje++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing obrazovanje ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.obrazovanje} obrazovanje`);
    }

    // 11. RODITELJI
    console.log('\n👨‍👩‍👧 Importing Roditelji...');
    const roditeljiFile = path.join(seedDir, 'harispandzic-1766524417680.csv');
    if (fs.existsSync(roditeljiFile)) {
      const records = parseCSV(roditeljiFile);
      for (const record of records) {
        try {
          await prisma.roditelj.upsert({
            where: { id: record.id },
            update: {
              ucenikId: record.ucenikId,
              tip: record.tip,
              imePrezime: record.imePrezime,
              datumRodjenja: parseDate(record.datumRodjenja),
              mjestoRodjenja: record.mjestoRodjenja || null,
              email: record.email || null,
              mobitel: record.mobitel || null,
              telefon: record.telefon || null,
              zaposlen: parseBoolean(record.zaposlen) ?? false,
              obrazovanje: record.obrazovanje || null,
              zanimanje: record.zanimanje || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              ucenikId: record.ucenikId,
              tip: record.tip,
              imePrezime: record.imePrezime,
              datumRodjenja: parseDate(record.datumRodjenja),
              mjestoRodjenja: record.mjestoRodjenja || null,
              email: record.email || null,
              mobitel: record.mobitel || null,
              telefon: record.telefon || null,
              zaposlen: parseBoolean(record.zaposlen) ?? false,
              obrazovanje: record.obrazovanje || null,
              zanimanje: record.zanimanje || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.roditelji++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing roditelj ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.roditelji} roditelji`);
    }

    // 12. KONTAKTI
    console.log('\n📞 Importing Kontakti...');
    const kontaktiFile = path.join(seedDir, 'harispandzic-1766524417607.csv');
    if (fs.existsSync(kontaktiFile)) {
      const records = parseCSV(kontaktiFile);
      for (const record of records) {
        try {
          await prisma.kontakt.upsert({
            where: { id: record.id },
            update: {
              ucenikId: record.ucenikId,
              tip: record.tip,
              vrijednost: record.vrijednost,
              primarni: parseBoolean(record.primarni) ?? false,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              ucenikId: record.ucenikId,
              tip: record.tip,
              vrijednost: record.vrijednost,
              primarni: parseBoolean(record.primarni) ?? false,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.kontakti++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing kontakt ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.kontakti} kontakti`);
    }

    // 13. RAZRED NASTAVNA GODINA
    console.log('\n🔗 Importing RazredNastavnaGodina...');
    const razredNastavnaGodinaFile = path.join(seedDir, 'harispandzic-1766524417672.csv');
    if (fs.existsSync(razredNastavnaGodinaFile)) {
      const records = parseCSV(razredNastavnaGodinaFile);
      for (const record of records) {
        try {
          await prisma.razredNastavnaGodina.upsert({
            where: {
              nastavnaGodinaId_razredId: {
                nastavnaGodinaId: record.nastavnaGodinaId,
                razredId: record.razredId,
              },
            },
            update: {
              muallimId: record.muallimId,
              split: parseBoolean(record.split) ?? false,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              nastavnaGodinaId: record.nastavnaGodinaId,
              razredId: record.razredId,
              muallimId: record.muallimId,
              split: parseBoolean(record.split) ?? false,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.razredNastavneGodine++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing razredNastavnaGodina ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.razredNastavneGodine} razredNastavneGodine`);
    }

    // 14. GRUPE
    console.log('\n👥 Importing Grupe...');
    const grupeFile = path.join(seedDir, 'harispandzic-1766524417587.csv');
    if (fs.existsSync(grupeFile)) {
      const records = parseCSV(grupeFile);
      for (const record of records) {
        try {
          await prisma.grupa.upsert({
            where: { id: record.id },
            update: {
              razredNastavnaGodinaId: record.razredNastavnaGodinaId,
              naziv: record.naziv,
              kuran: parseBoolean(record.kuran) ?? false,
              sufara: parseBoolean(record.sufara) ?? false,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              razredNastavnaGodinaId: record.razredNastavnaGodinaId,
              naziv: record.naziv,
              kuran: parseBoolean(record.kuran) ?? false,
              sufara: parseBoolean(record.sufara) ?? false,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.grupe++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing grupa ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.grupe} grupe`);
    }

    // 15. RASPOREDI
    console.log('\n📅 Importing Rasporedi...');
    const rasporediFile = path.join(seedDir, 'harispandzic-1766524417664.csv');
    if (fs.existsSync(rasporediFile)) {
      const records = parseCSV(rasporediFile);
      for (const record of records) {
        try {
          await prisma.raspored.upsert({
            where: { id: record.id },
            update: {
              grupaId: record.grupaId,
              dan: record.dan,
              slot: record.slot,
              lokacija: record.lokacija || null,
              trajanje: parseInt(record.trajanje) ?? 45,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              grupaId: record.grupaId,
              dan: record.dan,
              slot: record.slot,
              lokacija: record.lokacija || null,
              trajanje: parseInt(record.trajanje) ?? 45,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.rasporedi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing raspored ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.rasporedi} rasporedi`);
    }

    // 16. UCENIK GRUPA
    console.log('\n🔗 Importing UcenikGrupa...');
    const ucenikGrupaFile = path.join(seedDir, 'harispandzic-1766524417723.csv');
    if (fs.existsSync(ucenikGrupaFile)) {
      const records = parseCSV(ucenikGrupaFile);
      for (const record of records) {
        try {
          await prisma.ucenikGrupa.upsert({
            where: {
              ucenikId_grupaId: {
                ucenikId: record.ucenikId,
                grupaId: record.grupaId,
              },
            },
            update: {
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              ucenikId: record.ucenikId,
              grupaId: record.grupaId,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.ucenikGrupe++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing ucenikGrupa ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.ucenikGrupe} ucenikGrupe`);
    }

    // 17. SKOLA HIFZA
    console.log('\n📖 Importing SkolaHifza...');
    const skolaHifzaFile = path.join(seedDir, 'harispandzic-1766524417695.csv');
    if (fs.existsSync(skolaHifzaFile)) {
      const records = parseCSV(skolaHifzaFile);
      for (const record of records) {
        try {
          await prisma.skolaHifza.upsert({
            where: { id: record.id },
            update: {
              nastavnaGodinaId: record.nastavnaGodinaId,
              lekcije: parseJSON(record.lekcije),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              nastavnaGodinaId: record.nastavnaGodinaId,
              lekcije: parseJSON(record.lekcije),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.skolaHifza++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing skolaHifza ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.skolaHifza} skolaHifza`);
    }

    // 18. SKOLA HIFZA MUALLIMI
    console.log('\n👨‍🏫 Importing SkolaHifzaMuallimi...');
    const skolaHifzaMuallimiFile = path.join(seedDir, 'harispandzic-1766524417701.csv');
    if (fs.existsSync(skolaHifzaMuallimiFile)) {
      const records = parseCSV(skolaHifzaMuallimiFile);
      for (const record of records) {
        try {
          await prisma.skolaHifzaMuallim.upsert({
            where: {
              skolaHifzaId_muallimId: {
                skolaHifzaId: record.skolaHifzaId,
                muallimId: record.muallimId,
              },
            },
            update: {
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              skolaHifzaId: record.skolaHifzaId,
              muallimId: record.muallimId,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.skolaHifzaMuallimi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing skolaHifzaMuallim ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.skolaHifzaMuallimi} skolaHifzaMuallimi`);
    }

    // 19. SKOLA HIFZA UCENICI
    console.log('\n👥 Importing SkolaHifzaUcenici...');
    const skolaHifzaUceniciFile = path.join(seedDir, 'harispandzic-1766524417708.csv');
    if (fs.existsSync(skolaHifzaUceniciFile)) {
      const records = parseCSV(skolaHifzaUceniciFile);
      for (const record of records) {
        try {
          await prisma.skolaHifzaUcenik.upsert({
            where: {
              skolaHifzaId_ucenikId: {
                skolaHifzaId: record.skolaHifzaId,
                ucenikId: record.ucenikId,
              },
            },
            update: {
              muallimId: record.muallimId,
              napredak: parseJSON(record.napredak),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              skolaHifzaId: record.skolaHifzaId,
              ucenikId: record.ucenikId,
              muallimId: record.muallimId,
              napredak: parseJSON(record.napredak),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.skolaHifzaUcenici++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing skolaHifzaUcenik ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.skolaHifzaUcenici} skolaHifzaUcenici`);
    }

    // 20. CASOVI
    console.log('\n📚 Importing Casovi...');
    const casoviFile = path.join(seedDir, 'harispandzic-1766524417581.csv');
    if (fs.existsSync(casoviFile)) {
      const records = parseCSV(casoviFile);
      for (const record of records) {
        if (!record.id || record.id === '') continue; // Skip empty records
        try {
          await prisma.cas.upsert({
            where: { id: record.id },
            update: {
              nastavnaGodinaId: record.nastavnaGodinaId,
              razredNastavnaGodinaId: record.razredNastavnaGodinaId,
              grupaId: record.grupaId,
              rasporedId: record.rasporedId,
              datum: parseDate(record.datum) || new Date(),
              tipovi: parseTipCasaArray(record.tipovi),
              napomena: record.napomena || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              nastavnaGodinaId: record.nastavnaGodinaId,
              razredNastavnaGodinaId: record.razredNastavnaGodinaId,
              grupaId: record.grupaId,
              rasporedId: record.rasporedId,
              datum: parseDate(record.datum) || new Date(),
              tipovi: parseTipCasaArray(record.tipovi),
              napomena: record.napomena || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.casovi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing cas ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.casovi} casovi`);
    }

    // 21. CAS LEKCIJE
    console.log('\n🔗 Importing CasLekcije...');
    const casLekcijeFile = path.join(seedDir, 'harispandzic.csv');
    if (fs.existsSync(casLekcijeFile)) {
      const records = parseCSV(casLekcijeFile);
      for (const record of records) {
        if (!record.id || record.id === '' || !record.casId || !record.lekcijaId) continue;
        try {
          await prisma.casLekcija.upsert({
            where: {
              casId_lekcijaId: {
                casId: record.casId,
                lekcijaId: record.lekcijaId,
              },
            },
            update: {},
            create: {
              id: record.id,
              casId: record.casId,
              lekcijaId: record.lekcijaId,
            },
          });
          stats.casLekcije++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing casLekcija ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.casLekcije} casLekcije`);
    }

    // 22. CAS PRISUSTVA
    console.log('\n✅ Importing CasPrisustva...');
    const casPrisustvaFile = path.join(seedDir, 'harispandzic-1766524417573.csv');
    if (fs.existsSync(casPrisustvaFile)) {
      const records = parseCSV(casPrisustvaFile);
      for (const record of records) {
        try {
          await prisma.casPrisustvo.upsert({
            where: {
              casId_ucenikId: {
                casId: record.casId,
                ucenikId: record.ucenikId,
              },
            },
            update: {
              status: record.status,
              napomena: record.napomena || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              casId: record.casId,
              ucenikId: record.ucenikId,
              status: record.status,
              napomena: record.napomena || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.casPrisustva++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing casPrisustvo ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.casPrisustva} casPrisustva`);
    }

    // 23. CAS OCJENE
    console.log('\n⭐ Importing CasOcjene...');
    const casOcjeneFile = path.join(seedDir, 'harispandzic-1766524417567.csv');
    if (fs.existsSync(casOcjeneFile)) {
      const records = parseCSV(casOcjeneFile);
      for (const record of records) {
        try {
          await prisma.casOcjena.upsert({
            where: {
              casId_ucenikId_lekcijaId: {
                casId: record.casId,
                ucenikId: record.ucenikId,
                lekcijaId: record.lekcijaId,
              },
            },
            update: {
              ocjena: parseInt(record.ocjena) ?? 1,
              komentar: record.komentar || null,
              vrijeme: parseDate(record.vrijeme) || new Date(),
            },
            create: {
              id: record.id,
              casId: record.casId,
              ucenikId: record.ucenikId,
              lekcijaId: record.lekcijaId,
              ocjena: parseInt(record.ocjena) ?? 1,
              komentar: record.komentar || null,
              vrijeme: parseDate(record.vrijeme) || new Date(),
            },
          });
          stats.casOcjene++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing casOcjena ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.casOcjene} casOcjene`);
    }

    // 24. SKOLA HIFZA CASOVI
    console.log('\n📖 Importing SkolaHifzaCasovi...');
    const skolaHifzaCasoviFile = path.join(seedDir, 'harispandzic-1766524417699.csv');
    if (fs.existsSync(skolaHifzaCasoviFile)) {
      const records = parseCSV(skolaHifzaCasoviFile);
      for (const record of records) {
        try {
          await prisma.skolaHifzaCas.upsert({
            where: { id: record.id },
            update: {
              skolaHifzaId: record.skolaHifzaId,
              slotId: record.slotId,
              datum: parseDate(record.datum) || new Date(),
              napomena: record.napomena || null,
              napredak: parseJSON(record.napredak),
              komentari: parseJSON(record.komentari),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              skolaHifzaId: record.skolaHifzaId,
              slotId: record.slotId,
              datum: parseDate(record.datum) || new Date(),
              napomena: record.napomena || null,
              napredak: parseJSON(record.napredak),
              komentari: parseJSON(record.komentari),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.skolaHifzaCasovi++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing skolaHifzaCas ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.skolaHifzaCasovi} skolaHifzaCasovi`);
    }

    // 25. SKOLA HIFZA PRISUSTVA
    console.log('\n✅ Importing SkolaHifzaPrisustva...');
    const skolaHifzaPrisustvaFile = path.join(seedDir, 'harispandzic-1766524417705.csv');
    if (fs.existsSync(skolaHifzaPrisustvaFile)) {
      const records = parseCSV(skolaHifzaPrisustvaFile);
      for (const record of records) {
        try {
          await prisma.skolaHifzaPrisustvo.upsert({
            where: {
              casId_ucenikId: {
                casId: record.casId,
                ucenikId: record.ucenikId,
              },
            },
            update: {
              status: record.status,
              napomena: record.napomena || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              casId: record.casId,
              ucenikId: record.ucenikId,
              status: record.status,
              napomena: record.napomena || null,
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.skolaHifzaPrisustva++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing skolaHifzaPrisustvo ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.skolaHifzaPrisustva} skolaHifzaPrisustva`);
    }

    // 26. IMPORTS
    console.log('\n📥 Importing Imports...');
    const importsFile = path.join(seedDir, 'harispandzic-1766524417595.csv');
    if (fs.existsSync(importsFile)) {
      const records = parseCSV(importsFile);
      for (const record of records) {
        try {
          await prisma.import.upsert({
            where: { id: record.id },
            update: {
              nazivFajla: record.nazivFajla,
              status: record.status,
              ukupnoRedova: parseInt(record.ukupnoRedova) ?? 0,
              uspjesnoSacuvano: parseInt(record.uspjesnoSacuvano) ?? 0,
              novih: parseInt(record.novih) ?? 0,
              updateanih: parseInt(record.updateanih) ?? 0,
              gresaka: parseInt(record.gresaka) ?? 0,
              logovi: parseJSON(record.logovi),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
            create: {
              id: record.id,
              nazivFajla: record.nazivFajla,
              status: record.status,
              ukupnoRedova: parseInt(record.ukupnoRedova) ?? 0,
              uspjesnoSacuvano: parseInt(record.uspjesnoSacuvano) ?? 0,
              novih: parseInt(record.novih) ?? 0,
              updateanih: parseInt(record.updateanih) ?? 0,
              gresaka: parseInt(record.gresaka) ?? 0,
              logovi: parseJSON(record.logovi),
              kreiran: parseDate(record.kreiran) || new Date(),
              azuriran: parseDate(record.azuriran) || new Date(),
            },
          });
          stats.imports++;
        } catch (error: any) {
          console.error(`  ⚠️  Error importing import ${record.id}: ${error.message}`);
        }
      }
      console.log(`  ✅ Imported ${stats.imports} imports`);
    }

    console.log('\n🎉 Seeding completed!\n');
    console.log('📊 Statistics:');
    console.log(`   - Korisnici: ${stats.korisnici}`);
    console.log(`   - Razredi: ${stats.razredi}`);
    console.log(`   - Lekcije: ${stats.lekcije}`);
    console.log(`   - NastavniPlanovi: ${stats.nastavniPlanovi}`);
    console.log(`   - NastavniPlanRazredi: ${stats.nastavniPlanRazredi}`);
    console.log(`   - NastavniPlanRazredLekcije: ${stats.nastavniPlanRazredLekcije}`);
    console.log(`   - NastavneGodine: ${stats.nastavneGodine}`);
    console.log(`   - RazredNastavneGodine: ${stats.razredNastavneGodine}`);
    console.log(`   - Grupe: ${stats.grupe}`);
    console.log(`   - Rasporedi: ${stats.rasporedi}`);
    console.log(`   - Ucenici: ${stats.ucenici}`);
    console.log(`   - Obrazovanje: ${stats.obrazovanje}`);
    console.log(`   - Roditelji: ${stats.roditelji}`);
    console.log(`   - Kontakti: ${stats.kontakti}`);
    console.log(`   - UcenikGrupe: ${stats.ucenikGrupe}`);
    console.log(`   - SkolaHifza: ${stats.skolaHifza}`);
    console.log(`   - SkolaHifzaMuallimi: ${stats.skolaHifzaMuallimi}`);
    console.log(`   - SkolaHifzaUcenici: ${stats.skolaHifzaUcenici}`);
    console.log(`   - Casovi: ${stats.casovi}`);
    console.log(`   - CasLekcije: ${stats.casLekcije}`);
    console.log(`   - CasPrisustva: ${stats.casPrisustva}`);
    console.log(`   - CasOcjene: ${stats.casOcjene}`);
    console.log(`   - SkolaHifzaCasovi: ${stats.skolaHifzaCasovi}`);
    console.log(`   - SkolaHifzaPrisustva: ${stats.skolaHifzaPrisustva}`);
    console.log(`   - Imports: ${stats.imports}`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

