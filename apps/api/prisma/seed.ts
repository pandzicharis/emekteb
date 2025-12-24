import { PrismaClient, Uloga, Ilmihal, TipLekcije } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ============================================
  // 1. KREIRANJE KORISNIKA (MUALLIM I ADMIN)
  // ============================================
  console.log('📝 Kreiranje korisnika...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Kreiraj MUALLIM korisnika - Muhidin Topcagic
  const muallim = await prisma.korisnik.upsert({
    where: { email: 'muhidin.topcagic@emekteb.ba' },
    update: {
      lozinka: hashedPassword,
      ime: 'Muhidin',
      prezime: 'Topcagic',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1234',
    },
    create: {
      email: 'muhidin.topcagic@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Muhidin',
      prezime: 'Topcagic',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1234',
    },
  });

  console.log('✅ Muallim kreiran:', muallim.email);

  // Kreiraj Ucenik zapis za muallima (muallim je samo Ucenik sa ulogom MUALLIM)
  await prisma.ucenik.upsert({
    where: { korisnikId: muallim.id },
    update: {},
    create: {
      korisnikId: muallim.id,
    },
  });

  console.log('✅ Muallim Ucenik zapis kreiran');

  // Kreiraj ADMIN korisnika
  const admin = await prisma.korisnik.upsert({
    where: { email: 'admin@emekteb.ba' },
    update: {
      lozinka: hashedPassword,
      ime: 'Admin',
      prezime: 'Emekteb',
      uloga: Uloga.ADMIN,
      aktivan: true,
      pin: '0000',
    },
    create: {
      email: 'admin@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Admin',
      prezime: 'Emekteb',
      uloga: Uloga.ADMIN,
      aktivan: true,
      pin: '0000',
    },
  });

  console.log('✅ Admin kreiran:', admin.email);
  console.log('');

  // ============================================
  // 2. KREIRANJE RAZREDA
  // ============================================
  console.log('📚 Kreiranje razreda...\n');

  const razredi = [
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

  let kreiranoRazreda = 0;
  let postojaloRazreda = 0;

  for (const razredData of razredi) {
    const postojeci = await prisma.razred.findUnique({
      where: { name: razredData.name },
    });

    if (postojeci) {
      console.log(`  ✓ ${razredData.name} već postoji`);
      postojaloRazreda++;
    } else {
      await prisma.razred.create({
        data: {
          name: razredData.name,
          ilmihal: razredData.ilmihal,
          status: true,
        },
      });
      console.log(`  ✅ Kreiran: ${razredData.name} (${razredData.ilmihal})`);
      kreiranoRazreda++;
    }
  }

  console.log(`\n✅ Razredi: Kreirano ${kreiranoRazreda}, Već postojalo ${postojaloRazreda}\n`);

  // ============================================
  // 3. KREIRANJE LEKCIJA (SAMO KURAN I SUFARA)
  // ============================================
  console.log('📖 Kreiranje lekcija (KURAN i SUFARA)...\n');

  // Definiši lekcije (KURAN i SUFARA - bez veze sa razredima)
  const lekcije: Array<{
    naslov: string;
    opis: string;
    tip: TipLekcije;
    tezina: number;
    redoslijed: number;
  }> = [
    // SUFARA lekcije
    { naslov: 'Elif-Ba - Slova', opis: 'Učenje arapskih slova', tip: TipLekcije.SUFARA, tezina: 1, redoslijed: 1 },
    { naslov: 'Elif-Ba - Osnovni znakovi', opis: 'Osnovni znakovi u arapskom pismu', tip: TipLekcije.SUFARA, tezina: 1, redoslijed: 2 },
    { naslov: 'Čitanje - Osnovni tekstovi', opis: 'Osnovno čitanje arapskog teksta', tip: TipLekcije.SUFARA, tezina: 2, redoslijed: 3 },
    { naslov: 'Čitanje - Srednji tekstovi', opis: 'Srednje teško čitanje', tip: TipLekcije.SUFARA, tezina: 3, redoslijed: 4 },
    { naslov: 'Čitanje - Teži tekstovi', opis: 'Teže čitanje arapskog teksta', tip: TipLekcije.SUFARA, tezina: 4, redoslijed: 5 },
    { naslov: 'Čitanje - Napredni tekstovi', opis: 'Napredno čitanje', tip: TipLekcije.SUFARA, tezina: 5, redoslijed: 6 },
    { naslov: 'Čitanje - Ekspertni tekstovi', opis: 'Ekspertno čitanje', tip: TipLekcije.SUFARA, tezina: 6, redoslijed: 7 },
    
    // KURAN lekcije
    { naslov: 'Kratke sure - Al-Fatiha', opis: 'Učenje sure Al-Fatiha', tip: TipLekcije.KURAN, tezina: 1, redoslijed: 8 },
    { naslov: 'Kratke sure - Al-Ihlas', opis: 'Učenje sure Al-Ihlas', tip: TipLekcije.KURAN, tezina: 1, redoslijed: 9 },
    { naslov: 'Kratke sure - Al-Falaq', opis: 'Učenje sure Al-Falaq', tip: TipLekcije.KURAN, tezina: 2, redoslijed: 10 },
    { naslov: 'Kratke sure - An-Nas', opis: 'Učenje sure An-Nas', tip: TipLekcije.KURAN, tezina: 2, redoslijed: 11 },
    { naslov: 'Kratke sure - Al-Kafirun', opis: 'Učenje sure Al-Kafirun', tip: TipLekcije.KURAN, tezina: 3, redoslijed: 12 },
    { naslov: 'Kratke sure - An-Nasr', opis: 'Učenje sure An-Nasr', tip: TipLekcije.KURAN, tezina: 3, redoslijed: 13 },
    { naslov: 'Kratke sure - Al-Masad', opis: 'Učenje sure Al-Masad', tip: TipLekcije.KURAN, tezina: 4, redoslijed: 14 },
    { naslov: 'Srednje sure - Al-Kevser', opis: 'Učenje sure Al-Kevser', tip: TipLekcije.KURAN, tezina: 5, redoslijed: 15 },
    { naslov: 'Srednje sure - Al-Maun', opis: 'Učenje sure Al-Maun', tip: TipLekcije.KURAN, tezina: 5, redoslijed: 16 },
    { naslov: 'Srednje sure - Al-Fil', opis: 'Učenje sure Al-Fil', tip: TipLekcije.KURAN, tezina: 6, redoslijed: 17 },
    { naslov: 'Srednje sure - Kurejš', opis: 'Učenje sure Kurejš', tip: TipLekcije.KURAN, tezina: 6, redoslijed: 18 },
    { naslov: 'Duže sure - Al-Humaza', opis: 'Učenje sure Al-Humaza', tip: TipLekcije.KURAN, tezina: 7, redoslijed: 19 },
    { naslov: 'Duže sure - At-Tekasur', opis: 'Učenje sure At-Tekasur', tip: TipLekcije.KURAN, tezina: 7, redoslijed: 20 },
    { naslov: 'Tefsir - Osnovni', opis: 'Osnovni tefsir', tip: TipLekcije.KURAN, tezina: 7, redoslijed: 21 },
    { naslov: 'Duže sure - Al-Asr', opis: 'Učenje sure Al-Asr', tip: TipLekcije.KURAN, tezina: 8, redoslijed: 22 },
    { naslov: 'Duže sure - Al-Kadr', opis: 'Učenje sure Al-Kadr', tip: TipLekcije.KURAN, tezina: 8, redoslijed: 23 },
    { naslov: 'Tefsir - Srednji', opis: 'Srednji tefsir', tip: TipLekcije.KURAN, tezina: 8, redoslijed: 24 },
    { naslov: 'Duže sure - Al-Bejjina', opis: 'Učenje sure Al-Bejjina', tip: TipLekcije.KURAN, tezina: 9, redoslijed: 25 },
    { naslov: 'Duže sure - Al-Zilzal', opis: 'Učenje sure Al-Zilzal', tip: TipLekcije.KURAN, tezina: 9, redoslijed: 26 },
    { naslov: 'Tefsir - Napredni', opis: 'Napredni tefsir', tip: TipLekcije.KURAN, tezina: 9, redoslijed: 27 },
  ];

  let novihLekcija = 0;

  // Kreiraj sve lekcije
  const kreiraneLekcije: Array<{ id: string; naslov: string; tip: TipLekcije }> = [];

  for (const lekcijaData of lekcije) {
    // Proveri da li lekcija već postoji (po naslovu i tipu)
    let lekcija = await prisma.lekcija.findFirst({
      where: {
        naslov: lekcijaData.naslov,
        tip: lekcijaData.tip,
      },
    });

    // Ako ne postoji, kreiraj je
    if (!lekcija) {
      lekcija = await prisma.lekcija.create({
        data: {
          naslov: lekcijaData.naslov,
          opis: lekcijaData.opis,
          tip: lekcijaData.tip,
          tezina: lekcijaData.tezina,
          redoslijed: lekcijaData.redoslijed,
          aktivan: true,
        },
      });
      novihLekcija++;
      console.log(`  ✅ Kreirana lekcija: ${lekcijaData.naslov} (${lekcijaData.tip})`);
    } else {
      // Ažuriraj redoslijed ako je potrebno
      if (lekcija.redoslijed !== lekcijaData.redoslijed) {
        await prisma.lekcija.update({
          where: { id: lekcija.id },
          data: { redoslijed: lekcijaData.redoslijed },
        });
      }
      console.log(`  ℹ️  Lekcija već postoji: ${lekcijaData.naslov}`);
    }

    kreiraneLekcije.push({ id: lekcija.id, naslov: lekcija.naslov, tip: lekcija.tip });
  }

  console.log(`\n✅ Kreirano/pronadjeno ${kreiraneLekcije.length} lekcija (KURAN i SUFARA)`);
  console.log(`   - Novih lekcija: ${novihLekcija}`);
  console.log(`   - Ukupno lekcija (KURAN/SUFARA): ${kreiraneLekcije.length}`);
  console.log(`\n💡 Napomena: Lekcije nisu povezane sa razredima u seed-u.`);
  console.log(`   Veze između razreda i lekcija se kreiraju u nastavnom planu.\n`);

  // ============================================
  // 4. KREIRANJE LEKCIJA ZA ŠKOLU HIFZA
  // ============================================
  console.log('📖 Kreiranje lekcija za Školu Hifza...\n');

  // Pronađi razred Škola Hifza
  const skolaHifzaRazred = await prisma.razred.findUnique({
    where: { name: 'Škola Hifza' },
  });

  if (!skolaHifzaRazred) {
    console.log('⚠️  Razred "Škola Hifza" nije pronađen. Preskačem kreiranje lekcija za Školu Hifza.');
  } else {
    // Učitaj podatke o suri iz JSON fajla - provjeri više mogućih putanja
    const basePath = process.cwd();
    const possiblePaths = [
      path.join(basePath, 'apps/api/src/skola-hifza/sure-data.json'),
      path.join(__dirname, '../src/skola-hifza/sure-data.json'),
      path.join(__dirname, '../../src/skola-hifza/sure-data.json'),
    ];

    let sureDataPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        sureDataPath = possiblePath;
        break;
      }
    }

    if (!sureDataPath) {
      console.log(`⚠️  Ne mogu pronaći sure-data.json fajl. Tražene putanje: ${possiblePaths.join(', ')}`);
      console.log('   Preskačem kreiranje lekcija za Školu Hifza.');
    } else {
      const sureDataContent = fs.readFileSync(sureDataPath, 'utf-8');
      const sureData: Record<string, number> = JSON.parse(sureDataContent);

      let novihHifzaLekcija = 0;
      let novihHifzaPovezivanja = 0;

      // Sortiraj sure po redoslijedu (Al-Fatiha prva, zatim po redoslijedu u Kur'anu)
      const sureEntries = Object.entries(sureData).sort((a, b) => {
        // Al-Fatiha je uvijek prva
        if (a[0] === 'Al-Fatiha') return -1;
        if (b[0] === 'Al-Fatiha') return 1;
        return a[0].localeCompare(b[0]);
      });

      let redoslijed = 1;

      for (const [suraName, brojAjeta] of sureEntries) {
        // Proveri da li lekcija već postoji (po naslovu i tipu SKOLA_HIFZA)
        let lekcija = await prisma.lekcija.findFirst({
          where: {
            naslov: suraName,
            tip: TipLekcije.SKOLA_HIFZA,
          },
        });

        // Ako ne postoji, kreiraj je
        if (!lekcija) {
          lekcija = await prisma.lekcija.create({
            data: {
              naslov: suraName,
              opis: `Sura ${suraName} - ${brojAjeta} ajeta`,
              tip: TipLekcije.SKOLA_HIFZA,
              tezina: 1, // Default težina za Školu Hifza
              redoslijed: redoslijed,
              brojAjeta: brojAjeta,
              aktivan: true,
            },
          });
          novihHifzaLekcija++;
          console.log(`  ✅ Kreirana lekcija: ${suraName} (${brojAjeta} ajeta)`);
        } else {
          // Ažuriraj broj ajeta i redoslijed ako je potrebno
          if (lekcija.brojAjeta !== brojAjeta || lekcija.redoslijed !== redoslijed) {
            await prisma.lekcija.update({
              where: { id: lekcija.id },
              data: {
                brojAjeta: brojAjeta,
                redoslijed: redoslijed,
              },
            });
          }
          console.log(`  ℹ️  Lekcija već postoji: ${suraName}`);
        }

        // Poveži lekciju sa razredom Škola Hifza
        const postojecaPovezanost = await prisma.razredLekcija.findUnique({
          where: {
            razredId_lekcijaId: {
              razredId: skolaHifzaRazred.id,
              lekcijaId: lekcija.id,
            },
          },
        });

        if (!postojecaPovezanost) {
          await prisma.razredLekcija.create({
            data: {
              razredId: skolaHifzaRazred.id,
              lekcijaId: lekcija.id,
            },
          });
          novihHifzaPovezivanja++;
        }

        redoslijed++;
      }

      console.log(`\n✅ Kreirano/pronadjeno ${sureEntries.length} lekcija za Školu Hifza`);
      console.log(`   - Novih lekcija: ${novihHifzaLekcija}`);
      console.log(`   - Novih povezivanja: ${novihHifzaPovezivanja}\n`);
    }
  }

  console.log('\n🎉 Seeding završen!');
  console.log('\n📊 Statistika:');
  console.log(`   - Razredi: Kreirano ${kreiranoRazreda}, Već postojalo ${postojaloRazreda}`);
  console.log(`   - Lekcije (KURAN/SUFARA): Novih ${novihLekcija}, Ukupno ${kreiraneLekcije.length}`);
  console.log(`   - Veze između razreda i lekcija se kreiraju u nastavnom planu`);
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@emekteb.ba / password123 / PIN: 0000');
  console.log('   Muallim: muhidin.topcagic@emekteb.ba / password123 / PIN: 1234');
  console.log('\n💡 Napomena: Učenici će se automatski importovati pri pokretanju aplikacije iz CSV fajla.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
