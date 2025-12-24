import { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface Ucenik {
  id: string;
  ime: string;
  prezime: string;
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
  const [showDrawer, setShowDrawer] = useState(false);
  const [ucenikNapredak, setUcenikNapredak] = useState<SkolaHifzaUcenik | null>(null);
  const [uceniciNapredak, setUceniciNapredak] = useState<Record<string, Napredak | null>>({});
  const [loadingNapredak, setLoadingNapredak] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSura, setSelectedSura] = useState<string>('');
  const [selectedAjeta, setSelectedAjeta] = useState<Set<number>>(new Set());
  const napredakFormRef = useRef<HTMLDivElement | null>(null);

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

  // Učitaj napredak učenika
  const loadUcenikNapredak = async (ucenikId: string) => {
    if (!dashboardData?.nastavnaGodina) return;
    try {
      // Pronađi SkolaHifza za nastavnu godinu
      const skolaHifzaResponse = await axios.get(
        `${API_URL}/skola-hifza/nastavna-godina/${dashboardData.nastavnaGodina.id}`
      );
      const skolaHifzaId = skolaHifzaResponse.data?.id;
      if (!skolaHifzaId) return;

      // Pronađi napredak učenika
      const napredakResponse = await axios.get(
        `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${ucenikId}/napredak`
      );
      const napredakData = napredakResponse.data;
      const napredak = napredakData?.napredak || null;
      
      // Osiguraj da imamo ispravan format
      setUcenikNapredak({
        id: napredakData?.id || null,
        ucenikId: napredakData?.ucenikId || ucenikId,
        napredak: napredak,
      });

      // Ažuriraj i mapu napretka
      setUceniciNapredak((prev) => ({
        ...prev,
        [ucenikId]: napredak,
      }));
    } catch (err) {
      console.warn('Error fetching napredak:', err);
      setUcenikNapredak(null);
      setUceniciNapredak((prev) => ({
        ...prev,
        [ucenikId]: null,
      }));
    }
  };

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

  const handleOpenDrawer = async (ucenik: Ucenik) => {
    setSelectedUcenik(ucenik);
    setShowDrawer(true);
    
    // Koristi postojeći napredak ako već postoji, inače učitaj
    const existingNapredak = uceniciNapredak[ucenik.id];
    if (existingNapredak !== undefined) {
      setUcenikNapredak({
        id: null,
        ucenikId: ucenik.id,
        napredak: existingNapredak,
      });
    } else {
      await loadUcenikNapredak(ucenik.id);
    }
    
    setSelectedSura('');
    setSelectedAjeta(new Set());
  };

  const handleToggleAjet = (ajet: number) => {
    setSelectedAjeta((prev) => {
      const next = new Set(prev);
      if (next.has(ajet)) {
        next.delete(ajet);
      } else {
        next.add(ajet);
      }
      return next;
    });
  };

  const handleSelectAllAjeta = (maxAjeta: number) => {
    const allAjeta = Array.from({ length: maxAjeta }, (_, i) => i + 1);
    setSelectedAjeta(new Set(allAjeta));
  };

  const handleDeselectAllAjeta = () => {
    setSelectedAjeta(new Set());
  };

  const handleSaveNapredak = async () => {
    if (!selectedUcenik || !selectedSura || selectedAjeta.size === 0 || !dashboardData?.nastavnaGodina) return;

    setSaving(true);
    try {
      // Pronađi SkolaHifza za nastavnu godinu
      const skolaHifzaResponse = await axios.get(
        `${API_URL}/skola-hifza/nastavna-godina/${dashboardData.nastavnaGodina.id}`
      );
      const skolaHifzaId = skolaHifzaResponse.data?.id;
      if (!skolaHifzaId) {
        throw new Error('Škola Hifza nije pronađena za ovu nastavnu godinu');
      }

      // Ažuriraj napredak - zamijeni postojeće ajeta sa novim odabranim
      const currentNapredak = ucenikNapredak?.napredak || {};
      const updatedAjeta = Array.from(selectedAjeta).sort((a, b) => a - b);

      const updatedNapredak = {
        ...currentNapredak,
        [selectedSura]: updatedAjeta,
      };

      await axios.post(
        `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${selectedUcenik.id}/napredak`,
        { napredak: updatedNapredak }
      );

      // Ažuriraj lokalno stanje za drawer
      setUcenikNapredak({
        ...ucenikNapredak!,
        napredak: updatedNapredak,
      });

      // Ažuriraj i mapu napretka za sve učenike (za prikaz na listi)
      setUceniciNapredak((prev) => ({
        ...prev,
        [selectedUcenik.id]: updatedNapredak,
      }));

      // Ne resetuj selectedSura - korisnik može nastaviti sa istom surom
      // Samo resetuj selectedAjeta da se vidi da je sačuvano
      setSelectedAjeta(new Set(updatedAjeta));
      
      // Prikaži uspešnu poruku (može se dodati toast notification)
      console.log('✅ Napredak uspešno sačuvan');
    } catch (err: any) {
      console.error('Error saving napredak:', err);
      alert('Greška pri čuvanju napretka: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSura = async (suraName: string) => {
    if (!selectedUcenik || !dashboardData?.nastavnaGodina) return;
    if (!confirm(`Da li ste sigurni da želite obrisati sve ajeta iz sure "${suraName}"?`)) return;

    setSaving(true);
    try {
      const skolaHifzaResponse = await axios.get(
        `${API_URL}/skola-hifza/nastavna-godina/${dashboardData.nastavnaGodina.id}`
      );
      const skolaHifzaId = skolaHifzaResponse.data?.id;
      if (!skolaHifzaId) return;

      const currentNapredak = ucenikNapredak?.napredak || {};
      const updatedNapredak = { ...currentNapredak };
      delete updatedNapredak[suraName];

      await axios.post(
        `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${selectedUcenik.id}/napredak`,
        { napredak: updatedNapredak }
      );

      setUcenikNapredak({
        ...ucenikNapredak!,
        napredak: updatedNapredak,
      });

      // Ažuriraj i mapu napretka za sve učenike (za prikaz na listi)
      setUceniciNapredak((prev) => ({
        ...prev,
        [selectedUcenik.id]: updatedNapredak,
      }));
    } catch (err: any) {
      console.error('Error deleting sura:', err);
      alert('Greška pri brisanju: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
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

      {/* Drawer za unos napretka */}
      {showDrawer && selectedUcenik && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDrawer(false);
              setSelectedUcenik(null);
              setUcenikNapredak(null);
              setSelectedSura('');
              setSelectedAjeta(new Set());
            }
          }}
        >
          <div 
            className="bg-white rounded-t-xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-5 flex items-center justify-between z-10 shadow-lg">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedUcenik.ime} {selectedUcenik.prezime}
                </h3>
                <p className="text-sm text-purple-100 mt-0.5">Praćenje napretka u učenju</p>
              </div>
              <button
                onClick={() => {
                  setShowDrawer(false);
                  setSelectedUcenik(null);
                  setUcenikNapredak(null);
                  setSelectedSura('');
                  setSelectedAjeta(new Set());
                }}
                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
              {/* Statistika */}
              {ucenikNapredak?.napredak && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-1">Naučeno ajeta</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {calculateUkupnoAjeta(ucenikNapredak.napredak)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-1">Naučene sure</div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {Object.keys(ucenikNapredak.napredak).length}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-1">Napredak</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {calculateProcenat(ucenikNapredak.napredak)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Pregled napretka */}
              {ucenikNapredak?.napredak && Object.keys(ucenikNapredak.napredak).length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Naučene sure i ajeta
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(ucenikNapredak.napredak).map(([sura, ajeta]) => {
                      const lekcija = lekcije.find((l) => l.naslov === sura);
                      const maxAjeta = lekcija?.brojAjeta || 0;
                      const sortedAjeta = [...ajeta].sort((a, b) => a - b);
                      const procenat = maxAjeta > 0 ? Math.round((ajeta.length / maxAjeta) * 100) : 0;
                      const isComplete = procenat === 100;
                      
                      return (
                        <div key={sura} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-gray-900 text-base">{sura}</span>
                                {isComplete && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                    Završeno
                                  </span>
                                )}
                                <button
                                  onClick={() => handleDeleteSura(sura)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                  title="Obriši suru"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm text-gray-600">
                                  <span className="font-semibold text-gray-900">{ajeta.length}</span> / {maxAjeta} ajeta
                                </span>
                                <span className="text-sm font-bold text-purple-600">({procenat}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    isComplete ? 'bg-emerald-500' : 'bg-purple-500'
                                  }`}
                                  style={{ width: `${procenat}%` }}
                                ></div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedSura(sura);
                                setSelectedAjeta(new Set(sortedAjeta));
                                // Skroluj do forme nakon kratke pauze da se state ažurira
                                setTimeout(() => {
                                  napredakFormRef.current?.scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'start' 
                                  });
                                }, 100);
                              }}
                              className="ml-4 px-4 py-2 rounded-lg border-2 border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-colors font-semibold text-sm"
                            >
                              Uredi
                            </button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex flex-wrap gap-1.5">
                              {sortedAjeta.slice(0, 30).map((ajet) => (
                                <span
                                  key={ajet}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200"
                                >
                                  {ajet}
                                </span>
                              ))}
                              {sortedAjeta.length > 30 && (
                                <span className="inline-flex items-center justify-center px-2 h-8 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                  +{sortedAjeta.length - 30} više
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-base text-gray-700 font-semibold mb-1">Nema zabilježenog napretka</p>
                  <p className="text-sm text-gray-500">Odaberite suru i označite naučene ajeta da započnete praćenje napretka</p>
                </div>
              )}

              {/* Forma za dodavanje napretka */}
              <div ref={napredakFormRef} className="border-t-2 border-gray-200 pt-6 mt-6">
                <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {selectedSura ? 'Uredi napredak' : 'Dodaj novi napredak'}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Odaberi suru</label>
                    <select
                      value={selectedSura}
                      onChange={(e) => {
                        setSelectedSura(e.target.value);
                        if (e.target.value) {
                          // Učitaj postojeće ajeta za ovu suru
                          const existingAjeta = ucenikNapredak?.napredak?.[e.target.value] || [];
                          setSelectedAjeta(new Set(existingAjeta));
                        } else {
                          setSelectedAjeta(new Set());
                        }
                      }}
                      className="w-full rounded-xl border-2 border-gray-200 bg-white text-sm px-4 py-3 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all font-medium"
                    >
                      <option value="">-- Odaberi suru --</option>
                      {lekcije.map((lekcija) => {
                        const existingCount = ucenikNapredak?.napredak?.[lekcija.naslov]?.length || 0;
                        const isComplete = lekcija.brojAjeta && existingCount === lekcija.brojAjeta;
                        return (
                          <option key={lekcija.id} value={lekcija.naslov}>
                            {lekcija.naslov} ({lekcija.brojAjeta} ajeta) {existingCount > 0 ? `- ${existingCount} naučeno${isComplete ? ' ✓' : ''}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedSura && (() => {
                    const lekcija = lekcije.find((l) => l.naslov === selectedSura);
                    const maxAjeta = lekcija?.brojAjeta || 0;
                    const existingAjeta = ucenikNapredak?.napredak?.[selectedSura] || [];
                    const allSelected = selectedAjeta.size === maxAjeta && maxAjeta > 0;
                    const noneSelected = selectedAjeta.size === 0;
                    const hasChanges = JSON.stringify([...selectedAjeta].sort()) !== JSON.stringify([...existingAjeta].sort());

                    return (
                      <div className="space-y-4 bg-purple-50 rounded-xl p-5 border-2 border-purple-100">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-bold text-gray-900">
                            Označi naučene ajeta
                            <span className="ml-2 text-purple-600">
                              ({selectedAjeta.size} / {maxAjeta})
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectAllAjeta(maxAjeta)}
                              disabled={allSelected}
                              className="text-xs px-3 py-1.5 rounded-lg border-2 border-purple-300 text-purple-700 bg-white hover:bg-purple-100 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Odaberi sve
                            </button>
                            <button
                              type="button"
                              onClick={handleDeselectAllAjeta}
                              disabled={noneSelected}
                              className="text-xs px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-100 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Obriši sve
                            </button>
                          </div>
                        </div>
                        
                        <div className="border-2 border-purple-200 rounded-xl p-4 bg-white max-h-80 overflow-y-auto shadow-inner">
                          <div className="grid grid-cols-12 gap-2">
                            {Array.from({ length: maxAjeta }, (_, i) => {
                              const ajetNum = i + 1;
                              const isSelected = selectedAjeta.has(ajetNum);
                              const wasExisting = existingAjeta.includes(ajetNum);
                              return (
                                <label
                                  key={ajetNum}
                                  className={`relative flex items-center justify-center h-10 w-10 rounded-lg border-2 cursor-pointer transition-all transform hover:scale-105 ${
                                    isSelected
                                      ? 'bg-purple-600 border-purple-700 text-white shadow-lg'
                                      : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400 hover:bg-purple-50'
                                  } ${wasExisting && !isSelected ? 'ring-2 ring-amber-400' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleAjet(ajetNum)}
                                    className="sr-only"
                                  />
                                  <span className="text-xs font-bold">{ajetNum}</span>
                                  {wasExisting && isSelected && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Zeleni indikator označava prethodno naučene ajeta. Kliknite na ajeta da ih označite/odznačite.
                        </p>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-200">
                    <button
                      onClick={() => {
                        setShowDrawer(false);
                        setSelectedUcenik(null);
                        setUcenikNapredak(null);
                        setSelectedSura('');
                        setSelectedAjeta(new Set());
                      }}
                      className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Odustani
                    </button>
                    <button
                      onClick={handleSaveNapredak}
                      disabled={!selectedSura || selectedAjeta.size === 0 || saving}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Čuvanje...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Sačuvaj napredak
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

