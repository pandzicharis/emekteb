import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

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

type ApiRazred = {
  id: string;
  name: string;
  ilmihal: 'ILMIHAL_I' | 'ILMIHAL_II' | 'ILMIHAL_III';
  status: boolean;
};

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

const labelGrupa = (razred: number) => (razred === 0 ? 'Predškolci' : `${razred}. razred`);

const ilmihalInfo = (razred?: ApiRazred, fallbackRazred?: number) => {
  const isPreschool = fallbackRazred === 0 || razred?.name === '0';
  if (isPreschool) {
    return { label: 'PREDSKOLCI', color: 'bg-teal-100 text-teal-800 border-teal-200' };
  }

  const ilmihal = razred?.ilmihal ?? 'ILMIHAL_I';

  if (ilmihal === 'ILMIHAL_I') return { label: 'ILMIHAL I', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (ilmihal === 'ILMIHAL_II') return { label: 'ILMIHAL II', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'ILMIHAL III', color: 'bg-amber-100 text-amber-800 border-amber-200' };
};

type StepData = {
  korak1: {
    naziv: string;
    opis: string;
    datumUsvajanja: string;
    aktivan: boolean;
  };
  korak2: {
    razredi: string[]; // čuvamo id razreda
  };
  korak3: {
    // po razredu
    [razredId: string]: Lekcija[];
  };
  // Tipovi lekcija po razredu
  tipoviLekcija: {
    [razredId: string]: TipLekcije[];
  };
  // Generirane lekcije za Kuran i Sufara po razredu
  generiraneLekcije: {
    [razredId: string]: {
      KURAN?: Lekcija[];
      SUFARA?: Lekcija[];
    };
  };
  // Odabrane lekcije iz Kuran/Sufara po razredu
  odabraneLekcije: {
    [razredId: string]: {
      KURAN?: string[]; // IDs
      SUFARA?: string[]; // IDs
    };
  };
};

export default function NastavniPlanPage() {
  const [step, setStep] = useState(1);
  const [expandedRazred, setExpandedRazred] = useState<number | null>(null); // UI koristi broj (nameNum)
  const [expandedLekcija, setExpandedLekcija] = useState<{ razredId: string; lekcijaId: string } | null>(null);
  const [draggingLekcija, setDraggingLekcija] = useState<{ razredId: string; lekcijaId: string } | null>(null);
  const [hoverDrop, setHoverDrop] = useState<{ razredId: string; index: number } | null>(null);
  const [razredi, setRazredi] = useState<{ id: string; nameNum: number; ilmihal: ApiRazred['ilmihal'] }[]>([]);
  const [razrediData, setRazrediData] = useState<ApiRazred[]>([]);
  const [loadingRazredi, setLoadingRazredi] = useState(false);
  const [razrediError, setRazrediError] = useState<string | null>(null);
  const [lekcijeLoading, setLekcijeLoading] = useState(false);
  const [lekcijeError, setLekcijeError] = useState<string | null>(null);
  const [globalLekcije, setGlobalLekcije] = useState<{
    KURAN: Lekcija[];
    SUFARA: Lekcija[];
  }>({ KURAN: [], SUFARA: [] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [plans, setPlans] = useState<Array<{ id: string; naziv: string; opis: string; datumUsvajanja: string; aktivan: boolean; _count?: { razredi: number } }>>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const razrediFetched = useRef(false);
  const lekcijeFetched = useRef(false);
  const emptyForm: StepData = {
    korak1: {
      naziv: '',
      opis: '',
      datumUsvajanja: '',
      aktivan: true,
    },
    korak2: {
      razredi: [],
    },
    korak3: {},
    tipoviLekcija: {},
    generiraneLekcije: {},
    odabraneLekcije: {},
  };

  const [data, setData] = useState<StepData>(emptyForm);

  const isStep1Valid =
    data.korak1.naziv.trim().length > 2 &&
    data.korak1.datumUsvajanja.length > 0;

  const isStep2Valid = data.korak2.razredi.length > 0;

  // Kreiraj novu strukturu lekcija po razredima
  const lekcijePoRazredima = data.korak2.razredi.reduce((acc, razredId) => {
    const odabraneSufara = data.odabraneLekcije[razredId]?.SUFARA;
    const odabraneKuran = data.odabraneLekcije[razredId]?.KURAN;
    const ilmihalLekcije = (data.korak3[razredId] ?? []).filter((l) => l.tip === 'ILMIHAL');

    acc[razredId] = {
      SUFARA: odabraneSufara && odabraneSufara.length > 0 ? odabraneSufara : null,
      KURAN: odabraneKuran && odabraneKuran.length > 0 ? odabraneKuran : null,
      ILMIHAL: ilmihalLekcije.length > 0 ? ilmihalLekcije : [],
    };
    return acc;
  }, {} as Record<string, { SUFARA: string[] | null; KURAN: string[] | null; ILMIHAL: Lekcija[] }>);

  const payload = {
    id: editingPlanId ?? undefined,
    nastavniPlan: {
      naziv: data.korak1.naziv,
      opis: data.korak1.opis,
      datumUsvajanja: data.korak1.datumUsvajanja,
      aktivan: data.korak1.aktivan,
    },
    razredi: data.korak2.razredi,
    lekcije: lekcijePoRazredima,
  };

  const loadPlans = async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await axios.get(`${API_URL}/nastavni-plan`, { timeout: 5000 });
      setPlans(res.data ?? []);
    } catch (error) {
      console.warn('Neuspješno dohvaćanje nastavnih planova', error);
      setPlansError('Nisam uspio dohvatiti nastavne planove.');
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const toastNode = toast ? (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}
      >
        <svg
          className="w-5 h-5 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {toast.type === 'success' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <div className="text-sm leading-5">{toast.message}</div>
      </div>
    </div>
  ) : null;

  const startNewPlan = () => {
    setEditingPlanId(null);
    setData(emptyForm);
    setSaveError(null);
    setStep(1);
    setViewMode('create');
  };

  const loadPlan = async (planId: string) => {
    setPlansError(null);
    setSaving(true);
    try {
      const res = await axios.get(`${API_URL}/nastavni-plan/${planId}`, { timeout: 8000 });
      const { nastavniPlan, razredi, lekcije } = res.data ?? {};

      // Provjeri format razreda - ako su objekti, ekstraktuj ID-ove
      const razrediIds = (razredi ?? []).map((r: string | { id: string }) => typeof r === 'string' ? r : r.id);

      const tipoviLekcija: StepData['tipoviLekcija'] = {};
      const generiraneLekcije: StepData['generiraneLekcije'] = {};
      const odabraneLekcije: StepData['odabraneLekcije'] = {};
      const korak3: StepData['korak3'] = {};

      for (const razredId of razrediIds) {
        const entry = lekcije?.[razredId];
        if (!entry) continue;
        const tips: TipLekcije[] = [];
        if (entry.SUFARA) tips.push('SUFARA');
        if (entry.KURAN) tips.push('KURAN');
        if ((entry.ILMIHAL ?? []).length > 0) tips.push('ILMIHAL');
        tipoviLekcija[razredId] = tips;

        generiraneLekcije[razredId] = {
          ...(entry.KURAN ? { KURAN: globalLekcije.KURAN } : {}),
          ...(entry.SUFARA ? { SUFARA: globalLekcije.SUFARA } : {}),
        };
        odabraneLekcije[razredId] = {
          ...(entry.KURAN ? { KURAN: entry.KURAN } : {}),
          ...(entry.SUFARA ? { SUFARA: entry.SUFARA } : {}),
        };

        const ilmihalLekcije = (entry.ILMIHAL ?? []).map((l: Lekcija, idx: number) => ({
          ...l,
          tip: 'ILMIHAL' as const,
          redoslijed: l.redoslijed ?? idx,
        }));
        korak3[razredId] = ilmihalLekcije;
      }

      setData({
        korak1: {
          naziv: nastavniPlan?.naziv ?? '',
          opis: nastavniPlan?.opis ?? '',
          datumUsvajanja: nastavniPlan?.datumUsvajanja ?? '',
          aktivan: nastavniPlan?.aktivan ?? true,
        },
        korak2: { razredi: razrediIds },
        korak3,
        tipoviLekcija,
        generiraneLekcije,
        odabraneLekcije,
      });
      setEditingPlanId(planId);
      setViewMode('create');
      setStep(1);
    } catch (error) {
      console.warn('Neuspješno učitavanje nastavnog plana', error);
      setPlansError('Nisam uspio učitati nastavni plan.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    const fetchRazredi = async () => {
      if (razrediFetched.current) return;
      razrediFetched.current = true;
      setLoadingRazredi(true);
      setRazrediError(null);
      try {
        const response = await axios.get<ApiRazred[]>(`${API_URL}/razredi`, {
          timeout: 5000,
        });

        const active = (response.data ?? []).filter((r) => r.status !== false);
        const withParsed = active
          .map((r) => {
            const match = r.name.match(/\d+/);
            const nameNum = match ? Number(match[0]) : NaN;
            return { ...r, nameNum };
          })
          .filter((r) => !Number.isNaN(r.nameNum));

        const uniqueSortedNums = Array.from(new Set(withParsed.map((r) => r.nameNum))).sort((a, b) => a - b);
        const uiList =
          uniqueSortedNums.length > 0
            ? uniqueSortedNums
                .map((num) => withParsed.find((r) => r.nameNum === num)!)
                .filter(Boolean)
                .map((r) => ({ id: r.id, nameNum: r.nameNum, ilmihal: r.ilmihal }))
            : [];

        setRazrediData(withParsed);
        setRazredi(uiList);
      } catch (error) {
        console.warn('API razredi nije dostupan:', error);
        setRazrediData([]);
        setRazredi([]);
        setRazrediError('Nisam uspio dohvatiti razrede.');
      } finally {
        setLoadingRazredi(false);
      }
    };

    fetchRazredi();
  }, []);

  useEffect(() => {
    const fetchLekcije = async () => {
      if (lekcijeFetched.current) return;
      lekcijeFetched.current = true;
      setLekcijeLoading(true);
      setLekcijeError(null);
      try {
        const [kuranRes, sufaraRes] = await Promise.all([
          axios.get<Lekcija[]>(`${API_URL}/lekcije`, { params: { tip: 'KURAN' }, timeout: 5000 }),
          axios.get<Lekcija[]>(`${API_URL}/lekcije`, { params: { tip: 'SUFARA' }, timeout: 5000 }),
        ]);

        const sortAndNormalize = (list: Lekcija[]) =>
          (list ?? [])
            .sort((a, b) => a.redoslijed - b.redoslijed)
            .map((l, idx) => ({ ...l, redoslijed: idx }));

        setGlobalLekcije({
          KURAN: sortAndNormalize(kuranRes.data ?? []),
          SUFARA: sortAndNormalize(sufaraRes.data ?? []),
        });
      } catch (error) {
        console.warn('Neuspješno dohvaćanje lekcija', error);
        setLekcijeError('Nisam uspio dohvatiti lekcije (KURAN/SUFARA).');
      } finally {
        setLekcijeLoading(false);
      }
    };

    fetchLekcije();
  }, []);

  const toggleTipLekcije = (razredId: string, tip: TipLekcije) => {
    setData((prev) => {
      const currentTipovi = prev.tipoviLekcija[razredId] ?? [];
      const hasTip = currentTipovi.includes(tip);
      
      let newTipovi: TipLekcije[];
      const newGeneriraneLekcije = { ...prev.generiraneLekcije };
      const newOdabraneLekcije = { ...prev.odabraneLekcije };
      
      if (hasTip) {
        // Ukloni tip
        newTipovi = currentTipovi.filter((t) => t !== tip);
        // Ukloni generirane lekcije (samo za KURAN i SUFARA)
        if (tip === 'KURAN' || tip === 'SUFARA') {
          if (newGeneriraneLekcije[razredId]) {
            const updated = { ...newGeneriraneLekcije[razredId] };
            if (tip === 'KURAN') {
              delete updated.KURAN;
            } else {
              delete updated.SUFARA;
            }
            newGeneriraneLekcije[razredId] = updated;
          }
          // Ukloni odabrane lekcije
          if (newOdabraneLekcije[razredId]) {
            const updated = { ...newOdabraneLekcije[razredId] };
            if (tip === 'KURAN') {
              delete updated.KURAN;
            } else {
              delete updated.SUFARA;
            }
            newOdabraneLekcije[razredId] = updated;
          }
        }
        // Ukloni lekcije iz korak3
        const lekcije = prev.korak3[razredId] ?? [];
        const filteredLekcije = lekcije.filter((l) => l.tip !== tip);
        return {
          ...prev,
          tipoviLekcija: { ...prev.tipoviLekcija, [razredId]: newTipovi },
          generiraneLekcije: newGeneriraneLekcije,
          odabraneLekcije: newOdabraneLekcije,
          korak3: { ...prev.korak3, [razredId]: filteredLekcije },
        };
      } else {
        // Dodaj tip
        newTipovi = [...currentTipovi, tip];
        if (tip === 'KURAN' || tip === 'SUFARA') {
          const lekcije = globalLekcije[tip] ?? [];
          if (!newGeneriraneLekcije[razredId]) {
            newGeneriraneLekcije[razredId] = {};
          }
          newGeneriraneLekcije[razredId] = {
            ...newGeneriraneLekcije[razredId],
            [tip]: lekcije,
          };

          if (tip === 'SUFARA') {
            const existingLekcije = prev.korak3[razredId] ?? [];
            const nonSufara = existingLekcije.filter((l) => l.tip !== 'SUFARA');
            const withSufara = [
              ...nonSufara,
              ...lekcije.map((l, idx) => ({ ...l, redoslijed: nonSufara.length + idx })),
            ];
            return {
              ...prev,
              tipoviLekcija: { ...prev.tipoviLekcija, [razredId]: newTipovi },
              generiraneLekcije: newGeneriraneLekcije,
              odabraneLekcije: {
                ...prev.odabraneLekcije,
                [razredId]: {
                  ...prev.odabraneLekcije[razredId],
                  SUFARA: lekcije.map((l) => l.id),
                },
              },
              korak3: {
                ...prev.korak3,
                [razredId]: withSufara,
              },
            };
          }
        }
      }
      
      return {
        ...prev,
        tipoviLekcija: { ...prev.tipoviLekcija, [razredId]: newTipovi },
        generiraneLekcije: newGeneriraneLekcije,
        odabraneLekcije: newOdabraneLekcije,
      };
    });

    // Lekcije se već fetchaju globalno na mount
  };

  const toggleOdabranaLekcija = (razredId: string, tip: 'KURAN' | 'SUFARA', lekcijaId: string) => {
    setData((prev) => {
      const currentOdabrane = prev.odabraneLekcije[razredId]?.[tip] ?? [];
      const isOdabrana = currentOdabrane.includes(lekcijaId);
      
      let newOdabrane: string[];
      let lekcije = [...(prev.korak3[razredId] ?? [])];
      
      if (isOdabrana) {
        // Ukloni lekciju
        newOdabrane = currentOdabrane.filter((id) => id !== lekcijaId);
        lekcije = lekcije.filter((l) => l.id !== lekcijaId);
      } else {
        // Dodaj lekciju
        newOdabrane = [...currentOdabrane, lekcijaId];
        const generiraneLekcije = prev.generiraneLekcije[razredId]?.[tip] ?? [];
        const lekcija = generiraneLekcije.find((l) => l.id === lekcijaId);
        if (lekcija) {
          lekcije.push({ ...lekcija, redoslijed: lekcije.length });
        }
      }
      
      return {
        ...prev,
        odabraneLekcije: {
          ...prev.odabraneLekcije,
          [razredId]: {
            ...prev.odabraneLekcije[razredId],
            [tip]: newOdabrane,
          },
        },
        korak3: {
          ...prev.korak3,
          [razredId]: lekcije.map((l, idx) => ({ ...l, redoslijed: idx })),
        },
      };
    });
  };

  const addLekcija = (razredId: string, tip: 'ILMIHAL' | 'SUFARA' = 'ILMIHAL') => {
    const lekcije = data.korak3[razredId] ?? [];
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
        [razredId]: [...lekcije, newLekcija],
      },
    }));
    setExpandedLekcija({ razredId, lekcijaId: newLekcija.id });
  };

  const updateLekcija = (razredId: string, lekcijaId: string, updates: Partial<Lekcija>) => {
    setData((prev) => {
      const lekcije = prev.korak3[razredId] ?? [];
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razredId]: lekcije.map((l) => (l.id === lekcijaId ? { ...l, ...updates } : l)),
        },
      };
    });
  };

  const removeLekcija = (razredId: string, lekcijaId: string) => {
    setData((prev) => {
      const lekcije = prev.korak3[razredId] ?? [];
      const filtered = lekcije.filter((l) => l.id !== lekcijaId);
      // Reorder remaining lekcije
      const reordered = filtered.map((l, idx) => ({ ...l, redoslijed: idx }));
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razredId]: reordered,
        },
      };
    });
  };

  const reorderLekcije = (razredId: string, fromIndex: number, toIndex: number) => {
    setData((prev) => {
      const lekcije = [...(prev.korak3[razredId] ?? [])];
      const [removed] = lekcije.splice(fromIndex, 1);
      lekcije.splice(toIndex, 0, removed);
      const reordered = lekcije.map((l, idx) => ({ ...l, redoslijed: idx }));
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razredId]: reordered,
        },
      };
    });
  };

  const toggleRazred = (r: { id: string; nameNum: number; ilmihal: ApiRazred['ilmihal'] }) => {
    setData((prev) => {
      const exists = prev.korak2.razredi.includes(r.id);
      const razredi = exists
        ? prev.korak2.razredi.filter((x) => x !== r.id)
        : [...prev.korak2.razredi, r.id];

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
      <div className="flex items-center gap-3 justify-end">
        <div className="flex-1">
          {loadingRazredi && (
            <div className="text-sm text-gray-500 font-medium">Učitavam razrede...</div>
          )}
          {!loadingRazredi && razrediError && (
            <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
              {razrediError}
            </div>
          )}
          {!loadingRazredi && !razrediError && razredi.length === 0 && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Nema dostupnih razreda.
            </div>
          )}
        </div>
        <button
          onClick={() =>
            setData((prev) => ({
              ...prev,
              korak2: { razredi: razredi.map((r) => r.id) },
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
        {razredi.map((r) => {
          const active = data.korak2.razredi.includes(r.id);
          const razredObj = razrediData.find((rr) => rr.id === r.id);
          const info = ilmihalInfo(razredObj, r.nameNum);
          return (
            <div
              key={r.id}
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
                  <div className="text-lg font-bold text-gray-900">{labelGrupa(r.nameNum)}</div>
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
      {data.korak2.razredi.map((rId) => {
        const razredObj = razredi.find((r) => r.id === rId);
        const sveLekcije = data.korak3[rId] ?? [];
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
          <div key={rId} className="border border-gray-200 rounded-lg bg-white transition-colors">
            <button
              onClick={() => {
                const next = expandedRazred === razredObj?.nameNum ? null : razredObj?.nameNum ?? null;
                setExpandedRazred(next);
              }}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3 flex-1">
                {/* Status ikona */}
                {hasLekcije ? (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                {/* Naziv razreda */}
                <span className="text-base font-bold text-gray-900">{labelGrupa(razredObj?.nameNum ?? 0)}</span>
                
                {/* Ilmihal badge - desno */}
                <div className="flex-1" />
                {(() => {
                  const razredFull = razrediData.find((rr) => rr.id === rId);
                  const info = ilmihalInfo(razredFull, razredObj?.nameNum);
                  return (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold mr-2.5 ${info.color}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <span className="text-xs">{info.label}</span>
                    </div>
                  );
                })()}
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  expandedRazred === (razredObj?.nameNum ?? null) ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedRazred !== (razredObj?.nameNum ?? null) && (() => {
              const sveLekcije = data.korak3[rId] ?? [];
              const ilmihalLekcije = sveLekcije.filter((l) => l.tip === 'ILMIHAL' || (!l.tip && !l.id.toLowerCase().includes('kuran') && !l.id.toLowerCase().includes('sufara')));
              const kuranLekcije = sveLekcije.filter((l) => l.tip === 'KURAN');
              const sufaraLekcije = sveLekcije.filter((l) => l.tip === 'SUFARA');
              const ukupno = ilmihalLekcije.length + kuranLekcije.length + sufaraLekcije.length;
              
              // Provjeri da li je SUFARA aktivan
              const hasSufara = (data.tipoviLekcija[rId] ?? []).includes('SUFARA');
              // Broj odabranih KURAN lekcija
              const kuranCount = data.odabraneLekcije[rId]?.KURAN?.length ?? 0;
              
              return (
                <div className="mx-4 mb-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 flex items-center">
                        {/* Lekcije - broj */}
                        <div className="flex-1 pr-3 border-r border-gray-300">
                          <div className="text-lg font-bold text-gray-900">{ukupno}</div>
                          <div className="text-[10px] text-gray-500 font-medium">Lekcije</div>
                        </div>
                        {/* Sufara - boolean */}
                        <div className="flex-1 px-3 border-r border-gray-300">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded-full ${hasSufara ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div className="text-sm font-semibold text-gray-900">{hasSufara ? 'Da' : 'Ne'}</div>
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium">Sufara</div>
                        </div>
                        {/* Kuran - broj */}
                        <div className="flex-1 pl-3">
                          <div className="text-lg font-bold text-gray-900">{kuranCount}</div>
                          <div className="text-[10px] text-gray-500 font-medium">Kuran</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {expandedRazred === (razredObj?.nameNum ?? null) && (
              <div className="px-4 pb-4 space-y-6">
                {/* Lesson Type Selector */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Tipovi lekcija</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ILMIHAL */}
                    {(() => {
                      const isActive = (data.tipoviLekcija[rId] ?? []).includes('ILMIHAL');
                      return (
                        <button
                          onClick={() => toggleTipLekcije(rId, 'ILMIHAL')}
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
                      const isActive = (data.tipoviLekcija[rId] ?? []).includes('KURAN');
                      const odabrane = data.odabraneLekcije[rId]?.KURAN ?? [];
                      return (
                        <button
                          onClick={() => toggleTipLekcije(rId, 'KURAN')}
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
                      const isActive = (data.tipoviLekcija[rId] ?? []).includes('SUFARA');
                      const sufaraLekcije = (data.korak3[rId] ?? []).filter((l) => l.tip === 'SUFARA');
                      return (
                        <button
                          onClick={() => toggleTipLekcije(rId, 'SUFARA')}
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
                          if (draggingLekcija && draggingLekcija.razredId === rId) {
                          const sveLekcije = data.korak3[rId] ?? [];
                          const targetIndex = hoverDrop?.razredId === rId ? hoverDrop.index : lekcije.length - 1;
                          // Pronađi index u filtriranoj listi
                          const fromIndex = lekcije.findIndex((l) => l.id === draggingLekcija.lekcijaId);
                          if (fromIndex !== -1 && fromIndex !== targetIndex) {
                            // Pronađi stvarni index u svim lekcijama
                            const draggedLekcija = lekcije[fromIndex];
                            const realFromIndex = sveLekcije.findIndex((l) => l.id === draggedLekcija.id);
                            const realTargetLekcija = lekcije[targetIndex];
                            const realTargetIndex = realTargetLekcija ? sveLekcije.findIndex((l) => l.id === realTargetLekcija.id) : sveLekcije.length - 1;
                            if (realFromIndex !== -1 && realTargetIndex !== -1 && realFromIndex !== realTargetIndex) {
                              reorderLekcije(rId, realFromIndex, realTargetIndex);
                            }
                          }
                        }
                        setDraggingLekcija(null);
                        setHoverDrop(null);
                      }}
                    >
                      {lekcije.map((lekcija, index) => {
                    const isDragging = draggingLekcija?.lekcijaId === lekcija.id;
                    const isHoverTarget = hoverDrop?.razredId === rId && hoverDrop?.index === index;
                    const isExpanded = expandedLekcija?.razredId === rId && expandedLekcija?.lekcijaId === lekcija.id;
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
                            setDraggingLekcija({ razredId: rId, lekcijaId: lekcija.id });
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
                            setHoverDrop({ razredId: rId, index });
                          }
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX;
                          const y = e.clientY;
                          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                            setHoverDrop((prev) =>
                              prev && prev.razredId === rId && prev.index === index ? null : prev
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
                                    onChange={(e) => updateLekcija(rId, lekcija.id, { aktivan: e.target.checked })}
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
                                      isExpanded ? null : { razredId: rId, lekcijaId: lekcija.id },
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
                                    onChange={(e) => updateLekcija(rId, lekcija.id, { naslov: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="npr. Uvod u Islam"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">Opis</label>
                                  <textarea
                                    value={lekcija.opis}
                                    onChange={(e) => updateLekcija(rId, lekcija.id, { opis: e.target.value })}
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
                                        onClick={() => updateLekcija(rId, lekcija.id, { tezina })}
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
                                    onClick={() => removeLekcija(rId, lekcija.id)}
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
                {(data.tipoviLekcija[rId] ?? []).includes('ILMIHAL') && (
                  <button
                    onClick={() => addLekcija(rId, 'ILMIHAL')}
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
                  const isKuranActive = (data.tipoviLekcija[rId] ?? []).includes('KURAN');
                  const generirane = data.generiraneLekcije[rId]?.KURAN ?? [];
                  const odabrane = data.odabraneLekcije[rId]?.KURAN ?? [];
                  const isLoading = lekcijeLoading;
                  const loadError = lekcijeError;
                  
                  if (!isKuranActive || (!isLoading && generirane.length === 0 && !loadError)) return null;
                  
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
                        {isLoading && (
                          <div className="text-sm text-gray-500">Učitavam lekcije...</div>
                        )}
                        {loadError && (
                          <div className="text-sm text-red-600">{loadError}</div>
                        )}
                        {!isLoading && !loadError && (
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
                                    onChange={() => toggleOdabranaLekcija(rId, 'KURAN', lekcija.id)}
                                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 focus:ring-1"
                                  />
                                  <span className="text-sm flex-1 text-gray-700">
                                    {lekcija.naslov}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
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

  if (viewMode === 'list') {
    return (
      <div className="bg-gray-50 min-h-full p-6 lg:p-10">
        {toastNode}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nastavni planovi</h1>
            <p className="text-sm text-gray-600 mt-1">Pregled postojećih nastavnih planova.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          {plansLoading && <div className="text-sm text-gray-500">Učitavam planove...</div>}
          {plansError && <div className="text-sm text-red-600">{plansError}</div>}
          {!plansLoading && !plansError && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.length === 0 && (
                <div className="col-span-full text-sm text-gray-500">Nema kreiranih nastavnih planova.</div>
              )}
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPlan(p.id)}
                  className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm text-left hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l-2 4h4l-2 4" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-base font-semibold text-gray-900">{p.naziv}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2M12 22a10 10 0 100-20 10 10 0 000 20z" />
                          </svg>
                          {new Date(p.datumUsvajanja).toLocaleDateString('bs-BA')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.aktivan ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.aktivan ? 'Aktivan' : 'Neaktivan'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-3 line-clamp-3">{p.opis}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                      </svg>
                      {p._count?.razredi ?? 0} razreda
                    </div>
                    <div className="flex items-center gap-1 text-blue-600 font-medium">
                      <span className="text-xs">Detalji</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={startNewPlan}
                className="border border-dashed border-gray-300 rounded-xl p-4 bg-white text-left hover:border-green-400 hover:shadow-md transition-all flex flex-col justify-center gap-2 min-h-[150px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900">Novi nastavni plan</div>
                    <div className="text-xs text-gray-500 mt-1">Dodaj novi plan i postavke</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  Kreiraj novi plan
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      {toastNode}
      <div className="w-full max-w-none mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{editingPlanId ? 'Uredi nastavni plan' : 'Novi nastavni plan'}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Osnovni podaci → odabir razreda → lekcije.
            </p>
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Povratak na listu
          </button>
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
                    onClick={async () => {
                      setSaveError(null);
                      setSaving(true);
                      try {
                        await axios.post(`${API_URL}/nastavni-plan`, payload, { timeout: 10000 });
                        await loadPlans();
                        setViewMode('list');
                        setEditingPlanId(null);
                        setData(emptyForm);
                        setStep(1);
                        setToast({ type: 'success', message: editingPlanId ? 'Plan ažuriran.' : 'Plan sačuvan.' });
                      } catch (error) {
                        console.warn('Greška pri spremanju nastavnog plana', error);
                        setSaveError('Nisam uspio spremiti nastavni plan. Pokušajte ponovo.');
                        setToast({ type: 'error', message: 'Spremanje nije uspjelo.' });
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={!isStep1Valid || !isStep2Valid || saving}
                    className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Spremam...' : editingPlanId ? 'Ažuriraj' : 'Spremi'}
                  </button>
                )}
              </div>
              {saveError && (
                <div className="mt-3 text-sm text-red-600">
                  {saveError}
                </div>
              )}
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

