import { PrismaClient, TipLekcije } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Brisanje veza između razreda i lekcija (KURAN i SUFARA)...\n');

  try {
    // Pronađi sve lekcije tipa KURAN i SUFARA
    const kuranSufaraLekcije = await prisma.lekcija.findMany({
      where: {
        tip: {
          in: [TipLekcije.KURAN, TipLekcije.SUFARA],
        },
      },
      select: {
        id: true,
        naslov: true,
        tip: true,
      },
    });

    console.log(`📚 Pronađeno ${kuranSufaraLekcije.length} lekcija (KURAN i SUFARA):`);
    kuranSufaraLekcije.forEach((lekcija) => {
      console.log(`   - ${lekcija.naslov} (${lekcija.tip})`);
    });

    if (kuranSufaraLekcije.length === 0) {
      console.log('\n⚠️  Nema lekcija tipa KURAN ili SUFARA. Nema šta brisati.');
      return;
    }

    const lekcijaIds = kuranSufaraLekcije.map((l) => l.id);

    // Pronađi sve veze između razreda i ovih lekcija
    const veze = await prisma.razredLekcija.findMany({
      where: {
        lekcijaId: {
          in: lekcijaIds,
        },
      },
      include: {
        razred: {
          select: {
            name: true,
          },
        },
        lekcija: {
          select: {
            naslov: true,
            tip: true,
          },
        },
      },
    });

    console.log(`\n🔗 Pronađeno ${veze.length} veza između razreda i lekcija (KURAN/SUFARA):`);

    // Grupiši po razredu za bolji pregled
    const vezePoRazredu: Record<string, number> = {};
    veze.forEach((veza) => {
      const razredName = veza.razred.name;
      vezePoRazredu[razredName] = (vezePoRazredu[razredName] || 0) + 1;
    });

    Object.entries(vezePoRazredu).forEach(([razredName, count]) => {
      console.log(`   - ${razredName}: ${count} veza`);
    });

    if (veze.length === 0) {
      console.log('\n⚠️  Nema veza za brisanje.');
      return;
    }

    // Obriši sve veze
    const result = await prisma.razredLekcija.deleteMany({
      where: {
        lekcijaId: {
          in: lekcijaIds,
        },
      },
    });

    console.log(`\n✅ Uspešno obrisano ${result.count} veza između razreda i lekcija (KURAN/SUFARA)`);
    console.log('\n💡 Napomena: Lekcije su ostale u bazi, samo su veze obrisane.');
    console.log('   Veze će se kreirati tek kada se lekcije dodjeljuju razredima u nastavnom planu.\n');
  } catch (error) {
    console.error('❌ Greška pri brisanju veza:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error removing connections:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





