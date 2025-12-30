import EnhancedStatCard from './EnhancedStatCard';
import ComparisonChart from './ComparisonChart';
import TrendChart from './TrendChart';

interface UcenikStatsProps {
  data: {
    ukupnoCasova: number;
    prisutni: number;
    odsutni: number;
    opravdani: number;
    stopaPrisustva: number;
    ukupnoOcjena: number;
    prosjekOcjena: number;
    ukupnoLekcija: number;
    ocjenjenoLekcija: number;
    postotakPredjenogGradiva: number;
    lekcijePoTezini: Array<{
      tezina: number;
      ukupno: number;
      ocjenjeno: number;
      prosjekOcjena: number;
    }>;
    razredAverage: number;
    grupaAverage: number;
    razredRank: number;
    grupaRank: number;
    najduziNizPrisustva: number;
    najduziNizOdsutnosti: number;
    prosjekPoMjesecu: Array<{
      mjesec: number;
      prosjekOcjena: number;
      stopaPrisustva: number;
    }>;
    lekcijeDetaljno: Array<{
      id: string;
      naslov: string;
      tezina: number;
      ocjena: number;
      datum: Date | string;
    }>;
  };
}

export default function UcenikStats({ data }: UcenikStatsProps) {
  // Prepare comparison data
  const comparisonData = [
    {
      name: 'Prosjek ocjena',
      ucenik: data.prosjekOcjena,
      ...(data.razredAverage > 0 && { razred: data.razredAverage }),
      ...(data.grupaAverage > 0 && { grupa: data.grupaAverage }),
    },
    {
      name: 'Prisustvo',
      ucenik: data.stopaPrisustva,
      ...(data.razredAverage > 0 && { razred: 0 }), // We don't have razred attendance average in this data
      ...(data.grupaAverage > 0 && { grupa: 0 }),
    },
  ];

  // Prepare lekcije by tezina chart data
  const lekcijePoTeziniData = data.lekcijePoTezini.map((l) => ({
    name: `Težina ${l.tezina}`,
    prosjekOcjena: l.prosjekOcjena,
    ocjenjeno: l.ocjenjeno,
    ukupno: l.ukupno,
  }));

  // Prepare trend data
  const trendData = data.prosjekPoMjesecu.map((m) => ({
    name: m.mjesec.toString(),
    prosjekOcjena: m.prosjekOcjena,
    stopaPrisustva: m.stopaPrisustva,
  }));

  return (
    <div className="space-y-6">
      {/* Sekcija 1: Osnovne statistike */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedStatCard
          title="Ukupno časova"
          value={data.ukupnoCasova}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <EnhancedStatCard
          title="Stopa prisustva"
          value={`${data.stopaPrisustva.toFixed(1)}%`}
          subtitle={`${data.prisutni} prisutni, ${data.odsutni} odsutni, ${data.opravdani} opravdani`}
          color="green"
          progress={data.stopaPrisustva}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <EnhancedStatCard
          title="Prosjek ocjena"
          value={data.prosjekOcjena.toFixed(2)}
          subtitle={`${data.ukupnoOcjena} ocjena`}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        />
        <EnhancedStatCard
          title="Postotak predjenog gradiva"
          value={`${data.postotakPredjenogGradiva.toFixed(1)}%`}
          subtitle={`${data.ocjenjenoLekcija} / ${data.ukupnoLekcija} lekcija`}
          color="purple"
          progress={data.postotakPredjenogGradiva}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Sekcija 2: Poređenje sa razredom/grupom */}
      {(data.razredAverage > 0 || data.grupaAverage > 0) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.razredAverage > 0 && (
              <EnhancedStatCard
                title="Prosjek razreda"
                value={data.razredAverage.toFixed(2)}
                subtitle={`Rang: ${data.razredRank}. mjesto`}
                color="green"
              />
            )}
            {data.grupaAverage > 0 && (
              <EnhancedStatCard
                title="Prosjek grupe"
                value={data.grupaAverage.toFixed(2)}
                subtitle={`Rang: ${data.grupaRank}. mjesto`}
                color="blue"
              />
            )}
            <EnhancedStatCard
              title="Najduži niz prisustva"
              value={data.najduziNizPrisustva}
              color="green"
            />
          </div>
          <ComparisonChart data={comparisonData} title="Poređenje sa razredom i grupom" />
        </div>
      )}

      {/* Sekcija 3: Statistika lekcija po težini */}
      {lekcijePoTeziniData.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistika lekcija po težini</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {data.lekcijePoTezini.map((lekcija) => (
              <EnhancedStatCard
                key={lekcija.tezina}
                title={`Težina ${lekcija.tezina}`}
                value={lekcija.prosjekOcjena > 0 ? lekcija.prosjekOcjena.toFixed(2) : '-'}
                subtitle={`${lekcija.ocjenjeno} / ${lekcija.ukupno} ocjenjeno`}
                color={lekcija.prosjekOcjena >= 4 ? 'green' : lekcija.prosjekOcjena >= 3 ? 'yellow' : 'red'}
              />
            ))}
          </div>
          <ComparisonChart
            data={lekcijePoTeziniData.map((d) => ({
              name: d.name,
              ucenik: d.prosjekOcjena,
            }))}
            title="Prosjek ocjena po težini lekcija"
          />
        </div>
      )}

      {/* Sekcija 4: Trend po mjesecima */}
      {trendData.length > 0 && (
        <TrendChart
          data={trendData}
          title="Trend po mjesecima"
          dataKeys={[
            { key: 'prosjekOcjena', name: 'Prosjek ocjena', color: '#3b82f6' },
            { key: 'stopaPrisustva', name: 'Stopa prisustva (%)', color: '#10b981' },
          ]}
        />
      )}

      {/* Sekcija 5: Detaljna lista lekcija */}
      {data.lekcijeDetaljno.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Detaljna lista lekcija</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lekcija</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Težina</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ocjena</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.lekcijeDetaljno.map((lekcija) => {
                  const datum = typeof lekcija.datum === 'string' ? new Date(lekcija.datum) : lekcija.datum;
                  return (
                    <tr key={lekcija.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lekcija.naslov}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lekcija.tezina}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lekcija.ocjena}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {datum.toLocaleDateString('bs-BA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}




