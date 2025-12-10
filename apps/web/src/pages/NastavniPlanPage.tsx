import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Lekcija = {
  id: string;
  naslov: string;
  opis: string;
  tezina: 1 | 2 | 3;
  redoslijed: number;
  aktivan: boolean;
  tip?: 'ILMIHAL' | 'KURAN' | 'SUFARA';
};

type TipLekcije = 'ILMIHAL' | 'KURAN' | 'SUFARA';

const RAZREDI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 0 = predškolci

const labelGrupa = (razred: number) => (razred === 0 ? 'Predškolci' : `${razred}. razred`);

function razredInfo(razred: number) {
  if (razred === 0) return { label: 'PREDSKOLCI', color: 'bg-teal-100 text-teal-800 border-teal-200' };
  if (razred <= 3) return { label: 'ILMIHAL 1', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (razred <= 6) return { label: 'ILMIHAL 2', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'ILMIHAL 3', color: 'bg-amber-100 text-amber-800 border-amber-200' };
}

// Helper function to generate lessons for Kuran or Sufara
const generateLekcije = (tip: 'KURAN' | 'SUFARA', razred: number): Lekcija[] => {
  const prefix = tip === 'KURAN' ? 'Kuran' : 'Sufara';
  return Array.from({ length: 20 }, (_, i) => ({
    id: `${tip.toLowerCase()}-${razred}-${i + 1}-${Date.now()}`,
    naslov: `${prefix} - Lekcija ${i + 1}`,
    opis: `Lekcija ${i + 1} iz ${prefix.toLowerCase()}a za ${labelGrupa(razred)}`,
    tezina: 2 as const,
    redoslijed: i,
    aktivan: true,
    tip,
  }));
};

type StepData = {
  korak1: {
    naziv: string;
    opis: string;
    datumUsvajanja: string;
    aktivan: boolean;
  };
  korak2: {
    razredi: number[];
  };
  korak3: {
    // po razredu
    [razred: number]: Lekcija[];
  };
  // Tipovi lekcija po razredu
  tipoviLekcija: {
    [razred: number]: TipLekcije[];
  };
  // Generirane lekcije za Kuran i Sufara po razredu
  generiraneLekcije: {
    [razred: number]: {
      KURAN?: Lekcija[];
      SUFARA?: Lekcija[];
    };
  };
  // Odabrane lekcije iz Kuran/Sufara po razredu
  odabraneLekcije: {
    [razred: number]: {
      KURAN?: string[]; // IDs
      SUFARA?: string[]; // IDs
    };
  };
};

export default function NastavniPlanPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [expandedRazred, setExpandedRazred] = useState<number | null>(null);
  const [expandedLekcija, setExpandedLekcija] = useState<{ razred: number; lekcijaId: string } | null>(null);
  const [draggingLekcija, setDraggingLekcija] = useState<{ razred: number; lekcijaId: string } | null>(null);
  const [hoverDrop, setHoverDrop] = useState<{ razred: number; index: number } | null>(null);

  const [data, setData] = useState<StepData>({
    korak1: {
      naziv: 'Ilmihal - osnovni plan',
      opis: 'Osnovni nastavni plan za predmet Ilmihal koji pokriva temeljne vjerske znanja i vrednote.',
      datumUsvajanja: new Date().toISOString().split('T')[0], // Današnji datum
      aktivan: true,
    },
    korak2: {
      razredi: [],
    },
    korak3: {},
    tipoviLekcija: {},
    generiraneLekcije: {},
    odabraneLekcije: {},
  });

  const isStep1Valid =
    data.korak1.naziv.trim().length > 2 &&
    data.korak1.datumUsvajanja.length > 0;

  const isStep2Valid = data.korak2.razredi.length > 0;

  const payload = {
    nastavniPlan: {
      naziv: data.korak1.naziv,
      opis: data.korak1.opis,
      datumUsvajanja: data.korak1.datumUsvajanja,
      aktivan: data.korak1.aktivan,
    },
    razredi: data.korak2.razredi,
    lekcije: data.korak3,
  };

  const toggleTipLekcije = (razred: number, tip: TipLekcije) => {
    setData((prev) => {
      const currentTipovi = prev.tipoviLekcija[razred] ?? [];
      const hasTip = currentTipovi.includes(tip);
      
      let newTipovi: TipLekcije[];
      const newGeneriraneLekcije = { ...prev.generiraneLekcije };
      const newOdabraneLekcije = { ...prev.odabraneLekcije };
      
      if (hasTip) {
        // Ukloni tip
        newTipovi = currentTipovi.filter((t) => t !== tip);
        // Ukloni generirane lekcije (samo za KURAN i SUFARA)
        if (tip === 'KURAN' || tip === 'SUFARA') {
          if (newGeneriraneLekcije[razred]) {
            const updated = { ...newGeneriraneLekcije[razred] };
            if (tip === 'KURAN') {
              delete updated.KURAN;
            } else {
              delete updated.SUFARA;
            }
            newGeneriraneLekcije[razred] = updated;
          }
          // Ukloni odabrane lekcije
          if (newOdabraneLekcije[razred]) {
            const updated = { ...newOdabraneLekcije[razred] };
            if (tip === 'KURAN') {
              delete updated.KURAN;
            } else {
              delete updated.SUFARA;
            }
            newOdabraneLekcije[razred] = updated;
          }
        }
        // Ukloni lekcije iz korak3
        const lekcije = prev.korak3[razred] ?? [];
        const filteredLekcije = lekcije.filter((l) => l.tip !== tip);
        return {
          ...prev,
          tipoviLekcija: { ...prev.tipoviLekcija, [razred]: newTipovi },
          generiraneLekcije: newGeneriraneLekcije,
          odabraneLekcije: newOdabraneLekcije,
          korak3: { ...prev.korak3, [razred]: filteredLekcije },
        };
      } else {
        // Dodaj tip
        newTipovi = [...currentTipovi, tip];
        // Generiraj lekcije za KURAN ili SUFARA
        if (tip === 'KURAN' || tip === 'SUFARA') {
          const generirane = generateLekcije(tip, razred);
          if (!newGeneriraneLekcije[razred]) {
            newGeneriraneLekcije[razred] = {};
          }
          newGeneriraneLekcije[razred] = {
            ...newGeneriraneLekcije[razred],
            [tip]: generirane,
          };
          
          // Za SUFARA automatski dodaj sve lekcije
          if (tip === 'SUFARA') {
            const existingLekcije = prev.korak3[razred] ?? [];
            const allSufaraIds = generirane.map((l) => l.id);
            const newLekcije = generirane.map((l, idx) => ({
              ...l,
              redoslijed: existingLekcije.length + idx,
            }));
            return {
              ...prev,
              tipoviLekcija: { ...prev.tipoviLekcija, [razred]: newTipovi },
              generiraneLekcije: newGeneriraneLekcije,
              odabraneLekcije: {
                ...prev.odabraneLekcije,
                [razred]: {
                  ...prev.odabraneLekcije[razred],
                  SUFARA: allSufaraIds,
                },
              },
              korak3: {
                ...prev.korak3,
                [razred]: [...existingLekcije, ...newLekcije],
              },
            };
          }
        }
      }
      
      return {
        ...prev,
        tipoviLekcija: { ...prev.tipoviLekcija, [razred]: newTipovi },
        generiraneLekcije: newGeneriraneLekcije,
        odabraneLekcije: newOdabraneLekcije,
      };
    });
  };

  const toggleOdabranaLekcija = (razred: number, tip: 'KURAN' | 'SUFARA', lekcijaId: string) => {
    setData((prev) => {
      const currentOdabrane = prev.odabraneLekcije[razred]?.[tip] ?? [];
      const isOdabrana = currentOdabrane.includes(lekcijaId);
      
      let newOdabrane: string[];
      let lekcije = [...(prev.korak3[razred] ?? [])];
      
      if (isOdabrana) {
        // Ukloni lekciju
        newOdabrane = currentOdabrane.filter((id) => id !== lekcijaId);
        lekcije = lekcije.filter((l) => l.id !== lekcijaId);
      } else {
        // Dodaj lekciju
        newOdabrane = [...currentOdabrane, lekcijaId];
        const generiraneLekcije = prev.generiraneLekcije[razred]?.[tip] ?? [];
        const lekcija = generiraneLekcije.find((l) => l.id === lekcijaId);
        if (lekcija) {
          lekcije.push({ ...lekcija, redoslijed: lekcije.length });
        }
      }
      
      return {
        ...prev,
        odabraneLekcije: {
          ...prev.odabraneLekcije,
          [razred]: {
            ...prev.odabraneLekcije[razred],
            [tip]: newOdabrane,
          },
        },
        korak3: {
          ...prev.korak3,
          [razred]: lekcije.map((l, idx) => ({ ...l, redoslijed: idx })),
        },
      };
    });
  };

  const addLekcija = (razred: number, tip: 'ILMIHAL' | 'SUFARA' = 'ILMIHAL') => {
    const lekcije = data.korak3[razred] ?? [];
    const newLekcija: Lekcija = {
      id: `lekcija-${Date.now()}-${Math.random()}`,
      naslov: '',
      opis: '',
      tezina: 2,
      redoslijed: lekcije.length,
      aktivan: true,
      tip,
    };
    setData((prev) => ({
      ...prev,
      korak3: {
        ...prev.korak3,
        [razred]: [...lekcije, newLekcija],
      },
    }));
    setExpandedLekcija({ razred, lekcijaId: newLekcija.id });
  };

  const updateLekcija = (razred: number, lekcijaId: string, updates: Partial<Lekcija>) => {
    setData((prev) => {
      const lekcije = prev.korak3[razred] ?? [];
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: lekcije.map((l) => (l.id === lekcijaId ? { ...l, ...updates } : l)),
        },
      };
    });
  };

  const removeLekcija = (razred: number, lekcijaId: string) => {
    setData((prev) => {
      const lekcije = prev.korak3[razred] ?? [];
      const filtered = lekcije.filter((l) => l.id !== lekcijaId);
      // Reorder remaining lekcije
      const reordered = filtered.map((l, idx) => ({ ...l, redoslijed: idx }));
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: reordered,
        },
      };
    });
  };

  const reorderLekcije = (razred: number, fromIndex: number, toIndex: number) => {
    setData((prev) => {
      const lekcije = [...(prev.korak3[razred] ?? [])];
      const [removed] = lekcije.splice(fromIndex, 1);
      lekcije.splice(toIndex, 0, removed);
      const reordered = lekcije.map((l, idx) => ({ ...l, redoslijed: idx }));
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: reordered,
        },
      };
    });
  };

  const toggleRazred = (r: number) => {
    setData((prev) => {
      const exists = prev.korak2.razredi.includes(r);
      const razredi = exists
        ? prev.korak2.razredi.filter((x) => x !== r)
        : [...prev.korak2.razredi, r];

      return {
        ...prev,
        korak2: { razredi },
      };
    });
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 1, label: 'Osnovni podaci' },
      { id: 2, label: 'Razredi' },
      { id: 3, label: 'Lekcije' },
    ];
    return (
      <div className="flex items-center gap-4 mb-8">
        {steps.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                step === s.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : step > s.id
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-gray-100 text-gray-400 border-gray-300'
              }`}
            >
              {step > s.id ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span>{s.id}</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-semibold ${
                step === s.id ? 'text-gray-900' : step > s.id ? 'text-gray-700' : 'text-gray-400'
              }`}>{s.label}</span>
              {idx < steps.length - 1 && (
                <div className={`h-px w-16 mt-2 ${
                  step > s.id ? 'bg-green-300' : 'bg-gray-300'
                }`} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Naziv *</label>
        <input
          type="text"
          value={data.korak1.naziv}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              korak1: { ...prev.korak1, naziv: e.target.value },
            }))
          }
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          placeholder="npr. Ilmihal - osnovni plan"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Opis</label>
        <textarea
          value={data.korak1.opis}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              korak1: { ...prev.korak1, opis: e.target.value },
            }))
          }
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          rows={3}
          placeholder="Kratak opis nastavnog plana..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Datum usvajanja *</label>
        <input
          type="date"
          value={data.korak1.datumUsvajanja}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              korak1: { ...prev.korak1, datumUsvajanja: e.target.value },
            }))
          }
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-700 mb-1">Status</div>
          <p className="text-xs text-gray-600">Aktivan nastavni plan će biti dostupan za odabir</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
          <input
            type="checkbox"
            checked={data.korak1.aktivan}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                korak1: { ...prev.korak1, aktivan: e.target.checked },
              }))
            }
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 rounded-full transition-colors ${
            data.korak1.aktivan
              ? 'bg-green-600'
              : 'bg-gray-300'
          }`}>
            <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
              data.korak1.aktivan ? 'translate-x-5' : 'translate-x-0'
            }`}></div>
          </div>
        </label>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-700 mb-1">Status</div>
          <p className="text-xs text-gray-600">Aktivan nastavni plan će biti dostupan za odabir</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
          <input
            type="checkbox"
            checked={data.korak1.aktivan}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                korak1: { ...prev.korak1, aktivan: e.target.checked },
              }))
            }
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 rounded-full transition-colors ${
            data.korak1.aktivan
              ? 'bg-green-600'
              : 'bg-gray-300'
          }`}>
            <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
              data.korak1.aktivan ? 'translate-x-5' : 'translate-x-0'
            }`}></div>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={() =>
            setData((prev) => ({
              ...prev,
              korak2: { razredi: [...RAZREDI] },
            }))
          }
          className="px-4 py-2 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Odaberi sve razrede
        </button>
        <button
          onClick={() =>
            setData((prev) => ({
              ...prev,
              korak2: { razredi: [] },
            }))
          }
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Očisti odabir
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {RAZREDI.map((r) => {
          const active = data.korak2.razredi.includes(r);
          const info = razredInfo(r);
          return (
            <div
              key={r}
              role="button"
              tabIndex={0}
              onClick={() => toggleRazred(r)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRazred(r)}
              className={`p-4 rounded-xl border shadow-sm transition transform hover:-translate-y-0.5 cursor-pointer ${
                active ? 'border-green-500 bg-green-50 ring-1 ring-green-200' : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-gray-500 font-medium">Razred</div>
                  <div className="text-lg font-bold text-gray-900">{labelGrupa(r)}</div>
                </div>
              </div>
              <div className={`inline-flex text-xs px-3 py-1 rounded-full border font-semibold ${info.color}`}>
                {info.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      {data.korak2.razredi.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900 font-medium">
          Prvo odaberite razrede u prethodnom koraku.
        </div>
      )}
      {data.korak2.razredi.map((r) => {
        const sveLekcije = data.korak3[r] ?? [];
        // Prikaži samo ILMIHAL lekcije (ne prikazuj KURAN i SUFARA)
        const lekcije = sveLekcije.filter((l) => {
          // Ako nema tipa, provjeri ID
          if (!l.tip) {
            return !l.id.toLowerCase().includes('kuran') && !l.id.toLowerCase().includes('sufara');
          }
          // Prikaži samo ILMIHAL
          return l.tip === 'ILMIHAL';
        });
        const hasLekcije = lekcije.length > 0;
        return (
          <div key={r} className="border border-gray-200 rounded-lg bg-white transition-colors">
            <button
              onClick={() => {
                const next = expandedRazred === r ? null : r;
                setExpandedRazred(next);
              }}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {hasLekcije && (
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-base font-semibold text-gray-900">{labelGrupa(r)}</span>
                {(() => {
                  const info = razredInfo(r);
                  return (
                    <span className={`text-xs px-2 py-1 rounded border font-semibold ${info.color}`}>
                      {info.label}
                    </span>
                  );
                })()}
                {hasLekcije && (
                  <span className="text-xs text-gray-500 font-medium">
                    ({lekcije.length} {lekcije.length === 1 ? 'lekcija' : 'lekcija'})
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  expandedRazred === r ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedRazred !== r && (() => {
              const sveLekcije = data.korak3[r] ?? [];
              const ilmihalLekcije = sveLekcije.filter((l) => l.tip === 'ILMIHAL' || (!l.tip && !l.id.toLowerCase().includes('kuran') && !l.id.toLowerCase().includes('sufara')));
              const kuranLekcije = sveLekcije.filter((l) => l.tip === 'KURAN');
              const sufaraLekcije = sveLekcije.filter((l) => l.tip === 'SUFARA');
              const ukupno = ilmihalLekcije.length + kuranLekcije.length + sufaraLekcije.length;
              
              if (ukupno === 0) return null;
              
              return (
                <div className="mx-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ILMIHAL grupa */}
                    {ilmihalLekcije.length > 0 ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-xs font-semibold text-emerald-800">
                            ILMIHAL ({ilmihalLekcije.length})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {ilmihalLekcije.map((lekcija, idx) => (
                            <div key={lekcija.id} className="flex items-center gap-2 text-xs pl-4">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                              <span className="text-emerald-700">
                                {idx + 1}. {lekcija.naslov || 'Naslov lekcije'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 opacity-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          <span className="text-xs font-semibold text-gray-500">
                            ILMIHAL (0)
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* KURAN grupa */}
                    {kuranLekcije.length > 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="text-xs font-semibold text-amber-800">
                            KURAN ({kuranLekcije.length})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {kuranLekcije.map((lekcija, idx) => (
                            <div key={lekcija.id} className="flex items-center gap-2 text-xs pl-4">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                              <span className="text-amber-700">
                                {idx + 1}. {lekcija.naslov || 'Naslov lekcije'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 opacity-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          <span className="text-xs font-semibold text-gray-500">
                            KURAN (0)
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* SUFARA grupa */}
                    {sufaraLekcije.length > 0 ? (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <span className="text-xs font-semibold text-purple-800">
                            SUFARA ({sufaraLekcije.length})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {sufaraLekcije.map((lekcija, idx) => (
                            <div key={lekcija.id} className="flex items-center gap-2 text-xs pl-4">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                              <span className="text-purple-700">
                                {idx + 1}. {lekcija.naslov || 'Naslov lekcije'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 opacity-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          <span className="text-xs font-semibold text-gray-500">
                            SUFARA (0)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Ukupno */}
                  <div className="text-center pt-3 mt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-600">
                      Ukupno lekcija: <span className="font-semibold text-gray-900">{ukupno}</span>
                    </span>
                  </div>
                </div>
              );
            })()}
            {expandedRazred === r && (
              <div className="px-4 pb-4 space-y-6">
                {/* Lesson Type Selector */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Tipovi lekcija</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ILMIHAL */}
                    {(() => {
                      const isActive = (data.tipoviLekcija[r] ?? []).includes('ILMIHAL');
                      return (
                        <button
                          onClick={() => toggleTipLekcije(r, 'ILMIHAL')}
                          className={`relative p-3 rounded-lg border transition-colors ${
                            isActive
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded flex items-center justify-center ${
                              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-sm">ILMIHAL</div>
                              <div className="text-xs text-gray-500">Ručno dodavanje</div>
                            </div>
                            {isActive && (
                              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })()}
                    
                    {/* KURAN */}
                    {(() => {
                      const isActive = (data.tipoviLekcija[r] ?? []).includes('KURAN');
                      const odabrane = data.odabraneLekcije[r]?.KURAN ?? [];
                      return (
                        <button
                          onClick={() => toggleTipLekcije(r, 'KURAN')}
                          className={`relative p-3 rounded-lg border transition-colors ${
                            isActive
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded flex items-center justify-center ${
                              isActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-sm">KURAN</div>
                              <div className="text-xs text-gray-500">
                                {isActive && odabrane.length > 0 ? `${odabrane.length} odabrano` : 'Odabir lekcija'}
                              </div>
                            </div>
                            {isActive && (
                              <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })()}
                    
                    {/* SUFARA */}
                    {(() => {
                      const isActive = (data.tipoviLekcija[r] ?? []).includes('SUFARA');
                      const sufaraLekcije = (data.korak3[r] ?? []).filter((l) => l.tip === 'SUFARA');
                      return (
                        <button
                          onClick={() => toggleTipLekcije(r, 'SUFARA')}
                          className={`relative p-3 rounded-lg border transition-colors ${
                            isActive
                              ? 'bg-purple-50 border-purple-200 text-purple-900'
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded flex items-center justify-center ${
                              isActive ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-sm">SUFARA</div>
                              <div className="text-xs text-gray-500">
                                {isActive ? `${sufaraLekcije.length} lekcija` : 'Auto dodavanje'}
                              </div>
                            </div>
                            {isActive && (
                              <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Lekcije List - Sve dodane lekcije */}
                {lekcije.length > 0 ? (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">ILMIHAL lekcije ({lekcije.length})</h3>
                    <div
                      className="space-y-3"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggingLekcija && draggingLekcija.razred === r) {
                          const sveLekcije = data.korak3[r] ?? [];
                          const targetIndex = hoverDrop?.razred === r ? hoverDrop.index : lekcije.length - 1;
                          // Pronađi index u filtriranoj listi
                          const fromIndex = lekcije.findIndex((l) => l.id === draggingLekcija.lekcijaId);
                          if (fromIndex !== -1 && fromIndex !== targetIndex) {
                            // Pronađi stvarni index u svim lekcijama
                            const draggedLekcija = lekcije[fromIndex];
                            const realFromIndex = sveLekcije.findIndex((l) => l.id === draggedLekcija.id);
                            const realTargetLekcija = lekcije[targetIndex];
                            const realTargetIndex = realTargetLekcija ? sveLekcije.findIndex((l) => l.id === realTargetLekcija.id) : sveLekcije.length - 1;
                            if (realFromIndex !== -1 && realTargetIndex !== -1 && realFromIndex !== realTargetIndex) {
                              reorderLekcije(r, realFromIndex, realTargetIndex);
                            }
                          }
                        }
                        setDraggingLekcija(null);
                        setHoverDrop(null);
                      }}
                    >
                      {lekcije.map((lekcija, index) => {
                    const isDragging = draggingLekcija?.lekcijaId === lekcija.id;
                    const isHoverTarget = hoverDrop?.razred === r && hoverDrop?.index === index;
                    const isExpanded = expandedLekcija?.razred === r && expandedLekcija?.lekcijaId === lekcija.id;
                    const tezinaColors = {
                      1: 'bg-green-500 text-white border-green-600',
                      2: 'bg-yellow-500 text-white border-yellow-600',
                      3: 'bg-red-500 text-white border-red-600',
                    };
                    return (
                      <div
                        key={lekcija.id}
                        draggable={!isExpanded}
                        onDragStart={(e) => {
                          if (!isExpanded) {
                            setDraggingLekcija({ razred: r, lekcijaId: lekcija.id });
                            e.dataTransfer.effectAllowed = 'move';
                          }
                        }}
                        onDragEnd={() => {
                          setDraggingLekcija(null);
                          setHoverDrop(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isDragging && !isExpanded) {
                            setHoverDrop({ razred: r, index });
                          }
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX;
                          const y = e.clientY;
                          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                            setHoverDrop((prev) =>
                              prev && prev.razred === r && prev.index === index ? null : prev
                            );
                          }
                        }}
                        className={`bg-white border rounded-lg p-4 shadow-sm transition-all cursor-move ${
                          isHoverTarget && !isDragging
                            ? 'border-green-400 bg-green-50 border-dashed'
                            : isDragging
                            ? 'opacity-50 border-blue-300'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex-shrink-0 mt-1 cursor-move text-gray-400 hover:text-gray-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                          <div className="flex-1 space-y-3">
                            {/* Header row: number, title, switch, caret */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-lg font-bold text-gray-900 flex items-center gap-2 flex-1 min-w-0">
                                <span>#{index + 1}</span>
                                <span>-</span>
                                <span className="truncate">{lekcija.naslov || 'Naslov lekcije'}</span>
                                {lekcija.tip && (
                                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                                    lekcija.tip === 'ILMIHAL'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : lekcija.tip === 'KURAN'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-purple-50 text-purple-700'
                                  }`}>
                                    {lekcija.tip}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={lekcija.aktivan}
                                    onChange={(e) => updateLekcija(r, lekcija.id, { aktivan: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div
                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                      lekcija.aktivan ? 'bg-green-600' : 'bg-gray-300'
                                    }`}
                                  >
                                    <div
                                      className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
                                        lekcija.aktivan ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    ></div>
                                  </div>
                                </label>
                                <button
                                  onClick={() =>
                                    setExpandedLekcija(
                                      isExpanded ? null : { razred: r, lekcijaId: lekcija.id },
                                    )
                                  }
                                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                                  title={isExpanded ? 'Zatvori' : 'Otvori'}
                                >
                                  <svg
                                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Accordion content with smooth open/close */}
                            <div
                              className={`overflow-hidden transition-all duration-200 ease-out ${
                                isExpanded
                                  ? 'max-h-[800px] opacity-100 translate-y-0'
                                  : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
                              }`}
                            >
                              <div className={`space-y-3 ${isExpanded ? 'pt-3' : 'pt-0'} border-t border-gray-100`}>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">Naslov</label>
                                  <input
                                    type="text"
                                    value={lekcija.naslov}
                                    onChange={(e) => updateLekcija(r, lekcija.id, { naslov: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="npr. Uvod u Islam"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">Opis</label>
                                  <textarea
                                    value={lekcija.opis}
                                    onChange={(e) => updateLekcija(r, lekcija.id, { opis: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={2}
                                    placeholder="Kratak opis lekcije..."
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-2">Težina</label>
                                  <div className="flex items-center gap-2">
                                    {([1, 2, 3] as const).map((tezina) => (
                                      <button
                                        key={tezina}
                                        onClick={() => updateLekcija(r, lekcija.id, { tezina })}
                                        className={`flex items-center justify-center w-12 h-12 rounded-lg border-2 font-bold text-base transition-all ${
                                          lekcija.tezina === tezina
                                            ? tezinaColors[tezina] + ' ring-2 ring-offset-2 ring-gray-400'
                                            : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400'
                                        }`}
                                      >
                                        {tezina}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center justify-end pb-1">
                                  <button
                                    onClick={() => removeLekcija(r, lekcija.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Ukloni lekciju"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
                    Nema dodanih lekcija. Aktiviraj tipove lekcija iznad i odaberi ih.
                  </div>
                )}

                {/* Dodaj ILMIHAL lekciju */}
                {(data.tipoviLekcija[r] ?? []).includes('ILMIHAL') && (
                  <button
                    onClick={() => addLekcija(r, 'ILMIHAL')}
                    className="w-full px-4 py-2.5 border border-dashed border-gray-300 rounded text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Dodaj lekciju
                  </button>
                )}

                {/* KURAN Lekcije Selection Section */}
                {(() => {
                  const isKuranActive = (data.tipoviLekcija[r] ?? []).includes('KURAN');
                  const generirane = data.generiraneLekcije[r]?.KURAN ?? [];
                  const odabrane = data.odabraneLekcije[r]?.KURAN ?? [];
                  
                  if (!isKuranActive || generirane.length === 0) return null;
                  
                  return (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">Odaberi KURAN lekcije</h3>
                        {odabrane.length > 0 && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {odabrane.length} odabrano
                          </span>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {generirane.map((lekcija) => {
                            const isOdabrana = odabrane.includes(lekcija.id);
                            return (
                              <label
                                key={lekcija.id}
                                className={`flex items-center gap-2.5 p-2 rounded cursor-pointer transition-colors border ${
                                  isOdabrana
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isOdabrana}
                                  onChange={() => toggleOdabranaLekcija(r, 'KURAN', lekcija.id)}
                                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 focus:ring-1"
                                />
                                <span className="text-sm flex-1 text-gray-700">
                                  {lekcija.naslov}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Save button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setExpandedRazred(null)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    Spremi
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full max-w-none mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nastavni plan</h1>
            <p className="text-sm text-gray-600 mt-1">
              Kreirajte novi nastavni plan: osnovni podaci → odabir razreda → lekcije.
            </p>
          </div>
        </div>

        {renderStepIndicator()}

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Nazad
              </button>
              <div className="flex items-center gap-2">
                {step < 3 && (
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                    className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Dalje
                  </button>
                )}
                {step === 3 && (
                  <button
                    onClick={() => {
                      console.log('JSON Payload:', JSON.stringify(payload, null, 2));
                      // TODO: Pozvati API za spremanje
                      navigate('/');
                    }}
                    disabled={!isStep1Valid || !isStep2Valid}
                    className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Spremi
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Pregled JSON payloada</h3>
            <p className="text-xs text-gray-500 mb-3 font-medium">
              Ovo je struktura koja će se slati na backend.
            </p>
            <pre className="text-xs bg-gray-900 text-green-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

