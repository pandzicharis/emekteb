import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Creating test parent account...\n');

  // Pronađi prvog učenika u bazi
  const prviUcenik = await prisma.ucenik.findFirst({
    include: {
      korisnik: true,
    },
  });

  if (!prviUcenik || !prviUcenik.korisnik || !prviUcenik.korisnik.email) {
    console.error('❌ Nema učenika u bazi. Prvo pokrenite seed: npm run prisma:seed');
    return;
  }

  const ucenikEmail = prviUcenik.korisnik.email; // Email djeteta (npr. ahmed.hasanovic@emekteb.ba)
  // Email roditelja u bazi: r.ime.prezime@emekteb.ba
  const emailParts = ucenikEmail.split('@');
  const roditeljEmail = emailParts.length === 2 ? `r.${emailParts[0]}@${emailParts[1]}` : `r.${ucenikEmail}`;
  const password = 'password123';
  const ime = 'Roditelj';
  const prezime = prviUcenik.korisnik.prezime || 'Test';

  console.log(`📧 Email djeteta: ${ucenikEmail}`);
  console.log(`📧 Email roditelja u bazi: ${roditeljEmail}`);
  console.log(`👤 Dijete: ${prviUcenik.korisnik.ime} ${prviUcenik.korisnik.prezime}\n`);

  // Check if parent user already exists
  const existingParent = await prisma.korisnik.findFirst({
    where: {
      email: roditeljEmail,
      uloga: 'RODITELJ',
    },
  });

  if (existingParent) {
    console.log('⚠️  Roditelj korisnik već postoji. Updating...');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.korisnik.update({
      where: { id: existingParent.id },
      data: {
        ime,
        prezime,
        lozinka: hashedPassword,
        aktivan: true,
      },
    });
    
    console.log('✅ Test parent account updated successfully!');
  } else {
    // Create new parent user with roditelj. prefix
    const hashedPassword = await bcrypt.hash(password, 10);
    const parentUser = await prisma.korisnik.create({
      data: {
        email: roditeljEmail,
        ime,
        prezime,
        lozinka: hashedPassword,
        uloga: 'RODITELJ',
        aktivan: true,
      },
    });

    console.log('✅ Test parent account created successfully!');
    console.log(`   ID: ${parentUser.id}`);
  }

  // Provjeri da li postoji Roditelj zapis za ovog učenika
  const roditeljZapis = await prisma.roditelj.findFirst({
    where: {
      ucenikId: prviUcenik.id,
    },
  });

  if (!roditeljZapis) {
    console.log('\n📝 Kreiranje Roditelj zapisa...');
    
    // Koristi isti email kao u Korisnik tabeli
    
    // Kreiraj majku
    await prisma.roditelj.create({
      data: {
        ucenikId: prviUcenik.id,
        tip: 'MAJKA',
        imePrezime: 'Majka Test',
        email: roditeljEmail,
        mobitel: '+38761123456',
      },
    });

    // Kreiraj oca
    await prisma.roditelj.create({
      data: {
        ucenikId: prviUcenik.id,
        tip: 'OTAC',
        imePrezime: 'Otac Test',
        email: roditeljEmail,
        mobitel: '+38762123456',
      },
    });

    console.log('✅ Roditelj zapisi kreirani!');
  }

  console.log('\n📋 Login credentials:');
  console.log(`   Email za login: ${ucenikEmail} (email djeteta)`);
  console.log(`   Password: ${password}`);
  console.log(`   Uloga: RODITELJ`);
  console.log(`\n💡 Roditelj se loguje sa email-om djeteta (${ucenikEmail})`);
  console.log(`   Sistem automatski pronalazi roditelja i prikazuje sve učenike povezane sa istim roditeljem.\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

