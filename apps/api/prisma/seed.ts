import { PrismaClient, Uloga } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Kreiraj MUALLIM korisnika - Muhidin Topcagic
  const muallim = await prisma.korisnik.upsert({
    where: { email: 'muhidin.topcagic@emekteb.ba' },
    update: {
      lozinka: hashedPassword,
      ime: 'Muhidin',
      prezime: 'Topcagic',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1234',
    },
    create: {
      email: 'muhidin.topcagic@emekteb.ba',
      lozinka: hashedPassword,
      ime: 'Muhidin',
      prezime: 'Topcagic',
      uloga: Uloga.MUALLIM,
      aktivan: true,
      pin: '1234',
    },
  });

  console.log('✅ Muallim kreiran:', muallim.email);

  // Kreiraj Ucenik zapis za muallima (muallim je samo Ucenik sa ulogom MUALLIM)
  await prisma.ucenik.upsert({
    where: { korisnikId: muallim.id },
    update: {},
    create: {
      korisnikId: muallim.id,
    },
  });

  console.log('✅ Muallim Ucenik zapis kreiran');

  console.log('\n🎉 Seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('Muallim: muhidin.topcagic@emekteb.ba / password123 / PIN: 1234');
  console.log('\n💡 Napomena: Učenici će se automatski importovati pri pokretanju aplikacije iz CSV fajla.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
