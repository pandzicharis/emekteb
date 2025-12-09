import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Lekcija = {
  id: string;
  naslov: string;
  opis: string;
  tezina: 1 | 2 | 3;
  redoslijed: number;
  aktivan: boolean;
};

const RAZREDI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 0 = predškolci

const labelGrupa = (razred: number) => (razred === 0 ? 'Predškolci' : `${razred}. razred`);

function razredInfo(razred: number) {
  if (razred === 0) return { label: 'PREDSKOLCI', color: 'bg-teal-100 text-teal-800 border-teal-200' };
  if (razred <= 3) return { label: 'ILMIHAL 1', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (razred <= 6) return { label: 'ILMIHAL 2', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'ILMIHAL 3', color: 'bg-amber-100 text-amber-800 border-amber-200' };
}

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

  const addLekcija = (razred: number) => {
    const lekcije = data.korak3[razred] ?? [];
    const newLekcija: Lekcija = {
      id: `lekcija-${Date.now()}-${Math.random()}`,
      naslov: '',
      opis: '',
      tezina: 2,
      redoslijed: lekcije.length,
      aktivan: true,
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
        const lekcije = data.korak3[r] ?? [];
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
            {hasLekcije && expandedRazred !== r && (
              <div className="mx-4 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-900">
                  <span className="font-bold">{lekcije.length}</span> {lekcije.length === 1 ? 'lekcija' : 'lekcija'} dodano
                </div>
              </div>
            )}
            {expandedRazred === r && (
              <div className="px-4 pb-4 space-y-4">
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
                      const targetIndex = hoverDrop?.razred === r ? hoverDrop.index : lekcije.length - 1;
                      const fromIndex = lekcije.findIndex((l) => l.id === draggingLekcija.lekcijaId);
                      if (fromIndex !== -1 && fromIndex !== targetIndex) {
                        reorderLekcije(r, fromIndex, targetIndex);
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
                              <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span>#{index + 1}</span>
                                <span>-</span>
                                <span className="truncate">{lekcija.naslov || 'Naslov lekcije'}</span>
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
                <button
                  onClick={() => addLekcija(r)}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium text-sm"
                >
                  + Dodaj lekciju
                </button>
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

