import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';

type NastavniPlan = { id: string; naziv: string };

type Ucenik = {
  id: string;
  ime: string;
  prezime: string;
  email?: string;
};

type Muallim = {
  id: string;
  ime: string;
  prezime: string;
  email: string;
};

type ApiRazred = {
  id: string;
  name: string;
  ilmihal: 'ILMIHAL_I' | 'ILMIHAL_II' | 'ILMIHAL_III';
  status: boolean;
};

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

const WEEKEND_DAYS: Schedule['day'][] = ['subota', 'nedjelja'];

// Timeline constants
const TIMELINE_START_HOUR = 8; // 08:00
const TIMELINE_END_HOUR = 16; // 16:00
const TIMELINE_HEIGHT = 480; // px
const SLOT_DURATION_OPTIONS = [30, 45, 60, 90, 120]; // minutes

const labelGrupa = (razred: number) => (razred === 0 ? 'Predškolci' : `${razred}. razred`);

function razredInfo(razred: number, ilmihal?: ApiRazred['ilmihal']) {
  if (razred === 0) return { label: 'PREDSKOLCI', color: 'bg-teal-100 text-teal-800 border-teal-200' };

  if (ilmihal === 'ILMIHAL_I') return { label: 'ILMIHAL I', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (ilmihal === 'ILMIHAL_II') return { label: 'ILMIHAL II', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  if (ilmihal === 'ILMIHAL_III') return { label: 'ILMIHAL III', color: 'bg-amber-100 text-amber-800 border-amber-200' };

  if (razred <= 3) return { label: 'ILMIHAL 1', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (razred <= 6) return { label: 'ILMIHAL 2', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'ILMIHAL 3', color: 'bg-amber-100 text-amber-800 border-amber-200' };
}

// Helper function to get avatar initials and color
const getAvatarInfo = (ime: string, prezime: string) => {
  const initials = `${(ime?.[0] ?? '').toUpperCase()}${(prezime?.[0] ?? '').toUpperCase()}`;
  // Sivi avatar za sve muallime
  return { initials, color: 'bg-gray-400 text-white' };
};

const getEndTime = (startTime: string, duration: number = 45): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};

// Helper functions for timeline
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const timeToPosition = (time: string): number => {
  const totalMinutes = timeToMinutes(time);
  const startMinutes = TIMELINE_START_HOUR * 60;
  const endMinutes = TIMELINE_END_HOUR * 60;
  const range = endMinutes - startMinutes;
  const position = ((totalMinutes - startMinutes) / range) * TIMELINE_HEIGHT;
  return Math.max(0, Math.min(TIMELINE_HEIGHT, position));
};

const positionToTime = (position: number): string => {
  const startMinutes = TIMELINE_START_HOUR * 60;
  const endMinutes = TIMELINE_END_HOUR * 60;
  const range = endMinutes - startMinutes;
  const minutes = startMinutes + (position / TIMELINE_HEIGHT) * range;
  // Round to nearest 5 minutes
  const rounded = Math.round(minutes / 5) * 5;
  return minutesToTime(rounded);
};

type SplitState = {
  enabled: boolean;
  groupA: string[];
  groupB: string[];
  selectionDone?: boolean;
};

type Schedule = {
  day: 'subota' | 'nedjelja';
  slot: string; // HH:mm
  location: 'ucionica' | 'divanhana';
  duration?: number; // minutes, default 45
};

type StepData = {
  korak1: {
    naziv: string;
    opis: string;
    periodOd: string;
    periodDo: string;
    planId: string;
    status: 'ACTIVE' | 'INACTIVE';
  };
  korak2: {
    razredi: number[];
  };
  korak3: {
    // po razredu
    [razred: number]: {
      razredId: string;
      muallimId: string | null;
      ucenici: string[]; // ako split nije uključen
      split: SplitState;
      settings?: {
        single?: { kuran: boolean; sufara: boolean };
        groupA?: { kuran: boolean; sufara: boolean };
        groupB?: { kuran: boolean; sufara: boolean };
      };
      raspored: {
        single: Schedule;
        groupA?: Schedule;
        groupB?: Schedule;
      };
    };
  };
};

type NastavnaGodinaCard = {
  id: string;
  naziv: string;
  opis?: string | null;
  datumOd: string;
  datumDo: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  nastavniPlan?: { id: string; naziv: string } | null;
  razredi?: Array<{ razred?: ApiRazred; split?: boolean }> | null;
  _count?: { razredi: number };
};

type ApiGrupa = {
  naziv: string;
  kuran?: boolean;
  sufara?: boolean;
  raspored?: Array<{
    dan?: Schedule['day'];
    day?: Schedule['day'];
    slot?: string;
    lokacija?: string;
    location?: string;
    trajanje?: number;
    duration?: number;
  }>;
  ucenici?: Array<{ ucenik?: { id: string } }>;
};

type ApiRazredGodina = {
  razred?: ApiRazred;
  razredId?: string;
  split?: boolean;
  muallim?: { korisnik?: Muallim };
  muallimId?: string;
  grupe?: ApiGrupa[];
};

type ApiGodinaDetails = NastavnaGodinaCard & {
  nastavniPlanId?: string;
  razredi?: ApiRazredGodina[] | null;
};

const emptyForm: StepData = {
  korak1: {
    naziv: '',
    opis: '',
    periodOd: '',
    periodDo: '',
    planId: '',
    status: 'ACTIVE',
  },
  korak2: {
    razredi: [],
  },
  korak3: {},
};

export default function SetupNastavnaGodinaPage() {
  const [step, setStep] = useState(1);
  const [expandedRazred, setExpandedRazred] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [search, setSearch] = useState('');
  const [occupiedFilter, setOccupiedFilter] = useState('');
  const [dragging, setDragging] = useState<{ razred: number; ucenikId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hoverDrop, setHoverDrop] = useState<{ razred: number; group: 'A' | 'B' } | null>(null);
  const [razredActiveStep, setRazredActiveStep] = useState<Record<number, number>>({});
  const [savedSteps, setSavedSteps] = useState<Record<number, Set<number>>>({});
  const [editingSteps, setEditingSteps] = useState<Record<number, Set<number>>>({});
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [timelineHover, setTimelineHover] = useState<Record<string, { position: number; day: Schedule['day'] }>>({});
  const [razredi, setRazredi] = useState<ApiRazred[]>([]);
  const [loadingRazredi, setLoadingRazredi] = useState(false);
  const [razrediError, setRazrediError] = useState<string | null>(null);
  const [godine, setGodine] = useState<NastavnaGodinaCard[]>([]);
  const [godineLoading, setGodineLoading] = useState(false);
  const [godineError, setGodineError] = useState<string | null>(null);
  const [plans, setPlans] = useState<NastavniPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [muallimi, setMuallimi] = useState<Muallim[]>([]);
  const [muallimiLoading, setMuallimiLoading] = useState(false);
  const [muallimiError, setMuallimiError] = useState<string | null>(null);
  const [planCapabilities, setPlanCapabilities] = useState<Record<number, { kuran: boolean; sufara: boolean }>>({});
  const [planDetailsLoading, setPlanDetailsLoading] = useState(false);
  const [planDetailsError, setPlanDetailsError] = useState<string | null>(null);
  const [planRazredIds, setPlanRazredIds] = useState<string[]>([]);
  const [editingGodinaId, setEditingGodinaId] = useState<string | null>(null);
  const [godinaDetailsLoading, setGodinaDetailsLoading] = useState(false);
  const [godinaDetailsError, setGodinaDetailsError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchUcenici = async () => {
      try {
        const response = await axios.get<Ucenik[]>(`${API_URL}/ucenici`, {
          timeout: 5000, // 5 sekundi timeout
        });
        setUcenici(response.data ?? []);
      } catch (error) {
        console.warn('API nije dostupan za učenike:', error);
        setUcenici([]);
      }
    };

    fetchUcenici();
  }, []);

  useEffect(() => {
    const fetchMuallimi = async () => {
      setMuallimiLoading(true);
      setMuallimiError(null);
      try {
        const response = await axios.get<Muallim[]>(`${API_URL}/muallimi`, { timeout: 5000 });
        setMuallimi(response.data ?? []);
      } catch (error) {
        console.warn('API nije dostupan za muallime:', error);
        setMuallimi([]);
        setMuallimiError('Nisam uspio dohvatiti muallime.');
      } finally {
        setMuallimiLoading(false);
      }
    };

    fetchMuallimi();
  }, []);

  useEffect(() => {
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);
      try {
        const response = await axios.get<NastavniPlan[]>(`${API_URL}/nastavni-plan`, { timeout: 5000 });
        const fetched = response.data ?? [];
        setPlans(fetched);
        if (fetched.length > 0) {
          setData((prev) => ({
            ...prev,
            korak1: { ...prev.korak1, planId: prev.korak1.planId || fetched[0].id },
          }));
        }
      } catch (error) {
        console.warn('API nije dostupan za nastavne planove:', error);
        setPlans([]);
        setPlansError('Nisam uspio dohvatiti nastavne planove.');
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchRazredi = async () => {
      setLoadingRazredi(true);
      setRazrediError(null);
      try {
        const response = await axios.get<ApiRazred[]>(`${API_URL}/razredi`, { timeout: 5000 });
        setRazredi(response.data ?? []);
      } catch (error) {
        console.warn('API nije dostupan za razrede:', error);
        setRazredi([]);
        setRazrediError('Nisam uspio dohvatiti razrede.');
      } finally {
        setLoadingRazredi(false);
      }
    };

    fetchRazredi();
  }, []);

  useEffect(() => {
    loadGodine();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const setActiveRazredStep = (razred: number, nextStep: number) => {
    setRazredActiveStep((prev) => ({
      ...prev,
      [razred]: Math.min(4, Math.max(1, nextStep)),
    }));
  };

  const isStepSaved = (razred: number, stepNum: number) => {
    return savedSteps[razred]?.has(stepNum) ?? false;
  };

  const areAllStepsSaved = (razred: number) => {
    return isStepSaved(razred, 1) && isStepSaved(razred, 2) && isStepSaved(razred, 3) && isStepSaved(razred, 4);
  };

  const isStepEditing = (razred: number, stepNum: number) => {
    return editingSteps[razred]?.has(stepNum) ?? false;
  };

  const saveStep = (razred: number, stepNum: number) => {
    setSavedSteps((prev) => {
      const razredSet = prev[razred] ?? new Set();
      razredSet.add(stepNum);
      return { ...prev, [razred]: razredSet };
    });
    setEditingSteps((prev) => {
      const razredSet = prev[razred] ?? new Set();
      razredSet.delete(stepNum);
      return { ...prev, [razred]: razredSet };
    });
    
    // Automatski prelazak na sljedeći korak ako nije posljednji
    if (stepNum < 4) {
      setActiveRazredStep(razred, stepNum + 1);
    }
  };

  const startEditingStep = (razred: number, stepNum: number) => {
    setEditingSteps((prev) => {
      const razredSet = prev[razred] ?? new Set();
      razredSet.add(stepNum);
      return { ...prev, [razred]: razredSet };
    });
    setActiveRazredStep(razred, stepNum);
  };

  const cancelEditingStep = (razred: number, stepNum: number) => {
    setEditingSteps((prev) => {
      const razredSet = prev[razred] ?? new Set();
      razredSet.delete(stepNum);
      return { ...prev, [razred]: razredSet };
    });
  };

  const isStepActive = (razred: number, stepNum: number) => {
    const active = razredActiveStep[razred] ?? 1;
    const saved = isStepSaved(razred, stepNum);
    const editing = isStepEditing(razred, stepNum);
    
    // Korak 1 je uvijek dostupan i vidljiv
    if (stepNum === 1) {
      return true;
    }
    
    // Korak 2 je uvijek dostupan i vidljiv ako je korak 1 saved
    if (stepNum === 2) {
      const step1Saved = isStepSaved(razred, 1);
      return step1Saved;
    }
    
    // Korak 3 (Podjela u grupe) je uvijek dostupan ako je korak 2 saved
    // jer korisnik mora uvek moći da menja podjelu u grupe
    if (stepNum === 3) {
      const step2Saved = isStepSaved(razred, 2);
      return step2Saved;
    }
    
    // Za ostale korake, provjeravamo da li je prethodni korak saved
    const prevStepSaved = isStepSaved(razred, stepNum - 1);
    if (!prevStepSaved) {
      return false; // Ne može biti aktivan ako prethodni nije saved
    }
    
    return active === stepNum || (saved && editing);
  };

  const defaultRazredState = (razredId: string = '') => ({
    razredId,
    muallimId: null as string | null,
    ucenici: [] as string[],
    split: { enabled: false, groupA: [] as string[], groupB: [] as string[], selectionDone: false },
  settings: { single: { kuran: false, sufara: false } },
    raspored: {
      single: { day: 'subota' as const, slot: '', location: 'ucionica' as const, duration: 45 },
    },
  });

  const [data, setData] = useState<StepData>(emptyForm);

  const razrediOptions = useMemo(
    () =>
      (razredi ?? [])
        .filter((r) => r.status !== false)
        .map((r) => {
          const match = r.name.match(/\d+/);
          const nameNum = match ? Number(match[0]) : NaN;
          return { ...r, nameNum };
        })
        .filter((r) => !Number.isNaN(r.nameNum)),
    [razredi],
  );

  const razredByNumber = useMemo(() => {
    const map = new Map<number, (typeof razrediOptions)[number]>();
    razrediOptions.forEach((r) => map.set(r.nameNum, r));
    return map;
  }, [razrediOptions]);

  const getRazredId = (razred: number): string => {
    const razredInfo = razredByNumber.get(razred);
    return razredInfo?.id ?? '';
  };

  const planRazredOptions = useMemo(() => {
    if (planRazredIds.length === 0) return razrediOptions;
    const allowedIds = new Set(planRazredIds);
    return razrediOptions.filter((r) => allowedIds.has(r.id));
  }, [planRazredIds, razrediOptions]);

  const muallimById = useMemo(() => {
    const map = new Map<string, Muallim>();
    muallimi.forEach((m) => map.set(m.id, m));
    return map;
  }, [muallimi]);

  const loadGodine = async () => {
    setGodineLoading(true);
    setGodineError(null);
    try {
      const response = await axios.get<NastavnaGodinaCard[]>(`${API_URL}/nastavne-godine`, { timeout: 6000 });
      setGodine(response.data ?? []);
    } catch (error) {
      console.warn('Neuspješno dohvaćanje nastavnih godina', error);
      setGodineError('Nisam uspio dohvatiti nastavne godine.');
    } finally {
      setGodineLoading(false);
    }
  };

  const startNewGodina = () => {
    setEditingGodinaId(null);
    setGodinaDetailsError(null);
    setSaveError(null);
    setViewMode('create');
    setStep(1);
    setExpandedRazred(null);
    setRazredActiveStep({});
    setSavedSteps({});
    setEditingSteps({});
    setHoverDrop(null);
    setData((prev) => ({
      ...emptyForm,
      korak1: { ...emptyForm.korak1, planId: prev.korak1.planId || plans[0]?.id || emptyForm.korak1.planId },
    }));
  };

  const loadGodina = async (godinaId: string) => {
    setGodinaDetailsLoading(true);
    setGodinaDetailsError(null);
    setSaveError(null);
    setExpandedRazred(null);
    setHoverDrop(null);
    try {
      const response = await axios.get<ApiGodinaDetails>(`${API_URL}/nastavne-godine/${godinaId}`, { timeout: 8000 });
      const godina = response.data;
      const razrediEntries = godina?.razredi ?? [];
      const korak3: StepData['korak3'] = {};
      const saved: Record<number, Set<number>> = {};
      const active: Record<number, number> = {};
      const razrediNums: number[] = [];

      const toSchedule = (grupa?: ApiGrupa): Schedule => {
        const raw = Array.isArray(grupa?.raspored) ? grupa?.raspored?.[0] : grupa?.raspored;
        return {
          day: (raw?.dan ?? raw?.day ?? 'subota') as Schedule['day'],
          slot: raw?.slot ?? '',
          location: (raw?.lokacija ?? raw?.location ?? 'ucionica') as Schedule['location'],
          duration: raw?.trajanje ?? raw?.duration ?? 45,
        };
      };

      razrediEntries.forEach((entry: ApiRazredGodina) => {
        const match = entry?.razred?.name?.match?.(/\d+/);
        const razredNum = match ? Number(match[0]) : NaN;
        if (Number.isNaN(razredNum)) return;
        razrediNums.push(razredNum);

        const grupaA = (entry?.grupe ?? []).find((g) => g.naziv === 'A');
        const grupaB = (entry?.grupe ?? []).find((g) => g.naziv === 'B');
        const uceniciA = (grupaA?.ucenici ?? []).map((u) => u?.ucenik?.id).filter(Boolean) as string[];
        const uceniciB = (grupaB?.ucenici ?? []).map((u) => u?.ucenik?.id).filter(Boolean) as string[];
        const splitOn = !!entry?.split;

        korak3[razredNum] = {
          razredId: entry?.razredId ?? entry?.razred?.id ?? getRazredId(razredNum),
          muallimId: entry?.muallim?.korisnik?.id ?? entry?.muallimId ?? null,
          ucenici: uceniciA,
          split: { enabled: splitOn, groupA: uceniciA, groupB: uceniciB, selectionDone: true },
          settings: splitOn
            ? {
                groupA: { kuran: grupaA?.kuran ?? false, sufara: grupaA?.sufara ?? false },
                groupB: { kuran: grupaB?.kuran ?? false, sufara: grupaB?.sufara ?? false },
              }
            : {
                single: { kuran: grupaA?.kuran ?? false, sufara: grupaA?.sufara ?? false },
                groupA: { kuran: grupaA?.kuran ?? false, sufara: grupaA?.sufara ?? false },
              },
          raspored: splitOn
            ? {
                single: toSchedule(grupaA),
                groupA: toSchedule(grupaA),
                groupB: toSchedule(grupaB),
              }
            : {
                single: toSchedule(grupaA),
              },
        };

        saved[razredNum] = new Set([1, 2, 3, 4]);
        active[razredNum] = 4;
      });

      setData({
        korak1: {
          naziv: godina?.naziv ?? '',
          opis: godina?.opis ?? '',
          periodOd: godina?.datumOd ? godina.datumOd.slice(0, 10) : '',
          periodDo: godina?.datumDo ? godina.datumDo.slice(0, 10) : '',
          planId: godina?.nastavniPlanId ?? godina?.nastavniPlan?.id ?? '',
          status: (godina?.status ?? 'ACTIVE') as StepData['korak1']['status'],
        },
        korak2: { razredi: Array.from(new Set(razrediNums)) },
        korak3,
      });
      setSavedSteps(saved);
      setRazredActiveStep(active);
      setEditingSteps({});
      setEditingGodinaId(godinaId);
      setStep(1);
      setViewMode('create');
      setToast({ type: 'success', message: 'Detalji učitani.' });
    } catch (error) {
      console.warn('Neuspješno dohvaćanje nastavne godine', error);
      setGodinaDetailsError('Nisam uspio dohvatiti nastavnu godinu.');
      setToast({ type: 'error', message: 'Greška pri učitavanju godine.' });
    } finally {
      setGodinaDetailsLoading(false);
    }
  };

  useEffect(() => {
    const fetchPlanDetails = async () => {
      const planId = data.korak1.planId;
      if (!planId || razrediOptions.length === 0) {
        setPlanCapabilities({});
        return;
      }
      setPlanDetailsLoading(true);
      setPlanDetailsError(null);
      try {
        const response = await axios.get(`${API_URL}/nastavni-plan/${planId}`, { timeout: 8000 });
        const lekcije = response.data?.lekcije ?? {};
        const planRazredi: string[] = response.data?.razredi ?? [];
        setPlanRazredIds(planRazredi);
        const caps: Record<number, { kuran: boolean; sufara: boolean }> = {};
        razrediOptions.forEach((r) => {
          const entry = lekcije[r.id];
          const hasKuran = !!(entry?.KURAN && entry.KURAN.length > 0);
          const hasSufara = !!(entry?.SUFARA && entry.SUFARA.length > 0);
          caps[r.nameNum] = { kuran: hasKuran, sufara: hasSufara };
        });
        setPlanCapabilities(caps);
      } catch (error) {
        console.warn('Neuspješno dohvaćanje detalja nastavnog plana', error);
        setPlanCapabilities({});
        setPlanRazredIds([]);
        setPlanDetailsError('Nisam uspio dohvatiti detalje plana.');
      } finally {
        setPlanDetailsLoading(false);
      }
    };

    fetchPlanDetails();
  }, [data.korak1.planId, razrediOptions]);

  useEffect(() => {
    // Očisti odabir razreda koji nisu u planu
    setData((prev) => {
      const allowedNums = new Set(planRazredOptions.map((r) => r.nameNum));
      const filtered = prev.korak2.razredi.filter((num) => allowedNums.has(num));
      return filtered.length === prev.korak2.razredi.length
        ? prev
        : {
            ...prev,
            korak2: { razredi: filtered },
            korak3: Object.fromEntries(
              Object.entries(prev.korak3).filter(([key]) => allowedNums.has(Number(key))),
            ),
          };
    });
  }, [planRazredOptions]);

  const filteredUcenici = useMemo(() => {
    if (!search) return ucenici;
    const lower = search.toLowerCase();
    return ucenici.filter(
      (u) =>
        u.ime.toLowerCase().includes(lower) ||
        u.prezime.toLowerCase().includes(lower) ||
        (u.email ?? '').toLowerCase().includes(lower),
    );
  }, [search, ucenici]);

  const isStep1Valid =
    data.korak1.naziv.trim().length > 2 &&
    data.korak1.periodOd &&
    data.korak1.periodDo &&
    data.korak1.planId;

  const isStep2Valid = data.korak2.razredi.length > 0;

  const isStep3Valid = data.korak2.razredi.every((r) => {
    const entry = data.korak3[r];
    const selectionDone = entry?.split?.selectionDone ?? false;
    return entry?.muallimId && selectionDone;
  });

  const payload = useMemo(() => {
    // jedan JSON za backend
    const koraci = data.korak2.razredi.map((r) => {
      const entry = data.korak3[r];
      // Uvijek koristimo grupaA kao default grupu
      // Ako split nije uključen, svi učenici su u groupA
      // Ako split je uključen, učenici su podijeljeni između groupA i groupB
      const grupaA = entry?.split?.enabled 
        ? (entry?.split?.groupA ?? [])
        : (entry?.split?.groupA ?? entry?.ucenici ?? []);
      const grupaB = entry?.split?.enabled 
        ? (entry?.split?.groupB ?? [])
        : [];
      
      const uceniciObj: { grupaA: string[]; grupaB?: string[] } = {
        grupaA,
      };
      if (entry?.split?.enabled) {
        uceniciObj.grupaB = grupaB;
      }

      const rasporedObj: { grupaA: Schedule | null; grupaB?: Schedule | null } = {
        grupaA: entry?.split?.enabled
          ? (entry?.raspored?.groupA ?? entry?.raspored?.single ?? null)
          : (entry?.raspored?.single ?? null),
      };
      if (entry?.split?.enabled) {
        rasporedObj.grupaB = entry?.raspored?.groupB ?? null;
      }

      const defaultSet = { kuran: false, sufara: false };
      const settingsObj: { grupaA: { kuran: boolean; sufara: boolean }; grupaB?: { kuran: boolean; sufara: boolean } } = {
        grupaA: entry?.split?.enabled
          ? (entry?.settings?.groupA ?? entry?.settings?.single ?? defaultSet)
          : (entry?.settings?.single ?? entry?.settings?.groupA ?? defaultSet),
      };
      if (entry?.split?.enabled) {
        settingsObj.grupaB = entry?.settings?.groupB ?? defaultSet;
      }

      return {
        razred: r,
        razredId: entry?.razredId ?? razredByNumber.get(r)?.id ?? '',
        muallimId: entry?.muallimId ?? null,
        split: entry?.split?.enabled ?? false,
        ucenici: uceniciObj,
        raspored: rasporedObj,
        postavkeGrupe: settingsObj,
      };
    });

    return {
      nastavnaGodina: {
        naziv: data.korak1.naziv,
        opis: data.korak1.opis,
        period: {
          od: data.korak1.periodOd,
          do: data.korak1.periodDo,
        },
        nastavniPlanId: data.korak1.planId,
        status: data.korak1.status,
      },
      razredi: koraci,
    };
  }, [data, razredByNumber]);

  const toastNode = toast ? (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}
      >
        <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  type OccupiedSlotInfo = {
    razred: number;
    grupa: string;
    slot: string;
    end: string;
    day: Schedule['day'];
    location: Schedule['location'];
  };

  const occupiedSlots = useMemo(() => {
    const empty: Record<Schedule['day'], Record<Schedule['location'], OccupiedSlotInfo[]>> = {
      subota: { ucionica: [], divanhana: [] },
      nedjelja: { ucionica: [], divanhana: [] },
    };

    const pushSlot = (razred: number, grupa: string, schedule?: Schedule) => {
      if (!schedule?.slot) return;
      empty[schedule.day][schedule.location].push({
        razred,
        grupa,
        slot: schedule.slot,
        end: getEndTime(schedule.slot, schedule.duration ?? 45),
        day: schedule.day,
        location: schedule.location,
      });
    };

    for (const razred of data.korak2.razredi) {
      const entry = data.korak3[razred];
      if (!entry) continue;

      if (entry.split.enabled) {
        pushSlot(razred, 'Grupa 1', entry.raspored.groupA);
        pushSlot(razred, 'Grupa 2', entry.raspored.groupB);
      } else {
        pushSlot(razred, 'Jedna grupa', entry.raspored.single);
      }
    }

    // Sort po vremenu radi konzistentnog prikaza
    (['subota', 'nedjelja'] as const).forEach((day) => {
      (['ucionica', 'divanhana'] as const).forEach((loc) => {
        empty[day][loc].sort((a, b) => a.slot.localeCompare(b.slot));
      });
    });

    return empty;
  }, [data]);

  const toggleRazred = (r: number) => {
    setData((prev) => {
      const exists = prev.korak2.razredi.includes(r);
      const razredi = exists
        ? prev.korak2.razredi.filter((x) => x !== r)
        : [...prev.korak2.razredi, r];

      // Ako ga brišemo, ukloni i podatke iz korak3
      const korak3 = { ...prev.korak3 };
      if (exists) {
        delete korak3[r];
      } else {
        // Kada dodajemo razred, dohvati njegov ID iz baze
        const razredInfo = razredByNumber.get(r);
        if (razredInfo) {
          korak3[r] = defaultRazredState(razredInfo.id);
        }
      }

      return {
        ...prev,
        korak2: { razredi },
        korak3,
      };
    });
  };

  const setRazredUcenici = (razred: number, ucenici: string[]) => {
    // Umjesto spremanja u ucenici, sprema u groupA
    setData((prev) => {
      const current = prev.korak3[razred] ?? defaultRazredState(getRazredId(razred));
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: {
            ...current,
            ucenici: [], // Zadržan za kompatibilnost, ali ne koristimo
            split: {
              ...current.split,
              groupA: ucenici,
              groupB: current.split.enabled ? current.split.groupB : [],
            },
          },
        },
      };
    });
  };

  const setSchedule = (
    razred: number,
    target: 'single' | 'groupA' | 'groupB',
    partial: Partial<Schedule>,
  ) => {
    setData((prev) => {
      const current = prev.korak3[razred] ?? defaultRazredState(getRazredId(razred));
      const raspored = { ...current.raspored };
      const base =
        (target === 'single' ? raspored.single : target === 'groupA' ? raspored.groupA : raspored.groupB) ??
        { day: 'subota', slot: '', location: 'ucionica' as const, duration: 45 };
      const nextSchedule = { ...base, ...partial };

      if (target === 'single') {
        raspored.single = nextSchedule;
      }

      if (target === 'groupA') {
        raspored.groupA = nextSchedule;
      }

      if (target === 'groupB') {
        raspored.groupB = nextSchedule;
      }

      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: {
            ...current,
            raspored,
          },
        },
      };
    });
  };

  const setMuallim = (razred: number, muallimId: string) => {
    setData((prev) => {
      const current = prev.korak3[razred] ?? defaultRazredState(getRazredId(razred));
      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: {
            ...current,
            muallimId,
          },
        },
      };
    });
    // Automatski sačuvaj korak i pređi na sljedeći
    saveStep(razred, 1);
  };

  const setSplit = (razred: number, enabled: boolean) => {
    setData((prev) => {
      const current = prev.korak3[razred] ?? defaultRazredState(getRazredId(razred));
      // Nova logika:
      // - enable: svi učenici iz groupA ostaju, groupB prazna
      // - disable: spoji groupA+B nazad u groupA, groupB prazna
      let groupA: string[] = current.split.groupA ?? [];
      let groupB: string[] = current.split.groupB ?? [];
      // Fallback: ako nema učenika u grupama, provjeri stari ucenici array
      const oldUcenici: string[] = current.ucenici ?? [];
      if (groupA.length === 0 && oldUcenici.length > 0) {
        groupA = [...oldUcenici];
      }

      if (enabled) {
        // Kada enable: zadrži postojeće u groupA, groupB ostaje prazna
        // (već su svi u groupA)
        const baseSingle = current.settings?.single ?? current.settings?.groupA ?? { kuran: false, sufara: false };
        return {
          ...prev,
          korak3: {
            ...prev.korak3,
            [razred]: {
              ...current,
              split: {
                enabled,
                groupA,
                groupB,
                selectionDone: current.split.selectionDone ?? false,
              },
              settings: {
                groupA: current.settings?.groupA ?? baseSingle,
                groupB: current.settings?.groupB ?? { kuran: false, sufara: false },
              },
              ucenici: [],
            },
          },
        };
      } else {
        // Kada disable: spoji groupA+B nazad u groupA
        groupA = [...groupA, ...groupB];
        groupB = [];
        const mergedSettings = current.settings?.groupA ?? current.settings?.single ?? { kuran: false, sufara: false };

        return {
          ...prev,
          korak3: {
            ...prev.korak3,
            [razred]: {
              ...current,
              split: {
                enabled,
                groupA,
                groupB,
                selectionDone: current.split.selectionDone ?? false,
              },
              settings: { single: mergedSettings },
              ucenici: [], // Više se ne koristi, zadržan za kompatibilnost
            },
          },
        };
      }
    });
  };

  const toggleSplitMember = (razred: number, grupa: 'A' | 'B', ucenikId: string) => {
    setData((prev) => {
      const current = prev.korak3[razred];
      if (!current) return prev;
      const gA = new Set(current.split.groupA);
      const gB = new Set(current.split.groupB);

      // remove from both, then add to target
      gA.delete(ucenikId);
      gB.delete(ucenikId);
      if (grupa === 'A') gA.add(ucenikId);
      else gB.add(ucenikId);

      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: {
            ...current,
            split: {
              ...current.split,
              groupA: Array.from(gA),
              groupB: Array.from(gB),
            },
          },
        },
      };
    });
  };

  const setGroupSetting = (razred: number, target: 'single' | 'groupA' | 'groupB', field: 'kuran' | 'sufara') => {
    setData((prev) => {
      const current = prev.korak3[razred] ?? defaultRazredState(getRazredId(razred));
      const settings = current.settings ? { ...current.settings } : {};
      const base = { kuran: false, sufara: false };

      const next =
        target === 'single'
          ? { ...(settings.single ?? settings.groupA ?? base), [field]: !(settings.single ?? settings.groupA ?? base)[field] }
          : {
              ...(target === 'groupA' ? settings.groupA ?? settings.single ?? base : settings.groupB ?? base),
              [field]: !(
                target === 'groupA'
                  ? (settings.groupA ?? settings.single ?? base)[field]
                  : (settings.groupB ?? base)[field]
              ),
            };

      const updatedSettings =
        target === 'single'
          ? { single: next }
          : {
              ...settings,
              groupA: target === 'groupA' ? next : settings.groupA ?? settings.single ?? base,
              groupB: target === 'groupB' ? next : settings.groupB ?? base,
            };

      return {
        ...prev,
        korak3: {
          ...prev.korak3,
          [razred]: {
            ...current,
            settings: updatedSettings,
          },
        },
      };
    });
  };

  const toggleStudent = (razred: number, ucenikId: string) => {
    // Koristimo groupA umjesto ucenici
    const entry = data.korak3[razred];
    const groupA = entry?.split?.groupA ?? entry?.ucenici ?? [];
    const exists = groupA.includes(ucenikId);
    const next = exists ? groupA.filter((u) => u !== ucenikId) : [...groupA, ucenikId];
    setRazredUcenici(razred, next);
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 1, label: 'Osnovni podaci' },
      { id: 2, label: 'Razredi' },
      { id: 3, label: 'Postavke grupa' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            placeholder="npr. 2025/2026"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nastavni plan *</label>
          <select
            value={data.korak1.planId}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                korak1: { ...prev.korak1, planId: e.target.value },
              }))
            }
            disabled={plansLoading || plans.length === 0}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            {plansLoading && <option>Učitavam planove...</option>}
            {!plansLoading && plans.length === 0 && <option>Nema dostupnih planova</option>}
            {!plansLoading &&
              plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naziv}
                </option>
              ))}
          </select>
          {plansError && <p className="mt-1 text-xs text-red-600">{plansError}</p>}
        </div>
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
          placeholder="Kratak opis nastavne godine..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Period od *</label>
          <input
            type="date"
            value={data.korak1.periodOd}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                korak1: { ...prev.korak1, periodOd: e.target.value },
              }))
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Period do *</label>
          <input
            type="date"
            value={data.korak1.periodDo}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                korak1: { ...prev.korak1, periodDo: e.target.value },
              }))
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-700 mb-1">Status</div>
          <p className="text-xs text-gray-600">Aktivan nastavni plan će biti dostupan za odabir</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
          <input
            type="checkbox"
            checked={data.korak1.status === 'ACTIVE'}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                korak1: { ...prev.korak1, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' },
              }))
            }
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 rounded-full transition-colors ${
            data.korak1.status === 'ACTIVE'
              ? 'bg-green-600'
              : 'bg-gray-300'
          }`}>
            <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
              data.korak1.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'
            }`}></div>
          </div>
        </label>
      </div>

    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={() =>
            setData((prev) => {
              const razrediNums = planRazredOptions.map((r) => r.nameNum);
              const korak3: StepData['korak3'] = {};
              razrediNums.forEach((num) => {
                const razredInfo = razredByNumber.get(num);
                if (razredInfo) {
                  korak3[num] = defaultRazredState(razredInfo.id);
                }
              });
              return {
                ...prev,
                korak2: { razredi: razrediNums },
                korak3,
              };
            })
          }
          disabled={loadingRazredi || planRazredOptions.length === 0}
          className="px-4 py-2 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Odaberi sve razrede
        </button>
        <button
          onClick={() =>
            setData((prev) => ({
              ...prev,
              korak2: { razredi: [] },
              korak3: {},
            }))
          }
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Očisti odabir
        </button>
      </div>
      {razrediError && (
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          {razrediError}
        </div>
      )}
      {loadingRazredi || planDetailsLoading ? (
        <div className="flex items-center justify-center text-sm text-gray-600">Učitavam razrede...</div>
      ) : planRazredOptions.length === 0 ? (
        <div className="px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
          Odabrani nastavni plan nema vezane razrede.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {planRazredOptions.map((razred) => {
            const active = data.korak2.razredi.includes(razred.nameNum);
            const info = razredInfo(razred.nameNum, razred.ilmihal);
            return (
              <div
                key={razred.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleRazred(razred.nameNum)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRazred(razred.nameNum)}
                className={`p-4 rounded-xl border shadow-sm transition transform hover:-translate-y-0.5 cursor-pointer ${
                  active ? 'border-green-500 bg-green-50 ring-1 ring-green-200' : 'border-gray-200 bg-white hover:border-green-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Razred</div>
                    <div className="text-lg font-bold text-gray-900">{labelGrupa(razred.nameNum)}</div>
                  </div>
                </div>
                <div className={`inline-flex text-xs px-3 py-1 rounded-full border font-semibold ${info.color}`}>
                  {info.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderUceniciList = (razred: number, muallimSelected: boolean, isReadOnly: boolean = false, onCancel?: () => void) => {
    if (!muallimSelected) return null;

    // Koristimo groupA umjesto ucenici za inicijalni odabir
    const entry = data.korak3[razred];
    const groupA = entry?.split?.groupA ?? [];
    const groupB = entry?.split?.groupB ?? [];
    const allSelected = [...groupA, ...groupB];
    // Fallback na stari ucenici array ako nema u grupama
    const oldUcenici = entry?.ucenici ?? [];
    const initialSelection = allSelected.length > 0 ? allSelected : oldUcenici;
    const selected = new Set(initialSelection);

    // Sakrij učenike koji su već dodijeljeni drugim razredima, ali ostavi one već odabrane za ovaj razred
    const occupiedIds = new Set<string>();
    data.korak2.razredi.forEach((r) => {
      if (r === razred) return;
      const other = data.korak3[r];
      if (!other) return;
      const alreadyPlaced = [
        ...(other.split?.groupA ?? []),
        ...(other.split?.groupB ?? []),
        ...(other.ucenici ?? []),
      ];
      alreadyPlaced.forEach((id) => occupiedIds.add(id));
    });

    const availableUcenici = filteredUcenici.filter((u) => !occupiedIds.has(u.id) || selected.has(u.id));

    const finalizeSelection = () => {
      const selectedArr = Array.from(selected);
      setData((prev) => {
        const current = prev.korak3[razred] ?? defaultRazredState(getRazredId(razred));

        // Uvijek koristimo groupA kao glavnu grupu
        // Ako je split uključen: zadrži postojeće grupe ali uskladi sa novim odabirom
        // - Ukloni iz grupa učenike koji više nisu odabrani
        // - Sve nove dodaj u groupA
        let groupA = current.split.groupA ?? [];
        let groupB = current.split.groupB ?? [];

        const selectedSet = new Set(selectedArr);
        if (current.split.enabled) {
          groupA = groupA.filter((id) => selectedSet.has(id));
          groupB = groupB.filter((id) => selectedSet.has(id));
          const already = new Set([...groupA, ...groupB]);
          const toAdd = selectedArr.filter((id) => !already.has(id));
          groupA = [...groupA, ...toAdd]; // nove u groupA
        } else {
          // Ako split nije uključen: svi učenici idu u groupA
          groupA = selectedArr;
          groupB = [];
        }

        return {
          ...prev,
          korak3: {
            ...prev.korak3,
            [razred]: {
              ...current,
              ucenici: [], // Više se ne koristi, zadržan za kompatibilnost
              split: {
                ...current.split,
                enabled: current.split.enabled,
                groupA,
                groupB,
                selectionDone: true,
              },
            },
          },
        };
      });
      // Automatski sačuvaj korak i pređi na sljedeći
      saveStep(razred, 2);
    };
    return (
      <div className="space-y-2">
        {!isReadOnly && (
          <>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži učenike..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
              <div className="space-y-1">
                {availableUcenici.map((u) => {
                  const isSelected = selected.has(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudent(razred, u.id)}
                          className="h-4 w-4 text-green-600 accent-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {u.ime} {u.prezime}
                          </p>
                          <p className="text-xs text-gray-500 font-medium">{u.email}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-xs text-green-700 font-semibold">Odabrano</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-row items-center justify-end gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 h-10 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold"
                >
                  Odustani
                </button>
              )}
              <button
                onClick={finalizeSelection}
                disabled={selected.size === 0}
                className="px-4 py-2 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Spremi
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

const renderSplitControls = (razred: number, isReadOnly: boolean = false) => {
  const splitState = data.korak3[razred]?.split ?? {
    enabled: false,
    groupA: [],
    groupB: [],
    selectionDone: false,
  };
  const selectionDone = splitState.selectionDone ?? false;
  const selectedCount = splitState.enabled
    ? (splitState.groupA?.length ?? 0) + (splitState.groupB?.length ?? 0)
    : (splitState.groupA?.length ?? 0);
  const groupACount = splitState.groupA?.length ?? 0;
  const groupBCount = splitState.groupB?.length ?? 0;

  return (
    <div className="space-y-3">
      {selectionDone && !isReadOnly && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-700 mb-1">Podjela u grupe</div>
              <p className="text-xs text-gray-600">
                {splitState.enabled 
                  ? `Učenici će biti podijeljeni u dvije grupe (Grupa 1: ${groupACount}, Grupa 2: ${groupBCount})`
                  : `Svi učenici (${selectedCount}) će biti raspoređeni u jednoj grupi`}
              </p>
            </div>
          </div>
          <label className={`relative inline-flex items-center flex-shrink-0 ml-4 ${!selectionDone ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={splitState.enabled}
              onChange={() => setSplit(razred, !splitState.enabled)}
              disabled={!selectionDone}
              className="sr-only peer"
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              splitState.enabled
                ? 'bg-green-600'
                : 'bg-gray-300'
            } ${!selectionDone ? 'opacity-50' : ''}`}>
              <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
                splitState.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </div>
          </label>
        </div>
      )}

      {selectionDone && isReadOnly && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 space-y-1">
          {splitState.enabled ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-green-900">GRUPA 1</span>
                <span className="text-sm text-green-900">
                  <span className="font-bold">{groupACount}</span> djece
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-green-900">GRUPA 2</span>
                <span className="text-sm text-green-900">
                  <span className="font-bold">{groupBCount}</span> djece
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-green-900">GRUPA</span>
              <span className="text-sm text-green-900">
                <span className="font-bold">{groupACount}</span> djece
              </span>
            </div>
          )}
        </div>
      )}

      {splitState.enabled && !isReadOnly && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['A', 'B'] as const).map((g) => {
            const list = g === 'A' ? splitState.groupA : splitState.groupB;
            const colorClasses =
              g === 'A'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-purple-50 text-purple-800 border-purple-200';
            return (
              <div
                key={g}
                onDragOver={(e) => {
                  if (!splitState.enabled) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!splitState.enabled || !dragging) return;
                  e.preventDefault();
                  toggleSplitMember(razred, g, dragging.ucenikId);
                  setDragging(null);
                  setHoverDrop(null);
                }}
                onDragEnter={(e) => {
                  if (!splitState.enabled || !dragging) return;
                  e.preventDefault();
                  setHoverDrop({ razred, group: g });
                }}
                onDragLeave={() => {
                  setHoverDrop((prev) =>
                    prev && prev.razred === razred && prev.group === g ? null : prev,
                  );
                }}
                className={`border rounded-lg p-3 bg-white transition-colors ${
                  hoverDrop?.razred === razred && hoverDrop?.group === g
                    ? 'border-green-400 bg-green-50 border-dashed'
                    : 'border-gray-200 border-dashed'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${colorClasses}`}>
                    Grupa {g === 'A' ? '1' : '2'} ({list.length})
                  </span>
                </div>
                <div className="space-y-1 min-h-[60px]">
                  {(list || []).map((id) => {
                    const u = ucenici.find((x) => x.id === id);
                    if (!u) return null;
                    return (
                      <button
                        key={id}
                        draggable={splitState.enabled}
                        onDragStart={() => setDragging({ razred, ucenikId: id })}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => toggleSplitMember(razred, g, id)}
                        disabled={isReadOnly}
                        className="w-full text-left px-3 py-2 rounded bg-gray-50 hover:bg-gray-100 text-sm text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {u.ime} {u.prezime}
                      </button>
                    );
                  })}
                  {list.length === 0 && (
                    <div className="text-xs text-gray-400 italic font-medium">Prevuci učenike ovdje</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

  const renderOccupiedSlotsPanel = (highlightRazred?: number) => {
    const dayLabels: Record<Schedule['day'], string> = { subota: 'Subota', nedjelja: 'Nedjelja' };
    const locationLabels: Record<Schedule['location'], string> = { ucionica: 'Učionica', divanhana: 'Divanhana' };
    const filter = occupiedFilter.trim().toLowerCase();

    const matchesMuallim = (slot: OccupiedSlotInfo) => {
      if (!filter) return true;
      // Kada filter dolazi iz switcha, matchamo po ID; ako ikad bude custom teksta, fallback na ime/prezime
      const muallimId = data.korak3[slot.razred]?.muallimId;
      const muallim = muallimId ? muallimById.get(muallimId) : undefined;
      if (!muallim) return false;
      if (muallimi.some((m) => m.id === occupiedFilter)) {
        return muallim.id === occupiedFilter;
      }
      const full = `${muallim.ime} ${muallim.prezime}`.toLowerCase();
      return full.includes(filter);
    };

    const renderSlotRow = (slot: OccupiedSlotInfo) => {
      const active = highlightRazred === slot.razred;
      const muallimId = data.korak3[slot.razred]?.muallimId;
      const muallim = muallimId ? muallimById.get(muallimId) : undefined;
      const entrySettings = data.korak3[slot.razred]?.settings;
      const formatProgram = (s?: { kuran?: boolean; sufara?: boolean }) => {
        if (!s) return '';
        const parts: string[] = [];
        if (s.kuran) parts.push('Kuran');
        if (s.sufara) parts.push('Sufara');
        return parts.join(' • ');
      };
      const programLabel = (() => {
        if (!entrySettings) return '';
        if (slot.grupa === 'Jedna grupa') {
          return formatProgram(entrySettings.single ?? entrySettings.groupA);
        }
        if (slot.grupa === 'Grupa 1') {
          return formatProgram(entrySettings.groupA ?? entrySettings.single);
        }
        if (slot.grupa === 'Grupa 2') {
          return formatProgram(entrySettings.groupB);
        }
        return '';
      })();
      const groupLabel = slot.grupa === 'Jedna grupa' ? '' : ` • ${slot.grupa}`;
      return (
        <div
          key={`${slot.day}-${slot.location}-${slot.slot}-${slot.razred}-${slot.grupa}`}
          className={`flex items-start justify-between gap-2 px-2 py-2 rounded-md border ${
            active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900">
              {slot.slot} - {slot.end}
            </p>
            <p className="text-[11px] text-gray-600 font-semibold truncate">
              {labelGrupa(slot.razred)}
              {groupLabel}
              {programLabel ? ` • ${programLabel}` : ''}
              {muallim ? ` • ${muallim.ime} ${muallim.prezime}` : ''}
            </p>
          </div>
        </div>
      );
    };

    return (
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 lg:sticky lg:top-4">
        <div className="flex flex-col gap-2 mb-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Zauzeti slotovi</h4>
            <p className="text-xs text-gray-500 font-medium">Trenutni raspored</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Muallimi</span>
            {occupiedFilter && (
              <button
                onClick={() => setOccupiedFilter('')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[{ id: '', label: 'Svi' }, ...muallimi.map((m) => ({ id: m.id, label: `${m.ime} ${m.prezime}`, initials: `${m.ime?.[0] ?? ''}${m.prezime?.[0] ?? ''}`.toUpperCase() })) as { id: string; label: string; initials?: string }[]].flat().map((m) => {
              const active = occupiedFilter === m.id;
              const hasAvatar = !!m.id;
              const initials = hasAvatar ? m.initials ?? '' : '';
              return (
                <button
                  key={m.id || 'all'}
                  onClick={() => setOccupiedFilter(active ? '' : m.id)}
                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow'
                      : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {hasAvatar && (
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                        active ? 'bg-white text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {initials}
                    </span>
                  )}
                  <span className="whitespace-nowrap">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          {(['subota', 'nedjelja'] as const).map((day) => (
            <div key={day} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">{dayLabels[day]}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(['ucionica', 'divanhana'] as const).map((loc) => {
                  const list = occupiedSlots[day][loc].filter(matchesMuallim);
                  return (
                    <div key={loc} className="bg-white border border-gray-200 rounded-md p-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-800">{locationLabels[loc]}</span>
                      </div>
                      <div className="space-y-1">
                        {list.length === 0 ? (
                          <div className="text-[11px] text-gray-400 font-medium italic">Nema zauzetih slotova</div>
                        ) : (
                          list.map(renderSlotRow)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

const renderTimelineSchedule = (
  razred: number,
  target: 'single' | 'groupA' | 'groupB',
  label: string,
  isReadOnly: boolean = false,
  timelineHover: Record<string, { position: number; day: Schedule['day'] }> = {},
  setTimelineHover: React.Dispatch<React.SetStateAction<Record<string, { position: number; day: Schedule['day'] }>>> = () => {},
  isStep4Saved: boolean = false,
  isEditing: boolean = false,
) => {
  const entry = data.korak3[razred] ?? defaultRazredState(getRazredId(razred));
  const schedule =
    target === 'single'
      ? entry.raspored.single
      : target === 'groupA'
      ? entry.raspored.groupA ?? entry.raspored.single
      : entry.raspored.groupB ?? entry.raspored.single;
  const ready = !!entry.muallimId && (entry.split.selectionDone ?? false);
  const duration = schedule.duration ?? 45;

  const setField = (field: keyof Schedule, value: Schedule[keyof Schedule]) => {
    if (isReadOnly) return;
    setSchedule(razred, target, { [field]: value } as Partial<Schedule>);
  };

  // Vraća sve već zauzete grupe u istom terminu/lokaciji
  const findSlotConflicts = (day: Schedule['day'], slot: string, location: Schedule['location'], slotDuration: number) => {
    const conflicts: { razred: number; grupa: 'single' | 'groupA' | 'groupB'; start: string; end: string }[] = [];
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + slotDuration;

    for (const r of data.korak2.razredi) {
      const otherEntry = data.korak3[r];
      if (!otherEntry) continue;

      const checkConflict = (otherSchedule: Schedule | undefined, grupa: 'single' | 'groupA' | 'groupB') => {
        if (!otherSchedule?.slot || otherSchedule.day !== day || otherSchedule.location !== location) return;
        if (r === razred && target === grupa) return;

        const otherStart = timeToMinutes(otherSchedule.slot);
        const otherDuration = otherSchedule.duration ?? 45;
        const otherEnd = otherStart + otherDuration;

        // Check for overlap - slots that just touch each other are NOT overlapping
        if (slotStart < otherEnd && slotEnd > otherStart) {
          conflicts.push({
            razred: r,
            grupa,
            start: otherSchedule.slot,
            end: getEndTime(otherSchedule.slot, otherDuration),
          });
        }
      };

      if (!otherEntry.split.enabled) {
        checkConflict(otherEntry.raspored.single, 'single');
      } else {
        checkConflict(otherEntry.raspored.groupA, 'groupA');
        checkConflict(otherEntry.raspored.groupB, 'groupB');
      }
    }
    return conflicts;
  };

  // Generate hour markers
  const hours: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
    hours.push(h);
  }

  const selectedDay = schedule.day;
  const selectedSlot = schedule.slot;
  const selectedTop = selectedSlot && selectedDay ? timeToPosition(selectedSlot) : null;
  const selectedHeight = selectedSlot && selectedDay
    ? timeToPosition(getEndTime(selectedSlot, duration)) - (selectedTop ?? 0)
    : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>, day: Schedule['day']) => {
    if (isReadOnly || !ready) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickedTime = positionToTime(y);
    
    setField('day', day);
    setField('slot', clickedTime);
  };

  const timelineKey = `${razred}-${target}`;
  const hoverState = timelineHover[timelineKey];
  const hoverPosition = hoverState?.position ?? null;
  const hoverDay = hoverState?.day ?? null;
  const hoverTime = hoverPosition !== null ? positionToTime(hoverPosition) : null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, day: Schedule['day']) => {
    if (isReadOnly || !ready) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setTimelineHover((prev) => ({
      ...prev,
      [timelineKey]: { position: y, day },
    }));
  };

  const handleMouseLeave = () => {
    setTimelineHover((prev) => {
      const next = { ...prev };
      delete next[timelineKey];
      return next;
    });
  };

  const collectDaySlots = (day: Schedule['day'], excludeRazred?: number, excludeTarget?: 'single' | 'groupA' | 'groupB') => {
    const slots: {
      start: string;
      end: string;
      label: string;
      color: string;
      hasOverlap?: boolean;
      stackIndex?: number;
      stackCount?: number;
      startMin?: number;
      endMin?: number;
    }[] = [];

    // Only collect slots for the selected location
    const targetLocation = schedule.location;

    for (const r of data.korak2.razredi) {
      const entry = data.korak3[r];
      if (!entry) continue;
      
      // Skip this razred's slot if it's the current one being edited (not yet saved)
      const isCurrentRazredPending = excludeRazred !== undefined && r === excludeRazred;
      
      const baseLabel = labelGrupa(r);

      const pushSlot = (sch?: Schedule, grupa?: string, grupaTarget?: 'single' | 'groupA' | 'groupB') => {
        // Filter by location and day
        if (!sch?.slot || sch.day !== day || sch.location !== targetLocation) return;
        
        // Exclude the current slot being edited (not yet saved)
        if (isCurrentRazredPending && excludeTarget === grupaTarget) return;
        
        const dur = sch.duration ?? 45;
        const startMin = timeToMinutes(sch.slot);
        const endMin = startMin + dur;
        slots.push({
          start: sch.slot,
          end: getEndTime(sch.slot, dur),
          label: grupa ? `${baseLabel} • ${grupa}` : baseLabel,
          color: entry.split.enabled
            ? grupa === 'Grupa 2'
              ? 'bg-blue-100 border-blue-300 text-blue-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
            : 'bg-blue-50 border-blue-200 text-blue-900',
          startMin,
          endMin,
        });
      };

      if (entry.split.enabled) {
        pushSlot(entry.raspored.groupA, 'Grupa 1', 'groupA');
        pushSlot(entry.raspored.groupB, 'Grupa 2', 'groupB');
      } else {
        pushSlot(entry.raspored.single, '', 'single');
      }
    }

    // Improved stacking algorithm for calendar-like layout
    // Sort by start time, then by end time for slots starting at the same time
    const sorted = [...slots].sort((a, b) => {
      const startDiff = (a.startMin ?? 0) - (b.startMin ?? 0);
      if (startDiff !== 0) return startDiff;
      return (a.endMin ?? 0) - (b.endMin ?? 0);
    });

    // Track active slots to assign columns
    const active: { end: number; col: number; idx: number }[] = [];

    sorted.forEach((slot, idx) => {
      const start = slot.startMin ?? timeToMinutes(slot.start);
      const end = slot.endMin ?? timeToMinutes(slot.end);

      // Remove slots that have ended before or exactly when this one starts (no overlap)
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].end <= start) {
          active.splice(i, 1);
        }
      }

      // Find the first available column (0-indexed)
      let col = -1;
      const usedCols = new Set(active.map(a => a.col));
      for (let c = 0; c <= active.length; c++) {
        if (!usedCols.has(c)) {
          col = c;
          break;
        }
      }

      // If no column found, create new one
      if (col === -1) {
        col = active.length;
      }

      // Add this slot to active list
      active.push({ end, col, idx });

      // Store initial stack info
      sorted[idx] = {
        ...sorted[idx],
        stackIndex: col,
      };
    });

    // Calculate max stack count for each slot (max concurrent slots at any point during its lifetime)
    // For each slot, find the maximum number of slots that are active simultaneously at any point
    sorted.forEach((slot, idx) => {
      const start = slot.startMin ?? timeToMinutes(slot.start);
      const end = slot.endMin ?? timeToMinutes(slot.end);
      
      // Find all slots that overlap with this one
      // Slots that just touch each other (one ends when other starts) are NOT overlapping
      const overlappingSlots = sorted.filter((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const otherStart = other.startMin ?? timeToMinutes(other.start);
        const otherEnd = other.endMin ?? timeToMinutes(other.end);
        // True overlap: they share some actual time period (not just touching)
        return start < otherEnd && end > otherStart;
      });

      // The max count is 1 (this slot) + number of overlapping slots
      // But we need to find the maximum concurrent count at any single point in time
      // Create time points at start and end of each overlapping slot
      const timePoints = new Set<number>();
      timePoints.add(start);
      // Don't add 'end' point - slots that end exactly when another starts don't overlap
      overlappingSlots.forEach(other => {
        const otherStart = other.startMin ?? timeToMinutes(other.start);
        const otherEnd = other.endMin ?? timeToMinutes(other.end);
        // Only consider time points within our slot's duration (exclusive of end)
        if (otherStart >= start && otherStart < end) timePoints.add(otherStart);
        if (otherEnd > start && otherEnd < end) timePoints.add(otherEnd);
      });

      // For each time point, count how many slots are active at that moment
      // A slot is active if timePoint is >= start and < end (end is exclusive)
      let maxCount = 1;
      if (timePoints.size === 0) {
        // No overlapping slots, so this slot is alone
        maxCount = 1;
      } else {
        timePoints.forEach(timePoint => {
          let count = 1; // this slot is always active
          sorted.forEach((other, otherIdx) => {
            if (otherIdx === idx) return;
            const otherStart = other.startMin ?? timeToMinutes(other.start);
            const otherEnd = other.endMin ?? timeToMinutes(other.end);
            // Slot is active if timePoint is in [start, end) - end is exclusive
            if (timePoint >= otherStart && timePoint < otherEnd) {
              count++;
            }
          });
          maxCount = Math.max(maxCount, count);
        });
      }

      sorted[idx] = {
        ...sorted[idx],
        stackCount: maxCount,
      };
    });

    // Mark overlap if stackCount > 1
    const finalized = sorted.map((s) => ({
      ...s,
      hasOverlap: (s.stackCount ?? 1) > 1,
    }));

    return finalized;
  };

  // Exclude current razred/target slot from occupied slots if step 4 is not saved OR if we're editing
  // This ensures the preview slot doesn't appear as an occupied slot, and when editing, the old slot is hidden
  const currentRazredPending = (!isStep4Saved || isEditing) ? razred : undefined;
  const subotaSlots = collectDaySlots('subota', currentRazredPending, target);
  const nedjeljaSlots = collectDaySlots('nedjelja', currentRazredPending, target);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <span className="text-base font-medium text-gray-900 block">{label}</span>
            {schedule.slot && (
              <span className="text-sm text-gray-500 font-normal">
                {schedule.day === 'subota' ? 'Subota' : 'Nedjelja'} • {schedule.slot} - {getEndTime(schedule.slot, duration)} • {schedule.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
        </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Location selector - Google Meet style */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 block">Lokacija</span>
              <span className="text-xs text-gray-500">Odaberite gdje će se održati nastava</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
            {(['ucionica', 'divanhana'] as const).map((loc) => {
              const active = schedule.location === loc;
              return (
                <button
                  key={loc}
                  onClick={() => setField('location', loc)}
                  disabled={ready === false || isReadOnly}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {loc === 'ucionica' ? 'Učionica' : 'Divanhana'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration selector - Google Meet style */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 block">Dužina slota</span>
              <span className="text-xs text-gray-500">Odaberite trajanje nastave</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
            {SLOT_DURATION_OPTIONS.map((dur) => {
              const active = duration === dur;
            return (
                <button
                  key={dur}
                  onClick={() => setField('duration', dur)}
                  disabled={isReadOnly}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {dur} min
                </button>
              );
            })}
          </div>
        </div>

        {/* Combined Timeline for both days - Google Meet style */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Header with day labels */}
          <div className="flex border-b border-gray-200 bg-white">
            <div className="w-16 border-r border-gray-200 px-3 py-4 bg-gray-50/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 grid grid-cols-2">
                  <button
                onClick={() => setField('day', 'subota')}
                    disabled={ready === false || isReadOnly}
                className={`px-6 py-4 text-sm font-medium border-r border-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedDay === 'subota'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-b-blue-600'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Subota
                </span>
              </button>
              <button
                onClick={() => setField('day', 'nedjelja')}
                disabled={ready === false || isReadOnly}
                className={`px-6 py-4 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedDay === 'nedjelja'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-b-blue-600'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Nedjelja
                </span>
                  </button>
            </div>
                </div>

          {/* Timeline container */}
          <div className="relative flex bg-white">
            {/* Time labels column - narrower */}
            <div className="w-16 border-r border-gray-200 bg-gray-50/30 relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
              {hours.map((hour) => {
                const time = `${hour.toString().padStart(2, '0')}:00`;
                const position = timeToPosition(time);
                    return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 flex items-center"
                    style={{ top: `${position}px`, height: `${TIMELINE_HEIGHT / (TIMELINE_END_HOUR - TIMELINE_START_HOUR)}px` }}
                  >
                    <div className="w-full text-xs font-semibold text-gray-700 text-center">
                      {hour}:00
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline areas for both days */}
            <div className="flex-1 grid grid-cols-2">
              {WEEKEND_DAYS.map((day) => {
                const dayActive = selectedDay === day;
                const daySlots = day === 'subota' ? subotaSlots : nedjeljaSlots;
                const daySelectedTop = dayActive && selectedSlot ? selectedTop : null;
                const daySelectedHeight = dayActive && selectedSlot ? selectedHeight : 0;

                return (
                  <div
                    key={day}
                    className={`relative border-r last:border-r-0 border-gray-100 cursor-pointer transition-colors ${
                      dayActive ? 'bg-blue-50/10' : 'bg-white hover:bg-gray-50/30'
                    }`}
                    style={{ height: `${TIMELINE_HEIGHT}px` }}
                    onClick={(e) => handleTimelineClick(e, day)}
                    onMouseMove={(e) => handleMouseMove(e, day)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Hour grid lines */}
                    {hours.map((hour) => {
                      const time = `${hour.toString().padStart(2, '0')}:00`;
                      const position = timeToPosition(time);
                      return (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-t border-gray-200"
                          style={{ top: `${position}px` }}
                        />
                      );
                    })}

                    {/* Half-hour markers */}
                    {hours.slice(0, -1).map((hour) => {
                      const time = `${hour.toString().padStart(2, '0')}:30`;
                      const position = timeToPosition(time);
                      return (
                        <div
                          key={`${hour}-30`}
                          className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                          style={{ top: `${position}px` }}
                        />
                      );
                    })}

                    {/* Hover indicator - Google Meet style - always visible on hover */}
                    {hoverPosition !== null && hoverDay === day && !isReadOnly && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none transition-opacity duration-150"
                        style={{ top: `${hoverPosition}px`, zIndex: 35 }}
                      >
                        <div className="absolute left-0 right-0 h-0.5 bg-blue-500"></div>
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                          {hoverTime}
                        </div>
                      </div>
                    )}


                    {/* Occupied slots (all razredi) */}
                    {daySlots.map((slot, idx) => {
                      const top = timeToPosition(slot.start);
                      const height = timeToPosition(slot.end) - top;
                      const isOverlap = !!slot.hasOverlap;
                      const columns = slot.stackCount ?? 1;
                      const index = slot.stackIndex ?? 0;
                      const widthPct = 100 / columns;
                      const leftPct = widthPct * index;
                      const margin = 2; // gap between columns

                      const styleBase = isOverlap
                        ? 'bg-blue-100 border-blue-300 text-blue-900 shadow-sm ring-0.5 ring-blue-300/50'
                        : 'bg-blue-50 border-blue-200 text-blue-900/90';

                      // Calculate actual width and left position with margins
                      const actualWidth = `calc(${widthPct}% - ${margin * 2}px)`;
                      const actualLeft = `calc(${leftPct}% + ${margin}px)`;

                      return (
                        <div
                          key={`slot-${day}-${idx}`}
                          className={`absolute rounded-md border-[0.5px] ${styleBase} px-2 py-1 text-[11px] font-medium`}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 22)}px`,
                            left: actualLeft,
                            width: actualWidth,
                            minHeight: '22px',
                            zIndex: isOverlap ? 15 : 10,
                          }}
                          title={`${slot.start} - ${slot.end} • ${slot.label}`}
                        >
                          <div className="flex flex-col h-full justify-center overflow-hidden">
                            <div className="text-[10px] font-semibold leading-tight truncate">
                              {slot.start} - {slot.end}
                            </div>
                            {height >= 30 && (
                              <div className="text-[10px] leading-tight truncate mt-0.5 opacity-90">
                                {slot.label}
                              </div>
                            )}
                            {height < 30 && (
                              <div className="text-[9px] leading-tight truncate opacity-75">
                                {slot.label.split(' • ')[0]}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Selected slot preview - full blue like before, but not added to occupied slots until saved */}
                    {daySelectedTop !== null && dayActive && selectedSlot && (
                      <div
                        className="absolute left-2 right-2 rounded-lg bg-blue-600 text-white flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl border-[0.5px] border-blue-400"
                        style={{
                          top: `${daySelectedTop}px`,
                          height: `${Math.max(daySelectedHeight, 40)}px`,
                          minHeight: '40px',
                          zIndex: 40,
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {selectedSlot} - {getEndTime(selectedSlot, duration)}
                            </div>
                            <div className="text-xs font-normal text-blue-100 truncate mt-0.5">
                              {schedule.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-blue-100 bg-blue-700/50 px-2 py-1 rounded ml-2 flex-shrink-0 whitespace-nowrap">
                          {duration} min
                        </div>
                      </div>
                    )}

                    {/* Click hint - Google Meet style */}
                    {dayActive && !selectedSlot && !isReadOnly && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-xs text-gray-400 font-normal bg-white/90 backdrop-blur-sm px-3 py-2 rounded-md border border-gray-200 shadow-sm">
                          Kliknite da odaberete vrijeme
                        </div>
                      </div>
                    )}
                  </div>
                    );
                  })}
                </div>
          </div>
        </div>

        {/* Conflicts warning */}
        {schedule.slot && schedule.day && (() => {
          const conflicts = findSlotConflicts(schedule.day, schedule.slot, schedule.location, duration);
          return conflicts.length > 0 ? (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-bold text-orange-900 mb-1">Upozorenje: Konflikt vremena</div>
                  <div className="text-xs text-orange-800 space-y-1">
                    {conflicts.map((conflict, idx) => {
                      const conflictLabel = conflict.grupa === 'groupA'
                        ? `${labelGrupa(conflict.razred)} • Grupa 1`
                        : conflict.grupa === 'groupB'
                        ? `${labelGrupa(conflict.razred)} • Grupa 2`
                        : labelGrupa(conflict.razred);
                      return (
                        <div key={idx}>
                          {conflictLabel} ({conflict.start} - {conflict.end})
              </div>
            );
          })}
        </div>
                </div>
              </div>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
};

  const renderRaspored = (razred: number, isReadOnly: boolean = false) => {
    const entry = data.korak3[razred] ?? defaultRazredState(getRazredId(razred));
    const splitOn = entry.split.enabled;
    // Ready ako su koraci 1 i 2 saved (muallim i učenici)
    const ready = isStepSaved(razred, 1) && isStepSaved(razred, 2);
    const hasSchedule = splitOn
      ? !!(entry.raspored.groupA?.slot && entry.raspored.groupB?.slot)
      : !!entry.raspored.single?.slot;

    return (
      <div
        className={`bg-white border rounded-lg p-4 shadow-sm space-y-3 transition-all duration-300 ${
          isStepSaved(razred, 4) ? 'border-green-200 shadow-green-50' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                isStepSaved(razred, 4)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              4
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Raspored</h4>
          </div>
          {isStepSaved(razred, 4) && !isStepEditing(razred, 4) ? (
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 font-semibold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                POSTAVLJENO
              </span>
              <button
                onClick={() => startEditingStep(razred, 4)}
                className="w-8 h-8 rounded-full border border-orange-400 bg-white hover:bg-orange-50 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
        {isStepSaved(razred, 4) && !isStepEditing(razred, 4) ? (
          <div className="mb-3 flex items-start gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex flex-col gap-1">
              {splitOn ? (
                <>
                  {entry.raspored.groupA && (
                    <span className="text-sm text-green-900">
                      <span className="font-bold">GRUPA 1:</span> {entry.raspored.groupA.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupA.slot ? `${entry.raspored.groupA.slot} - ${getEndTime(entry.raspored.groupA.slot, entry.raspored.groupA.duration ?? 45)}` : ''} • {entry.raspored.groupA.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                    </span>
                  )}
                  {entry.raspored.groupB && (
                    <span className="text-sm text-green-900">
                      <span className="font-bold">GRUPA 2:</span> {entry.raspored.groupB.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupB.slot ? `${entry.raspored.groupB.slot} - ${getEndTime(entry.raspored.groupB.slot, entry.raspored.groupB.duration ?? 45)}` : ''} • {entry.raspored.groupB.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                    </span>
                  )}
                </>
              ) : (
                entry.raspored.single && (
                  <span className="text-sm text-green-900">
                    {entry.raspored.single.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.single.slot ? `${entry.raspored.single.slot} - ${getEndTime(entry.raspored.single.slot, entry.raspored.single.duration ?? 45)}` : ''} • {entry.raspored.single.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                  </span>
                )
              )}
            </div>
          </div>
        ) : (
          <div className={`space-y-3 ${ready && (!isReadOnly || isStepEditing(razred, 4)) ? '' : 'opacity-50 pointer-events-none select-none'}`}>
            {!splitOn && renderTimelineSchedule(razred, 'single', 'Jedna grupa', isReadOnly, timelineHover, setTimelineHover, isStepSaved(razred, 4), isStepEditing(razred, 4))}
            {splitOn && (
              <div className="space-y-3">
                {renderTimelineSchedule(razred, 'groupA', 'Grupa 1', isReadOnly, timelineHover, setTimelineHover, isStepSaved(razred, 4), isStepEditing(razred, 4))}
                {renderTimelineSchedule(razred, 'groupB', 'Grupa 2', isReadOnly, timelineHover, setTimelineHover, isStepSaved(razred, 4), isStepEditing(razred, 4))}
              </div>
            )}
          </div>
        )}
        {(!isStepSaved(razred, 4) || isStepEditing(razred, 4)) && (
          <div className="flex flex-row items-center justify-end gap-2 mt-3">
            {isStepEditing(razred, 4) && (
              <button
                onClick={() => cancelEditingStep(razred, 4)}
                className="px-4 py-2 h-10 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold"
              >
                Odustani
              </button>
            )}
            <button
              onClick={() => saveStep(razred, 4)}
              disabled={!hasSchedule}
              className="px-4 py-2 h-10 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              Spremi
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
      <div className="space-y-4">
        {data.korak2.razredi.length === 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900 font-medium">
            Prvo odaberite razrede u prethodnom koraku.
          </div>
        )}
        {data.korak2.razredi.map((r) => {
          const allStepsSaved = areAllStepsSaved(r);
          return (
          <div key={r} className={`border ${allStepsSaved ? 'border-green-500' : 'border-gray-200'} rounded-lg bg-white transition-colors`}>
            <button
                onClick={() => {
                  const next = expandedRazred === r ? null : r;
                  setExpandedRazred(next);
                  if (next !== null && razredActiveStep[r] === undefined) {
                    setActiveRazredStep(r, 1);
                  }
                }}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {allStepsSaved && (
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-base font-semibold text-gray-900">{labelGrupa(r)}</span>
                {(() => {
                  const meta = razredByNumber.get(r);
                  const info = razredInfo(r, meta?.ilmihal);
                  return (
                    <span className={`text-xs px-2 py-1 rounded border font-semibold ${info.color}`}>
                      {info.label}
                    </span>
                  );
                })()}
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
            {allStepsSaved && expandedRazred !== r && (
              <div className="mx-4 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="space-y-2">
                  {(() => {
                    const entry = data.korak3[r];
                    const selectedMuallim = entry?.muallimId ? muallimById.get(entry.muallimId) : undefined;
                    const splitOn = entry?.split?.enabled;
                    const settings = entry?.settings;
                    const renderBadges = (key: 'single' | 'groupA' | 'groupB') => {
                      const s =
                        key === 'single'
                          ? settings?.single ?? settings?.groupA
                          : key === 'groupA'
                          ? settings?.groupA ?? settings?.single
                          : settings?.groupB;
                      if (!s || (!s.kuran && !s.sufara)) {
                        return null;
                      }
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                          {s.kuran && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Kuran
                            </span>
                          )}
                          {s.sufara && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                              Sufara
                            </span>
                          )}
                        </span>
                      );
                    };
                    
                    return (
                      <>
                        <div className="text-sm text-green-900">
                          <span className="font-bold">Muallim:</span> {selectedMuallim ? `${selectedMuallim.ime} ${selectedMuallim.prezime}` : 'Nije odabran'}
                        </div>
                        {splitOn ? (
                          <>
                            <div className="text-sm text-green-900 flex flex-wrap items-center gap-2">
                              <span className="font-bold">GRUPA 1:</span> <span className="font-bold">{entry.split.groupA?.length ?? 0}</span> djece • {entry.raspored.groupA ? (
                                <>{entry.raspored.groupA.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupA.slot ? `${entry.raspored.groupA.slot} - ${getEndTime(entry.raspored.groupA.slot, entry.raspored.groupA.duration ?? 45)}` : ''} • {entry.raspored.groupA.location === 'ucionica' ? 'Učionica' : 'Divanhana'}</>
                              ) : 'Nije postavljen'}
                              <div className="inline-flex items-center gap-2">{renderBadges('groupA')}</div>
                            </div>
                            <div className="text-sm text-green-900 flex flex-wrap items-center gap-2">
                              <span className="font-bold">GRUPA 2:</span> <span className="font-bold">{entry.split.groupB?.length ?? 0}</span> djece • {entry.raspored.groupB ? (
                                <>{entry.raspored.groupB.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupB.slot ? `${entry.raspored.groupB.slot} - ${getEndTime(entry.raspored.groupB.slot, entry.raspored.groupB.duration ?? 45)}` : ''} • {entry.raspored.groupB.location === 'ucionica' ? 'Učionica' : 'Divanhana'}</>
                              ) : 'Nije postavljen'}
                              <div className="inline-flex items-center gap-2">{renderBadges('groupB')}</div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-green-900 flex flex-wrap items-center gap-2">
                            <span className="font-bold">{entry?.split?.groupA?.length ?? 0}</span> djece • {entry.raspored.single ? (
                              <>{entry.raspored.single.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.single.slot ? `${entry.raspored.single.slot} - ${getEndTime(entry.raspored.single.slot, entry.raspored.single.duration ?? 45)}` : ''} • {entry.raspored.single.location === 'ucionica' ? 'Učionica' : 'Divanhana'}</>
                            ) : 'Nije postavljen'}
                            <div className="inline-flex items-center gap-2">{renderBadges('single')}</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            {expandedRazred === r && (
              <div className="px-4 pb-4 space-y-6">
                {/* Sadržaj koraka */}
                <div className="space-y-4">
                      {/* Step 1: Muallim */}
                      {isStepActive(r, 1) ? (
                        <div
                          className={`bg-white border rounded-lg p-4 shadow-sm flex flex-col transition-all duration-300 ${
                            isStepSaved(r, 1) ? 'border-green-200 shadow-green-50' : 'border-gray-200'
                          }`}
                        >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                isStepSaved(r, 1)
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}
                            >
                              1
                            </div>
                            <p className="text-sm font-semibold text-gray-900">Odabir muallima</p>
                          </div>
                          {isStepSaved(r, 1) && !isStepEditing(r, 1) ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 font-semibold">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                POSTAVLJENO
                              </span>
                              <button
                                onClick={() => startEditingStep(r, 1)}
                                className="w-8 h-8 rounded-full border border-orange-400 bg-white hover:bg-orange-50 flex items-center justify-center transition-colors"
                              >
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {isStepSaved(r, 1) && !isStepEditing(r, 1) && (() => {
                          const selectedMuallim = muallimById.get(data.korak3[r]?.muallimId ?? '');
                          if (!selectedMuallim) return null;
                          const avatar = getAvatarInfo(selectedMuallim.ime, selectedMuallim.prezime);
                          return (
                            <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatar.color}`}>
                                {avatar.initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-green-900">{selectedMuallim.ime} {selectedMuallim.prezime}</div>
                                <div className="text-xs text-green-700">{selectedMuallim.email}</div>
                              </div>
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          );
                        })()}
                        {(!isStepSaved(r, 1) || isStepEditing(r, 1)) && (
                          <>
                            {muallimiLoading && (
                              <div className="text-sm text-gray-600">Učitavam muallime...</div>
                            )}
                            {muallimiError && !muallimiLoading && (
                              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{muallimiError}</div>
                            )}
                            {!muallimiLoading && muallimi.length === 0 && !muallimiError && (
                              <div className="text-sm text-gray-600">Nema dostupnih muallima.</div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {muallimi.map((m) => {
                                const active = data.korak3[r]?.muallimId === m.id;
                                const avatar = getAvatarInfo(m.ime, m.prezime);
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => setMuallim(r, m.id)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition shadow-sm ${
                                      active
                                        ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
                                    }`}
                                  >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatar.color}`}>
                                      {avatar.initials}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <div className="text-sm font-semibold text-gray-900 truncate">{m.ime} {m.prezime}</div>
                                      <div className="text-xs text-gray-600 font-medium truncate">{m.email}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {isStepEditing(r, 1) && (
                          <div className="flex flex-row items-center justify-end gap-2 mt-3">
                            <button
                              onClick={() => cancelEditingStep(r, 1)}
                              className="px-4 py-2 h-10 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold"
                            >
                              Odustani
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-dashed rounded-lg p-4 flex flex-col opacity-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-300 text-gray-600">
                            1
                          </div>
                          <p className="text-sm font-semibold text-gray-400">Odabir muallima</p>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Učenici */}
                    {isStepActive(r, 2) ? (
                      <div
                        className={`bg-white border rounded-lg p-4 shadow-sm flex flex-col transition-all duration-300 ${
                          isStepSaved(r, 2) ? 'border-green-200 shadow-green-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                isStepSaved(r, 2)
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}
                            >
                              2
                            </div>
                            <p className="text-sm font-semibold text-gray-900">Odabir učenika</p>
                          </div>
                          {isStepSaved(r, 2) && !isStepEditing(r, 2) ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 font-semibold">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                POSTAVLJENO
                              </span>
                              <button
                                onClick={() => startEditingStep(r, 2)}
                                className="w-8 h-8 rounded-full border border-orange-400 bg-white hover:bg-orange-50 flex items-center justify-center transition-colors"
                              >
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {isStepSaved(r, 2) && !isStepEditing(r, 2) ? (
                          <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-green-900">
                              Odabrano učenika: <span className="font-bold">{(() => {
                                const entry = data.korak3[r];
                                if (!entry) return 0;
                                if (entry.split?.enabled) {
                                  return (entry.split.groupA?.length ?? 0) + (entry.split.groupB?.length ?? 0);
                                }
                                return entry.split?.groupA?.length ?? 0;
                              })()}</span>
                            </span>
                          </div>
                        ) : null}
                        {renderUceniciList(
                          r,
                          isStepSaved(r, 1),
                          isStepSaved(r, 2) && !isStepEditing(r, 2),
                          isStepEditing(r, 2) ? () => cancelEditingStep(r, 2) : undefined
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-dashed rounded-lg p-4 flex flex-col opacity-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-300 text-gray-600">
                            2
                          </div>
                          <p className="text-sm font-semibold text-gray-400">Odabir učenika</p>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Postavke grupa */}
                    {isStepActive(r, 3) ? (
                      <div
                        className={`bg-white border rounded-lg p-4 shadow-sm flex flex-col transition-all duration-300 ${
                          isStepSaved(r, 3) ? 'border-green-200 shadow-green-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                isStepSaved(r, 3)
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}
                            >
                              3
                            </div>
                            <p className="text-sm font-semibold text-gray-900">Postavke grupa</p>
                          </div>
                          {isStepSaved(r, 3) && !isStepEditing(r, 3) && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 font-semibold">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                POSTAVLJENO
                              </span>
                              <button
                                onClick={() => startEditingStep(r, 3)}
                                className="w-8 h-8 rounded-full border border-orange-400 bg-white hover:bg-orange-50 flex items-center justify-center transition-colors"
                              >
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {renderSplitControls(r, isStepSaved(r, 3) && !isStepEditing(r, 3))}
                        {(!isStepSaved(r, 3) || isStepEditing(r, 3)) && (
                          <div>
                            {renderGroupSettings(r, false)}
                          </div>
                        )}
                        {(!isStepSaved(r, 3) || isStepEditing(r, 3)) && (
                          <div className="flex flex-row items-center justify-end gap-2 mt-3">
                            {isStepEditing(r, 3) && (
                              <button
                                onClick={() => cancelEditingStep(r, 3)}
                                className="px-4 py-2 h-10 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold"
                              >
                                Odustani
                              </button>
                            )}
                            <button
                              onClick={() => saveStep(r, 3)}
                              className="px-4 py-2 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Spremi
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-dashed rounded-lg p-4 flex flex-col opacity-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-300 text-gray-600">
                            3
                          </div>
                          <p className="text-sm font-semibold text-gray-400">Odabir grupa</p>
                        </div>
                      </div>
                    )}

                    {/* Step 4: Raspored vikenda */}
                    {isStepActive(r, 4) ? (
                      renderRaspored(r, isStepSaved(r, 4) && !isStepEditing(r, 4))
                    ) : (
                      <div className="bg-white border border-dashed rounded-lg p-4 flex flex-col opacity-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-300 text-gray-600">
                            4
                          </div>
                          <p className="text-sm font-semibold text-gray-400">Raspored</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            )}
          </div>
        );
      })}
      </div>
      <div className="space-y-4">
        {renderOccupiedSlotsPanel(expandedRazred ?? undefined)}
      </div>
    </div>
  );

const renderGroupSettings = (razred: number, isReadOnly: boolean = false) => {
  const entry = data.korak3[razred] ?? defaultRazredState(getRazredId(razred));
  const splitOn = entry.split.enabled;
  const settings = entry.settings ?? { single: { kuran: false, sufara: false } };
  const base = { kuran: false, sufara: false };

  const renderCard = (
    label: string,
    target: 'single' | 'groupA' | 'groupB',
    state: { kuran: boolean; sufara: boolean },
  ) => {
    const allowedFields: Array<'kuran' | 'sufara'> = [];
    const caps = planCapabilities[razred];
    if (!caps || caps.kuran || caps.sufara) {
      if (caps?.kuran ?? true) allowedFields.push('kuran');
      if (caps?.sufara ?? true) allowedFields.push('sufara');
    }

    if (allowedFields.length === 0) {
      return (
        <div className="flex flex-col gap-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm h-full">
          <div className="text-sm text-gray-600">Nema Kuran/Sufara postavki za ovaj razred u odabranom planu.</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">{label}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allowedFields.map((field) => (
            <label key={field} className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
              <span className="capitalize">{field === 'kuran' ? 'Kuran' : 'Sufara'}</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={state[field]}
                  disabled={isReadOnly}
                  onChange={() => setGroupSetting(razred, target, field)}
                />
                <div
                  className={`w-10 h-5 rounded-full transition-colors ${
                    state[field] ? 'bg-emerald-500' : 'bg-gray-300'
                  } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      state[field] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 mt-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Postavke grupa</p>
            <p className="text-xs text-gray-600">
              Vidljive opcije zavise od odabranog nastavnog plana za ovaj razred.
            </p>
          </div>
        </div>
        {planDetailsLoading && (
          <span className="text-xs text-gray-500">Učitavam postavke plana...</span>
        )}
        {planDetailsError && (
          <span className="text-xs text-red-600">{planDetailsError}</span>
        )}
      </div>
      {splitOn ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderCard('Grupa 1', 'groupA', settings.groupA ?? settings.single ?? base)}
          {renderCard('Grupa 2', 'groupB', settings.groupB ?? base)}
        </div>
      ) : (
        <div className="grid grid-cols-1">
          {renderCard('Jedna grupa', 'single', settings.single ?? base)}
        </div>
      )}
    </div>
  );
};

  const statusClasses = (status: NastavnaGodinaCard['status']) => {
    if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-700';
    if (status === 'ARCHIVED') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  const editingExisting = Boolean(editingGodinaId);

  if (viewMode === 'list') {
    return (
      <div className="bg-gray-50 min-h-full p-6 lg:p-10">
        {toastNode}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nastavne godine</h1>
            <p className="text-sm text-gray-600 mt-1">Pregled i detalji postojećih nastavnih godina.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          {godineLoading && <div className="text-sm text-gray-500">Učitavam nastavne godine...</div>}
          {godineError && <div className="text-sm text-red-600">{godineError}</div>}
          {godinaDetailsError && <div className="text-xs text-red-600 mb-2">{godinaDetailsError}</div>}
          {!godineLoading && !godineError && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {godine.length === 0 && (
                <div className="col-span-full text-sm text-gray-500">Nema kreiranih nastavnih godina.</div>
              )}
              {godine.map((g) => (
                <button
                  key={g.id}
                  onClick={() => loadGodina(g.id)}
                  disabled={godinaDetailsLoading}
                  className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm text-left hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a4 4 0 118 0v2M5 9h14v10H5z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-base font-semibold text-gray-900">{g.naziv}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a4 4 0 118 0v2M5 9h14v10H5z" />
                            </svg>
                            {g.nastavniPlan?.naziv ?? 'Bez plana'}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>
                            {new Date(g.datumOd).toLocaleDateString('bs-BA')} – {new Date(g.datumDo).toLocaleDateString('bs-BA')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClasses(g.status)}`}>
                      {g.status === 'ACTIVE' ? 'Aktivna' : g.status === 'ARCHIVED' ? 'Arhivirana' : 'Neaktivna'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-3 line-clamp-3">{g.opis}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                      </svg>
                      {(g._count?.razredi ?? g.razredi?.length ?? 0)} razreda
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
                onClick={startNewGodina}
                className="border border-dashed border-gray-300 rounded-xl p-4 bg-white text-left hover:border-green-400 hover:shadow-md transition-all flex flex-col justify-center gap-2 min-h-[150px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900">Nova nastavna godina</div>
                    <div className="text-xs text-gray-500 mt-1">Dodaj novu godinu i postavke</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  Kreiraj novu godinu
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
            <h1 className="text-2xl font-bold text-gray-900">
              {editingExisting ? 'Uredi nastavnu godinu' : 'Nastavna godina'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Korak-po-korak: osnovni podaci → odabir razreda → dodjela učenika (sa opcijom split).
            </p>
          </div>
          <button
            onClick={() => {
              setViewMode('list');
              setEditingGodinaId(null);
              setSaveError(null);
            }}
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
                      if (!isStep1Valid || !isStep2Valid || !isStep3Valid) return;

                      setSaving(true);
                      setSaveError(null);

                      try {
                        const isUpdate = Boolean(editingGodinaId);
                        const url = isUpdate
                          ? `${API_URL}/nastavne-godine/${editingGodinaId}`
                          : `${API_URL}/nastavne-godine`;
                        const method = isUpdate ? 'put' : 'post';

                        const response = await axios[method](url, payload, {
                          timeout: 30000,
                          headers: {
                            'Content-Type': 'application/json',
                          },
                        });

                        if (response.data?.success) {
                          await loadGodine();
                          setViewMode('list');
                          setEditingGodinaId(null);
                          setData(emptyForm);
                          setStep(1);
                          setToast({
                            type: 'success',
                            message: isUpdate ? 'Nastavna godina ažurirana.' : 'Nastavna godina sačuvana.',
                          });
                        } else {
                          throw new Error('Neočekivani odgovor sa servera');
                        }
                      } catch (error: unknown) {
                        console.error('Greška pri spašavanju nastavne godine:', error);
                        const fallback =
                          typeof error === 'object' && error !== null && 'message' in error
                            ? String((error as { message?: string }).message)
                            : 'Greška pri spašavanju nastavne godine';
                        setSaveError(
                          // @ts-expect-error - potencijalni Axios odgovor
                          error?.response?.data?.message || fallback,
                        );
                        setToast({ type: 'error', message: 'Spremanje nije uspjelo.' });
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={!isStep1Valid || !isStep2Valid || !isStep3Valid || saving}
                    className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Spremanje...' : editingExisting ? 'Ažuriraj' : 'Spremi'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-800">{saveError}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Pregled JSON payloada</h3>
            <p className="text-xs text-gray-500 mb-3 font-medium">
              Ovo je struktura koja će se slati na backend kao jedan JSON.
            </p>
            <pre className="text-xs bg-gray-900 text-green-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
{JSON.stringify(payload, null, 2)}
            </pre>
            <div className="mt-3 text-xs text-gray-500 font-medium">
              * Backend će kasnije validirati i sačuvati podatke (nastavna godina, razredi, učenici, split).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
