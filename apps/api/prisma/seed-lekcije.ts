import { PrismaClient, TipLekcije } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed lekcija za sve razrede
 * Kreira različite lekcije za različite razrede i tipove (Ilmihal, Kuran, Sufara)
 */
async function main() {
  console.log('🌱 Seeding lekcije za sve razrede...');

  // Pronađi sve razrede
  const razredi = await prisma.razred.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  if (razredi.length === 0) {
    console.log('❌ Nema razreda. Prvo pokreni seed-nastavni-plan.ts');
    return;
  }

  console.log(`✅ Pronađeno ${razredi.length} razreda\n`);

  let ukupnoLekcija = 0;
  let novihLekcija = 0;
  let novihPovezivanja = 0;

  // Definiši lekcije po razredima
  const lekcijePoRazredu: Record<string, Array<{
    naslov: string;
    opis: string;
    tip: TipLekcije;
    tezina: number;
  }>> = {
    'Razred 1': [
      { naslov: 'Uvod u Islam', opis: 'Osnovni pojmovi i uvodi u islamsku vjeru', tip: TipLekcije.ILMIHAL, tezina: 1 },
      { naslov: 'Taharet', opis: 'Čistoća i abdest', tip: TipLekcije.ILMIHAL, tezina: 1 },
      { naslov: 'Namaz - Osnove', opis: 'Osnovni dijelovi namaza', tip: TipLekcije.ILMIHAL, tezina: 2 },
      { naslov: 'Elif-Ba - Slova', opis: 'Učenje arapskih slova', tip: TipLekcije.SUFARA, tezina: 1 },
      { naslov: 'Elif-Ba - Osnovni znakovi', opis: 'Osnovni znakovi u arapskom pismu', tip: TipLekcije.SUFARA, tezina: 1 },
      { naslov: 'Kratke sure - Al-Fatiha', opis: 'Učenje sure Al-Fatiha', tip: TipLekcije.KURAN, tezina: 1 },
      { naslov: 'Kratke sure - Al-Ihlas', opis: 'Učenje sure Al-Ihlas', tip: TipLekcije.KURAN, tezina: 1 },
    ],
    'Razred 2': [
      { naslov: 'Namaz - Dnevni namazi', opis: 'Učenje dnevnih namaza', tip: TipLekcije.ILMIHAL, tezina: 2 },
      { naslov: 'Zikr i du\'a', opis: 'Učenje zikra i du\'a', tip: TipLekcije.ILMIHAL, tezina: 2 },
      { naslov: 'Ramazan i post', opis: 'Učenje o Ramazanu i postu', tip: TipLekcije.ILMIHAL, tezina: 2 },
      { naslov: 'Kratke sure - Al-Falaq', opis: 'Učenje sure Al-Falaq', tip: TipLekcije.KURAN, tezina: 2 },
      { naslov: 'Kratke sure - An-Nas', opis: 'Učenje sure An-Nas', tip: TipLekcije.KURAN, tezina: 2 },
      { naslov: 'Čitanje - Osnovni tekstovi', opis: 'Osnovno čitanje arapskog teksta', tip: TipLekcije.SUFARA, tezina: 2 },
    ],
    'Razred 3': [
      { naslov: 'Namaz - Džuma namaz', opis: 'Učenje džuma namaza', tip: TipLekcije.ILMIHAL, tezina: 3 },
      { naslov: 'Zekat', opis: 'Učenje o zekatu', tip: TipLekcije.ILMIHAL, tezina: 3 },
      { naslov: 'Hadž', opis: 'Učenje o hadžu', tip: TipLekcije.ILMIHAL, tezina: 3 },
      { naslov: 'Kratke sure - Al-Kafirun', opis: 'Učenje sure Al-Kafirun', tip: TipLekcije.KURAN, tezina: 3 },
      { naslov: 'Kratke sure - An-Nasr', opis: 'Učenje sure An-Nasr', tip: TipLekcije.KURAN, tezina: 3 },
      { naslov: 'Čitanje - Srednji tekstovi', opis: 'Srednje teško čitanje', tip: TipLekcije.SUFARA, tezina: 3 },
    ],
    'Razred 4': [
      { naslov: 'Akaid - Osnovni vjerovanja', opis: 'Osnovna vjerovanja u Islamu', tip: TipLekcije.ILMIHAL, tezina: 4 },
      { naslov: 'Akaid - Allah i Njegova svojstva', opis: 'Učenje o Allahu i Njegovim svojstvima', tip: TipLekcije.ILMIHAL, tezina: 4 },
      { naslov: 'Akaid - Meleki', opis: 'Učenje o melekima', tip: TipLekcije.ILMIHAL, tezina: 4 },
      { naslov: 'Kratke sure - Al-Masad', opis: 'Učenje sure Al-Masad', tip: TipLekcije.KURAN, tezina: 4 },
      { naslov: 'Kratke sure - Al-Ihlas', opis: 'Ponavljanje sure Al-Ihlas', tip: TipLekcije.KURAN, tezina: 4 },
      { naslov: 'Čitanje - Teži tekstovi', opis: 'Teže čitanje arapskog teksta', tip: TipLekcije.SUFARA, tezina: 4 },
    ],
    'Razred 5': [
      { naslov: 'Akaid - Knjige i Poslanici', opis: 'Učenje o svetim knjigama i poslanicima', tip: TipLekcije.ILMIHAL, tezina: 5 },
      { naslov: 'Akaid - Kijamet', opis: 'Učenje o kijametu', tip: TipLekcije.ILMIHAL, tezina: 5 },
      { naslov: 'Akaid - Sudnji dan', opis: 'Učenje o sudnjem danu', tip: TipLekcije.ILMIHAL, tezina: 5 },
      { naslov: 'Srednje sure - Al-Kevser', opis: 'Učenje sure Al-Kevser', tip: TipLekcije.KURAN, tezina: 5 },
      { naslov: 'Srednje sure - Al-Maun', opis: 'Učenje sure Al-Maun', tip: TipLekcije.KURAN, tezina: 5 },
      { naslov: 'Čitanje - Napredni tekstovi', opis: 'Napredno čitanje', tip: TipLekcije.SUFARA, tezina: 5 },
    ],
    'Razred 6': [
      { naslov: 'Fiqh - Čistoća', opis: 'Detaljno o čistoći u Islamu', tip: TipLekcije.ILMIHAL, tezina: 6 },
      { naslov: 'Fiqh - Namaz - Detalji', opis: 'Detaljno o namazu', tip: TipLekcije.ILMIHAL, tezina: 6 },
      { naslov: 'Fiqh - Post', opis: 'Detaljno o postu', tip: TipLekcije.ILMIHAL, tezina: 6 },
      { naslov: 'Srednje sure - Al-Fil', opis: 'Učenje sure Al-Fil', tip: TipLekcije.KURAN, tezina: 6 },
      { naslov: 'Srednje sure - Kurejš', opis: 'Učenje sure Kurejš', tip: TipLekcije.KURAN, tezina: 6 },
      { naslov: 'Čitanje - Ekspertni tekstovi', opis: 'Ekspertno čitanje', tip: TipLekcije.SUFARA, tezina: 6 },
    ],
    'Razred 7': [
      { naslov: 'Fiqh - Zekat - Detalji', opis: 'Detaljno o zekatu', tip: TipLekcije.ILMIHAL, tezina: 7 },
      { naslov: 'Fiqh - Hadž - Detalji', opis: 'Detaljno o hadžu', tip: TipLekcije.ILMIHAL, tezina: 7 },
      { naslov: 'Fiqh - Trgovina i poslovanje', opis: 'Islamsko poslovanje', tip: TipLekcije.ILMIHAL, tezina: 7 },
      { naslov: 'Duže sure - Al-Humaza', opis: 'Učenje sure Al-Humaza', tip: TipLekcije.KURAN, tezina: 7 },
      { naslov: 'Duže sure - At-Tekasur', opis: 'Učenje sure At-Tekasur', tip: TipLekcije.KURAN, tezina: 7 },
      { naslov: 'Tefsir - Osnovni', opis: 'Osnovni tefsir', tip: TipLekcije.KURAN, tezina: 7 },
    ],
    'Razred 8': [
      { naslov: 'Fiqh - Brak i porodica', opis: 'Islamski brak i porodica', tip: TipLekcije.ILMIHAL, tezina: 8 },
      { naslov: 'Fiqh - Nasljedstvo', opis: 'Pravila nasljedstva', tip: TipLekcije.ILMIHAL, tezina: 8 },
      { naslov: 'Fiqh - Kazne', opis: 'Islamski kazneni sistem', tip: TipLekcije.ILMIHAL, tezina: 8 },
      { naslov: 'Duže sure - Al-Asr', opis: 'Učenje sure Al-Asr', tip: TipLekcije.KURAN, tezina: 8 },
      { naslov: 'Duže sure - Al-Kadr', opis: 'Učenje sure Al-Kadr', tip: TipLekcije.KURAN, tezina: 8 },
      { naslov: 'Tefsir - Srednji', opis: 'Srednji tefsir', tip: TipLekcije.KURAN, tezina: 8 },
    ],
    'Razred 9': [
      { naslov: 'Fiqh - Džihad', opis: 'Učenje o džihadu', tip: TipLekcije.ILMIHAL, tezina: 9 },
      { naslov: 'Fiqh - Halal i Haram', opis: 'Detaljno o halalu i haramu', tip: TipLekcije.ILMIHAL, tezina: 9 },
      { naslov: 'Fiqh - Savremeni izazovi', opis: 'Savremeni izazovi u fiqhu', tip: TipLekcije.ILMIHAL, tezina: 9 },
      { naslov: 'Duže sure - Al-Bejjina', opis: 'Učenje sure Al-Bejjina', tip: TipLekcije.KURAN, tezina: 9 },
      { naslov: 'Duže sure - Al-Zilzal', opis: 'Učenje sure Al-Zilzal', tip: TipLekcije.KURAN, tezina: 9 },
      { naslov: 'Tefsir - Napredni', opis: 'Napredni tefsir', tip: TipLekcije.KURAN, tezina: 9 },
    ],
  };

  // Za svaki razred
  for (const razred of razredi) {
    const lekcijeZaRazred = lekcijePoRazredu[razred.name] || [];

    if (lekcijeZaRazred.length === 0) {
      console.log(`⚠️  Nema definisanih lekcija za ${razred.name}`);
      continue;
    }

    console.log(`📖 Razred: ${razred.name}`);

    let redoslijed = 1;

    // Za svaku lekciju
    for (const lekcijaData of lekcijeZaRazred) {
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
            redoslijed: redoslijed,
            aktivan: true,
          },
        });
        novihLekcija++;
        console.log(`  ✅ Kreirana lekcija: ${lekcijaData.naslov} (${lekcijaData.tip})`);
      } else {
        // Ažuriraj redoslijed ako je potrebno
        if (lekcija.redoslijed !== redoslijed) {
          await prisma.lekcija.update({
            where: { id: lekcija.id },
            data: { redoslijed: redoslijed },
          });
        }
        console.log(`  ℹ️  Lekcija već postoji: ${lekcijaData.naslov}`);
      }

      // Poveži lekciju sa razredom
      const postojecaPovezanost = await prisma.razredLekcija.findUnique({
        where: {
          razredId_lekcijaId: {
            razredId: razred.id,
            lekcijaId: lekcija.id,
          },
        },
      });

      if (!postojecaPovezanost) {
        await prisma.razredLekcija.create({
          data: {
            razredId: razred.id,
            lekcijaId: lekcija.id,
          },
        });
        novihPovezivanja++;
      }

      redoslijed++;
      ukupnoLekcija++;
    }

    console.log(`  ✅ ${lekcijeZaRazred.length} lekcija za ${razred.name}\n`);
  }

  console.log('\n🎉 Seeding lekcija završen!');
  console.log(`📊 Statistika:`);
  console.log(`   - Ukupno lekcija: ${ukupnoLekcija}`);
  console.log(`   - Novih lekcija: ${novihLekcija}`);
  console.log(`   - Novih povezivanja: ${novihPovezivanja}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding lekcije:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

