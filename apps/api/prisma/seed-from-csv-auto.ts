import { PrismaClient, TipCasa } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// Helper function to parse CSV file
function parseCSV(filePath: string): { headers: string[]; records: any[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true,
  });
  const headers = Object.keys(records[0] || {});
  return { headers, records };
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
    const parsed = JSON.parse(arrayStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
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

// Model detection based on column signatures
type ModelDetector = {
  name: string;
  signature: string[]; // Key columns that uniquely identify this model
  priority: number; // Higher priority = more specific match
};

const modelDetectors: ModelDetector[] = [
  // Most specific first (higher priority)
  { name: 'CasOcjena', signature: ['casId', 'ucenikId', 'lekcijaId', 'ocjena'], priority: 10 },
  { name: 'CasLekcija', signature: ['casId', 'lekcijaId'], priority: 9 },
  { name: 'SkolaHifzaPrisustvo', signature: ['casId', 'ucenikId', 'status'], priority: 9 }, // Check first for SkolaHifza context
  { name: 'CasPrisustvo', signature: ['casId', 'ucenikId', 'status'], priority: 8 },
  { name: 'SkolaHifzaUcenik', signature: ['skolaHifzaId', 'ucenikId', 'muallimId'], priority: 9 },
  { name: 'SkolaHifzaMuallim', signature: ['skolaHifzaId', 'muallimId'], priority: 9 },
  { name: 'SkolaHifzaCas', signature: ['skolaHifzaId', 'slotId', 'datum'], priority: 9 },
  { name: 'UcenikGrupa', signature: ['ucenikId', 'grupaId'], priority: 9 },
  { name: 'RazredLekcija', signature: ['razredId', 'lekcijaId'], priority: 9 },
  { name: 'NastavniPlanRazredLekcija', signature: ['nastavniPlanRazredId', 'lekcijaId'], priority: 9 },
  { name: 'NastavniPlanRazred', signature: ['nastavniPlanId', 'razredId'], priority: 9 },
  { name: 'RazredNastavnaGodina', signature: ['nastavnaGodinaId', 'razredId', 'muallimId'], priority: 9 },
  { name: 'Kontakt', signature: ['ucenikId', 'tip', 'vrijednost'], priority: 8 },
  { name: 'Roditelj', signature: ['ucenikId', 'tip', 'imePrezime'], priority: 8 },
  { name: 'Obrazovanje', signature: ['ucenikId', 'razred'], priority: 8 },
  { name: 'Cas', signature: ['nastavnaGodinaId', 'razredNastavnaGodinaId', 'grupaId', 'rasporedId', 'datum', 'tipovi'], priority: 10 },
  { name: 'Grupa', signature: ['razredNastavnaGodinaId', 'naziv', 'kuran', 'sufara'], priority: 8 },
  { name: 'Raspored', signature: ['grupaId', 'dan', 'slot'], priority: 8 },
  { name: 'SkolaHifza', signature: ['nastavnaGodinaId', 'lekcije'], priority: 8 },
  { name: 'NastavnaGodina', signature: ['naziv', 'datumOd', 'datumDo', 'nastavniPlanId'], priority: 8 },
  { name: 'NastavniPlan', signature: ['naziv', 'opis', 'datumUsvajanja'], priority: 8 },
  { name: 'Lekcija', signature: ['naslov', 'opis', 'tezina', 'redoslijed', 'tip'], priority: 8 },
  { name: 'Razred', signature: ['name', 'ilmihal'], priority: 8 },
  { name: 'Ucenik', signature: ['korisnikId', 'eksterniId'], priority: 7 },
  { name: 'Korisnik', signature: ['email', 'lozinka', 'uloga'], priority: 8 },
  { name: 'Import', signature: ['nazivFajla', 'status', 'ukupnoRedova'], priority: 8 },
];

// Detect which model a CSV file maps to
function detectModel(headers: string[], fileName?: string): string | null {
  const headerSet = new Set(headers);
  const fileNameLower = fileName?.toLowerCase() || '';
  
  // Score each model based on how many signature columns match
  const scores = modelDetectors.map((detector) => {
    const matchingColumns = detector.signature.filter((col) => headerSet.has(col));
    let score = matchingColumns.length * detector.priority;
    
    // Boost score if file name contains model-related keywords
    if (fileName) {
      const modelNameLower = detector.name.toLowerCase();
      // Check for direct model name match (e.g., "skolahifza" in filename)
      if (fileNameLower.includes(modelNameLower.replace('skolahifza', 'hifza'))) {
        score += 50; // Significant boost for name match
      }
      // Special handling for SkolaHifza models - check for "hifza" keyword
      if (detector.name.includes('SkolaHifza') && (fileNameLower.includes('hifza') || fileNameLower.includes('skola'))) {
        score += 40;
      }
      // Penalize SkolaHifza models if filename doesn't suggest it
      if (detector.name.includes('SkolaHifza') && !fileNameLower.includes('hifza') && !fileNameLower.includes('skola')) {
        score -= 20;
      }
    }
    
    return { model: detector.name, score, matchingColumns, totalSignature: detector.signature.length };
  });

  // Find the best match (highest score and all signature columns present)
  const bestMatch = scores
    .filter((s) => s.matchingColumns.length === s.totalSignature)
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch ? bestMatch.model : null;
}

// Get the where clause for upsert based on model and record
function getWhereClause(modelName: string, record: any): any {
  switch (modelName) {
    case 'CasOcjena':
      return {
        casId_ucenikId_lekcijaId: {
          casId: record.casId,
          ucenikId: record.ucenikId,
          lekcijaId: record.lekcijaId,
        },
      };
    case 'CasLekcija':
      return {
        casId_lekcijaId: {
          casId: record.casId,
          lekcijaId: record.lekcijaId,
        },
      };
    case 'CasPrisustvo':
    case 'SkolaHifzaPrisustvo':
      return {
        casId_ucenikId: {
          casId: record.casId,
          ucenikId: record.ucenikId,
        },
      };
    case 'SkolaHifzaUcenik':
      return {
        skolaHifzaId_ucenikId: {
          skolaHifzaId: record.skolaHifzaId,
          ucenikId: record.ucenikId,
        },
      };
    case 'SkolaHifzaMuallim':
      return {
        skolaHifzaId_muallimId: {
          skolaHifzaId: record.skolaHifzaId,
          muallimId: record.muallimId,
        },
      };
    case 'UcenikGrupa':
      return {
        ucenikId_grupaId: {
          ucenikId: record.ucenikId,
          grupaId: record.grupaId,
        },
      };
    case 'RazredLekcija':
      return {
        razredId_lekcijaId: {
          razredId: record.razredId,
          lekcijaId: record.lekcijaId,
        },
      };
    case 'NastavniPlanRazredLekcija':
      return {
        nastavniPlanRazredId_lekcijaId: {
          nastavniPlanRazredId: record.nastavniPlanRazredId,
          lekcijaId: record.lekcijaId,
        },
      };
    case 'NastavniPlanRazred':
      return {
        nastavniPlanId_razredId: {
          nastavniPlanId: record.nastavniPlanId,
          razredId: record.razredId,
        },
      };
    case 'RazredNastavnaGodina':
      return {
        nastavnaGodinaId_razredId: {
          nastavnaGodinaId: record.nastavnaGodinaId,
          razredId: record.razredId,
        },
      };
    case 'Obrazovanje':
      return { ucenikId: record.ucenikId };
    default:
      // Default to id-based where clause
      return { id: record.id };
  }
}

// Transform record data based on field types
function transformField(modelName: string, fieldName: string, value: any): any {
  // Handle null/empty values
  if (value === null || value === undefined || value === '' || value === 'null') {
    return null;
  }

  // Date fields
  if (fieldName.includes('datum') || fieldName.includes('kreiran') || fieldName.includes('azuriran') || 
      fieldName === 'vrijeme' || fieldName === 'poslednjeLogiranje') {
    return parseDate(value);
  }

  // Boolean fields
  if (fieldName === 'aktivan' || fieldName === 'zaposlen' || fieldName === 'primarni' || 
      fieldName === 'kuran' || fieldName === 'sufara' || fieldName === 'split' || 
      fieldName === 'imaPosebnePotrebe' || fieldName === 'status') {
    // Status might be enum, check context
    if (fieldName === 'status' && (modelName === 'CasPrisustvo' || modelName === 'SkolaHifzaPrisustvo' || 
        modelName === 'Import' || modelName === 'NastavnaGodina' || modelName === 'Ucenik')) {
      return value; // Enum, return as-is
    }
    return parseBoolean(value);
  }

  // Integer fields
  if (fieldName.includes('Id') && fieldName !== 'eksterniId' && fieldName !== 'idPunktaDzemata') {
    // Most IDs are strings (UUIDs), but some might be integers
    return value;
  }
  if (fieldName === 'tezina' || fieldName === 'redoslijed' || fieldName === 'razred' || 
      fieldName === 'ocjena' || fieldName === 'trajanje' || fieldName === 'ukupnoRedova' || 
      fieldName === 'uspjesnoSacuvano' || fieldName === 'novih' || fieldName === 'updateanih' || 
      fieldName === 'gresaka' || fieldName === 'brojBrace' || fieldName === 'brojSestara' || 
      fieldName === 'eksterniId' || fieldName === 'idPunktaDzemata' || fieldName === 'brojAjeta') {
    return parseInt(value);
  }

  // JSON fields
  if (fieldName === 'greske' || fieldName === 'napredak' || fieldName === 'lekcije' || 
      fieldName === 'komentari' || fieldName === 'logovi') {
    return parseJSON(value);
  }

  // Array fields (TipCasa)
  if (fieldName === 'tipovi') {
    return parseTipCasaArray(value);
  }

  // Default: return as string
  return value;
}

// Build create/update data object
function buildDataObject(modelName: string, record: any, headers: string[]): any {
  const data: any = {};
  
  for (const header of headers) {
    if (header === 'id' && record.id) {
      data.id = record.id;
      continue;
    }
    
    const transformedValue = transformField(modelName, header, record[header]);
    
    // Only include non-null values (or null if explicitly set)
    if (transformedValue !== null && transformedValue !== undefined) {
      data[header] = transformedValue;
    } else if (header.includes('kreiran') || header.includes('azuriran')) {
      // Always include timestamp fields
      data[header] = transformedValue || new Date();
    }
  }

  return data;
}

// Import records for a specific model
async function importModel(modelName: string, records: any[], headers: string[], stats: any): Promise<void> {
  const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const prismaModel = (prisma as any)[modelKey];
  
  if (!prismaModel) {
    console.error(`  ⚠️  Model ${modelName} not found in Prisma client`);
    return;
  }

  let imported = 0;
  let errors = 0;

  for (const record of records) {
    const where = getWhereClause(modelName, record);
    try {
      const updateData = buildDataObject(modelName, record, headers);
      const createData = { ...updateData };

      // Ensure id is in create data if present
      if (record.id && !createData.id) {
        createData.id = record.id;
      }

      await prismaModel.upsert({
        where,
        update: updateData,
        create: createData,
      });
      imported++;
    } catch (error: any) {
      errors++;
      const recordId = record.id || JSON.stringify(where);
      console.error(`  ⚠️  Error importing ${modelName} ${recordId}: ${error.message}`);
    }
  }

  stats[modelKey] = (stats[modelKey] || 0) + imported;
  console.log(`  ✅ Imported ${imported} ${modelName} records${errors > 0 ? ` (${errors} errors)` : ''}`);
}

async function main() {
  console.log('🌱 Auto-seeding database from CSV files...\n');

  const seedDir = path.join(__dirname, '../../../seed');
  
  if (!fs.existsSync(seedDir)) {
    console.error(`❌ Seed directory not found: ${seedDir}`);
    process.exit(1);
  }

  // Get all CSV files
  const csvFiles = fs.readdirSync(seedDir)
    .filter((file) => file.endsWith('.csv'))
    .map((file) => path.join(seedDir, file));

  if (csvFiles.length === 0) {
    console.error('❌ No CSV files found in seed directory');
    process.exit(1);
  }

  console.log(`📁 Found ${csvFiles.length} CSV files\n`);

  const stats: any = {};
  const modelGroups: { [key: string]: { file: string; headers: string[]; records: any[] }[] } = {};

  // Step 1: Detect models for each CSV file
  for (const file of csvFiles) {
    try {
      const { headers, records } = parseCSV(file);
      const fileName = path.basename(file);
      const modelName = detectModel(headers, fileName);
      
      if (!modelName) {
        console.warn(`⚠️  Could not detect model for: ${fileName}`);
        console.warn(`   Headers: ${headers.join(', ')}`);
        continue;
      }

      if (!modelGroups[modelName]) {
        modelGroups[modelName] = [];
      }
      
      modelGroups[modelName].push({ file: fileName, headers, records });
      console.log(`✓ ${fileName} → ${modelName} (${records.length} records)`);
    } catch (error: any) {
      console.error(`❌ Error reading ${path.basename(file)}: ${error.message}`);
    }
  }

  console.log(`\n📊 Detected ${Object.keys(modelGroups).length} models\n`);

  // Step 2: Import data for each model (in dependency order)
  const importOrder = [
    'Korisnik',
    'Razred',
    'Lekcija',
    'NastavniPlan',
    'NastavnaGodina',
    'RazredLekcija',
    'NastavniPlanRazred',
    'NastavniPlanRazredLekcija',
    'RazredNastavnaGodina',
    'Ucenik',
    'Obrazovanje',
    'Roditelj',
    'Kontakt',
    'Grupa',
    'Raspored',
    'UcenikGrupa',
    'SkolaHifza',
    'SkolaHifzaMuallim',
    'SkolaHifzaUcenik',
    'Cas',
    'CasLekcija',
    'CasPrisustvo',
    'CasOcjena',
    'SkolaHifzaCas',
    'SkolaHifzaPrisustvo',
    'Import',
  ];

  for (const modelName of importOrder) {
    if (modelGroups[modelName]) {
      console.log(`\n📝 Importing ${modelName}...`);
      for (const group of modelGroups[modelName]) {
        await importModel(modelName, group.records, group.headers, stats);
      }
    }
  }

  // Import any remaining models not in the order list
  for (const modelName of Object.keys(modelGroups)) {
    if (!importOrder.includes(modelName)) {
      console.log(`\n📝 Importing ${modelName}...`);
      for (const group of modelGroups[modelName]) {
        await importModel(modelName, group.records, group.headers, stats);
      }
    }
  }

  console.log('\n🎉 Seeding completed!\n');
  console.log('📊 Statistics:');
  for (const [model, count] of Object.entries(stats)) {
    console.log(`   - ${model}: ${count}`);
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

