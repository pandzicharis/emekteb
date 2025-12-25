import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import EnhancedStatCard from './EnhancedStatCard';
import ComparisonChart from './ComparisonChart';
import DistributionChart from './DistributionChart';
import AIInsights from './AIInsights';
import StatsDrawer from './StatsDrawer';

interface RazredStatsProps {
  data: {
    brojGrupa: number;
    brojUcenika: number;
    ukupnoCasova: number;
    planiraniCasovi?: number;
    neodrzaniCasovi?: number;
    postotakOdrzanihCasova?: number;
    prosjekCasovaPoUceniku?: number;
    ukupnoPrisustva: number;
    prisutni?: number;
    opravdani?: number;
    neopravdani?: number;
    prosjekPrisustva: number;
    ukupnoOcjena: number;
    prosjekOcjena: number;
    grupe: Array<{
      id: string;
      naziv: string;
      brojUcenika: number;
      prosjekPrisustva: number;
      prosjekOcjena: number;
      brojCasova: number;
      brojOcjena: number;
    }>;
    ukupnoLekcija: number;
    ocjenjenoLekcija: number;
    postotakPredjenogGradiva: number;
    najredovnijiUcenici: Array<{
      id: string;
      ime: string;
      prezime: string;
      stopaPrisustva: number;
    }>;
    najboljiUcenici: Array<{
      id: string;
      ime: string;
      prezime: string;
      prosjekOcjena: number;
    }>;
    uceniciKojiTrebajuPomoc: Array<{
      id: string;
      ime: string;
      prezime: string;
      prosjekOcjena: number;
      stopaPrisustva: number;
      razlog: string;
    }>;
    distribucijaOcjena: Record<number, number>;
    distribucijaPrisustva: {
      visoka: number;
      srednja: number;
      niska: number;
    };
  };
  nastavnaGodinaId?: string;
  razredNastavnaGodinaId?: string;
  mjesec?: number | null;
}

export default function RazredStats({ data, nastavnaGodinaId, razredNastavnaGodinaId, mjesec }: RazredStatsProps) {
  const [selectedGrupaId, setSelectedGrupaId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Prepare chart data for grupe - ocjene
  const grupeChartData = data.grupe.map((g) => ({
    name: g.naziv,
    grupa: g.prosjekOcjena,
  }));

  // Prepare chart data for grupe - prisustvo
  const grupePrisustvoChartData = data.grupe.map((g) => ({
    name: g.naziv,
    prisustvo: g.prosjekPrisustva,
  }));

  // Prepare chart data for grupe - broj časova
  const grupeCasoviChartData = data.grupe.map((g) => ({
    name: g.naziv,
    casovi: g.brojCasova,
  }));

  // Combined chart data for all metrics
  const grupeCombinedChartData = data.grupe.map((g) => ({
    name: g.naziv,
    prisustvo: g.prosjekPrisustva,
    ocjene: g.prosjekOcjena,
    casovi: g.brojCasova,
  }));

  const handleGrupaClick = (grupaId: string) => {
    setSelectedGrupaId(grupaId);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedGrupaId(null);
  };

  // Prepare distribution data
  const distribucijaOcjenaData = Object.entries(data.distribucijaOcjena).map(([ocjena, count]) => ({
    name: `Ocjena ${ocjena}`,
    value: count,
  }));

  const distribucijaPrisustvaData = [
    { name: 'Visoka (≥90%)', value: data.distribucijaPrisustva.visoka },
    { name: 'Srednja (70-89%)', value: data.distribucijaPrisustva.srednja },
    { name: 'Niska (<70%)', value: data.distribucijaPrisustva.niska },
  ];

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <AIInsights data={data} />

      {/* Box-ovi u tri reda: 2, 2, 1 */}
      {/* Prvi red: 2 box-a */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EnhancedStatCard
          title="Broj grupa"
          value={data.brojGrupa}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <EnhancedStatCard
          title="Broj učenika"
          value={data.brojUcenika}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      </div>

      {/* Drugi red: 2 box-a */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EnhancedStatCard
          title="Prosjek prisustva"
          value={`${data.prosjekPrisustva.toFixed(1)}%`}
          subtitle={`${data.ukupnoPrisustva} evidentiranih`}
          color="green"
          progress={data.prosjekPrisustva}
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
      </div>

      {/* Treći red: 1 box */}
      <div className="grid grid-cols-1 gap-6">
        {data.postotakOdrzanihCasova !== undefined ? (
          <EnhancedStatCard
            title="Održani časovi"
            value={`${data.postotakOdrzanihCasova.toFixed(1)}%`}
            subtitle={`${data.ukupnoCasova} od ${data.planiraniCasovi} planiranih`}
            color="purple"
            progress={data.postotakOdrzanihCasova}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        ) : (
          <EnhancedStatCard
            title="Postotak predjenog gradiva"
            value={`${data.postotakPredjenogGradiva.toFixed(1)}%`}
            color="purple"
            progress={data.postotakPredjenogGradiva}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
        )}
      </div>

      {/* Sekcija 2: Statistika grupa */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Statistika grupa</h3>
          <p className="text-sm text-gray-600 mt-1">Pregled performansi po grupama</p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj učenika</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prosjek prisustva</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prosjek ocjena</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj časova</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj ocjena</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.grupe.map((grupa) => (
                  <tr 
                    key={grupa.id} 
                    onClick={() => handleGrupaClick(grupa.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{grupa.naziv}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grupa.brojUcenika}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grupa.prosjekPrisustva.toFixed(1)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grupa.prosjekOcjena.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grupa.brojCasova}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grupa.brojOcjena}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sekcija 3: Statistika lekcija */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistika lekcija</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <EnhancedStatCard
            title="Ukupno lekcija"
            value={data.ukupnoLekcija}
            color="blue"
          />
          <EnhancedStatCard
            title="Ocjenjeno lekcija"
            value={data.ocjenjenoLekcija}
            color="green"
          />
          <EnhancedStatCard
            title="Postotak predjenog gradiva"
            value={`${data.postotakPredjenogGradiva.toFixed(1)}%`}
            color="purple"
            progress={data.postotakPredjenogGradiva}
          />
        </div>
      </div>

      {/* Sekcija 4: Top učenici */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Najredovniji učenici */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Najredovniji učenici</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Učenik</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prisustvo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.najredovnijiUcenici.map((ucenik) => (
                  <tr key={ucenik.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ucenik.ime} {ucenik.prezime}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{ucenik.stopaPrisustva.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Najbolji učenici */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Najbolji učenici</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Učenik</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prosjek</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.najboljiUcenici.map((ucenik) => (
                  <tr key={ucenik.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ucenik.ime} {ucenik.prezime}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{ucenik.prosjekOcjena.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Sekcija 4b: Učenici koji trebaju pomoć */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Učenici koji trebaju pomoć */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
            <h3 className="text-lg font-semibold text-gray-900">Trebaju pomoć</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Učenik</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Razlog</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.uceniciKojiTrebajuPomoc.map((ucenik) => (
                  <tr key={ucenik.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ucenik.ime} {ucenik.prezime}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{ucenik.razlog}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sekcija 5: Grafovi - zaseban red */}
      <div className="space-y-6">
        {/* Usporedba svih metrika grupa */}
        {grupeCombinedChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usporedba grupa u razredu</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={grupeCombinedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="prisustvo" fill="#10b981" name="Prisustvo (%)" />
                <Bar yAxisId="right" dataKey="ocjene" fill="#3b82f6" name="Prosjek ocjena" />
                <Bar yAxisId="left" dataKey="casovi" fill="#f59e0b" name="Broj časova" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {distribucijaOcjenaData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <DistributionChart
              data={distribucijaOcjenaData}
              type="bar"
              title="Distribucija ocjena"
            />
          </div>
        )}
        {distribucijaPrisustvaData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <DistributionChart
              data={distribucijaPrisustvaData}
              type="pie"
              title="Distribucija prisustva"
            />
          </div>
        )}
        {grupeChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <ComparisonChart data={grupeChartData} title="Poređenje prosjeka ocjena po grupama" />
          </div>
        )}
        {grupePrisustvoChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <ComparisonChart 
              data={grupePrisustvoChartData.map(g => ({ name: g.name, grupa: g.prisustvo }))} 
              title="Poređenje prosjeka prisustva po grupama" 
            />
          </div>
        )}
        {grupeCasoviChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <ComparisonChart 
              data={grupeCasoviChartData.map(g => ({ name: g.name, grupa: g.casovi }))} 
              title="Broj časova po grupama" 
            />
          </div>
        )}
      </div>

      {/* Drawer za statistiku grupe */}
      {selectedGrupaId && nastavnaGodinaId && razredNastavnaGodinaId && (
        <StatsDrawer
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          type="grupa"
          itemId={selectedGrupaId}
          filters={{
            nastavnaGodinaId,
            razredNastavnaGodinaId,
            mjesec: mjesec || undefined,
          }}
        />
      )}
    </div>
  );
}

