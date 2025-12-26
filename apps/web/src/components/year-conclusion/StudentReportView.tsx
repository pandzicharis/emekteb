import { useState, useEffect } from 'react';
import axios from 'axios';
import DiplomaForm from './DiplomaForm';
import ChartsWrapper from './ChartsWrapper';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface StudentReportViewProps {
  studentId: string;
  nastavnaGodinaId: string;
  razredId: string | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function StudentReportView({ studentId, nastavnaGodinaId, razredId }: StudentReportViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customComments, setCustomComments] = useState<Record<string, string>>({});
  const [showDiploma, setShowDiploma] = useState(false);

  useEffect(() => {
    const loadStudentData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${API_URL}/reports/year-conclusion/student/${studentId}?nastavnaGodinaId=${nastavnaGodinaId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setData(response.data);
      } catch (error) {
        console.error('Error loading student data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudentData();
  }, [studentId, nastavnaGodinaId]);

  const handleGenerateReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/reports/year-conclusion/generate-report`,
        {
          ucenikId: studentId,
          nastavnaGodinaId,
          customComments,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      );

      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `izvjestaj_${data?.ucenik.ime}_${data?.ucenik.prezime}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Greška pri generisanju izvještaja');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Nema podataka za ovog učenika.</div>;
  }

  // Prepare chart data with safe defaults
  const attendanceData = data?.attendance?.summaryByStudent?.[0] || {
    total: 0,
    prisutni: 0,
    opravdani: 0,
    neopravdani: 0,
    procenatPrisustva: 0,
  };

  const gradeDistribution = data?.grades?.statistics?.distribucija || {};
  const gradeChartData = Object.entries(gradeDistribution).map(([grade, count]) => ({
    name: `Ocjena ${grade}`,
    value: typeof count === 'number' ? count : 0,
  }));

  const monthlyStats = data?.stats?.prosjekPoMjesecu || [];
  const monthlyChartData = Array.isArray(monthlyStats) 
    ? monthlyStats.map((m: any) => ({
        mjesec: `Mjesec ${m?.mjesec || ''}`,
        prosjekOcjena: typeof m?.prosjekOcjena === 'number' ? m.prosjekOcjena : 0,
        stopaPrisustva: typeof m?.stopaPrisustva === 'number' ? m.stopaPrisustva : 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Student Header - Sticky */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          {data.ucenik.fotografija ? (
            <img
              src={`${API_URL}${data.ucenik.fotografija}`}
              alt={`${data.ucenik.ime} ${data.ucenik.prezime}`}
              className="w-20 h-20 rounded-full object-cover border-4 border-white"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-4 border-white">
              {data.ucenik.ime.charAt(0).toUpperCase()}
              {data.ucenik.prezime.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">
              {data.ucenik.ime} {data.ucenik.prezime}
            </h2>
            <p className="text-indigo-100">{data.nastavnaGodina.naziv}</p>
            {data.razredi.length > 0 && (
              <p className="text-indigo-100 text-sm">
                Razred: {data.razredi.map((r: any) => r.razred.name).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Prisustvo</h3>
          <p className="text-3xl font-bold text-indigo-600">{attendanceData.procenatPrisustva}%</p>
          <p className="text-sm text-gray-500 mt-1">
            {attendanceData.prisutni} od {attendanceData.total} časova
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Prosječna ocjena</h3>
          <p className="text-3xl font-bold text-green-600">
            {data?.grades?.statistics?.prosjek ? data.grades.statistics.prosjek.toFixed(2) : 'N/A'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {data?.grades?.statistics?.total || 0} ocjena
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Progres lekcija</h3>
          <p className="text-3xl font-bold text-purple-600">
            {data?.stats?.postotakPredjenogGradiva ? data.stats.postotakPredjenogGradiva.toFixed(0) : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {data?.stats?.ocjenjenoLekcija || 0} od {data?.stats?.ukupnoLekcija || 0} lekcija
          </p>
        </div>
      </div>

      {/* Charts */}
      <ChartsWrapper>
        {(ChartComponents) => {
          const {
            LineChart,
            Line,
            BarChart,
            Bar,
            PieChart,
            Pie,
            Cell,
            XAxis,
            YAxis,
            CartesianGrid,
            Tooltip,
            Legend,
            ResponsiveContainer,
          } = ChartComponents;

          return (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Chart */}
                {monthlyChartData.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Prisustvo po mjesecima</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mjesec" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="stopaPrisustva" stroke="#3b82f6" name="Prisustvo %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Grade Distribution */}
                {gradeChartData.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribucija ocjena</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={gradeChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {gradeChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Monthly Grades Chart */}
              {monthlyChartData.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Prosjek ocjena po mjesecima</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mjesec" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="prosjekOcjena" fill="#10b981" name="Prosjek ocjena" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          );
        }}
      </ChartsWrapper>

      {/* Hifz School Progress */}
      {data.hifz && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Škola Hifza - Napredak</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Prisustvo</p>
              <p className="text-2xl font-bold text-indigo-600">
                {data.hifz.attendance?.procenat || 0}%
              </p>
            </div>
            {data.hifz.attendance?.napredak && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Naučene sure</p>
                <div className="space-y-2">
                  {Object.entries(data.hifz.attendance.napredak as Record<string, any>).map(
                    ([sura, ajeta]: [string, any]) => (
                      <div key={sura} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{sura}</span>
                        <span className="text-sm text-gray-500">
                          {Array.isArray(ajeta) ? ajeta.length : 0} ajeta
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable Comments */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Komentari i napomene</h3>
        <textarea
          value={customComments.general || ''}
          onChange={(e) => setCustomComments({ ...customComments, general: e.target.value })}
          placeholder="Dodajte komentare ili napomene za izvještaj..."
          className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleGenerateReport}
          className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Generiši PDF izvještaj
        </button>
        <button
          onClick={() => setShowDiploma(true)}
          className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
        >
          Generiši diplomu
        </button>
      </div>

      {/* Diploma Form Modal */}
      {showDiploma && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Generisanje diplome</h2>
                <button
                  onClick={() => setShowDiploma(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <DiplomaForm
                student={data.ucenik}
                nastavnaGodina={data.nastavnaGodina}
                razredi={data.razredi}
                onClose={() => setShowDiploma(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

