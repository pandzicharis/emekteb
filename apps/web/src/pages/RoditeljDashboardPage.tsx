import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

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

export default function RoditeljDashboardPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUcenik, setExpandedUcenik] = useState<string | null>(null);
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
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 break-words">Dashboard Roditelja</h1>
          <p className="mt-1 text-base font-medium text-gray-700 break-words">
            Dobrodošli, {user?.ime} {user?.prezime}
          </p>
          {dashboardData.nastavnaGodina && (
            <p className="mt-2 text-sm text-gray-600 break-words">
              Aktivna nastavna godina: {dashboardData.nastavnaGodina.naziv}
            </p>
          )}
        </div>

        {/* Overview Statistics Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-100">Ukupno Učenika</p>
                <p className="text-3xl font-bold">{dashboardData.statistike.ukupnoUcenika}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-100">Prosjek Prisustva</p>
                <p className="text-3xl font-bold">{dashboardData.statistike.prosjekPrisustva}%</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-amber-100">Prosjek Ocjena</p>
                <p className="text-3xl font-bold">{dashboardData.statistike.prosjekOcjena.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Children List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Moja Djeca</h2>
          {dashboardData.ucenici.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Nemate povezanih učenika.</p>
            </div>
          ) : (
            dashboardData.ucenici.map((ucenik) => (
              <div
                key={ucenik.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => handleToggleUcenik(ucenik.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {ucenik.fotografija ? (
                        <img
                          src={`${API_URL}${ucenik.fotografija}`}
                          alt={`${ucenik.ime} ${ucenik.prezime}`}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                          {ucenik.ime.charAt(0).toUpperCase()}
                          {ucenik.prezime.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {ucenik.ime} {ucenik.prezime}
                        </h3>
                        {ucenik.razred && (
                          <p className="text-sm text-gray-600">
                            {ucenik.razred.name} - Grupa {ucenik.razred.grupa}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Prisustvo</p>
                        <p className="text-lg font-semibold text-green-600">
                          {ucenik.statistike.procenatPrisustva}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Prosjek</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {ucenik.statistike.prosjekOcjena.toFixed(2)}
                        </p>
                      </div>
                      <svg
                        className={`w-6 h-6 text-gray-400 transition-transform ${
                          expandedUcenik === ucenik.id ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedUcenik === ucenik.id && selectedUcenikData && (
                  <div className="border-t border-gray-200 bg-gray-50 p-6 space-y-6">
                    {/* Prisustvo */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Prisustvo
                      </h4>
                      <div className="bg-white rounded-lg p-4">
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Ukupno</p>
                            <p className="text-xl font-semibold">{selectedUcenikData.prisustvo.statistike.ukupno}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Prisutni</p>
                            <p className="text-xl font-semibold text-green-600">
                              {selectedUcenikData.prisustvo.statistike.prisutni}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Opravdani</p>
                            <p className="text-xl font-semibold text-yellow-600">
                              {selectedUcenikData.prisustvo.statistike.opravdani}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Neopravdani</p>
                            <p className="text-xl font-semibold text-red-600">
                              {selectedUcenikData.prisustvo.statistike.neopravdani}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">Procenat prisustva</p>
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-green-600 h-4 rounded-full transition-all"
                              style={{ width: `${selectedUcenikData.prisustvo.statistike.procenat}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedUcenikData.prisustvo.statistike.procenat}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ocjene */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        Ocjene
                      </h4>
                      <div className="bg-white rounded-lg p-4">
                        <div className="mb-4">
                          <p className="text-sm text-gray-600">Prosjek ocjena</p>
                          <p className="text-2xl font-bold text-amber-600">
                            {selectedUcenikData.ocjene.statistike.prosjek.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Ukupno ocjena: {selectedUcenikData.ocjene.statistike.ukupno}
                          </p>
                        </div>
                        {selectedUcenikData.ocjene.ocjene.length > 0 ? (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {selectedUcenikData.ocjene.ocjene.slice(0, 10).map((ocjena: any) => (
                              <div
                                key={ocjena.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium text-gray-900">{ocjena.lekcija.naslov}</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(ocjena.datum).toLocaleDateString('bs-BA')} - {ocjena.razred}
                                  </p>
                                  {ocjena.komentar && (
                                    <p className="text-sm text-gray-500 mt-1">{ocjena.komentar}</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-2xl font-bold text-amber-600">{ocjena.ocjena}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">Nema ocjena</p>
                        )}
                      </div>
                    </div>

                    {/* Raspored */}
                    {selectedUcenikData.raspored.raspored && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Raspored Časova
                        </h4>
                        <div className="bg-white rounded-lg p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Dan:</span>
                              <span className="text-sm text-gray-900 capitalize">
                                {selectedUcenikData.raspored.raspored.dan}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Vrijeme:</span>
                              <span className="text-sm text-gray-900">{selectedUcenikData.raspored.raspored.slot}</span>
                            </div>
                            {selectedUcenikData.raspored.raspored.lokacija && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Lokacija:</span>
                                <span className="text-sm text-gray-900">
                                  {selectedUcenikData.raspored.raspored.lokacija}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Trajanje:</span>
                              <span className="text-sm text-gray-900">
                                {selectedUcenikData.raspored.raspored.trajanje} minuta
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Napredak */}
                    {selectedUcenikData.napredak.napredak && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Napredak
                        </h4>
                        <div className="bg-white rounded-lg p-4">
                          <div className="space-y-3">
                            {selectedUcenikData.napredak.napredak.razred && (
                              <div>
                                <p className="text-sm font-medium text-gray-700">Razred:</p>
                                <p className="text-sm text-gray-900">{selectedUcenikData.napredak.napredak.razred}</p>
                              </div>
                            )}
                            {selectedUcenikData.napredak.napredak.sufaraLekcije &&
                              selectedUcenikData.napredak.napredak.sufaraLekcije.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Sufara lekcije:</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedUcenikData.napredak.napredak.sufaraLekcije.map((lekcija: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                                      >
                                        {lekcija}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            {selectedUcenikData.napredak.napredak.pohvaleIPriznanja &&
                              selectedUcenikData.napredak.napredak.pohvaleIPriznanja.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Pohvale i priznanja:</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedUcenikData.napredak.napredak.pohvaleIPriznanja.map(
                                      (pohvala: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                                        >
                                          {pohvala}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

