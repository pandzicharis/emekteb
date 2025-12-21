import { PrismaClient, TipCasa, StatusPrisustva } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ocjene za sve učenike i sve lekcije...');

  // Pronađi aktivnu nastavnu godinu
  const nastavnaGodina = await prisma.nastavnaGodina.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      razredi: {
        include: {
          razred: {
            include: {
              lekcije: {
                include: {
                  lekcija: true,
                },
              },
            },
          },
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
    console.log('❌ Nema aktivne nastavne godine');
    return;
  }

  console.log(`📚 Nastavna godina: ${nastavnaGodina.naziv}`);

  // Pronađi sve casove
  const casovi = await prisma.cas.findMany({
    where: {
      nastavnaGodinaId: nastavnaGodina.id,
    },
    include: {
      lekcije: {
        include: {
          lekcija: true,
        },
      },
      grupa: {
        include: {
          ucenici: {
            include: {
              ucenik: true,
            },
          },
        },
      },
      ocjene: true,
    },
  });

  if (casovi.length === 0) {
    console.log('⚠️  Nema casova - kreiram casove...');
    
    // Generiši datume za zadnjih 6 mjeseci
    const sada = new Date();
    const datumi: Date[] = [];
    const pocetak = new Date(sada);
    pocetak.setMonth(pocetak.getMonth() - 6);
    
    for (let d = new Date(pocetak); d <= sada; d.setDate(d.getDate() + 1)) {
      const dan = d.getDay();
      if (dan === 6 || dan === 0) {
        datumi.push(new Date(d));
      }
    }

    // Kreiraj casove za sve razrede i grupe
    for (const razredNG of nastavnaGodina.razredi) {
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

      if (!razred || razred.lekcije.length === 0) continue;

      const lekcije = razred.lekcije.map(rl => rl.lekcija);

      for (const grupa of razredNG.grupe) {
        if (!grupa.raspored || grupa.ucenici.length === 0) continue;

        const danRasporeda = grupa.raspored.dan;
        const relevantniDatumi = datumi.filter(d => {
          const dan = d.getDay();
          return (danRasporeda === 'subota' && dan === 6) || 
                 (danRasporeda === 'nedjelja' && dan === 0);
        });

        for (const datum of relevantniDatumi) {
          if (datum > sada) continue;

          const postojeciCas = await prisma.cas.findFirst({
            where: {
              grupaId: grupa.id,
              datum: {
                gte: new Date(datum.getFullYear(), datum.getMonth(), datum.getDate()),
                lt: new Date(datum.getFullYear(), datum.getMonth(), datum.getDate() + 1),
              },
            },
          });

          if (postojeciCas) continue;

          const brojLekcija = Math.floor(Math.random() * 3) + 1;
          const odabraneLekcije = [...lekcije]
            .sort(() => Math.random() - 0.5)
            .slice(0, brojLekcija);

          const cas = await prisma.cas.create({
            data: {
              nastavnaGodinaId: nastavnaGodina.id,
              razredNastavnaGodinaId: razredNG.id,
              grupaId: grupa.id,
              rasporedId: grupa.raspored.id,
              datum: datum,
              tipovi: [TipCasa.LEKCIJA],
            },
          });

          for (const lekcija of odabraneLekcije) {
            await prisma.casLekcija.create({
              data: {
                casId: cas.id,
                lekcijaId: lekcija.id,
              },
            });
          }

          // Kreiraj prisustvo
          for (const ucenikGrupa of grupa.ucenici) {
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
                ucenikId: ucenikGrupa.ucenik.id,
                status: status,
              },
            });
          }
        }
      }
    }

    // Ponovo učitaj casove
    const noviCasovi = await prisma.cas.findMany({
      where: {
        nastavnaGodinaId: nastavnaGodina.id,
      },
      include: {
        lekcije: {
          include: {
            lekcija: true,
          },
        },
        grupa: {
          include: {
            ucenici: {
              include: {
                ucenik: true,
              },
            },
          },
        },
        ocjene: true,
      },
    });

    casovi.push(...noviCasovi);
    console.log(`✅ Kreirano ${noviCasovi.length} novih casova\n`);
  }

  console.log(`📖 Pronađeno ${casovi.length} casova`);

  let ukupnoOcjena = 0;
  let novihOcjena = 0;
  let preskocenihOcjena = 0;

  // Za svaki cas
  for (const cas of casovi) {
    const lekcijeUCasu = cas.lekcije.map(cl => cl.lekcija);
    const sviUceniciUGrupi = cas.grupa.ucenici.map(ug => ug.ucenik);
    const postojeceOcjene = cas.ocjene;

    if (lekcijeUCasu.length === 0 || sviUceniciUGrupi.length === 0) {
      continue;
    }

    console.log(`  📝 Obrada casa ${cas.id} - ${lekcijeUCasu.length} lekcija, ${sviUceniciUGrupi.length} učenika`);

    // Za svakog učenika u grupi (ne samo prisutne!)
    for (const ucenikGrupa of cas.grupa.ucenici) {
      const ucenik = ucenikGrupa.ucenik;

      // Za svaku lekciju u casu
      for (const lekcija of lekcijeUCasu) {
        // Provjeri da li ocjena već postoji
        const postojecaOcjena = postojeceOcjene.find(
          o => o.ucenikId === ucenik.id && o.lekcijaId === lekcija.id
        );

        if (postojecaOcjena) {
          preskocenihOcjena++;
          continue;
        }

        // Dodaj ocjenu za SVE učenike i SVE lekcije (100% šanse)
        // Random ocjena između 2 i 5, sa većom vjerovatnoćom za bolje ocjene
        const rand = Math.random();
        let ocjena: number;
        if (rand < 0.25) {
          ocjena = 5; // 25% šanse za 5
        } else if (rand < 0.45) {
          ocjena = 4; // 20% šanse za 4
        } else if (rand < 0.70) {
          ocjena = 3; // 25% šanse za 3
        } else {
          ocjena = 2; // 30% šanse za 2
        }

        // Generiši komentar na osnovu ocjene
        const komentari = {
          5: ['Odličan rad!', 'Izvrsno!', 'Sjajno urađeno!', 'Bravo!'],
          4: ['Vrlo dobar rad', 'Dobro urađeno', 'Dobar napredak'],
          3: ['Dobar rad', 'U redu', 'Može bolje'],
          2: ['Treba više vježbe', 'Potrebno više rada', 'Nedovoljno'],
        };
        const komentar = komentari[ocjena as keyof typeof komentari][
          Math.floor(Math.random() * komentari[ocjena as keyof typeof komentari].length)
        ];

        // Generiši random vrijeme tokom casa (između početka i kraja casa)
        const casDatum = new Date(cas.datum);
        const vrijemeOcjene = new Date(
          casDatum.getTime() + Math.random() * 3600000 // Random vrijeme u roku od 1 sata
        );

        try {
          await prisma.casOcjena.create({
            data: {
              casId: cas.id,
              ucenikId: ucenik.id,
              lekcijaId: lekcija.id,
              ocjena: ocjena,
              komentar: komentar,
              vrijeme: vrijemeOcjene,
            },
          });

          novihOcjena++;
          ukupnoOcjena++;
        } catch (error) {
          // Možda već postoji (unique constraint)
          if (error instanceof Error && error.message.includes('Unique constraint')) {
            preskocenihOcjena++;
            continue;
          }
          console.error(`⚠️  Greška pri kreiranju ocjene za učenika ${ucenik.id}:`, error);
        }
      }
    }
  }

  // Dodaj dodatne ocjene za sve učenike i sve lekcije razreda (čak i ako nisu u casu)
  console.log('\n📚 Dodavanje ocjena za sve lekcije razreda...');
  
  for (const razredNG of nastavnaGodina.razredi) {
    // Učitaj razred sa lekcijama
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

    if (!razred || razred.lekcije.length === 0) {
      continue;
    }

    const sveLekcijeRazreda = razred.lekcije.map(rl => rl.lekcija);

    for (const grupa of razredNG.grupe) {
      if (grupa.ucenici.length === 0) {
        continue;
      }

      // Pronađi casove za ovu grupu
      const casoviGrupe = casovi.filter(c => c.grupaId === grupa.id);

      if (casoviGrupe.length === 0) {
        continue;
      }

      // Za svakog učenika
      for (const ucenikGrupa of grupa.ucenici) {
        const ucenik = ucenikGrupa.ucenik;

        // Za svaku lekciju razreda
        for (const lekcijaRazreda of sveLekcijeRazreda) {
          // Provjeri da li učenik već ima ocjenu za ovu lekciju u bilo kom casu
          const postojiOcjena = await prisma.casOcjena.findFirst({
            where: {
              ucenikId: ucenik.id,
              lekcijaId: lekcijaRazreda.id,
              cas: {
                grupaId: grupa.id,
              },
            },
          });

          if (postojiOcjena) {
            continue;
          }

          // Odaberi random cas iz grupe
          const randomCas = casoviGrupe[Math.floor(Math.random() * casoviGrupe.length)];

          // Dodaj ocjenu
          const rand = Math.random();
          let ocjena: number;
          if (rand < 0.25) {
            ocjena = 5;
          } else if (rand < 0.45) {
            ocjena = 4;
          } else if (rand < 0.70) {
            ocjena = 3;
          } else {
            ocjena = 2;
          }

          const komentari = {
            5: ['Odličan rad!', 'Izvrsno!', 'Sjajno urađeno!', 'Bravo!'],
            4: ['Vrlo dobar rad', 'Dobro urađeno', 'Dobar napredak'],
            3: ['Dobar rad', 'U redu', 'Može bolje'],
            2: ['Treba više vježbe', 'Potrebno više rada', 'Nedovoljno'],
          };
          const komentar = komentari[ocjena as keyof typeof komentari][
            Math.floor(Math.random() * komentari[ocjena as keyof typeof komentari].length)
          ];

          const casDatum = new Date(randomCas.datum);
          const vrijemeOcjene = new Date(
            casDatum.getTime() + Math.random() * 3600000
          );

          try {
            await prisma.casOcjena.create({
              data: {
                casId: randomCas.id,
                ucenikId: ucenik.id,
                lekcijaId: lekcijaRazreda.id,
                ocjena: ocjena,
                komentar: komentar,
                vrijeme: vrijemeOcjene,
              },
            });

            novihOcjena++;
            ukupnoOcjena++;
          } catch (error) {
            if (error instanceof Error && error.message.includes('Unique constraint')) {
              preskocenihOcjena++;
              continue;
            }
          }
        }
      }
    }
  }

  console.log('\n🎉 Seeding ocjena završen!');
  console.log(`📊 Statistika:`);
  console.log(`   - Ukupno ocjena: ${ukupnoOcjena}`);
  console.log(`   - Novih ocjena: ${novihOcjena}`);
  console.log(`   - Preskočenih (već postoje): ${preskocenihOcjena}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding ocjene:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

