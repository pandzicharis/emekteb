import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface Ucenik {
  id: string;
  ime: string;
  prezime: string;
  fotografija?: string | null;
  godinaRodjenja?: number | null;
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
  id: string | null;
  ucenikId: string;
  napredak: Napredak | null;
}

interface Props {
  open: boolean;
  ucenik: Ucenik | null;
  nastavnaGodinaId: string | null;
  onClose: () => void;
  onSave?: () => Promise<void> | void;
}

export default function SkolaHifzaUcenikDrawer({ open, ucenik, nastavnaGodinaId, onClose, onSave }: Props) {
  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [ucenikNapredak, setUcenikNapredak] = useState<SkolaHifzaUcenik | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSura, setSelectedSura] = useState<string>('');
  const [selectedAjeta, setSelectedAjeta] = useState<Set<number>>(new Set());
  const [skolaHifzaId, setSkolaHifzaId] = useState<string | null>(null);
  const napredakFormRef = useRef<HTMLDivElement | null>(null);

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

  // Učitaj SkolaHifza ID i napredak učenika
  useEffect(() => {
    if (!open || !ucenik || !nastavnaGodinaId) {
      setUcenikNapredak(null);
      setSkolaHifzaId(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Pronađi SkolaHifza za nastavnu godinu
        const skolaHifzaResponse = await axios.get(
          `${API_URL}/skola-hifza/nastavna-godina/${nastavnaGodinaId}`
        );
        const id = skolaHifzaResponse.data?.id;
        setSkolaHifzaId(id || null);
        
        if (id) {
          // Učitaj napredak učenika
          try {
            const napredakResponse = await axios.get(
              `${API_URL}/skola-hifza/${id}/ucenici/${ucenik.id}/napredak`
            );
            const napredakData = napredakResponse.data;
            const napredak = napredakData?.napredak || null;
            
            setUcenikNapredak({
              id: napredakData?.id || null,
              ucenikId: napredakData?.ucenikId || ucenik.id,
              napredak: napredak,
            });
          } catch (err) {
            console.warn('Error fetching napredak:', err);
            setUcenikNapredak({
              id: null,
              ucenikId: ucenik.id,
              napredak: null,
            });
          }
        }
      } catch (err) {
        console.error('Error loading SkolaHifza data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, ucenik, nastavnaGodinaId]);

  // Reset state kada se drawer zatvori
  useEffect(() => {
    if (!open) {
      setSelectedSura('');
      setSelectedAjeta(new Set());
      setUcenikNapredak(null);
    }
  }, [open]);

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
    if (!ucenik || !selectedSura || selectedAjeta.size === 0 || !skolaHifzaId) return;

    setSaving(true);
    try {
      // Ažuriraj napredak - zamijeni postojeće ajeta sa novim odabranim
      const currentNapredak = ucenikNapredak?.napredak || {};
      const updatedAjeta = Array.from(selectedAjeta).sort((a, b) => a - b);

      const updatedNapredak = {
        ...currentNapredak,
        [selectedSura]: updatedAjeta,
      };

      await axios.post(
        `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${ucenik.id}/napredak`,
        { napredak: updatedNapredak }
      );

      // Ažuriraj lokalno stanje
      setUcenikNapredak({
        ...ucenikNapredak!,
        napredak: updatedNapredak,
      });

      // Ne resetuj selectedSura - korisnik može nastaviti sa istom surom
      setSelectedAjeta(new Set(updatedAjeta));
      
      if (onSave) {
        await onSave();
      }
    } catch (err: any) {
      console.error('Error saving napredak:', err);
      alert('Greška pri čuvanju napretka: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSura = async (suraName: string) => {
    if (!ucenik || !skolaHifzaId) return;
    if (!confirm(`Da li ste sigurni da želite obrisati sve ajeta iz sure "${suraName}"?`)) return;

    setSaving(true);
    try {
      const currentNapredak = ucenikNapredak?.napredak || {};
      const updatedNapredak = { ...currentNapredak };
      delete updatedNapredak[suraName];

      await axios.post(
        `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${ucenik.id}/napredak`,
        { napredak: updatedNapredak }
      );

      setUcenikNapredak({
        ...ucenikNapredak!,
        napredak: updatedNapredak,
      });

      if (onSave) {
        await onSave();
      }
    } catch (err: any) {
      console.error('Error deleting sura:', err);
      alert('Greška pri brisanju: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !ucenik) return null;

  const napredak = ucenikNapredak?.napredak || null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-b border-purple-500 px-6 py-4 flex items-center justify-between z-10 shadow-lg">
          <div className="flex items-center gap-4">
            {ucenik.fotografija ? (
              <img
                src={`${API_URL}/${ucenik.fotografija}`}
                alt={`${ucenik.ime} ${ucenik.prezime}`}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/50"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center font-semibold text-lg border-2 border-white/50">
                {ucenik.ime.charAt(0)}{ucenik.prezime.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">
                {ucenik.ime} {ucenik.prezime}
              </h2>
              <p className="text-sm text-purple-100 mt-0.5">Praćenje napretka u učenju</p>
              {ucenik.godinaRodjenja && (
                <p className="text-xs text-purple-200 mt-0.5">
                  {new Date().getFullYear() - ucenik.godinaRodjenja} godina
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-purple-600"></div>
            </div>
          ) : (
            <>
              {/* Statistika */}
              {napredak && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-1">Naučeno ajeta</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {calculateUkupnoAjeta(napredak)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-1">Naučene sure</div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {Object.keys(napredak).length}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-1">Napredak</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {calculateProcenat(napredak)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Pregled napretka */}
              {napredak && Object.keys(napredak).length > 0 ? (
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
                    {Object.entries(napredak).map(([sura, ajeta]) => {
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
                          const existingAjeta = napredak?.[e.target.value] || [];
                          setSelectedAjeta(new Set(existingAjeta));
                        } else {
                          setSelectedAjeta(new Set());
                        }
                      }}
                      className="w-full rounded-xl border-2 border-gray-200 bg-white text-sm px-4 py-3 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all font-medium"
                    >
                      <option value="">-- Odaberi suru --</option>
                      {lekcije.map((lekcija) => {
                        const existingCount = napredak?.[lekcija.naslov]?.length || 0;
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
                    const existingAjeta = napredak?.[selectedSura] || [];
                    const allSelected = selectedAjeta.size === maxAjeta && maxAjeta > 0;
                    const noneSelected = selectedAjeta.size === 0;

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
            </>
          )}
        </div>
      </div>
    </>
  );
}

