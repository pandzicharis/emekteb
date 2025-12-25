import { ReactNode } from 'react';
import SearchableSelect from './SearchableSelect';

interface FilterOption {
  id: string;
  label: string;
  [key: string]: any;
}

interface FilterSectionProps {
  nastavnaGodinaId: string;
  razredNastavnaGodinaId: string;
  grupaId: string;
  ucenikId: string;
  datumOd: Date | null;
  datumDo: Date | null;
  mjesec?: number | null;
  ime?: string;
  prezime?: string;
  onNastavnaGodinaChange: (value: string) => void;
  onRazredChange: (value: string) => void;
  onGrupaChange: (value: string) => void;
  onUcenikChange: (value: string) => void;
  onDatumOdChange: (date: Date | null) => void;
  onDatumDoChange: (date: Date | null) => void;
  onMjesecChange?: (value: number | null) => void;
  onImeChange?: (value: string) => void;
  onPrezimeChange?: (value: string) => void;
  nastavneGodine: FilterOption[];
  razredi: FilterOption[];
  grupe: FilterOption[];
  ucenici: FilterOption[];
  loadingOptions?: boolean;
  onClearFilters?: () => void;
}

export default function FilterSection({
  nastavnaGodinaId,
  razredNastavnaGodinaId,
  grupaId,
  ucenikId,
  datumOd,
  datumDo,
  mjesec,
  ime,
  prezime,
  onNastavnaGodinaChange,
  onRazredChange,
  onGrupaChange,
  onUcenikChange,
  onDatumOdChange,
  onDatumDoChange,
  onMjesecChange,
  onImeChange,
  onPrezimeChange,
  nastavneGodine,
  razredi,
  grupe,
  ucenici,
  loadingOptions = false,
  onClearFilters,
}: FilterSectionProps) {
  const hasActiveFilters = nastavnaGodinaId || razredNastavnaGodinaId || grupaId || ucenikId || datumOd || datumDo || mjesec || ime || prezime;
  
  const mjesecOptions = [
    { id: '1', label: 'Januar' },
    { id: '2', label: 'Februar' },
    { id: '3', label: 'Mart' },
    { id: '4', label: 'April' },
    { id: '5', label: 'Maj' },
    { id: '6', label: 'Jun' },
    { id: '7', label: 'Jul' },
    { id: '8', label: 'Avgust' },
    { id: '9', label: 'Septembar' },
    { id: '10', label: 'Oktobar' },
    { id: '11', label: 'Novembar' },
    { id: '12', label: 'Decembar' },
  ];

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 border-2 border-gray-200 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Filteri</h3>
            <p className="text-xs text-gray-500">Odaberite kriterijume za izvještaj</p>
          </div>
        </div>
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Obriši sve
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Nastavna godina */}
        <SearchableSelect
          label="Nastavna godina"
          value={nastavnaGodinaId}
          onChange={onNastavnaGodinaChange}
          options={nastavneGodine.map((ng) => ({
            id: ng.id,
            label: `${ng.label}${ng.aktivan ? ' (Aktivna)' : ''}`,
          }))}
          disabled={loadingOptions}
          placeholder="Sve nastavne godine"
          loading={loadingOptions}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />

        {/* Razred */}
        <SearchableSelect
          label="Razred"
          value={razredNastavnaGodinaId}
          onChange={onRazredChange}
          options={razredi.map((r) => ({
            id: r.id,
            label: r.label,
          }))}
          disabled={!nastavnaGodinaId || loadingOptions}
          placeholder="Svi razredi"
          loading={loadingOptions}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        {/* Grupa */}
        <SearchableSelect
          label="Grupa"
          value={grupaId}
          onChange={onGrupaChange}
          options={grupe.map((g) => ({
            id: g.id,
            label: g.label,
          }))}
          disabled={!razredNastavnaGodinaId || loadingOptions}
          placeholder="Sve grupe"
          loading={loadingOptions}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        {/* Učenik */}
        <SearchableSelect
          label="Učenik"
          value={ucenikId}
          onChange={onUcenikChange}
          options={ucenici.map((u) => ({
            id: u.id,
            label: u.label,
          }))}
          disabled={loadingOptions}
          placeholder="Svi učenici"
          loading={loadingOptions}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        {/* Datum od */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Datum od</label>
          <div className="relative">
            <input
              type="date"
              value={datumOd ? datumOd.toISOString().split('T')[0] : ''}
              onChange={(e) => onDatumOdChange(e.target.value ? new Date(e.target.value) : null)}
              className="w-full px-4 py-3 pl-10 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Datum do */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Datum do</label>
          <div className="relative">
            <input
              type="date"
              value={datumDo ? datumDo.toISOString().split('T')[0] : ''}
              onChange={(e) => onDatumDoChange(e.target.value ? new Date(e.target.value) : null)}
              className="w-full px-4 py-3 pl-10 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Mjesec */}
        {onMjesecChange && (
          <SearchableSelect
            label="Mjesec"
            value={mjesec ? mjesec.toString() : ''}
            onChange={(value) => onMjesecChange(value ? parseInt(value) : null)}
            options={mjesecOptions}
            disabled={loadingOptions}
            placeholder="Svi mjeseci"
            loading={loadingOptions}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
        )}

        {/* Ime */}
        {onImeChange && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ime</label>
            <div className="relative">
              <input
                type="text"
                value={ime || ''}
                onChange={(e) => onImeChange(e.target.value)}
                placeholder="Pretraži po imenu..."
                className="w-full px-4 py-3 pl-10 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Prezime */}
        {onPrezimeChange && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Prezime</label>
            <div className="relative">
              <input
                type="text"
                value={prezime || ''}
                onChange={(e) => onPrezimeChange(e.target.value)}
                placeholder="Pretraži po prezimenu..."
                className="w-full px-4 py-3 pl-10 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

