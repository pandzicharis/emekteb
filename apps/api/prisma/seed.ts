import { Ilmihal, PrismaClient, Uloga } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password za sve korisnike
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Kreiraj ADMIN korisnika
  const admin = await prisma.korisnik.upsert({
    where: { email: 'admin@emekteb.ba' },
    update: {},
    create: {
      email: 'admin@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Admin',
      prezime: 'Korisnik',
      uloga: Uloga.ADMIN,
      aktivan: true,
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

  console.log('🎉 Seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('Admin: admin@emekteb.ba / password123');
  console.log('Muallim 1: muallim1@emekteb.ba / password123');
  console.log('Muallim 2: muallim2@emekteb.ba / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

