import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReportsList from './reports/ReportsList';
import StatsDrawer from './reports/StatsDrawer';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface StatisticsDashboardProps {
  nastavnaGodinaId: string;
  razredNastavnaGodinaId: string;
  grupaId: string;
  mjesec: number | null;
}

export default function StatisticsDashboard({
  nastavnaGodinaId,
  razredNastavnaGodinaId,
  grupaId,
  mjesec,
}: StatisticsDashboardProps) {
  const [listData, setListData] = useState<{
    razredi: any[];
    grupe: any[];
    ucenici: any[];
  }>({
    razredi: [],
    grupe: [],
    ucenici: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'razred' | 'grupa' | 'ucenik' } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchList = useCallback(async () => {
    if (!nastavnaGodinaId && !razredNastavnaGodinaId && !grupaId) {
      setListData({ razredi: [], grupe: [], ucenici: [] });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/reports/list`, {
        params: {
          nastavnaGodinaId: nastavnaGodinaId || undefined,
          razredNastavnaGodinaId: razredNastavnaGodinaId || undefined,
          grupaId: grupaId || undefined,
          mjesec: mjesec || undefined,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setListData(response.data);
    } catch (err: any) {
      console.error('Error fetching list:', err);
      setError(err.response?.data?.message || 'Greška pri učitavanju liste');
    } finally {
      setLoading(false);
    }
  }, [nastavnaGodinaId, razredNastavnaGodinaId, grupaId, mjesec]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleItemClick = (item: { id: string; type: 'razred' | 'grupa' | 'ucenik' }) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  // Determine which list to show
  const getListType = (): 'razredi' | 'grupe' | 'ucenici' => {
    if (grupaId) return 'ucenici';
    if (razredNastavnaGodinaId) return 'grupe';
    return 'razredi';
  };

  const getListData = () => {
    const type = getListType();
    return listData[type] || [];
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <ReportsList
        type={getListType()}
        data={getListData()}
        onItemClick={handleItemClick}
        loading={loading}
      />

      {selectedItem && (
        <StatsDrawer
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          type={selectedItem.type}
          itemId={selectedItem.id}
          filters={{
            nastavnaGodinaId,
            razredNastavnaGodinaId,
            grupaId,
            mjesec,
          }}
        />
      )}
    </div>
  );
}
