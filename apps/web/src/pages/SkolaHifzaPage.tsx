import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import SkolaHifzaUcenikDrawer from '../components/SkolaHifzaUcenikDrawer';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface Ucenik {
  id: string;
  ime: string;
  prezime: string;
  fotografija?: string | null;
  godinaRodjenja?: number | null;
}

interface Grupa {
  id: string;
  naziv: string;
  ucenici?: Ucenik[];
}

interface RazredData {
  id: string;
  razred: {
    id: string;
    name: string;
    ilmihal: string;
  };
  grupe: Grupa[];
}

interface DashboardData {
  nastavnaGodina: {
    id: string;
    naziv: string;
  } | null;
  razredi: RazredData[];
}

interface Lekcija {
  id: string;
  naslov: string;
  brojAjeta?: number;
}

interface Napredak {
  [suraName: string]: number[]; // Array of learned ajeta numbers
}

interface SkolaHifzaUcenik {
  id: string;
  ucenikId: string;
  napredak: Napredak | null;
}

export default function SkolaHifzaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [selectedUcenik, setSelectedUcenik] = useState<Ucenik | null>(null);
  const [uceniciNapredak, setUceniciNapredak] = useState<Record<string, Napredak | null>>({});
  const [loadingNapredak, setLoadingNapredak] = useState(false);

  // Pronađi SKOLA_HIFZA razred
  const skolaHifzaRazred = useMemo(() => {
    if (!dashboardData?.razredi) {
      console.log('⚠️ [SKOLA_HIFZA] Nema razreda u dashboard podacima');
      return null;
    }
    console.log('🔍 [SKOLA_HIFZA] Tražim SKOLA_HIFZA razred u:', dashboardData.razredi.map(r => ({ name: r.razred.name, ilmihal: r.razred.ilmihal })));
    const found = dashboardData.razredi.find(
      (r) => r.razred.ilmihal === 'SKOLA_HIFZA' || r.razred.ilmihal === 'ŠKOLA HIFZA'
    );
    console.log('✅ [SKOLA_HIFZA] Pronađen razred:', found ? { name: found.razred.name, grupe: found.grupe.length } : 'NEMA');
    return found;
  }, [dashboardData]);

  // Svi učenici iz SKOLA_HIFZA grupa
  const ucenici = useMemo(() => {
    if (!skolaHifzaRazred) {
      console.log('⚠️ [SKOLA_HIFZA] Nema skolaHifzaRazred');
      return [];
    }
    console.log('🔍 [SKOLA_HIFZA] Grupe u razredu:', skolaHifzaRazred.grupe.map(g => ({ naziv: g.naziv, uceniciCount: g.ucenici?.length || 0 })));
    const allUcenici: Ucenik[] = [];
    skolaHifzaRazred.grupe.forEach((grupa) => {
      console.log('📋 [SKOLA_HIFZA] Grupa:', grupa.naziv, 'ucenici:', grupa.ucenici);
      if (grupa.ucenici && Array.isArray(grupa.ucenici)) {
        grupa.ucenici.forEach((ucenik) => {
          if (!allUcenici.find((u) => u.id === ucenik.id)) {
            allUcenici.push(ucenik);
          }
        });
      }
    });
    console.log('✅ [SKOLA_HIFZA] Ukupno učenika:', allUcenici.length);
    return allUcenici.sort((a, b) => {
      const aName = `${a.ime || ''} ${a.prezime || ''}`.trim();
      const bName = `${b.ime || ''} ${b.prezime || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }, [skolaHifzaRazred]);

  // Učitaj dashboard podatke
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/muallimi/dashboard`);
        console.log('📊 [SKOLA_HIFZA] Dashboard response:', response.data);
        console.log('📊 [SKOLA_HIFZA] Razredi:', response.data?.razredi);
        setDashboardData(response.data);
      } catch (err: any) {
        console.error('❌ [SKOLA_HIFZA] Error fetching dashboard data:', err);
        setError('Greška pri učitavanju podataka');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Učitaj lekcije (sure)
  useEffect(() => {
    const fetchLekcije = async () => {
      try {
        const response = await axios.get<Lekcija[]>(`${API_URL}/lekcije`, {
          params: { tip: 'SKOLA_HIFZA' },
        });
        setLekcije(response.data.sort((a, b) => a.naslov.localeCompare(b.naslov)));
      } catch (err) {
        console.warn('Error fetching lekcije:', err);
      }
    };
    fetchLekcije();
  }, []);

  // Učitaj napredak za sve učenike
  useEffect(() => {
    const loadAllUceniciNapredak = async () => {
      if (!dashboardData?.nastavnaGodina || ucenici.length === 0) return;
      
      setLoadingNapredak(true);
      try {
        // Pronađi SkolaHifza za nastavnu godinu
        const skolaHifzaResponse = await axios.get(
          `${API_URL}/skola-hifza/nastavna-godina/${dashboardData.nastavnaGodina.id}`
        );
        const skolaHifzaId = skolaHifzaResponse.data?.id;
        if (!skolaHifzaId) {
          setLoadingNapredak(false);
          return;
        }

        // Učitaj napredak za sve učenike paralelno
        const napredakPromises = ucenici.map(async (ucenik) => {
          try {
            const napredakResponse = await axios.get(
              `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${ucenik.id}/napredak`
            );
            return {
              ucenikId: ucenik.id,
              napredak: napredakResponse.data?.napredak || null,
            };
          } catch (err) {
            console.warn(`Error fetching napredak for ucenik ${ucenik.id}:`, err);
            return {
              ucenikId: ucenik.id,
              napredak: null,
            };
          }
        });

        const results = await Promise.all(napredakPromises);
        const napredakMap: Record<string, Napredak | null> = {};
        results.forEach((result) => {
          napredakMap[result.ucenikId] = result.napredak;
        });

        setUceniciNapredak(napredakMap);
      } catch (err) {
        console.error('Error loading all ucenici napredak:', err);
      } finally {
        setLoadingNapredak(false);
      }
    };

    loadAllUceniciNapredak();
  }, [dashboardData?.nastavnaGodina, ucenici]);


  // Izračunaj ukupno naučenih ajeta
  const calculateUkupnoAjeta = (napredak: Napredak | null): number => {
    if (!napredak) return 0;
    return Object.values(napredak).reduce((sum, ajeta) => sum + ajeta.length, 0);
  };

  // Izračunaj procenat napretka
  const calculateProcenat = (napredak: Napredak | null): number => {
    if (!napredak || lekcije.length === 0) return 0;
    const ukupnoAjeta = lekcije.reduce((sum, lekcija) => sum + (lekcija.brojAjeta || 0), 0);
    const nauceniAjeta = calculateUkupnoAjeta(napredak);
    return ukupnoAjeta > 0 ? Math.round((nauceniAjeta / ukupnoAjeta) * 100) : 0;
  };

  const handleOpenDrawer = (ucenik: Ucenik) => {
    setSelectedUcenik(ucenik);
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
      </div>
    );
  }

  if (!skolaHifzaRazred) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          Niste dodijeljeni za Školu Hifza u ovoj nastavnoj godini.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Škola Hifza</h1>
              <p className="text-sm text-gray-600 mt-0.5">Upravljanje polaznicima i praćenje napretka</p>
            </div>
          </div>
        </div>

        {/* Lista učenika */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Polaznici
            </h2>
            <span className="px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
              {ucenici.length} {ucenici.length === 1 ? 'polaznik' : 'polaznika'}
            </span>
          </div>
          {ucenici.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500 font-medium">Nema polaznika</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ucenici.map((ucenik) => {
                // Pronađi napredak za ovog učenika iz učitane mape
                const napredak = uceniciNapredak[ucenik.id] || null;
                const ukupnoAjeta = calculateUkupnoAjeta(napredak);
                const procenat = calculateProcenat(napredak);
                const nauceneSure = napredak ? Object.keys(napredak).length : 0;

                return (
                  <div
                    key={ucenik.id}
                    onClick={() => handleOpenDrawer(ucenik)}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer bg-white group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {ucenik.ime.charAt(0)}{ucenik.prezime.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-base">
                              {ucenik.ime} {ucenik.prezime}
                            </div>
                            {ucenik.godinaRodjenja && (
                              <div className="text-xs text-gray-500">
                                {new Date().getFullYear() - ucenik.godinaRodjenja} godina
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="space-y-3 pt-4 border-t-2 border-gray-100">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                          <div className="text-xs font-medium text-purple-700 mb-1">Ajeta</div>
                          <div className="text-xl font-bold text-purple-900">{ukupnoAjeta}</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                          <div className="text-xs font-medium text-indigo-700 mb-1">Sure</div>
                          <div className="text-xl font-bold text-indigo-900">{nauceneSure}</div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
                          <span>Napredak</span>
                          <span className="text-purple-600">{procenat}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              procenat === 100 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                            }`}
                            style={{ width: `${procenat}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SkolaHifzaUcenikDrawer za prikaz detalja o učeniku */}
      <SkolaHifzaUcenikDrawer
        open={selectedUcenik !== null}
        ucenik={selectedUcenik}
        nastavnaGodinaId={dashboardData?.nastavnaGodina?.id || null}
        onClose={() => {
              setSelectedUcenik(null);
        }}
        onSave={async () => {
          // Refresh podatke nakon što se sačuvaju promjene
          if (selectedUcenik && dashboardData?.nastavnaGodina) {
            try {
              const skolaHifzaResponse = await axios.get(
                `${API_URL}/skola-hifza/nastavna-godina/${dashboardData.nastavnaGodina.id}`
              );
              const skolaHifzaId = skolaHifzaResponse.data?.id;
              if (skolaHifzaId) {
                const napredakResponse = await axios.get(
                  `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${selectedUcenik.id}/napredak`
                );
                const napredak = napredakResponse.data?.napredak || null;
                // Ažuriraj mapu napretka za prikaz na listi
                setUceniciNapredak((prev) => ({
                  ...prev,
                  [selectedUcenik.id]: napredak,
                }));
              }
            } catch (err) {
              console.warn('Error refreshing napredak:', err);
            }
          }
        }}
      />
    </div>
  );
}

