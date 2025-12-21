import { PrismaClient, StatusPrisustva, TipCasa, TipLekcije } from '@prisma/client';

const prisma = new PrismaClient();

// Funkcija za kreiranje lekcija (iz seed-lekcije.ts)
async function kreirajLekcije() {
  const razredi = await prisma.razred.findMany({ orderBy: { name: 'asc' } });
  if (razredi.length === 0) return;

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

  for (const razred of razredi) {
    const lekcijeZaRazred = lekcijePoRazredu[razred.name] || [];
    if (lekcijeZaRazred.length === 0) continue;

    let redoslijed = 1;
    for (const lekcijaData of lekcijeZaRazred) {
      let lekcija = await prisma.lekcija.findFirst({
        where: { naslov: lekcijaData.naslov, tip: lekcijaData.tip },
      });

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
      }

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
      }

      redoslijed++;
    }
  }
}

/**
 * Kompletan seed koji popunjava sve tabele sa testnim podacima
 * Pokreće sve potrebne seed fajlove u pravom redosledu
 */
async function main() {
  console.log('🌱 Pokretanje kompletnog seed-a za sve tabele...\n');

  // 0. Proveri da li postoje lekcije, ako ne kreiraj ih
  const postojeceLekcije = await prisma.lekcija.count();
  if (postojeceLekcije === 0) {
    console.log('⚠️  Nema lekcija - kreiram lekcije...');
    await kreirajLekcije();
    console.log('✅ Lekcije kreirane\n');
  } else {
    console.log(`✅ Pronađeno ${postojeceLekcije} lekcija\n`);
  }

  // 1. Proveri da li postoje osnovni podaci
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
    console.log('❌ Nema aktivne nastavne godine. Prvo pokreni seed-nastavna-godina.ts');
    return;
  }

  console.log(`✅ Nastavna godina: ${nastavnaGodina.naziv}`);
  console.log(`✅ Razredi: ${nastavnaGodina.razredi.length}`);
  
  let ukupnoCasova = 0;
  let ukupnoPrisustva = 0;
  let ukupnoOcjena = 0;

  // 2. Generiši datume za zadnjih 6 mjeseci
  const sada = new Date();
  const datumi: Date[] = [];
  const pocetak = new Date(sada);
  pocetak.setMonth(pocetak.getMonth() - 6);
  
  for (let d = new Date(pocetak); d <= sada; d.setDate(d.getDate() + 1)) {
    const dan = d.getDay();
    if (dan === 6 || dan === 0) { // Subota (6) ili Nedjelja (0)
      datumi.push(new Date(d));
    }
  }

  console.log(`📅 Generisano ${datumi.length} datuma za casove\n`);

  // 3. Za svaki razred kreiraj casove
  for (const razredNG of nastavnaGodina.razredi) {
    const razred = razredNG.razred;
    const lekcije = razred.lekcije.map(rl => rl.lekcija);
    
    if (lekcije.length === 0) {
      console.log(`⚠️  Razred ${razred.name} nema lekcija`);
      continue;
    }

    console.log(`📖 Razred: ${razred.name} (${lekcije.length} lekcija)`);

    // Za svaku grupu
    for (const grupa of razredNG.grupe) {
      if (!grupa.raspored) {
        console.log(`  ⚠️  Grupa ${grupa.naziv} nema raspored`);
        continue;
      }

      const ucenici = grupa.ucenici.map(ug => ug.ucenik);
      if (ucenici.length === 0) {
        console.log(`  ⚠️  Grupa ${grupa.naziv} nema učenika`);
        continue;
      }

      console.log(`  👥 Grupa ${grupa.naziv}: ${ucenici.length} učenika`);

      const danRasporeda = grupa.raspored.dan;
      const relevantniDatumi = datumi.filter(d => {
        const dan = d.getDay();
        return (danRasporeda === 'subota' && dan === 6) || 
               (danRasporeda === 'nedjelja' && dan === 0);
      });

      // Kreiraj casove za relevantne datume
      for (const datum of relevantniDatumi) {
        if (datum > sada) continue;

        // Proveri da li cas već postoji
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
          continue;
        }

        // Odaberi 1-3 lekcije za ovaj cas
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

          // Kreiraj ocjene za SVE učenike i SVE lekcije (100% pokrivenost)
          for (const lekcija of odabraneLekcije) {
            // Proveri da li ocjena već postoji
            const postojecaOcjena = await prisma.casOcjena.findFirst({
              where: {
                casId: cas.id,
                ucenikId: ucenik.id,
                lekcijaId: lekcija.id,
              },
            });

            if (postojecaOcjena) {
              continue;
            }

            // Dodaj ocjenu za SVE učenike (ne samo prisutne)
            const randOcjena = Math.random();
            let ocjena: number;
            if (randOcjena < 0.25) {
              ocjena = 5;
            } else if (randOcjena < 0.45) {
              ocjena = 4;
            } else if (randOcjena < 0.70) {
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

            try {
              await prisma.casOcjena.create({
                data: {
                  casId: cas.id,
                  ucenikId: ucenik.id,
                  lekcijaId: lekcija.id,
                  ocjena: ocjena,
                  komentar: komentar,
                  vrijeme: new Date(datum.getTime() + Math.random() * 3600000),
                },
              });

              ukupnoOcjena++;
            } catch (error) {
              // Preskoči ako već postoji
            }
          }
        }
      }

      console.log(`    ✅ Kreirano casova za grupu ${grupa.naziv}`);
    }
  }

  // 4. Dodaj dodatne ocjene za sve lekcije razreda (čak i ako nisu u casu)
  console.log('\n📚 Dodavanje dodatnih ocjena za sve lekcije razreda...');
  
  for (const razredNG of nastavnaGodina.razredi) {
    const razred = razredNG.razred;
    const sveLekcijeRazreda = razred.lekcije.map(rl => rl.lekcija);

    if (sveLekcijeRazreda.length === 0) {
      continue;
    }

    for (const grupa of razredNG.grupe) {
      if (grupa.ucenici.length === 0) {
        continue;
      }

      // Pronađi casove za ovu grupu
      const casoviGrupe = await prisma.cas.findMany({
        where: {
          grupaId: grupa.id,
          nastavnaGodinaId: nastavnaGodina.id,
        },
      });

      if (casoviGrupe.length === 0) {
        continue;
      }

      // Za svakog učenika
      for (const ucenikGrupa of grupa.ucenici) {
        const ucenik = ucenikGrupa.ucenik;

        // Za svaku lekciju razreda
        for (const lekcijaRazreda of sveLekcijeRazreda) {
          // Proveri da li učenik već ima ocjenu za ovu lekciju
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

            ukupnoOcjena++;
          } catch (error) {
            // Preskoči ako već postoji
          }
        }
      }
    }
  }

  console.log('\n🎉 Kompletan seed završen!');
  console.log(`📊 Statistika:`);
  console.log(`   - Casovi: ${ukupnoCasova}`);
  console.log(`   - Prisustva: ${ukupnoPrisustva}`);
  console.log(`   - Ocjene: ${ukupnoOcjena}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding all:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

