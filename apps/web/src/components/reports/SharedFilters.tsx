import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';

interface FilterOption {
  id: string;
  label: string;
  [key: string]: any;
}

interface SharedFiltersProps {
  nastavnaGodinaId: string;
  razredNastavnaGodinaId: string;
  grupaId: string;
  mjesec: number | null;
  onNastavnaGodinaChange: (value: string) => void;
  onRazredChange: (value: string) => void;
  onGrupaChange: (value: string) => void;
  onMjesecChange: (value: number | null) => void;
}

export default function SharedFilters({
  nastavnaGodinaId,
  razredNastavnaGodinaId,
  grupaId,
  mjesec,
  onNastavnaGodinaChange,
  onRazredChange,
  onGrupaChange,
  onMjesecChange,
}: SharedFiltersProps) {
  const [nastavneGodine, setNastavneGodine] = useState<FilterOption[]>([]);
  const [razredi, setRazredi] = useState<FilterOption[]>([]);
  const [grupe, setGrupe] = useState<FilterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

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

  const fetchFilterOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/reports/options`, {
        params: {
          nastavnaGodinaId: nastavnaGodinaId || undefined,
          razredNastavnaGodinaId: razredNastavnaGodinaId || undefined,
          grupaId: grupaId || undefined,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNastavneGodine(
        response.data.nastavneGodine.map((ng: any) => ({
          id: ng.id,
          label: ng.naziv,
          aktivan: ng.aktivan,
        }))
      );
      setRazredi(
        response.data.razredi.map((r: any) => ({
          id: r.id,
          label: r.razred.name,
        }))
      );
      setGrupe(
        response.data.grupe.map((g: any) => ({
          id: g.id,
          label: g.naziv,
        }))
      );
    } catch (err) {
      console.error('Error fetching filter options:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, [nastavnaGodinaId, razredNastavnaGodinaId, grupaId]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  const hasActiveFilters = nastavnaGodinaId || razredNastavnaGodinaId || grupaId || mjesec;

  const handleClearFilters = () => {
    onNastavnaGodinaChange('');
    onRazredChange('');
    onGrupaChange('');
    onMjesecChange(null);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Filteri</h3>
            <p className="text-sm text-gray-600">Odaberite kriterijume za izvještaje</p>
          </div>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Obriši sve
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>
    </div>
  );
}

