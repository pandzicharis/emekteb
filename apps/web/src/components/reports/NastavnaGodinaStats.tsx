import EnhancedStatCard from './EnhancedStatCard';
import ComparisonChart from './ComparisonChart';

interface NastavnaGodinaStatsProps {
  data: {
    brojRazreda: number;
    brojUcenika: number;
    ukupnoCasova: number;
    ukupnoPrisustva: number;
    prosjekPrisustva: number;
    ukupnoOcjena: number;
    prosjekOcjena: number;
    razredi: Array<{
      id: string;
      naziv: string;
      brojGrupa: number;
      brojUcenika: number;
      prosjekPrisustva: number;
      prosjekOcjena: number;
    }>;
  };
}

export default function NastavnaGodinaStats({ data }: NastavnaGodinaStatsProps) {
  const chartData = data.razredi.map((r) => ({
    name: r.naziv,
    razred: r.prosjekOcjena,
  }));

  return (
    <div className="space-y-6">
      {/* Osnovne statistike */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedStatCard
          title="Broj razreda"
          value={data.brojRazreda}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <EnhancedStatCard
          title="Broj učenika"
          value={data.brojUcenika}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
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

      {/* Poređenje razreda */}
      {chartData.length > 0 && (
        <ComparisonChart
          data={chartData}
          title="Poređenje prosjeka ocjena po razredima"
        />
      )}

      {/* Tabela razreda */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Razredi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razred</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj grupa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj učenika</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prosjek prisustva</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prosjek ocjena</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.razredi.map((razred) => (
                <tr key={razred.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{razred.naziv}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{razred.brojGrupa}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{razred.brojUcenika}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{razred.prosjekPrisustva.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{razred.prosjekOcjena.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

