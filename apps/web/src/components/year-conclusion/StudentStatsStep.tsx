import ChartsWrapper from './ChartsWrapper';
import { API_URL } from './constants';

interface StudentStatsStepProps {
  studentData: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function StudentStatsStep({ studentData }: StudentStatsStepProps) {
  // Prepare chart data with safe defaults
  const attendanceData = studentData?.attendance?.summaryByStudent?.[0] || {
    total: 0,
    prisutni: 0,
    opravdani: 0,
    neopravdani: 0,
    procenatPrisustva: 0,
  };

  const gradeDistribution = studentData?.grades?.statistics?.distribucija || {};
  const gradeChartData = Object.entries(gradeDistribution).map(([grade, count]) => ({
    name: `Ocjena ${grade}`,
    value: typeof count === 'number' ? count : 0,
  }));

  const monthlyStats = studentData?.stats?.prosjekPoMjesecu || [];
  const monthlyChartData = Array.isArray(monthlyStats)
    ? monthlyStats.map((m: any) => ({
        mjesec: `Mjesec ${m?.mjesec || ''}`,
        prosjekOcjena: typeof m?.prosjekOcjena === 'number' ? m.prosjekOcjena : 0,
        stopaPrisustva: typeof m?.stopaPrisustva === 'number' ? m.stopaPrisustva : 0,
      }))
    : [];

  const gradeStats = studentData?.grades?.statistics || { total: 0, prosjek: 0 };
  const stats = studentData?.stats || {};

  // Get detailed grades
  const detailedGrades = studentData?.grades?.data || [];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-sm p-6 text-white">
          <h3 className="text-sm font-medium text-indigo-100 mb-2">Prisustvo</h3>
          <p className="text-3xl font-bold">{attendanceData.procenatPrisustva}%</p>
          <p className="text-sm text-indigo-100 mt-1">
            {attendanceData.prisutni} od {attendanceData.total} časova
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm p-6 text-white">
          <h3 className="text-sm font-medium text-green-100 mb-2">Prosječna ocjena</h3>
          <p className="text-3xl font-bold">
            {gradeStats.prosjek ? gradeStats.prosjek.toFixed(2) : 'N/A'}
          </p>
          <p className="text-sm text-green-100 mt-1">
            {gradeStats.total || 0} ocjena
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
          <h3 className="text-sm font-medium text-purple-100 mb-2">Progres lekcija</h3>
          <p className="text-3xl font-bold">
            {stats.postotakPredjenogGradiva ? stats.postotakPredjenogGradiva.toFixed(0) : 0}%
          </p>
          <p className="text-sm text-purple-100 mt-1">
            {stats.ocjenjenoLekcija || 0} od {stats.ukupnoLekcija || 0} lekcija
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
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
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
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
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
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
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

      {/* Detailed Grades Table */}
      {detailedGrades.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detaljne ocjene</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lekcija
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ocjena
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Komentar
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailedGrades.slice(0, 20).map((grade: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(grade.datum).toLocaleDateString('bs-BA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {grade.lekcija?.naslov || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {grade.ocjena}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {grade.komentar || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detailedGrades.length > 20 && (
              <p className="mt-4 text-sm text-gray-500 text-center">
                Prikazano 20 od {detailedGrades.length} ocjena
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hifz School Progress */}
      {studentData.hifz && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Škola Hifza - Napredak</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Prisustvo</p>
              <p className="text-2xl font-bold text-indigo-600">
                {studentData.hifz.attendance?.procenat || 0}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {studentData.hifz.attendance?.prisutni || 0} od {studentData.hifz.attendance?.total || 0} časova
              </p>
            </div>
            {studentData.hifz.attendance?.napredak && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Naučene sure</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(studentData.hifz.attendance.napredak as Record<string, any>).map(
                    ([sura, ajeta]: [string, any]) => (
                      <div key={sura} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm font-medium text-gray-900">{sura}</span>
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

      {/* Comparison Stats */}
      {studentData.attendance?.comparisonStats && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Poređenje sa razredom</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Prosjek razreda (prisustvo)</p>
              <p className="text-2xl font-bold text-indigo-600">
                {studentData.attendance.comparisonStats.razredAverage?.toFixed(1) || 'N/A'}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Vaš procenat: {attendanceData.procenatPrisustva}%
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Prosjek razreda (ocjene)</p>
              <p className="text-2xl font-bold text-green-600">
                {studentData.grades?.comparisonStats?.razredAverage?.toFixed(2) || 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Vaš prosjek: {gradeStats.prosjek?.toFixed(2) || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




