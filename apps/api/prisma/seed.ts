import { Ilmihal, PrismaClient, TipLekcije, Uloga } from '@prisma/client';
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

  const razredRecords = await prisma.razred.findMany();
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

