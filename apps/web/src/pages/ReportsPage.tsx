import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import StatisticsDashboard from '../components/StatisticsDashboard';
import SharedFilters from '../components/reports/SharedFilters';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

export default function ReportsPage() {
  // Shared filters state
  const [nastavnaGodinaId, setNastavnaGodinaId] = useState<string>('');
  const [razredNastavnaGodinaId, setRazredNastavnaGodinaId] = useState<string>('');
  const [grupaId, setGrupaId] = useState<string>('');
  const [mjesec, setMjesec] = useState<number | null>(null);
  const [loadingActiveYear, setLoadingActiveYear] = useState(true);

  // Refs to prevent initial render resets
  const isInitialMount = useRef(true);
  const prevNastavnaGodinaId = useRef<string>('');
  const prevRazredNastavnaGodinaId = useRef<string>('');

  // Load active nastavna godina on mount
  useEffect(() => {
    const loadActiveNastavnaGodina = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/reports/options`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Find active nastavna godina
        const activeNastavnaGodina = response.data.nastavneGodine?.find(
          (ng: any) => ng.aktivan || ng.status === 'ACTIVE'
        );

        if (activeNastavnaGodina && !nastavnaGodinaId) {
          setNastavnaGodinaId(activeNastavnaGodina.id);
        }
      } catch (err) {
        console.error('Error loading active nastavna godina:', err);
      } finally {
        setLoadingActiveYear(false);
      }
    };

    loadActiveNastavnaGodina();
  }, []); // Only run on mount

  // Cascade reset filters
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevNastavnaGodinaId.current = nastavnaGodinaId;
      prevRazredNastavnaGodinaId.current = razredNastavnaGodinaId;
      return;
    }

    if (prevNastavnaGodinaId.current !== nastavnaGodinaId) {
      setRazredNastavnaGodinaId('');
      setGrupaId('');
      prevNastavnaGodinaId.current = nastavnaGodinaId;
    }

    if (prevRazredNastavnaGodinaId.current !== razredNastavnaGodinaId) {
      setGrupaId('');
      prevRazredNastavnaGodinaId.current = razredNastavnaGodinaId;
    }
  }, [nastavnaGodinaId, razredNastavnaGodinaId]);

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full max-w-none mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 break-words">Izvještaji</h1>
          <p className="mt-1 text-base font-medium text-gray-700 break-words">
            Pregled prisustva, ocjena i statistika
          </p>
          <p className="mt-2 text-sm text-gray-600 break-words">
            Detaljni pregled performansi razreda, grupa i učenika
          </p>
        </div>

        {/* Shared Filters */}
        <SharedFilters
          nastavnaGodinaId={nastavnaGodinaId}
          razredNastavnaGodinaId={razredNastavnaGodinaId}
          grupaId={grupaId}
          mjesec={mjesec}
          onNastavnaGodinaChange={setNastavnaGodinaId}
          onRazredChange={setRazredNastavnaGodinaId}
          onGrupaChange={setGrupaId}
          onMjesecChange={setMjesec}
        />

        {/* Statistics Dashboard */}
        <StatisticsDashboard
          nastavnaGodinaId={nastavnaGodinaId}
          razredNastavnaGodinaId={razredNastavnaGodinaId}
          grupaId={grupaId}
          mjesec={mjesec}
        />
      </div>
    </div>
  );
}

