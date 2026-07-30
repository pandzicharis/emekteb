import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface DashboardData {
  ucenici: Array<{ id: string; ime: string; prezime: string }>;
}

interface UcenikStatistics {
  ucenikId: string;
  ime: string;
  prezime: string;
  prisustvoData: Array<{ month: string; procenat: number }>;
  ocjeneData: Array<{ month: string; prosjek: number }>;
  distribucijaOcjena: Record<number, number>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function RoditeljStatisticsPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUcenikId, setSelectedUcenikId] = useState<string | 'all'>('all');
  const [statistics, setStatistics] = useState<UcenikStatistics[]>([]);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch dashboard to get children list
        const dashboardRes = await axios.get<DashboardData>(`${API_URL}/roditelj/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDashboardData(dashboardRes.data);

        // Fetch statistics for all children
        const statsPromises = dashboardRes.data.ucenici.map(async (ucenik) => {
          try {
            const [prisustvoRes, ocjeneRes] = await Promise.all([
              axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/prisustvo`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/ocjene`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);

            // Process prisustvo data by month
            const prisustvoByMonth: Record<string, { total: number; prisutni: number }> = {};
            if (prisustvoRes.data.prisustva) {
              prisustvoRes.data.prisustva.forEach((p: any) => {
                const date = new Date(p.datum);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!prisustvoByMonth[monthKey]) {
                  prisustvoByMonth[monthKey] = { total: 0, prisutni: 0 };
                }
                prisustvoByMonth[monthKey].total++;
                if (p.status === 'PRISUTAN' || p.status === 'OPRAVDAN') {
                  prisustvoByMonth[monthKey].prisutni++;
                }
              });
            }

            const prisustvoData = Object.entries(prisustvoByMonth).map(([month, data]) => ({
              month: month.split('-')[1], // Just month number
              procenat: data.total > 0 ? Math.round((data.prisutni / data.total) * 100) : 0,
            }));

            // Process ocjene data by month
            const ocjeneByMonth: Record<string, number[]> = {};
            if (ocjeneRes.data.ocjene) {
              ocjeneRes.data.ocjene.forEach((o: any) => {
                const date = new Date(o.datum);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!ocjeneByMonth[monthKey]) {
                  ocjeneByMonth[monthKey] = [];
                }
                ocjeneByMonth[monthKey].push(o.ocjena);
              });
            }

            const ocjeneData = Object.entries(ocjeneByMonth).map(([month, ocjene]) => ({
              month: month.split('-')[1],
              prosjek: ocjene.length > 0 ? parseFloat((ocjene.reduce((a, b) => a + b, 0) / ocjene.length).toFixed(2)) : 0,
            }));

            // Process ocjene distribution
            const distribucija: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            if (ocjeneRes.data.ocjene) {
              ocjeneRes.data.ocjene.forEach((o: any) => {
                distribucija[o.ocjena] = (distribucija[o.ocjena] || 0) + 1;
              });
            }

            return {
              ucenikId: ucenik.id,
              ime: ucenik.ime,
              prezime: ucenik.prezime,
              prisustvoData,
              ocjeneData,
              distribucijaOcjena: distribucija,
            };
          } catch (err) {
            console.error(`Error fetching stats for ${ucenik.id}:`, err);
            return null;
          }
        });

        const statsResults = await Promise.all(statsPromises);
        setStatistics(statsResults.filter((s): s is UcenikStatistics => s !== null));
      } catch (err: any) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Prepare combined data for charts
  const getCombinedPrisustvoData = () => {
    if (selectedUcenikId === 'all') {
      // Combine all children's data
      const combined: Record<string, { total: number; sum: number }> = {};
      statistics.forEach((stat) => {
        stat.prisustvoData.forEach((item) => {
          if (!combined[item.month]) {
            combined[item.month] = { total: 0, sum: 0 };
          }
          combined[item.month].total++;
          combined[item.month].sum += item.procenat;
        });
      });
      return Object.entries(combined).map(([month, data]) => ({
        month,
        procenat: data.total > 0 ? Math.round(data.sum / data.total) : 0,
      }));
    } else {
      const stat = statistics.find((s) => s.ucenikId === selectedUcenikId);
      return stat?.prisustvoData || [];
    }
  };

  const getCombinedOcjeneData = () => {
    if (selectedUcenikId === 'all') {
      const combined: Record<string, { total: number; sum: number; count: number }> = {};
      statistics.forEach((stat) => {
        stat.ocjeneData.forEach((item) => {
          if (!combined[item.month]) {
            combined[item.month] = { total: 0, sum: 0, count: 0 };
          }
          combined[item.month].total++;
          combined[item.month].sum += item.prosjek;
          combined[item.month].count++;
        });
      });
      return Object.entries(combined).map(([month, data]) => ({
        month,
        prosjek: data.count > 0 ? parseFloat((data.sum / data.count).toFixed(2)) : 0,
      }));
    } else {
      const stat = statistics.find((s) => s.ucenikId === selectedUcenikId);
      return stat?.ocjeneData || [];
    }
  };

  const getDistribucijaOcjena = () => {
    if (selectedUcenikId === 'all') {
      const combined: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      statistics.forEach((stat) => {
        Object.entries(stat.distribucijaOcjena).forEach(([ocjena, count]) => {
          combined[parseInt(ocjena)] += count;
        });
      });
      return Object.entries(combined)
        .map(([ocjena, count]) => ({
          name: `Ocjena ${ocjena}`,
          value: count,
        }))
        .filter((item) => item.value > 0);
    } else {
      const stat = statistics.find((s) => s.ucenikId === selectedUcenikId);
      if (!stat) return [];
      return Object.entries(stat.distribucijaOcjena)
        .map(([ocjena, count]) => ({
          name: `Ocjena ${ocjena}`,
          value: count,
        }))
        .filter((item) => item.value > 0);
    }
  };

  // Calculate comparison data if multiple children
  const getComparisonData = () => {
    if (statistics.length < 2) return [];
    return statistics.map((stat) => {
      const avgPrisustvo =
        stat.prisustvoData.length > 0
          ? Math.round(
              stat.prisustvoData.reduce((sum, item) => sum + item.procenat, 0) / stat.prisustvoData.length
            )
          : 0;
      const avgOcjene =
        stat.ocjeneData.length > 0
          ? parseFloat(
              (
                stat.ocjeneData.reduce((sum, item) => sum + item.prosjek, 0) / stat.ocjeneData.length
              ).toFixed(2)
            )
          : 0;
      return {
        name: `${stat.ime} ${stat.prezime}`,
        prisustvo: avgPrisustvo,
        prosjekOcjena: avgOcjene,
      };
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje podataka...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Nazad na Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Statistike</h1>
          <p className="mt-2 text-gray-600">Pregled trendova i analiza</p>
        </div>

        {/* Filters */}
        {dashboardData && dashboardData.ucenici.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtriraj po djetetu:
                </label>
                <select
                  value={selectedUcenikId}
                  onChange={(e) => setSelectedUcenikId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">Sva djeca</option>
                  {dashboardData.ucenici.map((ucenik) => (
                    <option key={ucenik.id} value={ucenik.id}>
                      {ucenik.ime} {ucenik.prezime}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Period:</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="month">Po mjesecu</option>
                  <option value="quarter">Po kvartalu</option>
                  <option value="year">Po godini</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Trend Prisustva */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Trend Prisustva</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getCombinedPrisustvoData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="procenat" stroke="#10b981" strokeWidth={2} name="Prisustvo (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Ocjena */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Trend Prosjeka Ocjena</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getCombinedOcjeneData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="prosjek" stroke="#f59e0b" strokeWidth={2} name="Prosjek ocjena" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Distribucija Ocjena */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Distribucija Ocjena</h3>
            {getDistribucijaOcjena().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getDistribucijaOcjena()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getDistribucijaOcjena().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-300 flex items-center justify-center text-gray-500">Nema podataka</div>
            )}
          </div>

          {/* Comparison Chart (if multiple children) */}
          {statistics.length >= 2 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Poređenje između djece</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getComparisonData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="prisustvo" fill="#10b981" name="Prisustvo (%)" />
                  <Bar dataKey="prosjekOcjena" fill="#f59e0b" name="Prosjek ocjena" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {selectedUcenikId === 'all' && statistics.length > 0 ? (
            <>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
                <p className="text-sm font-medium text-blue-100 mb-2">Ukupno Prosjek Prisustva</p>
                <p className="text-3xl font-bold">
                  {(() => {
                    const allPrisustvo = statistics.flatMap((s) => s.prisustvoData);
                    const avg =
                      allPrisustvo.length > 0
                        ? Math.round(allPrisustvo.reduce((sum, item) => sum + item.procenat, 0) / allPrisustvo.length)
                        : 0;
                    return `${avg}%`;
                  })()}
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-xl p-6 text-white">
                <p className="text-sm font-medium text-amber-100 mb-2">Ukupno Prosjek Ocjena</p>
                <p className="text-3xl font-bold">
                  {(() => {
                    const allOcjene = statistics.flatMap((s) => s.ocjeneData);
                    const avg =
                      allOcjene.length > 0
                        ? parseFloat(
                            (allOcjene.reduce((sum, item) => sum + item.prosjek, 0) / allOcjene.length).toFixed(2)
                          )
                        : 0;
                    return avg.toFixed(2);
                  })()}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
                <p className="text-sm font-medium text-green-100 mb-2">Ukupno Djeca</p>
                <p className="text-3xl font-bold">{statistics.length}</p>
              </div>
            </>
          ) : selectedUcenikId !== 'all' ? (
            (() => {
              const stat = statistics.find((s) => s.ucenikId === selectedUcenikId);
              if (!stat) return null;
              const avgPrisustvo =
                stat.prisustvoData.length > 0
                  ? Math.round(stat.prisustvoData.reduce((sum, item) => sum + item.procenat, 0) / stat.prisustvoData.length)
                  : 0;
              const avgOcjene =
                stat.ocjeneData.length > 0
                  ? parseFloat((stat.ocjeneData.reduce((sum, item) => sum + item.prosjek, 0) / stat.ocjeneData.length).toFixed(2))
                  : 0;
              const totalOcjena = Object.values(stat.distribucijaOcjena).reduce((a, b) => a + b, 0);
              return (
                <>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
                    <p className="text-sm font-medium text-blue-100 mb-2">Prosjek Prisustva</p>
                    <p className="text-3xl font-bold">{avgPrisustvo}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-xl p-6 text-white">
                    <p className="text-sm font-medium text-amber-100 mb-2">Prosjek Ocjena</p>
                    <p className="text-3xl font-bold">{avgOcjene.toFixed(2)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
                    <p className="text-sm font-medium text-green-100 mb-2">Ukupno Ocjena</p>
                    <p className="text-3xl font-bold">{totalOcjena}</p>
                  </div>
                </>
              );
            })()
          ) : null}
        </div>
      </div>
    </div>
  );
}





