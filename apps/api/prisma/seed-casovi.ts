import { PrismaClient, StatusPrisustva, TipCasa } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding casovi, prisustvo i ocjene...');

  // Pronađi aktivnu nastavnu godinu
  const nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      razredi: {
        include: {
          razred: true,
          grupe: {
            include: {
              raspored: true,
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
    console.log('❌ Nema aktivne nastavne godine');
    return;
  }

  console.log(`📚 Nastavna godina: ${nastavnaGodina.naziv}`);

  // Generiši datume za zadnja 3 mjeseca (subota i nedjelja)
  const sada = new Date();
  const datumi: Date[] = [];
  
  // Krećemo od 3 mjeseca unazad
  const pocetak = new Date(sada);
  pocetak.setMonth(pocetak.getMonth() - 3);
  
  // Generiši sve subote i nedjelje
  for (let d = new Date(pocetak); d <= sada; d.setDate(d.getDate() + 1)) {
    const dan = d.getDay();
    if (dan === 6 || dan === 0) { // Subota (6) ili Nedjelja (0)
      datumi.push(new Date(d));
    }
  }

  console.log(`📅 Generisano ${datumi.length} datuma za casove`);

  let ukupnoCasova = 0;
  let ukupnoPrisustva = 0;
  let ukupnoOcjena = 0;

  // Za svaki razred
  for (const razredNG of nastavnaGodina.razredi) {
    const razredName = razredNG.razred.name;
    console.log(`\n📖 Razred: ${razredName}`);

    // Pronađi lekcije za ovaj razred
    const razred = await prisma.razred.findUnique({
      where: { id: razredNG.razredId },
      include: {
        lekcije: {
          include: {
            lekcija: true,
          },
        },
      },
    });

    if (!razred) continue;

    const lekcije = razred.lekcije.map(rl => rl.lekcija);
    if (lekcije.length === 0) {
      console.log(`  ⚠️  Nema lekcija za ${razredName}`);
      continue;
    }

    // Za svaku grupu
    for (const grupa of razredNG.grupe) {
      if (!grupa.raspored) {
        console.log(`  ⚠️  Grupa ${grupa.naziv} nema raspored`);
        continue;
      }

      const danRasporeda = grupa.raspored.dan;
      const ucenici = grupa.ucenici.map(ug => ug.ucenik);

      if (ucenici.length === 0) {
        console.log(`  ⚠️  Grupa ${grupa.naziv} nema učenika`);
        continue;
      }

      console.log(`  👥 Grupa ${grupa.naziv}: ${ucenici.length} učenika`);

      // Filtriraj datume po danu rasporeda
      const relevantniDatumi = datumi.filter(d => {
        const dan = d.getDay();
        return (danRasporeda === 'subota' && dan === 6) || 
               (danRasporeda === 'nedjelja' && dan === 0);
      });

      // Kreiraj casove za relevantne datume
      for (const datum of relevantniDatumi) {
        // Preskoči ako je datum u budućnosti
        if (datum > sada) continue;

        // Provjeri da li cas već postoji
        const postojeciCas = await prisma.cas.findFirst({
          where: {
            grupaId: grupa.id,
            datum: {
              gte: new Date(datum.getFullYear(), datum.getMonth(), datum.getDate()),
              lt: new Date(datum.getFullYear(), datum.getMonth(), datum.getDate() + 1),
            },
          },
        });

        if (postojeciCas) {
          continue; // Preskoči ako već postoji
        }

        // Odaberi 1-3 lekcije za ovaj cas (random)
        const brojLekcija = Math.floor(Math.random() * 3) + 1;
        const odabraneLekcije = [...lekcije]
          .sort(() => Math.random() - 0.5)
          .slice(0, brojLekcija);

        // Kreiraj cas
        const cas = await prisma.cas.create({
          data: {
            nastavnaGodinaId: nastavnaGodina.id,
            razredNastavnaGodinaId: razredNG.id,
            grupaId: grupa.id,
            rasporedId: grupa.raspored.id,
            datum: datum,
            tipovi: [TipCasa.LEKCIJA],
            napomena: null,
          },
        });

        ukupnoCasova++;

        // Dodaj lekcije u cas
        for (const lekcija of odabraneLekcije) {
          await prisma.casLekcija.create({
            data: {
              casId: cas.id,
              lekcijaId: lekcija.id,
            },
          });
        }

        // Kreiraj prisustvo za sve učenike
        for (const ucenik of ucenici) {
          // Random status prisustva (80% prisutan, 15% opravdan, 5% neopravdan)
          const rand = Math.random();
          let status: StatusPrisustva;
          if (rand < 0.8) {
            status = StatusPrisustva.PRISUTAN;
          } else if (rand < 0.95) {
            status = StatusPrisustva.OPRAVDAN;
          } else {
            status = StatusPrisustva.NEOPRAVDAN;
          }

          await prisma.casPrisustvo.create({
            data: {
              casId: cas.id,
              ucenikId: ucenik.id,
              status: status,
              napomena: status === StatusPrisustva.OPRAVDAN ? 'Opravdan izostanak' : null,
            },
          });

          ukupnoPrisustva++;

          // Kreiraj ocjene samo za prisutne učenike
          if (status === StatusPrisustva.PRISUTAN) {
            for (const lekcija of odabraneLekcije) {
              // 70% šanse da dobije ocjenu
              if (Math.random() < 0.7) {
                // Random ocjena između 2 i 5, sa većom vjerovatnoćom za bolje ocjene
                const rand = Math.random();
                let ocjena: number;
                if (rand < 0.3) {
                  ocjena = 5; // 30% šanse za 5
                } else if (rand < 0.5) {
                  ocjena = 4; // 20% šanse za 4
                } else if (rand < 0.75) {
                  ocjena = 3; // 25% šanse za 3
                } else {
                  ocjena = 2; // 25% šanse za 2
                }

                await prisma.casOcjena.create({
                  data: {
                    casId: cas.id,
                    ucenikId: ucenik.id,
                    lekcijaId: lekcija.id,
                    ocjena: ocjena,
                    komentar: ocjena >= 4 ? 'Odličan rad!' : ocjena === 3 ? 'Dobar rad' : 'Treba više vježbe',
                    vrijeme: new Date(datum.getTime() + Math.random() * 3600000), // Random vrijeme tokom casa
                  },
                });

                ukupnoOcjena++;
              }
            }
          }
        }
      }

      console.log(`    ✅ Kreirano casova za grupu ${grupa.naziv}`);
    }
  }

  console.log('\n🎉 Seeding casova završen!');
  console.log(`📊 Statistika:`);
  console.log(`   - Casovi: ${ukupnoCasova}`);
  console.log(`   - Prisustva: ${ukupnoPrisustva}`);
  console.log(`   - Ocjene: ${ukupnoOcjena}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding casovi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

