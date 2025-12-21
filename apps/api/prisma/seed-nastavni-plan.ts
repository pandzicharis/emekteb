import { PrismaClient, Ilmihal } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding nastavni plan...');

  // Provjeri da li razredi postoje, ako ne kreiraj ih
  const razrediNames = [
    'Razred 1',
    'Razred 2',
    'Razred 3',
    'Razred 4',
    'Razred 5',
    'Razred 6',
    'Razred 7',
    'Razred 8',
    'Razred 9',
  ];

  const razrediMap: Record<string, string> = {};

  for (const razredName of razrediNames) {
    let razred = await prisma.razred.findUnique({
      where: { name: razredName },
    });

    if (!razred) {
      // Odredi ilmihal na osnovu razreda
      let ilmihal: Ilmihal;
      if (razredName === 'Razred 1' || razredName === 'Razred 2' || razredName === 'Razred 3') {
        ilmihal = Ilmihal.ILMIHAL_I;
      } else if (razredName === 'Razred 4' || razredName === 'Razred 5' || razredName === 'Razred 6') {
        ilmihal = Ilmihal.ILMIHAL_II;
      } else {
        ilmihal = Ilmihal.ILMIHAL_III;
      }

      razred = await prisma.razred.create({
        data: {
          name: razredName,
          ilmihal: ilmihal,
          status: true,
        },
      });
      console.log(`✅ Kreiran razred: ${razredName}`);
    } else {
      console.log(`ℹ️  Razred već postoji: ${razredName}`);
    }

    razrediMap[razredName] = razred.id;
  }

  // Kreiraj nastavni plan
  let nastavniPlan = await prisma.nastavniPlan.findFirst({
    where: {
      naziv: 'Osnovni nastavni plan',
      aktivan: true,
    },
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
    console.log(`✅ Nastavni plan kreiran: ${nastavniPlan.naziv}`);
  } else {
    console.log(`ℹ️  Nastavni plan već postoji: ${nastavniPlan.naziv}`);
  }

  // Dodaj sve razrede u nastavni plan
  for (const razredName of razrediNames) {
    const razredId = razrediMap[razredName];

    const existing = await prisma.nastavniPlanRazred.findUnique({
      where: {
        nastavniPlanId_razredId: {
          nastavniPlanId: nastavniPlan.id,
          razredId: razredId,
        },
      },
    });

    if (!existing) {
      await prisma.nastavniPlanRazred.create({
        data: {
          nastavniPlanId: nastavniPlan.id,
          razredId: razredId,
        },
      });
    }
  }

  console.log(`✅ Svi razredi dodati u nastavni plan`);

  console.log('\n🎉 Seeding nastavnog plana završen!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding nastavni plan:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

