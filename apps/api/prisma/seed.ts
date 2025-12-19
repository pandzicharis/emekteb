import { Ilmihal, PrismaClient, StatusNastavneGodine, TipLekcije, Uloga } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password za sve korisnike
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Kreiraj ADMIN korisnika
  const admin = await prisma.korisnik.upsert({
    where: { email: 'admin@emekteb.ba' },
    update: {
      pin: '0000',
    },
    create: {
      email: 'admin@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Admin',
      prezime: 'Korisnik',
      uloga: Uloga.ADMIN,
      aktivan: true,
      pin: '0000',
    },
  });

  console.log('✅ Admin korisnik kreiran:', admin.email);

  // Kreiraj 2 MUALLIM korisnika
  const muallim1 = await prisma.korisnik.upsert({
    where: { email: 'muallim1@emekteb.ba' },
    update: {},
    create: {
      email: 'muallim1@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Muallim',
      prezime: 'Prvi',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1234',
    },
  });

  console.log('✅ Muallim 1 kreiran:', muallim1.email);

  const muallim2 = await prisma.korisnik.upsert({
    where: { email: 'muallim2@emekteb.ba' },
    update: {},
    create: {
      email: 'muallim2@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Muallim',
      prezime: 'Drugi',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1235',
    },
  });

  console.log('✅ Muallim 2 kreiran:', muallim2.email);

  // Kreiraj ili osvježi razrede 1-9
  const razredi = Array.from({ length: 9 }, (_, index) => {
    const broj = index + 1;
    let ilmihal: Ilmihal;

    if (broj <= 3) {
      ilmihal = Ilmihal.ILMIHAL_I;
    } else if (broj <= 6) {
      ilmihal = Ilmihal.ILMIHAL_II;
    } else {
      ilmihal = Ilmihal.ILMIHAL_III;
    }

    return {
      name: `Razred ${broj}`,
      ilmihal,
    };
  });

  for (const razred of razredi) {
    await prisma.razred.upsert({
      where: { name: razred.name },
      update: { ilmihal: razred.ilmihal, status: true },
      create: { name: razred.name, ilmihal: razred.ilmihal, status: true },
    });
  }

  console.log('✅ Razredi 1-9 su postavljeni sa odgovarajućim ilmihalom');

  const razredRecords = await prisma.razred.findMany({
    orderBy: {
      name: 'asc', // Sortiraj po nazivu da bi bili 1, 2, 3, ... 9
    },
  });
  const razredByName = Object.fromEntries(razredRecords.map((r) => [r.name, r.id]));

  const kuranLekcije = [
    'Uvod u Kur\'an',
    'Sura El-Fatiha',
    'Sura El-Ihlas',
    'Sura El-Felek',
    'Sura En-Nas',
    'Sura El-Kevser',
    'Sura El-Maun',
    'Sura El-Asr',
    'Sura El-Kafirun',
    'Sura En-Nasr',
    'Osnove tedžvida',
    'Duga vokalizacija (medd)',
    'Kratki vokali (harakāti)',
    'Sunnet i farz u kiraetu',
    'Izgovor harfova (muhredž)',
    'Teško izgovorljivi harfovi',
    'Stanka i nastavljanje (vakf)',
    'Pravila gunne',
    'Lam i ra pravila',
    'Primjena na surama za učenje',
  ];

  const sufaraLekcije = [
    'Upoznavanje sa arapskim pismom',
    'Harf Elif',
    'Harf Be',
    'Harf Te',
    'Harf Se',
    'Harf Džim',
    'Harf Ha',
    'Harf Kha',
    'Harf Dal',
    'Harf Zal',
    'Harf Ra',
    'Harf Ze',
    'Harf Sin',
    'Harf Šin',
    'Harf Sad',
    'Harf Dad',
    'Harf Ta',
    'Harf Za',
    'Harf Ajin',
    'Harf Gajin',
  ];

  async function upsertLekcijaWithRazredi(
    naslov: string,
    tip: TipLekcije,
    opis: string,
    redoslijed: number,
    tezina: number,
    razredi: string[]
  ) {
    const existing = await prisma.lekcija.findFirst({ where: { naslov, tip } });
    const lekcija = existing
      ? await prisma.lekcija.update({
          where: { id: existing.id },
          data: { opis, redoslijed, tezina, aktivan: true },
        })
      : await prisma.lekcija.create({
          data: { naslov, opis, redoslijed, tezina, aktivan: true, tip },
        });

    for (const razredName of razredi) {
      const razredId = razredByName[razredName];
      if (!razredId) continue;
      await prisma.razredLekcija.upsert({
        where: { razredId_lekcijaId: { razredId, lekcijaId: lekcija.id } },
        update: {},
        create: { razredId, lekcijaId: lekcija.id },
      });
    }
  }

  const sufaraRazredi = ['Razred 1', 'Razred 2', 'Razred 3'];
  const kuranRazredi = ['Razred 4', 'Razred 5', 'Razred 6', 'Razred 7', 'Razred 8', 'Razred 9'];

  for (let i = 0; i < kuranLekcije.length; i++) {
    const naslov = kuranLekcije[i];
    await upsertLekcijaWithRazredi(
      naslov,
      TipLekcije.KURAN,
      `Lekcija ${i + 1}: ${naslov}`,
      i + 1,
      1 + (i % 3),
      kuranRazredi
    );
  }

  for (let i = 0; i < sufaraLekcije.length; i++) {
    const naslov = sufaraLekcije[i];
    await upsertLekcijaWithRazredi(
      naslov,
      TipLekcije.SUFARA,
      `Lekcija ${i + 1}: ${naslov}`,
      i + 1,
      1 + (i % 3),
      sufaraRazredi
    );
  }

  console.log('✅ Dodate lekcije za Kur\'an i Sufaru');

  // Raspoređivanje učenika po razredima za trenutnu nastavnu godinu
  console.log('\n📚 Raspoređivanje učenika po razredima...');

  // 1. Osiguraj da muallimi imaju Ucenik zapise
  const muallimi = [muallim1, muallim2];
  const muallimUcenikIds: string[] = [];

  for (const muallim of muallimi) {
    let muallimUcenik = await prisma.ucenik.findUnique({
      where: { korisnikId: muallim.id },
    });

    if (!muallimUcenik) {
      muallimUcenik = await prisma.ucenik.create({
        data: {
          korisnikId: muallim.id,
        },
      });
    }
    muallimUcenikIds.push(muallimUcenik.id);
  }

  // 2. Pronađi ili kreiraj aktivnu nastavnu godinu
  let nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: { status: StatusNastavneGodine.ACTIVE },
  });

  if (!nastavnaGodina) {
    // Kreiraj nastavni plan ako ne postoji
    let nastavniPlan = await prisma.nastavniPlan.findFirst({
      where: { aktivan: true },
    });

    if (!nastavniPlan) {
      nastavniPlan = await prisma.nastavniPlan.create({
        data: {
          naziv: 'Osnovni nastavni plan',
          opis: 'Osnovni nastavni plan za mekteb',
          datumUsvajanja: new Date(),
          aktivan: true,
        },
      });
    }

    // Dodaj sve razrede u nastavni plan ako već nisu dodati
    const postojeciRazredi = await prisma.nastavniPlanRazred.findMany({
      where: { nastavniPlanId: nastavniPlan.id },
    });
    const postojeciRazredIds = new Set(postojeciRazredi.map(r => r.razredId));

    for (const razredRecord of razredRecords) {
      if (!postojeciRazredIds.has(razredRecord.id)) {
        await prisma.nastavniPlanRazred.create({
          data: {
            nastavniPlanId: nastavniPlan.id,
            razredId: razredRecord.id,
          },
        });
      }
    }

    // Kreiraj nastavnu godinu
    const sada = new Date();
    const pocetakGodine = new Date(sada.getFullYear(), 8, 1); // 1. septembar
    const krajGodine = new Date(sada.getFullYear() + 1, 5, 30); // 30. jun

    nastavnaGodina = await prisma.nastavnaGodina.create({
      data: {
        naziv: `${sada.getFullYear()}/${sada.getFullYear() + 1}`,
        opis: `Nastavna godina ${sada.getFullYear()}/${sada.getFullYear() + 1}`,
        datumOd: pocetakGodine,
        datumDo: krajGodine,
        nastavniPlanId: nastavniPlan.id,
        status: StatusNastavneGodine.ACTIVE,
      },
    });
  }

  // 3. Kreiraj RazredNastavnaGodina za sve razrede ako ne postoje
  const razredNastavnaGodinaRecords: { id: string; razredId: string; razredName: string }[] = [];

  for (const razredRecord of razredRecords) {
    let razredNG = await prisma.razredNastavnaGodina.findUnique({
      where: {
        nastavnaGodinaId_razredId: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredId: razredRecord.id,
        },
      },
    });

    if (!razredNG) {
      // Dodeli muallima naizmenično
      const muallimIndex = razredRecords.indexOf(razredRecord) % muallimUcenikIds.length;
      const muallimId = muallimUcenikIds[muallimIndex];

      razredNG = await prisma.razredNastavnaGodina.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredId: razredRecord.id,
          muallimId: muallimId,
        },
      });
    }

    razredNastavnaGodinaRecords.push({
      id: razredNG.id,
      razredId: razredNG.razredId,
      razredName: razredRecord.name,
    });
  }

  // Sortiraj razrede po nazivu (1, 2, 3, ... 9)
  razredNastavnaGodinaRecords.sort((a, b) => {
    const numA = parseInt(a.razredName.replace('Razred ', ''));
    const numB = parseInt(b.razredName.replace('Razred ', ''));
    return numA - numB;
  });

  // 4. Kreiraj grupe za svaki razred ako ne postoje (A i B)
  for (const razredNG of razredNastavnaGodinaRecords) {
    // Grupa A - Subota 9:00-10:00
    let grupaA = await prisma.grupa.findFirst({
      where: {
        razredNastavnaGodinaId: razredNG.id,
        naziv: 'A',
      },
    });

    if (!grupaA) {
      grupaA = await prisma.grupa.create({
        data: {
          razredNastavnaGodinaId: razredNG.id,
          naziv: 'A',
          kuran: razredNG.razredId === razredByName['Razred 4'] || 
                 razredNG.razredId === razredByName['Razred 5'] || 
                 razredNG.razredId === razredByName['Razred 6'] ||
                 razredNG.razredId === razredByName['Razred 7'] ||
                 razredNG.razredId === razredByName['Razred 8'] ||
                 razredNG.razredId === razredByName['Razred 9'],
          sufara: razredNG.razredId === razredByName['Razred 1'] || 
                  razredNG.razredId === razredByName['Razred 2'] || 
                  razredNG.razredId === razredByName['Razred 3'],
        },
      });
    }

    // Kreiraj slot za grupu A - Subota 9:00-10:00
    await prisma.raspored.upsert({
      where: { grupaId: grupaA.id },
      update: {
        dan: 'subota',
        slot: '09:00',
        trajanje: 60,
      },
      create: {
        grupaId: grupaA.id,
        dan: 'subota',
        slot: '09:00',
        trajanje: 60,
      },
    });

    // Grupa B - Nedjelja 10:00-11:00
    let grupaB = await prisma.grupa.findFirst({
      where: {
        razredNastavnaGodinaId: razredNG.id,
        naziv: 'B',
      },
    });

    if (!grupaB) {
      grupaB = await prisma.grupa.create({
        data: {
          razredNastavnaGodinaId: razredNG.id,
          naziv: 'B',
          kuran: razredNG.razredId === razredByName['Razred 4'] || 
                 razredNG.razredId === razredByName['Razred 5'] || 
                 razredNG.razredId === razredByName['Razred 6'] ||
                 razredNG.razredId === razredByName['Razred 7'] ||
                 razredNG.razredId === razredByName['Razred 8'] ||
                 razredNG.razredId === razredByName['Razred 9'],
          sufara: razredNG.razredId === razredByName['Razred 1'] || 
                  razredNG.razredId === razredByName['Razred 2'] || 
                  razredNG.razredId === razredByName['Razred 3'],
        },
      });
    }

    // Kreiraj slot za grupu B - Nedjelja 10:00-11:00
    await prisma.raspored.upsert({
      where: { grupaId: grupaB.id },
      update: {
        dan: 'nedjelja',
        slot: '10:00',
        trajanje: 60,
      },
      create: {
        grupaId: grupaB.id,
        dan: 'nedjelja',
        slot: '10:00',
        trajanje: 60,
      },
    });
  }

  console.log('✅ Grupe A i B kreirane sa slotovima za sve razrede');

  // 5. Pronađi sve učenike
  const sviUcenici = await prisma.ucenik.findMany({
    where: {
      korisnik: {
        uloga: Uloga.UCENIK,
      },
    },
  });

  if (sviUcenici.length > 0) {
    console.log(`📊 Pronađeno ${sviUcenici.length} učenika za raspoređivanje`);

    // 6. Rasporedi učenike proporcionalno po razredima
    const brojRazreda = razredNastavnaGodinaRecords.length;
    const ucenikaPoRazredu = Math.floor(sviUcenici.length / brojRazreda);
    const ostatak = sviUcenici.length % brojRazreda;

    // Mešaj učenike za random raspoređivanje
    const mesaniUcenici = [...sviUcenici].sort(() => Math.random() - 0.5);

    let ucenikIndex = 0;

    for (let i = 0; i < razredNastavnaGodinaRecords.length; i++) {
      const razredNG = razredNastavnaGodinaRecords[i];
      
      // Pronađi grupu za ovaj razred
      const grupa = await prisma.grupa.findFirst({
        where: {
          razredNastavnaGodinaId: razredNG.id,
          naziv: 'A',
        },
      });

      if (!grupa) {
        const razredName = razredRecords.find(r => r.id === razredNG.razredId)?.name || 'Nepoznat';
        console.warn(`⚠️  Grupa nije pronađena za razred ${razredName}`);
        continue;
      }

      // Broj učenika za ovaj razred (dodaj 1 za prvih 'ostatak' razreda)
      const brojUcenikaZaRazred = ucenikaPoRazredu + (i < ostatak ? 1 : 0);

      // Dodeli učenike ovom razredu
      for (let j = 0; j < brojUcenikaZaRazred && ucenikIndex < mesaniUcenici.length; j++) {
        const ucenik = mesaniUcenici[ucenikIndex];

        // Proveri da li učenik već nije dodeljen nekoj grupi u ovoj nastavnoj godini
        const postojecaDodela = await prisma.ucenikGrupa.findFirst({
          where: {
            ucenikId: ucenik.id,
            grupa: {
              razredNastavnaGodina: {
                nastavnaGodinaId: nastavnaGodina.id,
              },
            },
          },
        });

        if (!postojecaDodela) {
          await prisma.ucenikGrupa.upsert({
            where: {
              ucenikId_grupaId: {
                ucenikId: ucenik.id,
                grupaId: grupa.id,
              },
            },
            update: {},
            create: {
              ucenikId: ucenik.id,
              grupaId: grupa.id,
            },
          });
        }

        ucenikIndex++;
      }

      const razredName = razredRecords.find(r => r.id === razredNG.razredId)?.name || 'Nepoznat';
      console.log(`  ✅ ${razredName}: ${brojUcenikaZaRazred} učenika`);
    }

    console.log(`✅ Ukupno ${ucenikIndex} učenika raspoređeno u ${brojRazreda} razreda`);
  } else {
    console.log('ℹ️  Nema učenika za raspoređivanje');
  }

  console.log('🎉 Seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('Admin: admin@emekteb.ba / password123 / PIN: 0000');
  console.log('Muallim 1: muallim1@emekteb.ba / password123 / PIN: 1234');
  console.log('Muallim 2: muallim2@emekteb.ba / password123 / PIN: 1235');
  console.log('\n💡 Napomena: Admin korisnik također ima PIN za brzi login!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

