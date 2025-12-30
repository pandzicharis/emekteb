import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import ExportButton from '../components/ExportButton';
import { ExportColumn } from '../utils/exportUtils';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface UcenikData {
  id: string;
  ime: string;
  prezime: string;
  fotografija: string | null;
  razred: {
    id: string;
    name: string;
    ilmihal: string;
    grupa: string;
  } | null;
  statistike: {
    procenatPrisustva: number;
    prosjekOcjena: number;
    ukupnoPrisustva: number;
    prisutni: number;
    opravdani: number;
    neopravdani: number;
    ukupnoOcjena: number;
  };
  napredak: any;
}

interface DashboardData {
  nastavnaGodina: {
    id: string;
    naziv: string;
    opis: string | null;
    datumOd: string;
    datumDo: string;
  } | null;
  ucenici: UcenikData[];
  statistike: {
    ukupnoUcenika: number;
    prosjekPrisustva: number;
    prosjekOcjena: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'ocjena' | 'prisustvo';
  ucenikIme: string;
  ucenikId: string;
  datum: string;
  opis: string;
  vrijednost?: number;
}

export default function RoditeljDashboardPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUcenik, setExpandedUcenik] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [selectedUcenikData, setSelectedUcenikData] = useState<{
    prisustvo: any;
    ocjene: any;
    napredak: any;
    raspored: any;
  } | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const response = await axios.get<DashboardData>(`${API_URL}/roditelj/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDashboardData(response.data);

        // Fetch recent activities (ocjene)
        if (response.data.ucenici.length > 0) {
          const activities: RecentActivity[] = [];
          for (const ucenik of response.data.ucenici.slice(0, 3)) {
            try {
              const ocjeneRes = await axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/ocjene`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (ocjeneRes.data.ocjene && ocjeneRes.data.ocjene.length > 0) {
                const recentOcjene = ocjeneRes.data.ocjene.slice(0, 3);
                recentOcjene.forEach((ocjena: any) => {
                  activities.push({
                    id: ocjena.id,
                    type: 'ocjena',
                    ucenikIme: `${ucenik.ime} ${ucenik.prezime}`,
                    ucenikId: ucenik.id,
                    datum: ocjena.datum,
                    opis: ocjena.lekcija.naslov,
                    vrijednost: ocjena.ocjena,
                  });
                });
              }
            } catch (err) {
              console.error('Error fetching ocjene for activity:', err);
            }
          }
          activities.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
          setRecentActivities(activities.slice(0, 5));
        }
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.response?.data?.message || 'Greška pri učitavanju podataka');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const fetchUcenikDetails = async (ucenikId: string) => {
    try {
      const token = localStorage.getItem('token');
      const [prisustvoRes, ocjeneRes, napredakRes, rasporedRes] = await Promise.all([
        axios.get(`${API_URL}/roditelj/ucenik/${ucenikId}/prisustvo`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/roditelj/ucenik/${ucenikId}/ocjene`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/roditelj/ucenik/${ucenikId}/napredak`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/roditelj/ucenik/${ucenikId}/raspored`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setSelectedUcenikData({
        prisustvo: prisustvoRes.data,
        ocjene: ocjeneRes.data,
        napredak: napredakRes.data,
        raspored: rasporedRes.data,
      });
    } catch (err: any) {
      console.error('Error fetching ucenik details:', err);
    }
  };

  const handleToggleUcenik = (ucenikId: string) => {
    if (expandedUcenik === ucenikId) {
      setExpandedUcenik(null);
      setSelectedUcenikData(null);
    } else {
      setExpandedUcenik(ucenikId);
      fetchUcenikDetails(ucenikId);
    }
  };

  // Generate mock trend data for charts (last 7 days)
  const generateTrendData = () => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        name: date.toLocaleDateString('bs-BA', { weekday: 'short' }),
        prisustvo: Math.floor(Math.random() * 20) + 80, // Mock data
        ocjene: parseFloat((Math.random() * 1.5 + 3.5).toFixed(2)), // Mock data
      });
    }
    return data;
  };

  const trendData = generateTrendData();

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

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 font-medium">Greška</p>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Pokušaj ponovo
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 break-words">Dashboard Roditelja</h1>
              <p className="mt-2 text-lg font-medium text-gray-700 break-words">
                Dobrodošli, {user?.ime} {user?.prezime}
              </p>
              {dashboardData.nastavnaGodina && (
                <p className="mt-2 text-sm text-gray-600 break-words">
                  Aktivna nastavna godina: {dashboardData.nastavnaGodina.naziv}
                </p>
              )}
            </div>
            <div>
              {dashboardData && (
                <ExportButton
                  data={dashboardData.ucenici.map((ucenik) => ({
                    ime: ucenik.ime,
                    prezime: ucenik.prezime,
                    razred: ucenik.razred?.name || 'N/A',
                    procenatPrisustva: `${ucenik.statistike.procenatPrisustva.toFixed(1)}%`,
                    prosjekOcjena: ucenik.statistike.prosjekOcjena.toFixed(2),
                    ukupnoPrisustva: ucenik.statistike.ukupnoPrisustva,
                    prisutni: ucenik.statistike.prisutni,
                    opravdani: ucenik.statistike.opravdani,
                    neopravdani: ucenik.statistike.neopravdani,
                  }))}
                  columns={[
                    { header: 'Ime', dataKey: 'ime' },
                    { header: 'Prezime', dataKey: 'prezime' },
                    { header: 'Razred', dataKey: 'razred' },
                    { header: 'Procenat prisustva', dataKey: 'procenatPrisustva' },
                    { header: 'Prosjek ocjena', dataKey: 'prosjekOcjena' },
                    { header: 'Ukupno prisustva', dataKey: 'ukupnoPrisustva' },
                    { header: 'Prisutni', dataKey: 'prisutni' },
                    { header: 'Opravdani', dataKey: 'opravdani' },
                    { header: 'Neopravdani', dataKey: 'neopravdani' },
                  ]}
                  title="Dashboard Podaci"
                  filename="roditelj-dashboard"
                />
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Link
            to="/roditelj/kalendar"
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 flex items-center gap-3 group hover:scale-105"
          >
            <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-medium text-gray-700">Kalendar</span>
          </Link>

          <Link
            to="/roditelj/statistike"
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 flex items-center gap-3 group hover:scale-105"
          >
            <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-medium text-gray-700">Statistike</span>
          </Link>

          <Link
            to="/komunikacija"
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 flex items-center gap-3 group hover:scale-105"
          >
            <div className="bg-indigo-100 p-3 rounded-lg group-hover:bg-indigo-200 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="font-medium text-gray-700">Poruke</span>
          </Link>

          <Link
            to="/roditelj/obavjestenja"
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 flex items-center gap-3 group hover:scale-105 relative"
          >
            <div className="bg-orange-100 p-3 rounded-lg group-hover:bg-orange-200 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span className="font-medium text-gray-700">Obavještenja</span>
            {recentActivities.length > 0 && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {recentActivities.length}
              </span>
            )}
          </Link>

          <Link
            to="/roditelj/zadace"
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 flex items-center gap-3 group hover:scale-105"
          >
            <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-medium text-gray-700">Zadaće</span>
          </Link>
        </div>

        {/* Overview Statistics Cards with Mini Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-xl p-3">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-100 mb-1">Ukupno Učenika</p>
              <p className="text-4xl font-bold mb-4">{dashboardData.statistike.ukupnoUcenika}</p>
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <Area type="monotone" dataKey="prisustvo" stroke="#fff" fill="rgba(255,255,255,0.3)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-xl p-3">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-green-100 mb-1">Prosjek Prisustva</p>
              <p className="text-4xl font-bold mb-4">{dashboardData.statistike.prosjekPrisustva}%</p>
              <div className="relative pt-2">
                <div className="overflow-hidden h-2 mb-2 text-xs flex rounded-full bg-green-700">
                  <div
                    style={{ width: `${dashboardData.statistike.prosjekPrisustva}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-white bg-opacity-50"
                  ></div>
                </div>
              </div>
              <div className="h-16 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line type="monotone" dataKey="prisustvo" stroke="#fff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-xl p-3">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-100 mb-1">Prosjek Ocjena</p>
              <p className="text-4xl font-bold mb-4">{dashboardData.statistike.prosjekOcjena.toFixed(2)}</p>
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line type="monotone" dataKey="ocjene" stroke="#fff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Recent Activity Feed */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Nedavne Aktivnosti
              </h2>
              {recentActivities.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nema nedavnih aktivnosti</p>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <Link
                      key={activity.id}
                      to={`/roditelj/dijete/${activity.ucenikId}`}
                      className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border-l-4 border-indigo-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {activity.type === 'ocjena' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Ocjena
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Prisustvo
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900">{activity.ucenikIme}</span>
                          </div>
                          <p className="text-sm text-gray-700">{activity.opis}</p>
                          {activity.vrijednost && (
                            <p className="text-lg font-bold text-amber-600 mt-1">{activity.vrijednost}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(activity.datum).toLocaleDateString('bs-BA', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link
                to="/roditelj/obavjestenja"
                className="mt-4 block text-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
              >
                Vidi sve →
              </Link>
            </div>
          </div>

          {/* Children List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Moja Djeca</h2>
                <Link
                  to="/roditelj/statistike"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Vidi statistike →
                </Link>
              </div>
              {dashboardData.ucenici.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="mt-4 text-gray-500">Nemate povezanih učenika.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.ucenici.map((ucenik) => (
                    <div
                      key={ucenik.id}
                      className="bg-gradient-to-r from-gray-50 to-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
                    >
                      <Link
                        to={`/roditelj/dijete/${ucenik.id}`}
                        className="block p-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            {ucenik.fotografija ? (
                              <img
                                src={`${API_URL}${ucenik.fotografija}`}
                                alt={`${ucenik.ime} ${ucenik.prezime}`}
                                className="w-16 h-16 rounded-full object-cover border-4 border-indigo-200 shadow-md"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                                {ucenik.ime.charAt(0).toUpperCase()}
                                {ucenik.prezime.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                                {ucenik.ime} {ucenik.prezime}
                              </h3>
                              {ucenik.razred && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {ucenik.razred.name} - Grupa {ucenik.razred.grupa}
                                </p>
                              )}
                              <div className="flex items-center space-x-4 mt-2">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-sm text-gray-600">Prisustvo:</span>
                                  <span className="text-sm font-semibold text-green-600">
                                    {ucenik.statistike.procenatPrisustva}%
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">Prosjek:</span>
                                  <span className="text-sm font-semibold text-amber-600">
                                    {ucenik.statistike.prosjekOcjena.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <svg
                            className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
