import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FilterSection from '../components/reports/FilterSection';
import NastavnaGodinaStats from '../components/reports/NastavnaGodinaStats';
import RazredStats from '../components/reports/RazredStats';
import UcenikStats from '../components/reports/UcenikStats';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface FilterOption {
  id: string;
  label: string;
  [key: string]: any;
}

export default function StatisticsDashboard() {
  const [nastavnaGodinaId, setNastavnaGodinaId] = useState<string>('');
  const [razredNastavnaGodinaId, setRazredNastavnaGodinaId] = useState<string>('');
  const [grupaId, setGrupaId] = useState<string>('');
  const [ucenikId, setUcenikId] = useState<string>('');
  const [mjesec, setMjesec] = useState<number | null>(null);
  const [ime, setIme] = useState<string>('');
  const [prezime, setPrezime] = useState<string>('');

  const [nastavneGodine, setNastavneGodine] = useState<FilterOption[]>([]);
  const [razredi, setRazredi] = useState<FilterOption[]>([]);
  const [grupe, setGrupe] = useState<FilterOption[]>([]);
  const [ucenici, setUcenici] = useState<FilterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent initial render resets
  const isInitialMount = useRef(true);
  const prevNastavnaGodinaId = useRef<string>('');
  const prevRazredNastavnaGodinaId = useRef<string>('');
  const prevGrupaId = useRef<string>('');

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/reports/options`, {
        params: {
          nastavnaGodinaId: nastavnaGodinaId || undefined,
          razredNastavnaGodinaId: razredNastavnaGodinaId || undefined,
          grupaId: grupaId || undefined,
          ime: ime || undefined,
          prezime: prezime || undefined,
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
      setUcenici(
        response.data.ucenici.map((u: any) => ({
          id: u.id,
          label: `${u.ime} ${u.prezime}`,
        }))
      );
    } catch (err) {
      console.error('Error fetching filter options:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, [nastavnaGodinaId, razredNastavnaGodinaId, grupaId, ime, prezime]);

  // Fetch statistics based on current filters
  const fetchStatistics = useCallback(async () => {
    if (!nastavnaGodinaId && !razredNastavnaGodinaId && !ucenikId) {
      setStatsData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      if (ucenikId) {
        // Fetch ucenik stats
        const response = await axios.get(`${API_URL}/reports/ucenik-stats`, {
          params: {
            ucenikId,
            nastavnaGodinaId: nastavnaGodinaId || undefined,
            razredNastavnaGodinaId: razredNastavnaGodinaId || undefined,
            grupaId: grupaId || undefined,
            mjesec: mjesec || undefined,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStatsData({ type: 'ucenik', data: response.data });
      } else if (razredNastavnaGodinaId) {
        // Fetch razred stats
        const response = await axios.get(`${API_URL}/reports/razred-stats`, {
          params: {
            nastavnaGodinaId,
            razredNastavnaGodinaId,
            mjesec: mjesec || undefined,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStatsData({ type: 'razred', data: response.data });
      } else if (nastavnaGodinaId) {
        // Fetch nastavna godina stats
        const response = await axios.get(`${API_URL}/reports/nastavna-godina-stats`, {
          params: {
            nastavnaGodinaId,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStatsData({ type: 'nastavnaGodina', data: response.data });
      }
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
      setError(err.response?.data?.message || 'Greška pri učitavanju statistika');
    } finally {
      setLoading(false);
    }
  }, [nastavnaGodinaId, razredNastavnaGodinaId, grupaId, ucenikId, mjesec]);

  // Initial fetch
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch options when filters change (with debounce for ime/prezime)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFilterOptions();
    }, ime || prezime ? 500 : 0);

    return () => clearTimeout(timer);
  }, [nastavnaGodinaId, razredNastavnaGodinaId, grupaId, ime, prezime, fetchFilterOptions]);

  // Cascade reset filters
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevNastavnaGodinaId.current = nastavnaGodinaId;
      prevRazredNastavnaGodinaId.current = razredNastavnaGodinaId;
      prevGrupaId.current = grupaId;
      return;
    }

    if (prevNastavnaGodinaId.current !== nastavnaGodinaId) {
      setRazredNastavnaGodinaId('');
      setGrupaId('');
      setUcenikId('');
      prevNastavnaGodinaId.current = nastavnaGodinaId;
    }

    if (prevRazredNastavnaGodinaId.current !== razredNastavnaGodinaId) {
      setGrupaId('');
      setUcenikId('');
      prevRazredNastavnaGodinaId.current = razredNastavnaGodinaId;
    }

    if (prevGrupaId.current !== grupaId) {
      setUcenikId('');
      prevGrupaId.current = grupaId;
    }
  }, [nastavnaGodinaId, razredNastavnaGodinaId, grupaId]);

  // Fetch statistics when filters change
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  const handleClearFilters = () => {
    setNastavnaGodinaId('');
    setRazredNastavnaGodinaId('');
    setGrupaId('');
    setUcenikId('');
    setMjesec(null);
    setIme('');
    setPrezime('');
    setStatsData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Statistike</h1>
          <p className="text-gray-600">Detaljne statistike za nastavnu godinu, razred i učenike</p>
        </div>

        <FilterSection
          nastavnaGodinaId={nastavnaGodinaId}
          razredNastavnaGodinaId={razredNastavnaGodinaId}
          grupaId={grupaId}
          ucenikId={ucenikId}
          datumOd={null}
          datumDo={null}
          mjesec={mjesec}
          ime={ime}
          prezime={prezime}
          onNastavnaGodinaChange={setNastavnaGodinaId}
          onRazredChange={setRazredNastavnaGodinaId}
          onGrupaChange={setGrupaId}
          onUcenikChange={setUcenikId}
          onDatumOdChange={() => {}}
          onDatumDoChange={() => {}}
          onMjesecChange={setMjesec}
          onImeChange={setIme}
          onPrezimeChange={setPrezime}
          nastavneGodine={nastavneGodine}
          razredi={razredi}
          grupe={grupe}
          ucenici={ucenici}
          loadingOptions={loadingOptions}
          onClearFilters={handleClearFilters}
        />

        {loading && (
          <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Učitavanje statistika...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!loading && !error && statsData && (
          <>
            {statsData.type === 'nastavnaGodina' && <NastavnaGodinaStats data={statsData.data} />}
            {statsData.type === 'razred' && <RazredStats data={statsData.data} />}
            {statsData.type === 'ucenik' && <UcenikStats data={statsData.data} />}
          </>
        )}

        {!loading && !error && !statsData && (nastavnaGodinaId || razredNastavnaGodinaId || ucenikId) && (
          <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm text-center">
            <p className="text-gray-600">Nema podataka za odabrane filtere</p>
          </div>
        )}

        {!loading && !error && !statsData && !nastavnaGodinaId && !razredNastavnaGodinaId && !ucenikId && (
          <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm text-center">
            <p className="text-gray-600">Odaberite filtere za prikaz statistika</p>
          </div>
        )}
      </div>
    </div>
  );
}


