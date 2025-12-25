import { useState, useEffect } from 'react';
import axios from 'axios';
import NastavnaGodinaStats from './NastavnaGodinaStats';
import RazredStats from './RazredStats';
import UcenikStats from './UcenikStats';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface StatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'razred' | 'grupa' | 'ucenik';
  itemId: string;
  filters: {
    nastavnaGodinaId: string;
    razredNastavnaGodinaId?: string;
    grupaId?: string;
    mjesec?: number | null;
  };
}

export default function StatsDrawer({ isOpen, onClose, type, itemId, filters }: StatsDrawerProps) {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !itemId) {
      setStatsData(null);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');

        if (type === 'ucenik') {
          const response = await axios.get(`${API_URL}/reports/ucenik-stats`, {
            params: {
              ucenikId: itemId,
              nastavnaGodinaId: filters.nastavnaGodinaId || undefined,
              razredNastavnaGodinaId: filters.razredNastavnaGodinaId || undefined,
              grupaId: filters.grupaId || undefined,
              mjesec: filters.mjesec || undefined,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setStatsData({ type: 'ucenik', data: response.data });
        } else if (type === 'razred') {
          const response = await axios.get(`${API_URL}/reports/razred-stats`, {
            params: {
              nastavnaGodinaId: filters.nastavnaGodinaId,
              razredNastavnaGodinaId: itemId,
              mjesec: filters.mjesec || undefined,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setStatsData({ type: 'razred', data: response.data });
        } else if (type === 'grupa') {
          // For grupa, get razred stats and filter to show only this grupa
          if (!filters.razredNastavnaGodinaId) {
            setError('Razred nije odabran');
            return;
          }
          const response = await axios.get(`${API_URL}/reports/razred-stats`, {
            params: {
              nastavnaGodinaId: filters.nastavnaGodinaId,
              razredNastavnaGodinaId: filters.razredNastavnaGodinaId,
              mjesec: filters.mjesec || undefined,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          // Filter to show only this grupa's stats
          if (response.data.grupe) {
            const grupaData = response.data.grupe.find((g: any) => g.id === itemId);
            if (grupaData) {
              // Create a filtered version of razred stats for this grupa
              setStatsData({ 
                type: 'grupa', 
                data: {
                  ...response.data,
                  grupaData,
                  // Override razred-level stats with grupa stats
                  brojUcenika: grupaData.brojUcenika,
                  prosjekPrisustva: grupaData.prosjekPrisustva,
                  prosjekOcjena: grupaData.prosjekOcjena,
                  ukupnoCasova: grupaData.brojCasova,
                  ukupnoOcjena: grupaData.brojOcjena,
                }
              });
            } else {
              setError('Grupa nije pronađena');
            }
          }
        }
      } catch (err: any) {
        console.error('Error fetching stats:', err);
        setError(err.response?.data?.message || 'Greška pri učitavanju statistika');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isOpen, itemId, type, filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
      {/* Overlay - pokriva ceo ekran */}
      <div
        className="fixed bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={onClose}
        style={{ 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0
        }}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-screen w-full max-w-4xl bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 shadow-sm z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {type === 'razred' && 'Statistike razreda'}
                {type === 'grupa' && 'Statistike grupe'}
                {type === 'ucenik' && 'Statistike učenika'}
              </h2>
              <p className="text-gray-600 mt-1">Detaljne statistike i analize</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && statsData && (
            <>
              {statsData.type === 'nastavnaGodina' && <NastavnaGodinaStats data={statsData.data} />}
              {statsData.type === 'razred' && (
                <RazredStats 
                  data={statsData.data} 
                  nastavnaGodinaId={filters.nastavnaGodinaId}
                  razredNastavnaGodinaId={filters.razredNastavnaGodinaId}
                  mjesec={filters.mjesec}
                />
              )}
              {statsData.type === 'ucenik' && <UcenikStats data={statsData.data} />}
              {statsData.type === 'grupa' && statsData.data && (
                <RazredStats 
                  data={statsData.data}
                  nastavnaGodinaId={filters.nastavnaGodinaId}
                  razredNastavnaGodinaId={filters.razredNastavnaGodinaId}
                  mjesec={filters.mjesec}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

