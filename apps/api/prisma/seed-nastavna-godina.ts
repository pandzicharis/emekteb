import { PrismaClient, StatusNastavneGodine } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding nastavna godina...');

  // Pronađi aktivni nastavni plan
  const nastavniPlan = await prisma.nastavniPlan.findFirst({
    where: {
      aktivan: true,
    },
    orderBy: {
      kreiran: 'desc',
    },
  });

  if (!nastavniPlan) {
    console.error('❌ Nema aktivnog nastavnog plana. Prvo pokreni seed-nastavni-plan.ts');
    return;
  }

  console.log(`✅ Pronađen nastavni plan: ${nastavniPlan.naziv}`);

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

  if (razredi.length === 0) {
    console.error('❌ Nema razreda. Prvo pokreni seed-nastavni-plan.ts');
    return;
  }

  console.log(`✅ Pronađeno ${razredi.length} razreda`);

  // Kreiraj nastavnu godinu za trenutnu školsku godinu
  const sada = new Date();
  const godina = sada.getFullYear();
  const mjesec = sada.getMonth() + 1; // 1-12

  // Školska godina počinje u septembru
  // Ako smo u januaru-avgustu, školska godina je počela u prošloj godini
  // Ako smo u septembru-decembru, školska godina je počela u ovoj godini
  let pocetnaGodina = godina;
  if (mjesec < 9) {
    pocetnaGodina = godina - 1;
  }

  const datumOd = new Date(pocetnaGodina, 8, 1); // 1. septembar
  const datumDo = new Date(pocetnaGodina + 1, 7, 31); // 31. august

  const nazivNastavneGodine = `${pocetnaGodina}/${pocetnaGodina + 1}`;

  // Provjeri da li već postoji aktivna nastavna godina
  let nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: {
      status: StatusNastavneGodine.ACTIVE,
    },
  });

  if (nastavnaGodina) {
    console.log(`ℹ️  Aktivna nastavna godina već postoji: ${nastavnaGodina.naziv}`);
    console.log('   Koristim postojeću nastavnu godinu...');
  } else {
    // Deaktiviraj sve postojeće nastavne godine
    await prisma.nastavnaGodina.updateMany({
      where: {
        status: StatusNastavneGodine.ACTIVE,
      },
      data: {
        status: StatusNastavneGodine.INACTIVE,
      },
    });

    // Kreiraj novu nastavnu godinu
    nastavnaGodina = await prisma.nastavnaGodina.create({
      data: {
        naziv: nazivNastavneGodine,
        opis: `Nastavna godina ${nazivNastavneGodine}`,
        datumOd: datumOd,
        datumDo: datumDo,
        nastavniPlanId: nastavniPlan.id,
        status: StatusNastavneGodine.ACTIVE,
      },
    });
    console.log(`✅ Kreirana nastavna godina: ${nastavnaGodina.naziv}`);
  }

  // Kreiraj RazredNastavnaGodina za svaki razred
  for (const razred of razredi) {
    const razredNG = await prisma.razredNastavnaGodina.findFirst({
      where: {
        nastavnaGodinaId: nastavnaGodina.id,
        razredId: razred.id,
      },
    });

    if (!razredNG) {
      await prisma.razredNastavnaGodina.create({
        data: {
          nastavnaGodinaId: nastavnaGodina.id,
          razredId: razred.id,
          muallimId: muallimId,
          split: true, // Svi razredi su podijeljeni u grupe
        },
      });
      console.log(`✅ Dodan razred ${razred.name} u nastavnu godinu`);
    } else {
      console.log(`ℹ️  Razred ${razred.name} već postoji u nastavnoj godini`);
    }
  }

  console.log('\n🎉 Seeding nastavne godine završen!');
  console.log(`📚 Aktivna nastavna godina: ${nastavnaGodina.naziv}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding nastavna godina:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

