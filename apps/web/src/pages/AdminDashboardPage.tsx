import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import DistributionChart from '../components/reports/DistributionChart';
import TrendChart from '../components/reports/TrendChart';
import ComparisonChart from '../components/reports/ComparisonChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface DashboardStats {
  overview: {
    ukupnoUcenika: number;
    aktivnihUcenika: number;
    ukupnoMuallima: number;
    aktivnihMuallima: number;
    ukupnoRazreda: number;
    aktivnihRazreda: number;
    ukupnoGrupa: number;
    ukupnoLekcija: number;
    ukupnoCasova: number;
    ukupnoPrisustva: number;
    ukupnoOcjena: number;
    prosjekOcjena: number;
    ukupnoImporta: number;
  };
  ucenici: {
    byStatus: { aktivni: number; arhivirani: number };
    bySpol: { muski: number; zenski: number };
    byRazred: Array<{ razred: string; count: number }>;
  };
  muallimi: {
    aktivni: number;
    byRazred: Array<{ razred: string; count: number }>;
  };
  razredi: {
    ukupno: number;
    aktivni: number;
    list: Array<{ razred: string; grupe: number; ucenici: number }>;
  };
  grupe: {
    ukupno: number;
    byRazred: Array<{ razred: string; count: number }>;
  };
  lekcije: {
    ukupno: number;
    aktivne: number;
    byTip: Array<{ tip: string; count: number }>;
  };
  prisustvo: {
    ukupno: number;
    prisutni: number;
    opravdani: number;
    neopravdani: number;
    procenatPrisustva: number;
    byRazred: Array<{ razred: string; procenat: number }>;
    monthlyTrend: Array<{ mjesec: string; prisutni: number; ukupno: number }>;
  };
  ocjene: {
    ukupno: number;
    prosjek: number;
    distribucija: { [ocjena: string]: number };
    byRazred: Array<{ razred: string; prosjek: number }>;
  };
  imports: {
    ukupno: number;
    uspjesni: number;
    neuspesni: number;
    recent: Array<{
      id: string;
      nazivFajla: string;
      status: string;
      ukupnoRedova: number;
      uspjesnoSacuvano: number;
      novih: number;
      updateanih: number;
      gresaka: number;
      kreiran: string;
    }>;
  };
  nastavnaGodina: {
    aktivna: {
      id: string;
      naziv: string;
      opis: string | null;
      datumOd: string;
      datumDo: string;
      status: string;
      nastavniPlan: {
        id: string;
        naziv: string;
      };
    } | null;
    ukupno: number;
  };
}

const StatCard = ({
  title,
  value,
  icon,
  iconBg,
  link,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  link?: string;
}) => {
  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className={`flex-shrink-0 ${iconBg} rounded-md p-3`}>{icon}</div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link to={link} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const response = await axios.get<DashboardStats>(`${API_URL}/admin/dashboard-stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStats(response.data);
        setLastUpdated(new Date());
      } catch (err: any) {
        console.error('Error fetching dashboard stats:', err);
        setError(err.response?.data?.message || 'Greška pri učitavanju podataka');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje dashboard podataka...</p>
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

  if (!stats) {
    return null;
  }

  // Prepare chart data
  const studentiByStatusData = [
    { name: 'Aktivni', value: stats.ucenici.byStatus.aktivni },
    { name: 'Arhivirani', value: stats.ucenici.byStatus.arhivirani },
  ];

  const studentiBySpolData = [
    { name: 'Muški', value: stats.ucenici.bySpol.muski },
    { name: 'Ženski', value: stats.ucenici.bySpol.zenski },
  ];

  const lekcijeByTipData = stats.lekcije.byTip.map((item) => ({
    name: item.tip.replace('_', ' '),
    value: item.count,
  }));

  const prisustvoByRazredData = stats.prisustvo.byRazred.map((item) => ({
    name: item.razred,
    procenat: item.procenat,
  }));

  const ocjeneDistribucijaData = Object.entries(stats.ocjene.distribucija).map(([ocjena, count]) => ({
    name: `Ocjena ${ocjena}`,
    value: count,
  }));

  const monthlyTrendData = stats.prisustvo.monthlyTrend.map((item) => ({
    name: item.mjesec,
    prisutni: item.prisutni,
    ukupno: item.ukupno,
    procenat: item.ukupno > 0 ? Math.round((item.prisutni / item.ukupno) * 100 * 100) / 100 : 0,
  }));

  const muallimiByRazredData = stats.muallimi.byRazred.map((item) => ({
    name: item.razred,
    count: item.count,
  }));

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 break-words">Admin Dashboard</h1>
              <p className="mt-1 text-base font-medium text-gray-700 break-words">
                Džemat Grbavica 2
              </p>
              {stats.nastavnaGodina.aktivna && (
                <p className="mt-2 text-sm text-gray-600 break-words">
                  Aktivna nastavna godina: {stats.nastavnaGodina.aktivna.naziv}
                  {stats.nastavnaGodina.aktivna.opis && ` - ${stats.nastavnaGodina.aktivna.opis}`}
                </p>
              )}
            </div>
            {lastUpdated && (
              <div className="text-sm text-gray-500">
                Posljednje ažuriranje: {lastUpdated.toLocaleTimeString('bs-BA')}
              </div>
            )}
          </div>
        </div>

        {/* Overview Statistics Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Ukupno Učenika"
            value={stats.overview.ukupnoUcenika}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            }
            iconBg="bg-blue-500"
            link="/ucenici"
          />

          <StatCard
            title="Aktivnih Učenika"
            value={stats.overview.aktivnihUcenika}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            iconBg="bg-green-500"
          />

          <StatCard
            title="Ukupno Muallima"
            value={stats.overview.ukupnoMuallima}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            iconBg="bg-purple-500"
            link="/settings/muallimi"
          />

          <StatCard
            title="Aktivnih Muallima"
            value={stats.overview.aktivnihMuallima}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            }
            iconBg="bg-indigo-500"
          />

          <StatCard
            title="Ukupno Razreda"
            value={stats.overview.ukupnoRazreda}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            }
            iconBg="bg-yellow-500"
          />

          <StatCard
            title="Aktivnih Razreda"
            value={stats.overview.aktivnihRazreda}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            iconBg="bg-orange-500"
          />

          <StatCard
            title="Ukupno Grupa"
            value={stats.overview.ukupnoGrupa}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            iconBg="bg-teal-500"
          />

          <StatCard
            title="Ukupno Lekcija"
            value={stats.overview.ukupnoLekcija}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            }
            iconBg="bg-pink-500"
          />

          <StatCard
            title="Ukupno Časova"
            value={stats.overview.ukupnoCasova}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            iconBg="bg-cyan-500"
          />

          <StatCard
            title="Ukupno Prisustva"
            value={stats.overview.ukupnoPrisustva}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            }
            iconBg="bg-emerald-500"
          />

          <StatCard
            title="Prosjek Ocjena"
            value={stats.overview.prosjekOcjena.toFixed(2)}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            }
            iconBg="bg-amber-500"
          />

          <StatCard
            title="Ukupno Importa"
            value={stats.overview.ukupnoImporta}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            }
            iconBg="bg-red-500"
          />
        </div>

        {/* Charts Section */}
        <div className="space-y-6 mb-8">
          {/* Row 1: Student Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DistributionChart
              data={studentiByStatusData}
              type="pie"
              title="Učenici po Statusu"
              colors={['#10b981', '#6b7280']}
            />
            <DistributionChart
              data={studentiBySpolData}
              type="pie"
              title="Učenici po Spolu"
              colors={['#3b82f6', '#ec4899']}
            />
          </div>

          {/* Row 2: Attendance Overview */}
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Prisustvo po Razredu (%)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prisustvoByRazredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="procenat" fill="#3b82f6" name="Procenat prisustva (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Row 3: Grade Distribution */}
          <DistributionChart
            data={ocjeneDistribucijaData}
            type="bar"
            title="Distribucija Ocjena"
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
          />

          {/* Row 4: Monthly Attendance Trend */}
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mjesečni Trend Prisustva</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="prisutni" fill="#10b981" name="Prisutni" />
                <Bar dataKey="ukupno" fill="#6b7280" name="Ukupno" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Row 5: Lessons by Type */}
          <DistributionChart
            data={lekcijeByTipData}
            type="pie"
            title="Lekcije po Tipu"
            colors={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']}
          />

          {/* Row 6: Teachers by Razred */}
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Muallimi po Razredu</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={muallimiByRazredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Broj muallima" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Brze Akcije</h2>
            <div className="grid grid-cols-1 gap-4">
              <Link
                to="/import"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <svg className="h-8 w-8 text-blue-600 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Import Učenika</p>
                  <p className="text-sm text-gray-600">Uvezi CSV fajl sa učenikom</p>
                </div>
              </Link>

              <Link
                to="/setup-nastavna-godina"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <svg className="h-8 w-8 text-green-600 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Podešavanje Nastavne Godine</p>
                  <p className="text-sm text-gray-600">Upravljaj nastavnim godinama</p>
                </div>
              </Link>

              <Link
                to="/izvjestaji"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <svg className="h-8 w-8 text-yellow-600 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Pregled Izvještaja</p>
                  <p className="text-sm text-gray-600">Detaljni izvještaji i statistike</p>
                </div>
              </Link>

              <Link
                to="/settings/muallimi"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <svg className="h-8 w-8 text-purple-600 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Upravljanje Muallimima</p>
                  <p className="text-sm text-gray-600">Pregled i upravljanje muallimima</p>
                </div>
              </Link>

              <Link
                to="/komunikacija"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <svg className="h-8 w-8 text-indigo-600 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Poruke</p>
                  <p className="text-sm text-gray-600">Komunikacija i poruke</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Posljednji Importi</h2>
            {stats.imports.recent.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nema nedavnih importa</p>
            ) : (
              <div className="space-y-4">
                {stats.imports.recent.map((imp) => (
                  <div key={imp.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">{imp.nazivFajla}</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          imp.status === 'USPJESAN'
                            ? 'bg-green-100 text-green-800'
                            : imp.status === 'NEUSPJESAN'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {imp.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Redova:</span> {imp.ukupnoRedova}
                      </div>
                      <div>
                        <span className="font-medium">Sačuvano:</span> {imp.uspjesnoSacuvano}
                      </div>
                      <div>
                        <span className="font-medium">Novih:</span> {imp.novih}
                      </div>
                      <div>
                        <span className="font-medium">Ažurirano:</span> {imp.updateanih}
                      </div>
                    </div>
                    {imp.gresaka > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        <span className="font-medium">Greške:</span> {imp.gresaka}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      {new Date(imp.kreiran).toLocaleString('bs-BA')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
