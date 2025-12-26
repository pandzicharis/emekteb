import { PrismaClient, Uloga, Ilmihal, TipLekcije, DanUNedelji, TipCasa, StatusPrisustva, Spol, StatusUcenika } from '@prisma/client';
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

  // ============================================
  // 5. KREIRANJE DODATNIH MUALLIMA
  // ============================================
  console.log('👨‍🏫 Kreiranje dodatnih muallima...\n');

  const muallimiData = [
    { ime: 'Ahmed', prezime: 'Hasanović', email: 'ahmed.hasanovic@emekteb.ba', pin: '1111' },
    { ime: 'Fatima', prezime: 'Mehmedović', email: 'fatima.mehmedovic@emekteb.ba', pin: '2222' },
    { ime: 'Emir', prezime: 'Alić', email: 'emir.alic@emekteb.ba', pin: '3333' },
    { ime: 'Amina', prezime: 'Kovačević', email: 'amina.kovacevic@emekteb.ba', pin: '4444' },
    { ime: 'Haris', prezime: 'Džafić', email: 'haris.dzafic@emekteb.ba', pin: '5555' },
    { ime: 'Lejla', prezime: 'Begić', email: 'lejla.begic@emekteb.ba', pin: '6666' },
    { ime: 'Adnan', prezime: 'Suljić', email: 'adnan.suljic@emekteb.ba', pin: '7777' },
    { ime: 'Emina', prezime: 'Hadžić', email: 'emina.hadzic@emekteb.ba', pin: '8888' },
    { ime: 'Dženan', prezime: 'Osmanović', email: 'dzenan.osmanovic@emekteb.ba', pin: '9999' },
  ];

  const kreiraniMuallimi = [muallim]; // Dodaj postojećeg muallima

  for (const muallimData of muallimiData) {
    const noviMuallim = await prisma.korisnik.upsert({
      where: { email: muallimData.email },
      update: {
        lozinka: hashedPassword,
        ime: muallimData.ime,
        prezime: muallimData.prezime,
        uloga: Uloga.MUALLIM,
        aktivan: true,
        pin: muallimData.pin,
      },
      create: {
        email: muallimData.email,
        lozinka: hashedPassword,
        ime: muallimData.ime,
        prezime: muallimData.prezime,
        uloga: Uloga.MUALLIM,
        aktivan: true,
        pin: muallimData.pin,
      },
    });

    // Kreiraj Ucenik zapis za muallima
    await prisma.ucenik.upsert({
      where: { korisnikId: noviMuallim.id },
      update: {},
      create: {
        korisnikId: noviMuallim.id,
        status: StatusUcenika.AKTIVAN,
      },
    });

    kreiraniMuallimi.push(noviMuallim);
    console.log(`  ✅ Muallim kreiran: ${muallimData.ime} ${muallimData.prezime}`);
  }

  console.log(`\n✅ Ukupno muallima: ${kreiraniMuallimi.length}\n`);

  // ============================================
  // 6. KREIRANJE NASTAVNE GODINE I NASTAVNOG PLANA
  // ============================================
  console.log('📅 Kreiranje nastavne godine i nastavnog plana...\n');

  let nastavniPlan = await prisma.nastavniPlan.findFirst({
    where: { naziv: 'Osnovni nastavni plan 2024/2025' },
  });

  if (!nastavniPlan) {
    nastavniPlan = await prisma.nastavniPlan.create({
      data: {
        naziv: 'Osnovni nastavni plan 2024/2025',
        opis: 'Osnovni nastavni plan za školsku godinu 2024/2025',
        datumUsvajanja: new Date('2024-09-01'),
        aktivan: true,
      },
    });
    console.log('✅ Nastavni plan kreiran');
  } else {
    console.log('✅ Nastavni plan već postoji');
  }

  const datumOd = new Date('2024-09-01');
  const datumDo = new Date('2025-06-30');

  let nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: { naziv: '2024/2025' },
  });

  if (!nastavnaGodina) {
    nastavnaGodina = await prisma.nastavnaGodina.create({
      data: {
        naziv: '2024/2025',
        opis: 'Nastavna godina 2024/2025',
        datumOd,
        datumDo,
        nastavniPlanId: nastavniPlan.id,
        status: 'ACTIVE',
      },
    });
    console.log('✅ Nastavna godina kreirana');
  } else {
    console.log('✅ Nastavna godina već postoji');
  }

  console.log('');

  // ============================================
  // 7. KREIRANJE RAZRED_NastavnaGodina I GRUPA
  // ============================================
  console.log('📚 Kreiranje razreda u nastavnoj godini i grupa...\n');

  const sviRazredi = await prisma.razred.findMany();
  const razredNastavnaGodinaMap = new Map<string, string>(); // razredId -> razredNastavnaGodinaId
  const grupeMap = new Map<string, Array<{ id: string; naziv: string }>>(); // razredNastavnaGodinaId -> grupe

  // Dijeli muallime između razreda
  let muallimIndex = 0;

  for (const razred of sviRazredi) {
    const muallimZaRazred = kreiraniMuallimi[muallimIndex % kreiraniMuallimi.length];
    muallimIndex++;

    // Pronađi Ucenik zapis za muallima
    const muallimUcenik = await prisma.ucenik.findUnique({
      where: { korisnikId: muallimZaRazred.id },
    });

    if (!muallimUcenik) {
      console.log(`  ⚠️  Muallim ${muallimZaRazred.ime} nema Ucenik zapis, preskačem...`);
      continue;
    }

    // Odluči da li će razred biti podijeljen u grupe (50% šanse za razrede 1-9)
    const split = razred.name !== 'Škola Hifza' && Math.random() > 0.5;

    const razredNG = await prisma.razredNastavnaGodina.upsert({
      where: {
        nastavnaGodinaId_razredId: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredId: razred.id,
        },
      },
      update: {},
      create: {
        nastavnaGodinaId: nastavnaGodina.id,
        razredId: razred.id,
        muallimId: muallimUcenik.id,
        split,
      },
    });

    razredNastavnaGodinaMap.set(razred.id, razredNG.id);
    console.log(`  ✅ ${razred.name} - Muallim: ${muallimZaRazred.ime} ${muallimZaRazred.prezime} (Split: ${split ? 'Da' : 'Ne'})`);

    // Kreiraj grupe
    const grupe: Array<{ id: string; naziv: string }> = [];

    if (split) {
      // Kreiraj grupe A i B
      for (const nazivGrupe of ['A', 'B']) {
        const grupa = await prisma.grupa.upsert({
          where: {
            razredNastavnaGodinaId_naziv: {
              razredNastavnaGodinaId: razredNG.id,
              naziv: nazivGrupe,
            },
          },
          update: {},
          create: {
            razredNastavnaGodinaId: razredNG.id,
            naziv: nazivGrupe,
            kuran: Math.random() > 0.5,
            sufara: Math.random() > 0.5,
          },
        });
        grupe.push({ id: grupa.id, naziv: grupa.naziv });
      }
    } else {
      // Kreiraj samo jednu grupu (bez naziva ili "A")
      const grupa = await prisma.grupa.upsert({
        where: {
          razredNastavnaGodinaId_naziv: {
            razredNastavnaGodinaId: razredNG.id,
            naziv: 'A',
          },
        },
        update: {},
        create: {
          razredNastavnaGodinaId: razredNG.id,
          naziv: 'A',
          kuran: Math.random() > 0.5,
          sufara: Math.random() > 0.5,
        },
      });
      grupe.push({ id: grupa.id, naziv: grupa.naziv });
    }

    grupeMap.set(razredNG.id, grupe);
  }

  console.log(`\n✅ Kreirano ${razredNastavnaGodinaMap.size} razreda u nastavnoj godini\n`);

  // ============================================
  // 8. KREIRANJE RASPOREDA ZA SVAKU GRUPU
  // ============================================
  console.log('📋 Kreiranje rasporeda za grupe...\n');

  const rasporediMap = new Map<string, string>(); // grupaId -> rasporedId
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

  for (const [razredNGId, grupe] of grupeMap.entries()) {
    for (const grupa of grupe) {
      // Kreiraj raspored za grupu (jedan raspored po grupi - za subotu)
      // Za nedjelju ćemo koristiti isti raspored ali sa nedjelja datumom
      const raspored = await prisma.raspored.upsert({
        where: { grupaId: grupa.id },
        update: {},
        create: {
          grupaId: grupa.id,
          dan: DanUNedelji.subota,
          slot: timeSlots[Math.floor(Math.random() * timeSlots.length)],
          lokacija: `Sala ${Math.floor(Math.random() * 10) + 1}`,
          trajanje: 45,
        },
      });

      rasporediMap.set(grupa.id, raspored.id);
      console.log(`  ✅ Grupa ${grupa.naziv}: ${raspored.slot} (${raspored.dan})`);
    }
  }

  console.log(`\n✅ Kreirano ${rasporediMap.size} rasporeda\n`);

  // ============================================
  // 9. KREIRANJE UČENIKA I DODJELA GRUPAMA
  // ============================================
  console.log('👥 Kreiranje učenika i dodjela grupama...\n');

  const imena = ['Ahmed', 'Fatima', 'Emir', 'Amina', 'Haris', 'Lejla', 'Adnan', 'Emina', 'Dženan', 'Selma', 'Armin', 'Ena', 'Tarik', 'Dina', 'Kenan', 'Maja', 'Nedim', 'Sara', 'Aldin', 'Lana'];
  const prezimena = ['Hasanović', 'Mehmedović', 'Alić', 'Kovačević', 'Džafić', 'Begić', 'Suljić', 'Hadžić', 'Osmanović', 'Jusufović', 'Mujić', 'Karić', 'Čengić', 'Delić', 'Pirić', 'Hodžić', 'Zukić', 'Kurtović', 'Malić', 'Tomić'];

  let ukupnoUcenika = 0;
  const uceniciMap = new Map<string, Array<string>>(); // grupaId -> ucenikIds

  for (const [razredNGId, grupe] of grupeMap.entries()) {
    const razredNG = await prisma.razredNastavnaGodina.findUnique({
      where: { id: razredNGId },
      include: { razred: true },
    });

    if (!razredNG) continue;

    // Broj učenika po grupi (10-20)
    const brojUcenikaPoGrupi = Math.floor(Math.random() * 11) + 10;

    for (const grupa of grupe) {
      const uceniciUGrupi: string[] = [];

      for (let i = 0; i < brojUcenikaPoGrupi; i++) {
        const ime = imena[Math.floor(Math.random() * imena.length)];
        const prezime = prezimena[Math.floor(Math.random() * prezimena.length)];
        const email = `${ime.toLowerCase()}.${prezime.toLowerCase()}.${ukupnoUcenika}@emekteb.ba`;

        // Generiši jedinstven PIN (4-cifreni)
        // Koristimo ukupnoUcenika kao osnovu, ali dodajemo offset da izbjegnemo konflikte sa postojećim PIN-ovima
        // Format: 2000 + (ukupnoUcenika % 8000) - osigurava PIN-ove između 2000-9999
        let pin = String(2000 + (ukupnoUcenika % 8000));
        
        // Provjeri da li PIN već postoji i ako postoji, generiši alternativni
        const existingPin = await prisma.korisnik.findUnique({
          where: { pin },
        });
        
        if (existingPin) {
          // Ako PIN postoji, koristi kombinaciju sa timestamp-om
          pin = String((2000 + ukupnoUcenika + Date.now()) % 10000).padStart(4, '0');
        }

        // Kreiraj ili ažuriraj korisnika (upsert za email)
        const korisnik = await prisma.korisnik.upsert({
          where: { email },
          update: {
            lozinka: hashedPassword,
            ime,
            prezime,
            uloga: Uloga.UCENIK,
            aktivan: true,
            pin,
          },
          create: {
            email,
            lozinka: hashedPassword,
            ime,
            prezime,
            uloga: Uloga.UCENIK,
            aktivan: true,
            pin,
          },
        });

        // Kreiraj učenika
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

        // Dodaj učenika u grupu
        await prisma.ucenikGrupa.create({
          data: {
            ucenikId: ucenik.id,
            grupaId: grupa.id,
          },
        });

        uceniciUGrupi.push(ucenik.id);
        ukupnoUcenika++;
      }

      uceniciMap.set(grupa.id, uceniciUGrupi);
      console.log(`  ✅ Grupa ${grupa.naziv} (${razredNG.razred.name}): ${uceniciUGrupi.length} učenika`);
    }
  }

  console.log(`\n✅ Ukupno kreirano ${ukupnoUcenika} učenika\n`);

  // ============================================
  // 10. KREIRANJE ČASOVA ZA SVAKU GRUPU I DAN
  // ============================================
  console.log('📝 Kreiranje časova za sve grupe i dane...\n');

  // Funkcija za pronalaženje datuma subote i nedjelje
  function getSubotaNedjeljaDates(weeksBack: number): { subota: Date; nedjelja: Date } {
    const danas = new Date();
    const danasDay = danas.getDay(); // 0 = nedjelja, 6 = subota
    
    // Pronađi posljednju subotu
    let daysToLastSubota = (danasDay + 1) % 7; // Broj dana do posljednje subote
    if (daysToLastSubota === 0) daysToLastSubota = 7;
    
    const lastSubota = new Date(danas);
    lastSubota.setDate(danas.getDate() - daysToLastSubota - (weeksBack * 7));
    lastSubota.setHours(9, 0, 0, 0);
    
    const nedjelja = new Date(lastSubota);
    nedjelja.setDate(lastSubota.getDate() + 1);
    nedjelja.setHours(9, 0, 0, 0);
    
    return { subota: lastSubota, nedjelja };
  }

  // Kreiraj časove za posljednjih 4 tjedna (8 dana - 4 subote i 4 nedjelje)
  const casoviMap = new Map<string, Array<{ id: string; datum: Date }>>(); // grupaId -> casovi

  // Pronađi sve lekcije (KURAN i SUFARA)
  const lekcijeKuranSufara = await prisma.lekcija.findMany({
    where: {
      tip: {
        in: [TipLekcije.KURAN, TipLekcije.SUFARA],
      },
    },
  });

  let ukupnoCasova = 0;

  for (const [grupaId, rasporedId] of rasporediMap.entries()) {
    const razredNGId = Array.from(grupeMap.entries()).find(([_, gs]) => gs.some(g => g.id === grupaId))?.[0];
    if (!razredNGId) continue;

    const casoviUGrupi: Array<{ id: string; datum: Date }> = [];

    // Kreiraj časove za posljednja 4 tjedna
    for (let tjedan = 0; tjedan < 4; tjedan++) {
      const { subota, nedjelja } = getSubotaNedjeljaDates(tjedan);

      // Subota
      const casSubota = await prisma.cas.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredNastavnaGodinaId: razredNGId,
          grupaId,
          rasporedId,
          datum: subota,
          tipovi: [TipCasa.LEKCIJA],
          napomena: Math.random() > 0.7 ? 'Posebna napomena za ovaj čas' : null,
        },
      });

      // Dodaj lekcije u čas
      const brojLekcija = Math.floor(Math.random() * 3) + 1;
      const odabraneLekcije = lekcijeKuranSufara.sort(() => 0.5 - Math.random()).slice(0, brojLekcija);
      for (const lekcija of odabraneLekcije) {
        await prisma.casLekcija.upsert({
          where: {
            casId_lekcijaId: {
              casId: casSubota.id,
              lekcijaId: lekcija.id,
            },
          },
          update: {},
          create: {
            casId: casSubota.id,
            lekcijaId: lekcija.id,
          },
        });
      }

      casoviUGrupi.push({ id: casSubota.id, datum: subota });
      ukupnoCasova++;

      // Nedjelja (koristi isti raspored ali sa nedjelja datumom)
      const casNedjelja = await prisma.cas.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredNastavnaGodinaId: razredNGId,
          grupaId,
          rasporedId, // Isti raspored
          datum: nedjelja,
          tipovi: [TipCasa.LEKCIJA],
          napomena: Math.random() > 0.7 ? 'Posebna napomena za ovaj čas' : null,
        },
      });

      // Dodaj lekcije u čas
      const brojLekcijaNedjelja = Math.floor(Math.random() * 3) + 1;
      const odabraneLekcijeNedjelja = lekcijeKuranSufara.sort(() => 0.5 - Math.random()).slice(0, brojLekcijaNedjelja);
      for (const lekcija of odabraneLekcijeNedjelja) {
        await prisma.casLekcija.upsert({
          where: {
            casId_lekcijaId: {
              casId: casNedjelja.id,
              lekcijaId: lekcija.id,
            },
          },
          update: {},
          create: {
            casId: casNedjelja.id,
            lekcijaId: lekcija.id,
          },
        });
      }

      casoviUGrupi.push({ id: casNedjelja.id, datum: nedjelja });
      ukupnoCasova++;
    }

    casoviMap.set(grupaId, casoviUGrupi);
  }

  console.log(`✅ Kreirano ${ukupnoCasova} časova\n`);

  // ============================================
  // 11. KREIRANJE PRISUSTVA ZA SVAKI ČAS
  // ============================================
  console.log('✅ Kreiranje prisustva za sve časove...\n');

  let ukupnoPrisustva = 0;

  for (const [grupaId, casovi] of casoviMap.entries()) {
    const ucenici = uceniciMap.get(grupaId) || [];

    for (const cas of casovi) {
      for (const ucenikId of ucenici) {
        // 80% šansa da je prisutan, 10% opravdan, 10% neopravdan
        const rand = Math.random();
        let status: StatusPrisustva;
        if (rand < 0.8) {
          status = StatusPrisustva.PRISUTAN;
        } else if (rand < 0.9) {
          status = StatusPrisustva.OPRAVDAN;
        } else {
          status = StatusPrisustva.NEOPRAVDAN;
        }

        await prisma.casPrisustvo.upsert({
          where: {
            casId_ucenikId: {
              casId: cas.id,
              ucenikId,
            },
          },
          update: {},
          create: {
            casId: cas.id,
            ucenikId,
            status,
            napomena: status !== StatusPrisustva.PRISUTAN && Math.random() > 0.5 ? 'Razlog odsutnosti' : null,
          },
        });

        ukupnoPrisustva++;
      }
    }
  }

  console.log(`✅ Kreirano ${ukupnoPrisustva} zapisa prisustva\n`);

  // ============================================
  // 12. KREIRANJE OCJENA ZA PRISUTNE UČENIKE
  // ============================================
  console.log('📊 Kreiranje ocjena za prisutne učenike...\n');

  let ukupnoOcjena = 0;

  for (const [grupaId, casovi] of casoviMap.entries()) {
    for (const cas of casovi) {
      // Pronađi lekcije za ovaj čas
      const lekcijeUCasu = await prisma.casLekcija.findMany({
        where: { casId: cas.id },
        include: { lekcija: true },
      });

      // Pronađi prisutne učenike
      const prisutniUcenici = await prisma.casPrisustvo.findMany({
        where: {
          casId: cas.id,
          status: StatusPrisustva.PRISUTAN,
        },
      });

      for (const prisustvo of prisutniUcenici) {
        // Za svaku lekciju, daj ocjenu (50% šansa)
        for (const casLekcija of lekcijeUCasu) {
          if (Math.random() > 0.5) {
            const ocjena = Math.floor(Math.random() * 3) + 3; // 3, 4, ili 5

            await prisma.casOcjena.upsert({
              where: {
                casId_ucenikId_lekcijaId: {
                  casId: cas.id,
                  ucenikId: prisustvo.ucenikId,
                  lekcijaId: casLekcija.lekcijaId,
                },
              },
              update: {},
              create: {
                casId: cas.id,
                ucenikId: prisustvo.ucenikId,
                lekcijaId: casLekcija.lekcijaId,
                ocjena,
                komentar: Math.random() > 0.7 ? 'Dobar napredak' : null,
              },
            });

            ukupnoOcjena++;
          }
        }
      }
    }
  }

  console.log(`✅ Kreirano ${ukupnoOcjena} ocjena\n`);

  // ============================================
  // 13. KREIRANJE ŠKOLA HIFZA PODATAKA
  // ============================================
  console.log('📖 Kreiranje Škola Hifza podataka...\n');

  const skolaHifzaRazredNG = Array.from(razredNastavnaGodinaMap.entries()).find(([razredId]) => {
    return sviRazredi.find(r => r.id === razredId)?.name === 'Škola Hifza';
  });

  if (skolaHifzaRazredNG) {
    // Kreiraj SkolaHifza zapis
    const skolaHifzaLekcije = await prisma.lekcija.findMany({
      where: { tip: TipLekcije.SKOLA_HIFZA },
    });

    const skolaHifza = await prisma.skolaHifza.upsert({
      where: { nastavnaGodinaId: nastavnaGodina.id },
      update: {},
      create: {
        nastavnaGodinaId: nastavnaGodina.id,
        lekcije: skolaHifzaLekcije.map(l => l.id),
      },
    });

    // Dodaj muallime u Školu Hifza
    const skolaHifzaMuallimi = kreiraniMuallimi.slice(0, 3); // Prva 3 muallima
    for (const muallimKorisnik of skolaHifzaMuallimi) {
      const muallimUcenik = await prisma.ucenik.findUnique({
        where: { korisnikId: muallimKorisnik.id },
      });

      if (muallimUcenik) {
        await prisma.skolaHifzaMuallim.upsert({
          where: {
            skolaHifzaId_muallimId: {
              skolaHifzaId: skolaHifza.id,
              muallimId: muallimUcenik.id,
            },
          },
          update: {},
          create: {
            skolaHifzaId: skolaHifza.id,
            muallimId: muallimUcenik.id,
          },
        });
      }
    }

    // Dodaj učenike u Školu Hifza (neki učenici iz različitih grupa)
    let dodanoUcenika = 0;
    for (const [grupaId, ucenici] of uceniciMap.entries()) {
      if (dodanoUcenika >= 20) break; // Maksimalno 20 učenika

      const muallimUcenik = await prisma.ucenik.findUnique({
        where: { korisnikId: skolaHifzaMuallimi[0].id },
      });

      if (muallimUcenik) {
        for (let i = 0; i < Math.min(3, ucenici.length); i++) {
          const ucenikId = ucenici[i];
          const napredak: Record<string, number[]> = {};
          const nekeSure = skolaHifzaLekcije.slice(0, 5);
          for (const sura of nekeSure) {
            napredak[sura.naslov] = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => i + 1);
          }

          await prisma.skolaHifzaUcenik.upsert({
            where: {
              skolaHifzaId_ucenikId: {
                skolaHifzaId: skolaHifza.id,
                ucenikId,
              },
            },
            update: {},
            create: {
              skolaHifzaId: skolaHifza.id,
              ucenikId,
              muallimId: muallimUcenik.id,
              napredak,
            },
          });

          dodanoUcenika++;
        }
      }
    }

    // Kreiraj časove za Školu Hifza
    const skolaHifzaGrupe = grupeMap.get(skolaHifzaRazredNG[1]) || [];
    if (skolaHifzaGrupe.length > 0) {
      const skolaHifzaGrupa = skolaHifzaGrupe[0];
      const rasporedId = rasporediMap.get(skolaHifzaGrupa.id);

      if (rasporedId) {
        const skolaHifzaUcenici = await prisma.skolaHifzaUcenik.findMany({
          where: { skolaHifzaId: skolaHifza.id },
        });

        for (let tjedan = 0; tjedan < 4; tjedan++) {
          const { subota, nedjelja } = getSubotaNedjeljaDates(tjedan);

          const casSubota = await prisma.skolaHifzaCas.create({
            data: {
              skolaHifzaId: skolaHifza.id,
              slotId: rasporedId,
              datum: subota,
              napomena: Math.random() > 0.7 ? 'Napomena za Školu Hifza' : null,
              napredak: {},
              komentari: {},
            },
          });

          // Kreiraj prisustva za subotu
          for (const shUcenik of skolaHifzaUcenici) {
            const rand = Math.random();
            let status: StatusPrisustva;
            if (rand < 0.8) {
              status = StatusPrisustva.PRISUTAN;
            } else if (rand < 0.9) {
              status = StatusPrisustva.OPRAVDAN;
            } else {
              status = StatusPrisustva.NEOPRAVDAN;
            }

            await prisma.skolaHifzaPrisustvo.create({
              data: {
                casId: casSubota.id,
                ucenikId: shUcenik.ucenikId,
                status,
                napomena: status !== StatusPrisustva.PRISUTAN && Math.random() > 0.5 ? 'Razlog odsutnosti' : null,
              },
            });
          }

          const casNedjelja = await prisma.skolaHifzaCas.create({
            data: {
              skolaHifzaId: skolaHifza.id,
              slotId: rasporedId,
              datum: nedjelja,
              napomena: Math.random() > 0.7 ? 'Napomena za Školu Hifza' : null,
              napredak: {},
              komentari: {},
            },
          });

          // Kreiraj prisustva za nedjelju
          for (const shUcenik of skolaHifzaUcenici) {
            const rand = Math.random();
            let status: StatusPrisustva;
            if (rand < 0.8) {
              status = StatusPrisustva.PRISUTAN;
            } else if (rand < 0.9) {
              status = StatusPrisustva.OPRAVDAN;
            } else {
              status = StatusPrisustva.NEOPRAVDAN;
            }

            await prisma.skolaHifzaPrisustvo.create({
              data: {
                casId: casNedjelja.id,
                ucenikId: shUcenik.ucenikId,
                status,
                napomena: status !== StatusPrisustva.PRISUTAN && Math.random() > 0.5 ? 'Razlog odsutnosti' : null,
              },
            });
          }
        }
      }
    }

    console.log(`✅ Škola Hifza: ${dodanoUcenika} učenika, ${skolaHifzaMuallimi.length} muallima\n`);
  }

  console.log('\n🎉 Seeding završen!');
  console.log('\n📊 Statistika:');
  console.log(`   - Razredi: ${sviRazredi.length}`);
  console.log(`   - Muallimi: ${kreiraniMuallimi.length}`);
  console.log(`   - Nastavna godina: ${nastavnaGodina.naziv}`);
  console.log(`   - Razredi u nastavnoj godini: ${razredNastavnaGodinaMap.size}`);
  console.log(`   - Grupe: ${Array.from(grupeMap.values()).flat().length}`);
  console.log(`   - Rasporedi: ${rasporediMap.size}`);
  console.log(`   - Učenici: ${ukupnoUcenika}`);
  console.log(`   - Časovi: ${ukupnoCasova}`);
  console.log(`   - Prisustva: ${ukupnoPrisustva}`);
  console.log(`   - Ocjene: ${ukupnoOcjena}`);
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@emekteb.ba / password123 / PIN: 0000');
  console.log('   Muallimi: email@emekteb.ba / password123 / PIN: xxxx');
  console.log('   Učenici: ime.prezime.@emekteb.ba / password123 / PIN: xxxx');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
