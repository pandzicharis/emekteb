import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
}

interface DashboardData {
  ucenici: UcenikData[];
}

type TabType = 'pregled' | 'prisustvo' | 'ocjene' | 'napredak' | 'raspored';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function RoditeljDijeteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('pregled');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedUcenik, setSelectedUcenik] = useState<UcenikData | null>(null);
  const [prisustvoData, setPrisustvoData] = useState<any>(null);
  const [ocjeneData, setOcjeneData] = useState<any>(null);
  const [napredakData, setNapredakData] = useState<any>(null);
  const [rasporedData, setRasporedData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');

        // Fetch dashboard data to get all children
        const dashboardRes = await axios.get<DashboardData>(`${API_URL}/roditelj/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDashboardData(dashboardRes.data);

        // Find the selected child
        const ucenik = dashboardRes.data.ucenici.find((u) => u.id === id);
        if (!ucenik) {
          setError('Učenik nije pronađen');
          setLoading(false);
          return;
        }
        setSelectedUcenik(ucenik);

        // Fetch all detail data
        const [prisustvoRes, ocjeneRes, napredakRes, rasporedRes] = await Promise.all([
          axios.get(`${API_URL}/roditelj/ucenik/${id}/prisustvo`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/roditelj/ucenik/${id}/ocjene`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/roditelj/ucenik/${id}/napredak`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/roditelj/ucenik/${id}/raspored`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setPrisustvoData(prisustvoRes.data);
        setOcjeneData(ocjeneRes.data);
        setNapredakData(napredakRes.data);
        setRasporedData(rasporedRes.data);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || 'Greška pri učitavanju podataka');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const handleUcenikChange = (newId: string) => {
    navigate(`/roditelj/dijete/${newId}`);
  };

  // Prepare chart data for prisustvo
  const prisustvoChartData = prisustvoData?.statistike
    ? [
        { name: 'Prisutni', value: prisustvoData.statistike.prisutni, color: '#10b981' },
        { name: 'Opravdani', value: prisustvoData.statistike.opravdani, color: '#f59e0b' },
        { name: 'Neopravdani', value: prisustvoData.statistike.neopravdani, color: '#ef4444' },
      ]
    : [];

  // Prepare chart data for ocjene distribution
  const ocjeneDistribution = ocjeneData?.statistike?.distribucija
    ? Object.entries(ocjeneData.statistike.distribucija).map(([ocjena, count]) => ({
        name: `Ocjena ${ocjena}`,
        value: count as number,
      }))
    : [];

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

  if (error || !selectedUcenik) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 font-medium">Greška</p>
          <p className="text-red-600 mt-2">{error || 'Učenik nije pronađen'}</p>
          <Link to="/" className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
            Nazad na Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: TabType; name: string; icon: JSX.Element }> = [
    {
      id: 'pregled',
      name: 'Pregled',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'prisustvo',
      name: 'Prisustvo',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'ocjene',
      name: 'Ocjene',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      id: 'napredak',
      name: 'Napredak',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      id: 'raspored',
      name: 'Raspored',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Nazad na Dashboard
            </Link>
            {dashboardData && dashboardData.ucenici.length > 1 && (
              <select
                value={id}
                onChange={(e) => handleUcenikChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {dashboardData.ucenici.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ime} {u.prezime}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-6">
              {selectedUcenik.fotografija ? (
                <img
                  src={`${API_URL}${selectedUcenik.fotografija}`}
                  alt={`${selectedUcenik.ime} ${selectedUcenik.prezime}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-indigo-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl">
                  {selectedUcenik.ime.charAt(0).toUpperCase()}
                  {selectedUcenik.prezime.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {selectedUcenik.ime} {selectedUcenik.prezime}
                </h1>
                {selectedUcenik.razred && (
                  <p className="text-lg text-gray-600 mb-4">
                    {selectedUcenik.razred.name} - Grupa {selectedUcenik.razred.grupa}
                  </p>
                )}
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Prisustvo:</span>
                    <span className="text-sm font-semibold text-green-600">
                      {selectedUcenik.statistike.procenatPrisustva}%
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm text-gray-600">Prosjek:</span>
                    <span className="text-sm font-semibold text-amber-600">
                      {selectedUcenik.statistike.prosjekOcjena.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Pregled Tab */}
            {activeTab === 'pregled' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                    <p className="text-sm font-medium text-blue-100 mb-2">Prosjek Prisustva</p>
                    <p className="text-3xl font-bold">{selectedUcenik.statistike.procenatPrisustva}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
                    <p className="text-sm font-medium text-amber-100 mb-2">Prosjek Ocjena</p>
                    <p className="text-3xl font-bold">{selectedUcenik.statistike.prosjekOcjena.toFixed(2)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                    <p className="text-sm font-medium text-green-100 mb-2">Ukupno Ocjena</p>
                    <p className="text-3xl font-bold">{selectedUcenik.statistike.ukupnoOcjena}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Prisustvo Detalji</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prisutni:</span>
                        <span className="font-semibold text-green-600">{selectedUcenik.statistike.prisutni}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opravdani:</span>
                        <span className="font-semibold text-yellow-600">{selectedUcenik.statistike.opravdani}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Neopravdani:</span>
                        <span className="font-semibold text-red-600">{selectedUcenik.statistike.neopravdani}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ukupno:</span>
                        <span className="font-semibold">{selectedUcenik.statistike.ukupnoPrisustva}</span>
                      </div>
                    </div>
                  </div>

                  {napredakData?.napredak && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Napredak</h3>
                      {napredakData.napredak.razred && (
                        <div className="mb-3">
                          <span className="text-gray-600">Razred: </span>
                          <span className="font-semibold">{napredakData.napredak.razred}</span>
                        </div>
                      )}
                      {napredakData.napredak.pohvaleIPriznanja &&
                        napredakData.napredak.pohvaleIPriznanja.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-2">Pohvale i priznanja:</p>
                            <div className="flex flex-wrap gap-2">
                              {napredakData.napredak.pohvaleIPriznanja.map((pohvala: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                                >
                                  {pohvala}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prisustvo Tab */}
            {activeTab === 'prisustvo' && prisustvoData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistike</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ukupno:</span>
                        <span className="font-semibold">{prisustvoData.statistike.ukupno}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prisutni:</span>
                        <span className="font-semibold text-green-600">{prisustvoData.statistike.prisutni}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opravdani:</span>
                        <span className="font-semibold text-yellow-600">{prisustvoData.statistike.opravdani}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Neopravdani:</span>
                        <span className="font-semibold text-red-600">{prisustvoData.statistike.neopravdani}</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600">Procenat prisustva:</span>
                          <span className="font-semibold">{prisustvoData.statistike.procenat}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className="bg-green-600 h-4 rounded-full transition-all"
                            style={{ width: `${prisustvoData.statistike.procenat}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {prisustvoChartData.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribucija</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={prisustvoChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {prisustvoChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lista Prisustva</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Datum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Razred
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Napomena
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {prisustvoData.prisustva && prisustvoData.prisustva.length > 0 ? (
                          prisustvoData.prisustva.map((prisustvo: any) => (
                            <tr key={prisustvo.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(prisustvo.datum).toLocaleDateString('bs-BA')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    prisustvo.status === 'PRISUTAN'
                                      ? 'bg-green-100 text-green-800'
                                      : prisustvo.status === 'OPRAVDAN'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {prisustvo.status === 'PRISUTAN'
                                    ? 'Prisutan'
                                    : prisustvo.status === 'OPRAVDAN'
                                    ? 'Opravdan'
                                    : 'Neopravdan'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prisustvo.razred}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{prisustvo.napomena || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                              Nema podataka o prisustvu
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Ocjene Tab */}
            {activeTab === 'ocjene' && ocjeneData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistike</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prosjek ocjena:</span>
                        <span className="font-semibold text-amber-600">
                          {ocjeneData.statistike.prosjek.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ukupno ocjena:</span>
                        <span className="font-semibold">{ocjeneData.statistike.ukupno}</span>
                      </div>
                    </div>
                  </div>

                  {ocjeneDistribution.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribucija Ocjena</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={ocjeneDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lista Ocjena</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {ocjeneData.ocjene && ocjeneData.ocjene.length > 0 ? (
                      ocjeneData.ocjene.map((ocjena: any) => (
                        <div
                          key={ocjena.id}
                          className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="text-3xl font-bold text-amber-600">{ocjena.ocjena}</span>
                                <div>
                                  <p className="font-medium text-gray-900">{ocjena.lekcija.naslov}</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(ocjena.datum).toLocaleDateString('bs-BA')} - {ocjena.razred}
                                  </p>
                                </div>
                              </div>
                              {ocjena.komentar && <p className="text-sm text-gray-500 mt-2">{ocjena.komentar}</p>}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-8">Nema ocjena</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Napredak Tab */}
            {activeTab === 'napredak' && napredakData && (
              <div className="space-y-6">
                {napredakData.napredak ? (
                  <>
                    {napredakData.napredak.razred && (
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                        <p className="text-sm font-medium text-indigo-100 mb-1">Razred</p>
                        <p className="text-2xl font-bold">{napredakData.napredak.razred}</p>
                      </div>
                    )}

                    {napredakData.napredak.sufaraLekcije && napredakData.napredak.sufaraLekcije.length > 0 && (
                      <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sufara Lekcije</h3>
                        <div className="flex flex-wrap gap-3">
                          {napredakData.napredak.sufaraLekcije.map((lekcija: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                            >
                              {lekcija}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {napredakData.napredak.pohvaleIPriznanja &&
                      napredakData.napredak.pohvaleIPriznanja.length > 0 && (
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pohvale i Priznanja</h3>
                          <div className="flex flex-wrap gap-3">
                            {napredakData.napredak.pohvaleIPriznanja.map((pohvala: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium"
                              >
                                {pohvala}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {napredakData.obrazovanje && (
                      <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Obrazovanje</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {napredakData.obrazovanje.nivoObrazovanja && (
                            <div>
                              <p className="text-sm text-gray-600">Nivo obrazovanja:</p>
                              <p className="font-medium">{napredakData.obrazovanje.nivoObrazovanja}</p>
                            </div>
                          )}
                          {napredakData.obrazovanje.razred && (
                            <div>
                              <p className="text-sm text-gray-600">Razred:</p>
                              <p className="font-medium">{napredakData.obrazovanje.razred}</p>
                            </div>
                          )}
                          {napredakData.obrazovanje.mektebStepen && (
                            <div>
                              <p className="text-sm text-gray-600">Mekteb stepen:</p>
                              <p className="font-medium">{napredakData.obrazovanje.mektebStepen}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-8 text-center">
                    <p className="text-gray-500">Nema podataka o napretku</p>
                  </div>
                )}
              </div>
            )}

            {/* Raspored Tab */}
            {activeTab === 'raspored' && rasporedData && (
              <div className="space-y-6">
                {rasporedData.raspored ? (
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-8 text-white">
                    <h3 className="text-2xl font-bold mb-6">Raspored Časova</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-blue-100 mb-1">Dan:</p>
                        <p className="text-xl font-semibold capitalize">{rasporedData.raspored.dan}</p>
                      </div>
                      <div>
                        <p className="text-blue-100 mb-1">Vrijeme:</p>
                        <p className="text-xl font-semibold">{rasporedData.raspored.slot}</p>
                      </div>
                      {rasporedData.raspored.lokacija && (
                        <div>
                          <p className="text-blue-100 mb-1">Lokacija:</p>
                          <p className="text-xl font-semibold">{rasporedData.raspored.lokacija}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-blue-100 mb-1">Trajanje:</p>
                        <p className="text-xl font-semibold">{rasporedData.raspored.trajanje} minuta</p>
                      </div>
                    </div>
                    {rasporedData.razred && (
                      <div className="mt-6 pt-6 border-t border-blue-400">
                        <p className="text-blue-100 mb-1">Razred:</p>
                        <p className="text-xl font-semibold">{rasporedData.razred.name}</p>
                        {rasporedData.grupa && (
                          <p className="text-lg text-blue-100 mt-2">Grupa: {rasporedData.grupa.naziv}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-8 text-center">
                    <p className="text-gray-500">Nema rasporeda</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

