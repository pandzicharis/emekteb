import { ReactNode } from 'react';

interface RazredItem {
  id: string;
  naziv: string;
  brojGrupa: number;
  brojUcenika: number;
  prosjekPrisustva: number;
  prosjekOcjena: number;
}

interface GrupaItem {
  id: string;
  naziv: string;
  razredNaziv: string;
  brojUcenika: number;
  prosjekPrisustva: number;
  prosjekOcjena: number;
}

interface UcenikItem {
  id: string;
  ime: string;
  prezime: string;
  grupaNaziv: string;
  razredNaziv: string;
  prosjekPrisustva: number;
  prosjekOcjena: number;
}

interface ReportsListProps {
  type: 'razredi' | 'grupe' | 'ucenici';
  data: RazredItem[] | GrupaItem[] | UcenikItem[];
  onItemClick: (item: { id: string; type: 'razred' | 'grupa' | 'ucenik' }) => void;
  loading?: boolean;
}

export default function ReportsList({ type, data, onItemClick, loading = false }: ReportsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="text-gray-600 text-lg">Nema podataka za prikaz</p>
      </div>
    );
  }

  const getColorForValue = (value: number, type: 'prisustvo' | 'ocjena') => {
    if (type === 'prisustvo') {
      if (value >= 90) return 'text-green-600 bg-green-50';
      if (value >= 70) return 'text-yellow-600 bg-yellow-50';
      return 'text-red-600 bg-red-50';
    } else {
      if (value >= 4) return 'text-green-600 bg-green-50';
      if (value >= 3) return 'text-yellow-600 bg-yellow-50';
      return 'text-red-600 bg-red-50';
    }
  };

  const renderRazredItem = (item: RazredItem) => (
    <div
      key={item.id}
      onClick={() => onItemClick({ id: item.id, type: 'razred' })}
      className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{item.naziv}</h3>
            <p className="text-sm text-gray-500">{item.brojGrupa} grupa • {item.brojUcenika} učenika</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className={`px-4 py-2 rounded-lg ${getColorForValue(item.prosjekPrisustva, 'prisustvo')}`}>
          <div className="text-xs font-medium mb-1">Prisustvo</div>
          <div className="text-lg font-bold">{item.prosjekPrisustva.toFixed(1)}%</div>
        </div>
        <div className={`px-4 py-2 rounded-lg ${getColorForValue(item.prosjekOcjena, 'ocjena')}`}>
          <div className="text-xs font-medium mb-1">Prosjek ocjena</div>
          <div className="text-lg font-bold">{item.prosjekOcjena.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );

  const renderGrupaItem = (item: GrupaItem) => (
    <div
      key={item.id}
      onClick={() => onItemClick({ id: item.id, type: 'grupa' })}
      className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Grupa {item.naziv}</h3>
            <p className="text-sm text-gray-500">{item.razredNaziv} • {item.brojUcenika} učenika</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className={`px-4 py-2 rounded-lg ${getColorForValue(item.prosjekPrisustva, 'prisustvo')}`}>
          <div className="text-xs font-medium mb-1">Prisustvo</div>
          <div className="text-lg font-bold">{item.prosjekPrisustva.toFixed(1)}%</div>
        </div>
        <div className={`px-4 py-2 rounded-lg ${getColorForValue(item.prosjekOcjena, 'ocjena')}`}>
          <div className="text-xs font-medium mb-1">Prosjek ocjena</div>
          <div className="text-lg font-bold">{item.prosjekOcjena.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );

  const renderUcenikItem = (item: UcenikItem) => (
    <div
      key={item.id}
      onClick={() => onItemClick({ id: item.id, type: 'ucenik' })}
      className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 rounded-lg">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{item.ime} {item.prezime}</h3>
            <p className="text-sm text-gray-500">{item.razredNaziv} • Grupa {item.grupaNaziv}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className={`px-4 py-2 rounded-lg ${getColorForValue(item.prosjekPrisustva, 'prisustvo')}`}>
          <div className="text-xs font-medium mb-1">Prisustvo</div>
          <div className="text-lg font-bold">{item.prosjekPrisustva.toFixed(1)}%</div>
        </div>
        <div className={`px-4 py-2 rounded-lg ${getColorForValue(item.prosjekOcjena, 'ocjena')}`}>
          <div className="text-xs font-medium mb-1">Prosjek ocjena</div>
          <div className="text-lg font-bold">{item.prosjekOcjena.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {type === 'razredi' && (data as RazredItem[]).map(renderRazredItem)}
      {type === 'grupe' && (data as GrupaItem[]).map(renderGrupaItem)}
      {type === 'ucenici' && (data as UcenikItem[]).map(renderUcenikItem)}
    </div>
  );
}

