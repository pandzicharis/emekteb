import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Truncating all tables...');

  // Redosled brisanja je važan zbog foreign key constraint-a
  // Prvo brišemo tabele koje imaju foreign key-ove, pa onda one koje nemaju

  try {
    // Brisanje u zavisnosti od foreign key-ova
    // Prvo SkolaHifza tabele
    await prisma.skolaHifzaPrisustvo.deleteMany({});
    console.log('✅ Obrisana SkolaHifza prisustva');

    await prisma.skolaHifzaCas.deleteMany({});
    console.log('✅ Obrisani SkolaHifza časovi');

    await prisma.skolaHifzaUcenik.deleteMany({});
    console.log('✅ Obrisani SkolaHifza učenici');

    await prisma.skolaHifzaMuallim.deleteMany({});
    console.log('✅ Obrisani SkolaHifza muallimi');

    await prisma.skolaHifza.deleteMany({});
    console.log('✅ Obrisana SkolaHifza');

    await prisma.casOcjena.deleteMany({});
    console.log('✅ Obrisane ocjene');

    await prisma.casLekcija.deleteMany({});
    console.log('✅ Obrisane veze cas-lekcija');

    await prisma.casPrisustvo.deleteMany({});
    console.log('✅ Obrisano prisustvo');

    await prisma.cas.deleteMany({});
    console.log('✅ Obrisani časovi');

    await prisma.raspored.deleteMany({});
    console.log('✅ Obrisan raspored');

    await prisma.ucenikGrupa.deleteMany({});
    console.log('✅ Obrisane veze učenik-grupa');

    await prisma.grupa.deleteMany({});
    console.log('✅ Obrisane grupe');

    await prisma.razredNastavnaGodina.deleteMany({});
    console.log('✅ Obrisane veze razred-nastavna godina');

    await prisma.nastavniPlanRazredLekcija.deleteMany({});
    console.log('✅ Obrisane veze nastavni plan-razred-lekcija');

    await prisma.nastavniPlanRazred.deleteMany({});
    console.log('✅ Obrisane veze nastavni plan-razred');

    await prisma.roditelj.deleteMany({});
    console.log('✅ Obrisani roditelji');

    await prisma.kontakt.deleteMany({});
    console.log('✅ Obrisani kontakti');

    await prisma.obrazovanje.deleteMany({});
    console.log('✅ Obrisano obrazovanje');

    await prisma.ucenik.deleteMany({});
    console.log('✅ Obrisani učenici');

    await prisma.korisnik.deleteMany({});
    console.log('✅ Obrisani korisnici');

    await prisma.razredLekcija.deleteMany({});
    console.log('✅ Obrisane veze razred-lekcija');

    await prisma.lekcija.deleteMany({});
    console.log('✅ Obrisane lekcije');

    await prisma.nastavniPlan.deleteMany({});
    console.log('✅ Obrisani nastavni planovi');

    await prisma.razred.deleteMany({});
    console.log('✅ Obrisani razredi');

    await prisma.slobodanDan.deleteMany({});
    console.log('✅ Obrisani slobodni dani');

    await prisma.nastavnaGodina.deleteMany({});
    console.log('✅ Obrisane nastavne godine');

    await prisma.import.deleteMany({});
    console.log('✅ Obrisani import zapisi');

    console.log('\n✅ Sve tabele su uspješno obrisane!');
  } catch (error) {
    console.error('❌ Greška pri brisanju:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error truncating database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

