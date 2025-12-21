import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding grupe...');

  // Pronađi aktivnu nastavnu godinu
  const nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: {
      status: 'ACTIVE',
    },
    orderBy: {
      kreiran: 'desc',
    },
  });

  if (!nastavnaGodina) {
    console.error('❌ Nema aktivne nastavne godine. Prvo kreiraj nastavnu godinu.');
    return;
  }

  console.log(`✅ Pronađena aktivna nastavna godina: ${nastavnaGodina.naziv}`);

  // Pronađi muallima (Muhidin Topcagic)
  const muallimKorisnik = await prisma.korisnik.findUnique({
    where: { email: 'muhidin.topcagic@emekteb.ba' },
    include: {
      ucenik: true,
    },
  });

  if (!muallimKorisnik || !muallimKorisnik.ucenik) {
    console.error('❌ Nema muallima. Prvo pokreni seed.ts');
    return;
  }

  const muallimId = muallimKorisnik.ucenik.id;
  console.log(`✅ Pronađen muallim: ${muallimKorisnik.ime} ${muallimKorisnik.prezime}`);

  // Pronađi sve razrede
  const razredi = await prisma.razred.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  const razredByName: Record<string, string> = {};
  razredi.forEach((r) => {
    razredByName[r.name] = r.id;
  });

  // Pronađi ili kreiraj razredNastavnaGodina za svaki razred
  const razredNastavnaGodinaRecords: Array<{
    id: string;
    razredId: string;
    razredName: string;
  }> = [];

  for (const razredRecord of razredi) {
    let razredNG = await prisma.razredNastavnaGodina.findFirst({
      where: {
        nastavnaGodinaId: nastavnaGodina.id,
        razredId: razredRecord.id,
      },
    });

    if (!razredNG) {
      // Ako nema razredNastavnaGodina, kreiraj ga
      razredNG = await prisma.razredNastavnaGodina.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredId: razredRecord.id,
          muallimId: muallimId,
          split: true, // Svi razredi su podijeljeni u grupe
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

  // Kreiraj grupe za svaki razred ako ne postoje (A i B)
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
      console.log(`✅ Kreirana grupa A za ${razredNG.razredName}`);
    } else {
      console.log(`ℹ️  Grupa A već postoji za ${razredNG.razredName}`);
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
      console.log(`✅ Kreirana grupa B za ${razredNG.razredName}`);
    } else {
      console.log(`ℹ️  Grupa B već postoji za ${razredNG.razredName}`);
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

  console.log('\n✅ Grupe A i B kreirane sa slotovima za sve razrede');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding grupe:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

