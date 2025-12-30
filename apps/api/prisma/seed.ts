import { PrismaClient, Uloga, Ilmihal, TipLekcije, Spol, StatusUcenika, Razred, Lekcija, Ucenik } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Funkcija za truncate baze
async function truncateDatabase() {
  console.log('🗑️  Truncating database...\n');

  try {
    // Redosled brisanja je važan zbog foreign key constraint-a
    await prisma.skolaHifzaPrisustvo.deleteMany({});
    await prisma.skolaHifzaCas.deleteMany({});
    await prisma.skolaHifzaUcenik.deleteMany({});
    await prisma.skolaHifzaMuallim.deleteMany({});
    await prisma.skolaHifza.deleteMany({});
    await prisma.casOcjena.deleteMany({});
    await prisma.casLekcija.deleteMany({});
    await prisma.casPrisustvo.deleteMany({});
    await prisma.cas.deleteMany({});
    await prisma.raspored.deleteMany({});
    await prisma.ucenikGrupa.deleteMany({});
    await prisma.grupa.deleteMany({});
    await prisma.razredNastavnaGodina.deleteMany({});
    await prisma.nastavniPlanRazredLekcija.deleteMany({});
    await prisma.nastavniPlanRazred.deleteMany({});
    await prisma.roditelj.deleteMany({});
    await prisma.kontakt.deleteMany({});
    await prisma.obrazovanje.deleteMany({});
    await prisma.ucenik.deleteMany({});
    await prisma.korisnik.deleteMany({});
    await prisma.razredLekcija.deleteMany({});
    await prisma.lekcija.deleteMany({});
    await prisma.nastavniPlan.deleteMany({});
    await prisma.slobodanDan.deleteMany({});
    await prisma.razred.deleteMany({});
    await prisma.nastavnaGodina.deleteMany({});
    await prisma.import.deleteMany({});

    console.log('✅ Database truncated successfully!\n');
  } catch (error) {
    console.error('❌ Error truncating database:', error);
    throw error;
  }
}

async function main() {
  console.log('🌱 Starting seed process...\n');

  // Provjeri da li je seed već napravljen - provjeri i ADMIN i MUALLIM
  const existingAdmin = await prisma.korisnik.findFirst({
    where: { uloga: Uloga.ADMIN },
  });

  const existingMuallim = await prisma.korisnik.findFirst({
    where: { uloga: Uloga.MUALLIM },
  });

  if (existingAdmin && existingMuallim) {
    console.log('⚠️  Seed je već napravljen (admin i muallim korisnici postoje).');
    console.log('   Za ponovni seed, prvo pokrenite: npm run prisma:truncate\n');
    return;
  }

  // Truncate bazu prije seeda
  await truncateDatabase();

  // ============================================
  // 1. KREIRANJE ADMINA I MUALLIMA
  // ============================================
  console.log('📝 Kreiranje admina i muallima...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Kreiraj ADMIN korisnika
  const admin = await prisma.korisnik.create({
    data: {
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

  // Kreiraj MUALLIM korisnika
  const muallim = await prisma.korisnik.create({
    data: {
      email: 'muallim@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Muhidin',
      prezime: 'Topcagic',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1234',
    },
  });

  console.log('✅ Muallim kreiran:', muallim.email);

  // Kreiraj Ucenik zapis za muallima
  const muallimUcenik = await prisma.ucenik.create({
    data: {
      korisnikId: muallim.id,
      status: StatusUcenika.AKTIVAN,
    },
  });

  console.log('✅ Muallim Ucenik zapis kreiran\n');

  // ============================================
  // 2. KREIRANJE RAZREDA
  // ============================================
  console.log('📚 Kreiranje razreda...');

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

  const kreiraniRazredi: Razred[] = [];
  for (const razredData of razredi) {
    const razred = await prisma.razred.create({
      data: {
        name: razredData.name,
        ilmihal: razredData.ilmihal,
        status: true,
      },
    });
    kreiraniRazredi.push(razred);
    console.log(`  ✅ Kreiran: ${razredData.name} (${razredData.ilmihal})`);
  }

  console.log(`\n✅ Kreirano ${kreiraniRazredi.length} razreda\n`);

  // ============================================
  // 3. KREIRANJE LEKCIJA - KURAN
  // ============================================
  console.log('📖 Kreiranje lekcija iz Kurana...');

  const kuranLekcije = [
    { naslov: 'Al-Fatiha', opis: 'Učenje sure Al-Fatiha', tezina: 1, redoslijed: 1 },
    { naslov: 'Al-Ihlas', opis: 'Učenje sure Al-Ihlas', tezina: 1, redoslijed: 2 },
    { naslov: 'Al-Falaq', opis: 'Učenje sure Al-Falaq', tezina: 2, redoslijed: 3 },
    { naslov: 'An-Nas', opis: 'Učenje sure An-Nas', tezina: 2, redoslijed: 4 },
    { naslov: 'Al-Kafirun', opis: 'Učenje sure Al-Kafirun', tezina: 3, redoslijed: 5 },
    { naslov: 'An-Nasr', opis: 'Učenje sure An-Nasr', tezina: 3, redoslijed: 6 },
    { naslov: 'Al-Masad', opis: 'Učenje sure Al-Masad', tezina: 4, redoslijed: 7 },
    { naslov: 'Al-Kevser', opis: 'Učenje sure Al-Kevser', tezina: 5, redoslijed: 8 },
    { naslov: 'Al-Maun', opis: 'Učenje sure Al-Maun', tezina: 5, redoslijed: 9 },
    { naslov: 'Al-Fil', opis: 'Učenje sure Al-Fil', tezina: 6, redoslijed: 10 },
  ];

  const kreiraneKuranLekcije: Lekcija[] = [];
  for (const lekcijaData of kuranLekcije) {
    const lekcija = await prisma.lekcija.create({
      data: {
        naslov: lekcijaData.naslov,
        opis: lekcijaData.opis,
        tip: TipLekcije.KURAN,
        tezina: lekcijaData.tezina,
        redoslijed: lekcijaData.redoslijed,
        aktivan: true,
      },
    });
    kreiraneKuranLekcije.push(lekcija);
    console.log(`  ✅ Kreirana lekcija: ${lekcijaData.naslov}`);
  }

  console.log(`\n✅ Kreirano ${kreiraneKuranLekcije.length} lekcija iz Kurana\n`);

  // ============================================
  // 4. KREIRANJE LEKCIJA - SUFARA
  // ============================================
  console.log('📖 Kreiranje lekcija - Sufara...');

  const sufaraLekcije = [
    { naslov: 'Elif-Ba - Slova', opis: 'Učenje arapskih slova', tezina: 1, redoslijed: 1 },
    { naslov: 'Elif-Ba - Osnovni znakovi', opis: 'Osnovni znakovi u arapskom pismu', tezina: 1, redoslijed: 2 },
    { naslov: 'Čitanje - Osnovni tekstovi', opis: 'Osnovno čitanje arapskog teksta', tezina: 2, redoslijed: 3 },
    { naslov: 'Čitanje - Srednji tekstovi', opis: 'Srednje teško čitanje', tezina: 3, redoslijed: 4 },
    { naslov: 'Čitanje - Teži tekstovi', opis: 'Teže čitanje arapskog teksta', tezina: 4, redoslijed: 5 },
    { naslov: 'Čitanje - Napredni tekstovi', opis: 'Napredno čitanje', tezina: 5, redoslijed: 6 },
    { naslov: 'Čitanje - Ekspertni tekstovi', opis: 'Ekspertno čitanje', tezina: 6, redoslijed: 7 },
  ];

  const kreiraneSufaraLekcije: Lekcija[] = [];
  for (const lekcijaData of sufaraLekcije) {
    const lekcija = await prisma.lekcija.create({
      data: {
        naslov: lekcijaData.naslov,
        opis: lekcijaData.opis,
        tip: TipLekcije.SUFARA,
        tezina: lekcijaData.tezina,
        redoslijed: lekcijaData.redoslijed,
        aktivan: true,
      },
    });
    kreiraneSufaraLekcije.push(lekcija);
    console.log(`  ✅ Kreirana lekcija: ${lekcijaData.naslov}`);
  }

  console.log(`\n✅ Kreirano ${kreiraneSufaraLekcije.length} lekcija - Sufara\n`);

  // ============================================
  // 5. KREIRANJE LEKCIJA ZA ŠKOLU HIFZA
  // ============================================
  console.log('📖 Kreiranje lekcija za Školu Hifza...');

  const skolaHifzaRazred = kreiraniRazredi.find(r => r.name === 'Škola Hifza');
  
  if (!skolaHifzaRazred) {
    console.log('⚠️  Razred "Škola Hifza" nije pronađen. Preskačem kreiranje lekcija za Školu Hifza.');
  } else {
    // Učitaj podatke o suri iz JSON fajla
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
      console.log(`⚠️  Ne mogu pronaći sure-data.json fajl. Preskačem kreiranje lekcija za Školu Hifza.`);
    } else {
      const sureDataContent = fs.readFileSync(sureDataPath, 'utf-8');
      const sureData: Record<string, number> = JSON.parse(sureDataContent);

      // Sortiraj sure po redoslijedu (Al-Fatiha prva)
      const sureEntries = Object.entries(sureData).sort((a, b) => {
        if (a[0] === 'Al-Fatiha') return -1;
        if (b[0] === 'Al-Fatiha') return 1;
        return a[0].localeCompare(b[0]);
      });

      const kreiraneHifzaLekcije: Lekcija[] = [];
      let redoslijed = 1;

      for (const [suraName, brojAjeta] of sureEntries) {
        const lekcija = await prisma.lekcija.create({
          data: {
            naslov: suraName,
            opis: `Sura ${suraName} - ${brojAjeta} ajeta`,
            tip: TipLekcije.SKOLA_HIFZA,
            tezina: 1,
            redoslijed: redoslijed,
            brojAjeta: brojAjeta,
            aktivan: true,
          },
        });

        // Poveži lekciju sa razredom Škola Hifza
        await prisma.razredLekcija.create({
          data: {
            razredId: skolaHifzaRazred.id,
            lekcijaId: lekcija.id,
          },
        });

        kreiraneHifzaLekcije.push(lekcija);
        redoslijed++;
      }

      console.log(`\n✅ Kreirano ${kreiraneHifzaLekcije.length} lekcija za Školu Hifza\n`);
    }
  }

  // ============================================
  // 6. KREIRANJE 10 UČENIKA
  // ============================================
  console.log('👥 Kreiranje 10 učenika...');

  const imena = ['Ahmed', 'Fatima', 'Emir', 'Amina', 'Haris', 'Lejla', 'Adnan', 'Emina', 'Dženan', 'Selma'];
  const prezimena = ['Hasanović', 'Mehmedović', 'Alić', 'Kovačević', 'Džafić', 'Begić', 'Suljić', 'Hadžić', 'Osmanović', 'Jusufović'];

  const kreiraniUcenici: Ucenik[] = [];
  for (let i = 0; i < 10; i++) {
    const ime = imena[i];
    const prezime = prezimena[i];
    const email = `${ime.toLowerCase()}.${prezime.toLowerCase()}@emekteb.ba`;
    const pin = String(2000 + i).padStart(4, '0');

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

    const ucenik = await prisma.ucenik.create({
      data: {
        korisnikId: korisnik.id,
        datumRodjenja: new Date(2010 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        spol: Math.random() > 0.5 ? Spol.MUSKO : Spol.ZENSKO,
        mjestoRodjenja: ['Sarajevo', 'Tuzla', 'Zenica', 'Mostar', 'Banja Luka'][Math.floor(Math.random() * 5)],
        adresaStanovanja: `Ulica ${Math.floor(Math.random() * 100) + 1}`,
        status: StatusUcenika.AKTIVAN,
      },
    });

    kreiraniUcenici.push(ucenik);
    console.log(`  ✅ Kreiran učenik: ${ime} ${prezime} (${email})`);
  }

  console.log(`\n✅ Kreirano ${kreiraniUcenici.length} učenika\n`);

  // ============================================
  // 7. KREIRANJE RODITELJA I POVEZIVANJE SA UČENICIMA
  // ============================================
  console.log('👨‍👩‍👧‍👦 Kreiranje roditelja i povezivanje sa učenikom...');

  // Kreiraj roditelja koji se loguje sa email-om prvog učenika (ahmed.hasanovic@emekteb.ba)
  const prviUcenik = kreiraniUcenici[0];
  const prviUcenikKorisnik = await prisma.korisnik.findUnique({
    where: { id: prviUcenik.korisnikId! },
  });

  if (prviUcenikKorisnik && prviUcenikKorisnik.email) {
    // Koristimo email u formatu roditelj.ime.prezime@emekteb.ba zbog unique constraint
    const roditeljEmail = `roditelj.${prviUcenikKorisnik.email}`;
    
    // Provjeri da li već postoji roditelj sa tim email-om
    const existingRoditelj = await prisma.korisnik.findFirst({
      where: {
        email: roditeljEmail,
        uloga: Uloga.RODITELJ,
      },
    });

    let roditeljKorisnik;
    if (existingRoditelj) {
      console.log(`  ⚠️  Roditelj korisnik već postoji sa email-om: ${existingRoditelj.email}`);
      roditeljKorisnik = existingRoditelj;
    } else {
      // Kreiraj roditelj korisnika sa email-om u formatu roditelj.ime.prezime@emekteb.ba
      roditeljKorisnik = await prisma.korisnik.create({
        data: {
          email: roditeljEmail,
          lozinka: hashedPassword,
          ime: 'Roditelj',
          prezime: prviUcenikKorisnik.prezime || 'Test',
          uloga: Uloga.RODITELJ,
          aktivan: true,
        },
      });

      console.log(`  ✅ Kreiran roditelj korisnik: ${roditeljEmail}`);
      console.log(`  📧 Roditelj se loguje sa email-om djeteta: ${prviUcenikKorisnik.email}`);
    }

    // Provjeri da li već postoje Roditelj zapisi za prvog učenika
    const existingRoditeljZapisi = await prisma.roditelj.findMany({
      where: {
        ucenikId: prviUcenik.id,
      },
    });

    // Kreiraj ili ažuriraj Roditelj zapise za prvog učenika
    // Koristimo isti email kao u Korisnik tabeli (roditelj.ahmed.hasanovic@emekteb.ba)
    const roditeljEmailForRoditeljTable = roditeljEmail; // Isti email kao u Korisnik tabeli
    
    // Provjeri da li postoji majka
    const existingMajka = await prisma.roditelj.findFirst({
      where: {
        ucenikId: prviUcenik.id,
        tip: 'MAJKA',
      },
    });

    if (existingMajka) {
      await prisma.roditelj.update({
        where: { id: existingMajka.id },
        data: {
          imePrezime: 'Majka Test',
          email: roditeljEmailForRoditeljTable,
          mobitel: '+38761123456',
        },
      });
    } else {
      await prisma.roditelj.create({
        data: {
          ucenikId: prviUcenik.id,
          tip: 'MAJKA',
          imePrezime: 'Majka Test',
          email: roditeljEmailForRoditeljTable,
          mobitel: '+38761123456',
        },
      });
    }

    // Provjeri da li postoji otac
    const existingOtac = await prisma.roditelj.findFirst({
      where: {
        ucenikId: prviUcenik.id,
        tip: 'OTAC',
      },
    });

    if (existingOtac) {
      await prisma.roditelj.update({
        where: { id: existingOtac.id },
        data: {
          imePrezime: 'Otac Test',
          email: roditeljEmailForRoditeljTable,
          mobitel: '+38762123456',
        },
      });
    } else {
      await prisma.roditelj.create({
        data: {
          ucenikId: prviUcenik.id,
          tip: 'OTAC',
          imePrezime: 'Otac Test',
          email: roditeljEmailForRoditeljTable,
          mobitel: '+38762123456',
        },
      });
    }

    console.log(`  ✅ Kreirani/ažurirani Roditelj zapisi za učenika: ${prviUcenikKorisnik.ime} ${prviUcenikKorisnik.prezime}`);

    console.log(`  📧 Email roditelja u Roditelj tabeli: ${roditeljEmail}`);
    console.log(`  📧 Za login koristi email djeteta: ${prviUcenikKorisnik.email}`);
  }

  console.log('\n✅ Roditelj kreiran i povezan\n');

  console.log('\n🎉 Seeding završen!');
  // Pronađi lekcije za Školu Hifza za statistiku
  const skolaHifzaLekcije = await prisma.lekcija.findMany({
    where: { tip: TipLekcije.SKOLA_HIFZA },
  });

  console.log('\n📊 Statistika:');
  console.log(`   - Admin: 1`);
  console.log(`   - Muallim: 1`);
  console.log(`   - Učenici: ${kreiraniUcenici.length}`);
  console.log(`   - Razredi: ${kreiraniRazredi.length}`);
  console.log(`   - Lekcije Kuran: ${kreiraneKuranLekcije.length}`);
  console.log(`   - Lekcije Sufara: ${kreiraneSufaraLekcije.length}`);
  console.log(`   - Lekcije Hifz: ${skolaHifzaLekcije.length}`);
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@emekteb.ba / password123 / PIN: 0000');
  console.log('   Muallim: muallim@emekteb.ba / password123 / PIN: 1234');
  console.log('   Učenici: ime.prezime@emekteb.ba / password123 / PIN: 2000-2009');
  console.log('   Roditelj: ahmed.hasanovic@emekteb.ba / password123');
  console.log('   (Roditelj se loguje sa email-om djeteta, ali u bazi ima email: roditelj.ahmed.hasanovic@emekteb.ba)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
