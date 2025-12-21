import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Dodavanje učenika u grupe...');

  // Pronađi aktivnu nastavnu godinu
  const nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: {
      status: 'ACTIVE',
    },
    include: {
      razredi: {
        include: {
          razred: true,
          grupe: {
            include: {
              ucenici: {
                include: {
                  ucenik: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!nastavnaGodina) {
    console.error('❌ Nema aktivne nastavne godine. Prvo pokreni seed-nastavna-godina.ts');
    return;
  }

  console.log(`✅ Pronađena aktivna nastavna godina: ${nastavnaGodina.naziv}`);

  // Pronađi sve aktivne učenike sa obrazovanjem
  const ucenici = await prisma.ucenik.findMany({
    where: {
      status: 'AKTIVAN',
      obrazovanje: {
        isNot: null,
      },
    },
    include: {
      obrazovanje: true,
      grupe: {
        include: {
          grupa: {
            include: {
              razredNastavnaGodina: {
                include: {
                  nastavnaGodina: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (ucenici.length === 0) {
    console.log('⚠️  Nema učenika sa obrazovanjem');
    return;
  }

  console.log(`✅ Pronađeno ${ucenici.length} učenika sa obrazovanjem`);

  // Mapiraj razrede po nazivu
  const razredMap: Record<string, string> = {};
  for (const razredNG of nastavnaGodina.razredi) {
    razredMap[razredNG.razred.name] = razredNG.id;
  }

  let dodano = 0;
  let vecPostoji = 0;
  let bezRazreda = 0;

  // Za svakog učenika
  for (const ucenik of ucenici) {
    const razredBroj = ucenik.obrazovanje?.razred;
    
    if (!razredBroj || razredBroj < 1 || razredBroj > 9) {
      bezRazreda++;
      continue;
    }

    const razredName = `Razred ${razredBroj}`;
    const razredNGId = razredMap[razredName];

    if (!razredNGId) {
      bezRazreda++;
      continue;
    }

    // Pronađi razredNastavnaGodina
    const razredNG = nastavnaGodina.razredi.find(rng => rng.id === razredNGId);
    if (!razredNG || razredNG.grupe.length === 0) {
      bezRazreda++;
      continue;
    }

    // Provjeri da li je učenik već u nekoj grupi ove nastavne godine
    const vecUGrupi = ucenik.grupe.some(ug => {
      return ug.grupa.razredNastavnaGodina.nastavnaGodina.id === nastavnaGodina.id;
    });

    if (vecUGrupi) {
      vecPostoji++;
      continue;
    }

    // Odaberi grupu (A ili B) - na osnovu broja učenika u grupama
    const grupaA = razredNG.grupe.find(g => g.naziv === 'A');
    const grupaB = razredNG.grupe.find(g => g.naziv === 'B');

    if (!grupaA || !grupaB) {
      bezRazreda++;
      continue;
    }

    // Broj učenika u grupama
    const brojUA = grupaA.ucenici.length;
    const brojUB = grupaB.ucenici.length;

    // Dodaj u grupu sa manje učenika (ili A ako su jednaki)
    const odabranaGrupa = brojUA <= brojUB ? grupaA : grupaB;

    try {
      await prisma.ucenikGrupa.create({
        data: {
          ucenikId: ucenik.id,
          grupaId: odabranaGrupa.id,
        },
      });
      dodano++;
    } catch (error) {
      // Možda već postoji (unique constraint)
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        vecPostoji++;
      } else {
        console.error(`⚠️  Greška pri dodavanju učenika ${ucenik.id} u grupu:`, error);
      }
    }
  }

  console.log('\n🎉 Dodavanje učenika u grupe završeno!');
  console.log(`📊 Statistika:`);
  console.log(`   - Dodano u grupe: ${dodano}`);
  console.log(`   - Već u grupama: ${vecPostoji}`);
  console.log(`   - Bez razreda ili grupe: ${bezRazreda}`);
}

main()
  .catch((e) => {
    console.error('❌ Error dodavanja učenika u grupe:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

