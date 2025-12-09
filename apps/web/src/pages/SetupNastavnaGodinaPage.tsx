import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const MOCK_PLANOVI: NastavniPlan[] = [
  { id: 'plan-1', naziv: 'Ilmihal - osnovni plan' },
  { id: 'plan-2', naziv: 'Ilmihal - napredni plan' },
  { id: 'plan-3', naziv: 'Kombinovani plan' },
];

const MOCK_MUALLIMI: Muallim[] = [
  { id: 'm-1', ime: 'Amir', prezime: 'Hadžić', email: 'amir.hadzic@example.com' },
  { id: 'm-2', ime: 'Lejla', prezime: 'Mujkić', email: 'lejla.mujkic@example.com' },
  { id: 'm-3', ime: 'Tarik', prezime: 'Selimović', email: 'tarik.selimovic@example.com' },
];

// Fallback mock podaci ako API nije dostupan
const FALLBACK_UCENICI: Ucenik[] = Array.from({ length: 40 }).map((_, idx) => ({
  id: `u-${idx + 1}`,
  ime: `Ucenik ${idx + 1}`,
  prezime: `Prezime ${idx + 1}`,
  email: `ucenik${idx + 1}@example.com`,
}));

const RAZREDI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 0 = predškolci
const WEEKEND_DAYS: Schedule['day'][] = ['subota', 'nedjelja'];
const SLOT_TIMES = ['09:00', '09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15'];

const labelGrupa = (razred: number) => (razred === 0 ? 'Predškolci' : `${razred}. razred`);

function razredInfo(razred: number) {
  if (razred === 0) return { label: 'PREDSKOLCI', color: 'bg-teal-100 text-teal-800 border-teal-200' };
  if (razred <= 3) return { label: 'ILMIHAL 1', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (razred <= 6) return { label: 'ILMIHAL 2', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'ILMIHAL 3', color: 'bg-amber-100 text-amber-800 border-amber-200' };
}

const getEndTime = (startTime: string): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + 45;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
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

export default function SetupNastavnaGodinaPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [expandedRazred, setExpandedRazred] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [occupiedFilter, setOccupiedFilter] = useState('');
  const [dragging, setDragging] = useState<{ razred: number; ucenikId: string } | null>(null);
  const [hoverDrop, setHoverDrop] = useState<{ razred: number; group: 'A' | 'B' } | null>(null);
  const [razredActiveStep, setRazredActiveStep] = useState<Record<number, number>>({});
  const [savedSteps, setSavedSteps] = useState<Record<number, Set<number>>>({});
  const [editingSteps, setEditingSteps] = useState<Record<number, Set<number>>>({});
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);

  useEffect(() => {
    const fetchUcenici = async () => {
      try {
        const response = await axios.get<Ucenik[]>('http://localhost:3000/ucenici', {
          timeout: 5000, // 5 sekundi timeout
        });
        if (response.data && response.data.length > 0) {
          setUcenici(response.data);
        } else {
          // Ako je response prazan, koristi fallback
          console.warn('API vratio prazan array, koristim fallback podatke');
          setUcenici(FALLBACK_UCENICI);
        }
      } catch (error) {
        console.warn('API nije dostupan, koristim fallback podatke:', error);
        // Fallback na mock podatke ako API nije dostupan
        setUcenici(FALLBACK_UCENICI);
      }
    };

    fetchUcenici();
  }, []);

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

  const defaultRazredState = () => ({
    muallimId: null as string | null,
    ucenici: [] as string[],
    split: { enabled: false, groupA: [] as string[], groupB: [] as string[], selectionDone: false },
  settings: { single: { kuran: false, sufara: false } },
    raspored: {
      single: { day: 'subota' as const, slot: '', location: 'ucionica' as const },
    },
  });

  const [data, setData] = useState<StepData>({
    korak1: {
      naziv: 'Nastavna godina 2025/2026',
      opis: 'Postavi raspored, razrede i grupe za novu školsku godinu.',
      periodOd: '2025-09-01',
      periodDo: '2026-06-10',
      planId: MOCK_PLANOVI[0].id,
      status: 'ACTIVE',
    },
    korak2: {
      razredi: [],
    },
    korak3: {},
  });

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
  }, [data]);

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
        end: getEndTime(schedule.slot),
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
      if (exists) delete korak3[r];

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
      const current = prev.korak3[razred] ?? defaultRazredState();
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
      const current = prev.korak3[razred] ?? defaultRazredState();
      const raspored = { ...current.raspored };
      const base =
        (target === 'single' ? raspored.single : target === 'groupA' ? raspored.groupA : raspored.groupB) ??
        { day: 'subota', slot: SLOT_TIMES[0], location: 'ucionica' as const };
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
      const current = prev.korak3[razred] ?? defaultRazredState();
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
      const current = prev.korak3[razred] ?? defaultRazredState();
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
      const current = prev.korak3[razred] ?? defaultRazredState();
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            {MOCK_PLANOVI.map((p) => (
              <option key={p.id} value={p.id}>
                {p.naziv}
              </option>
            ))}
          </select>
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
            setData((prev) => ({
              ...prev,
              korak2: { razredi: [...RAZREDI] },
              korak3: {},
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
              korak3: {},
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

    const finalizeSelection = () => {
      const selectedArr = Array.from(selected);
      setData((prev) => {
        const current = prev.korak3[razred] ?? defaultRazredState();

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
                {filteredUcenici.map((u) => {
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
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-700 mb-1">Podjela u grupe</div>
            <p className="text-xs text-gray-600">
              {splitState.enabled 
                ? `Učenici će biti podijeljeni u dvije grupe (Grupa 1: ${groupACount}, Grupa 2: ${groupBCount})`
                : `Svi učenici (${selectedCount}) će biti raspoređeni u jednoj grupi`}
            </p>
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
      const muallim = muallimId ? MOCK_MUALLIMI.find((m) => m.id === muallimId) : undefined;
      if (!muallim) return false;
      if (MOCK_MUALLIMI.some((m) => m.id === occupiedFilter)) {
        return muallim.id === occupiedFilter;
      }
      const full = `${muallim.ime} ${muallim.prezime}`.toLowerCase();
      return full.includes(filter);
    };

    const renderSlotRow = (slot: OccupiedSlotInfo) => {
      const active = highlightRazred === slot.razred;
      const muallimId = data.korak3[slot.razred]?.muallimId;
      const muallim = muallimId ? MOCK_MUALLIMI.find((m) => m.id === muallimId) : undefined;
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
            {[{ id: '', label: 'Svi' }, ...MOCK_MUALLIMI.map((m) => ({ id: m.id, label: `${m.ime} ${m.prezime}`, initials: `${m.ime[0] ?? ''}${m.prezime[0] ?? ''}`.toUpperCase() })) as { id: string; label: string; initials?: string }[]].flat().map((m) => {
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

const renderScheduleBoard = (
  razred: number,
  target: 'single' | 'groupA' | 'groupB',
  label: string,
  isReadOnly: boolean = false,
) => {
  const entry = data.korak3[razred] ?? defaultRazredState();
  const schedule =
    target === 'single'
      ? entry.raspored.single
      : target === 'groupA'
      ? entry.raspored.groupA ?? entry.raspored.single
      : entry.raspored.groupB ?? entry.raspored.single;
  const ready = !!entry.muallimId && (entry.split.selectionDone ?? false);

  const setField = (field: keyof Schedule, value: Schedule[keyof Schedule]) => {
    if (isReadOnly) return;
    setSchedule(razred, target, { [field]: value } as Partial<Schedule>);
  };

  // Vraća sve već zauzete grupe u istom terminu/lokaciji (dozvoljavamo overlap)
  const findSlotConflicts = (day: Schedule['day'], slot: string, location: Schedule['location']) => {
    const conflicts: { razred: number; grupa: 'single' | 'groupA' | 'groupB' }[] = [];
    for (const r of data.korak2.razredi) {
      const otherEntry = data.korak3[r];
      if (!otherEntry) continue;

      // Single
      if (
        otherEntry.raspored.single?.day === day &&
        otherEntry.raspored.single?.slot === slot &&
        otherEntry.raspored.single?.location === location &&
        !(r === razred && target === 'single') &&
        !otherEntry.split.enabled
      ) {
        conflicts.push({ razred: r, grupa: 'single' });
      }

      // Grupa A
      if (
        otherEntry.raspored.groupA?.day === day &&
        otherEntry.raspored.groupA?.slot === slot &&
        otherEntry.raspored.groupA?.location === location &&
        !(r === razred && target === 'groupA')
      ) {
        conflicts.push({ razred: r, grupa: 'groupA' });
      }

      // Grupa B
      if (
        otherEntry.raspored.groupB?.day === day &&
        otherEntry.raspored.groupB?.slot === slot &&
        otherEntry.raspored.groupB?.location === location &&
        !(r === razred && target === 'groupB')
      ) {
        conflicts.push({ razred: r, grupa: 'groupB' });
      }
    }
    return conflicts;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-md" style={{ minHeight: 420 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="text-xs text-gray-500 font-medium">
          {schedule.day === 'subota' ? 'Subota' : 'Nedjelja'} • {schedule.slot ? `${schedule.slot} - ${getEndTime(schedule.slot)}` : 'Nije odabrano'} •{' '}
          {schedule.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
        </span>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <span className="text-xs font-semibold text-gray-600">Lokacija</span>
          <div className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-full p-1">
            {(['ucionica', 'divanhana'] as const).map((loc) => {
              const active = schedule.location === loc;
              return (
                <button
                  key={loc}
                  onClick={() => setField('location', loc)}
                  disabled={ready === false || isReadOnly}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  {loc === 'ucionica' ? 'Učionica' : 'Divanhana'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WEEKEND_DAYS.map((day) => {
            const dayActive = schedule.day === day;
            return (
              <div
                key={day}
                className={`border rounded-lg p-3 transition-all ${
                  dayActive 
                    ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50 shadow-sm' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <button
                    onClick={() => setField('day', day)}
                    disabled={ready === false || isReadOnly}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      dayActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md scale-105'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {day === 'subota' ? 'Subota' : 'Nedjelja'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SLOT_TIMES.map((t) => {
                    const conflicts = findSlotConflicts(day, t, schedule.location);
                    const active = dayActive && schedule.slot === t;
                    const showConflict = conflicts.length > 0;
                    const conflictLabels = conflicts.map((c) => {
                      if (c.grupa === 'groupA') return `${labelGrupa(c.razred)} • Grupa 1`;
                      if (c.grupa === 'groupB') return `${labelGrupa(c.razred)} • Grupa 2`;
                      return labelGrupa(c.razred); // single grupa: samo razred
                    });
                    const activeConflict = showConflict && active;
                    const passiveConflict = showConflict && !active;
                    return (
                      <button
                        key={`${day}-${t}`}
                        onClick={() => {
                          setField('day', day);
                          setField('slot', t);
                        }}
                        disabled={!dayActive || ready === false || isReadOnly}
                        className={`relative text-left rounded-lg border text-[11px] font-semibold transition flex flex-row items-stretch gap-0 ${
                          activeConflict
                            ? 'bg-orange-50 text-orange-900 border-orange-300 shadow-[0_1px_4px_rgba(249,115,22,0.35)]'
                            : passiveConflict
                            ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-[0_1px_4px_rgba(168,85,247,0.35)]'
                            : active
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div
                          className={`w-2 rounded-l-lg ${
                            activeConflict
                              ? 'bg-orange-500'
                              : passiveConflict
                              ? 'bg-purple-500'
                              : active
                              ? 'bg-emerald-500'
                              : 'bg-emerald-200'
                          }`}
                        />
                        <div className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">{t} - {getEndTime(t)}</span>
                            {showConflict && (
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border ${
                                  activeConflict
                                    ? 'bg-orange-100 border-orange-300 text-orange-700'
                                    : 'bg-purple-100 border-purple-300 text-purple-700'
                                }`}
                                title={conflictLabels.join('\n')}
                              >
                                {activeConflict ? (
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M11 2l-7 9h5v7l7-9h-5V2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 2a1 1 0 01.894.553l6 12A1 1 0 0116 16H4a1 1 0 01-.894-1.447l6-12A1 1 0 0110 2zm0 5.5a1 1 0 00-.993.883L9 8.5v2a1 1 0 001.993.117L11 10.5v-2a1 1 0 00-1-1zm0 6a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" />
                                  </svg>
                                )}
                              </span>
                            )}
                          </div>
                          {showConflict && (
                            <div
                              className={`text-[10px] font-semibold leading-tight ${
                                activeConflict ? 'text-orange-800' : 'text-purple-800'
                              }`}
                              title={conflictLabels.join(', ')}
                            >
                              {conflictLabels.map((label) => (
                                <div key={label} className="truncate">
                                  {label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

  const renderRaspored = (razred: number, isReadOnly: boolean = false) => {
    const entry = data.korak3[razred] ?? defaultRazredState();
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
                      <span className="font-bold">GRUPA 1:</span> {entry.raspored.groupA.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupA.slot ? `${entry.raspored.groupA.slot} - ${getEndTime(entry.raspored.groupA.slot)}` : ''} • {entry.raspored.groupA.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                    </span>
                  )}
                  {entry.raspored.groupB && (
                    <span className="text-sm text-green-900">
                      <span className="font-bold">GRUPA 2:</span> {entry.raspored.groupB.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupB.slot ? `${entry.raspored.groupB.slot} - ${getEndTime(entry.raspored.groupB.slot)}` : ''} • {entry.raspored.groupB.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                    </span>
                  )}
                </>
              ) : (
                entry.raspored.single && (
                  <span className="text-sm text-green-900">
                    {entry.raspored.single.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.single.slot ? `${entry.raspored.single.slot} - ${getEndTime(entry.raspored.single.slot)}` : ''} • {entry.raspored.single.location === 'ucionica' ? 'Učionica' : 'Divanhana'}
                  </span>
                )
              )}
            </div>
          </div>
        ) : (
          <div className={`space-y-3 ${ready && (!isReadOnly || isStepEditing(razred, 4)) ? '' : 'opacity-50 pointer-events-none select-none'}`}>
            {!splitOn && renderScheduleBoard(razred, 'single', 'Jedna grupa', isReadOnly)}
            {splitOn && (
              <div className="space-y-3">
                {renderScheduleBoard(razred, 'groupA', 'Grupa 1', isReadOnly)}
                {renderScheduleBoard(razred, 'groupB', 'Grupa 2', isReadOnly)}
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
                  const info = razredInfo(r);
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
                    const selectedMuallim = MOCK_MUALLIMI.find(m => m.id === entry?.muallimId);
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
                                <>{entry.raspored.groupA.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupA.slot ? `${entry.raspored.groupA.slot} - ${getEndTime(entry.raspored.groupA.slot)}` : ''} • {entry.raspored.groupA.location === 'ucionica' ? 'Učionica' : 'Divanhana'}</>
                              ) : 'Nije postavljen'}
                              <div className="inline-flex items-center gap-2">{renderBadges('groupA')}</div>
                            </div>
                            <div className="text-sm text-green-900 flex flex-wrap items-center gap-2">
                              <span className="font-bold">GRUPA 2:</span> <span className="font-bold">{entry.split.groupB?.length ?? 0}</span> djece • {entry.raspored.groupB ? (
                                <>{entry.raspored.groupB.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.groupB.slot ? `${entry.raspored.groupB.slot} - ${getEndTime(entry.raspored.groupB.slot)}` : ''} • {entry.raspored.groupB.location === 'ucionica' ? 'Učionica' : 'Divanhana'}</>
                              ) : 'Nije postavljen'}
                              <div className="inline-flex items-center gap-2">{renderBadges('groupB')}</div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-green-900 flex flex-wrap items-center gap-2">
                            <span className="font-bold">{entry?.split?.groupA?.length ?? 0}</span> djece • {entry.raspored.single ? (
                              <>{entry.raspored.single.day === 'subota' ? 'Subota' : 'Nedjelja'} • {entry.raspored.single.slot ? `${entry.raspored.single.slot} - ${getEndTime(entry.raspored.single.slot)}` : ''} • {entry.raspored.single.location === 'ucionica' ? 'Učionica' : 'Divanhana'}</>
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
                          const selectedMuallim = MOCK_MUALLIMI.find(m => m.id === data.korak3[r]?.muallimId);
                          return selectedMuallim ? (
                            <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm text-green-900">
                                <span className="font-bold">{selectedMuallim.ime} {selectedMuallim.prezime}</span>
                              </span>
                            </div>
                          ) : null;
                        })()}
                        {(!isStepSaved(r, 1) || isStepEditing(r, 1)) && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {MOCK_MUALLIMI.map((m) => {
                              const active = data.korak3[r]?.muallimId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => setMuallim(r, m.id)}
                                  className={`text-left p-3 rounded-lg border transition shadow-sm ${
                                    active
                                      ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
                                  }`}
                                >
                                  <div className="text-sm font-semibold text-gray-900">{m.ime} {m.prezime}</div>
                                  <div className="text-xs text-gray-600 font-medium">{m.email}</div>
                                </button>
                              );
                            })}
                          </div>
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
  const entry = data.korak3[razred] ?? defaultRazredState();
  const splitOn = entry.split.enabled;
  const settings = entry.settings ?? { single: { kuran: false, sufara: false } };
  const base = { kuran: false, sufara: false };

  const renderCard = (
    label: string,
    target: 'single' | 'groupA' | 'groupB',
    state: { kuran: boolean; sufara: boolean },
  ) => (
    <div className="flex flex-col gap-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm h-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {(['kuran', 'sufara'] as const).map((field) => (
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

  return (
    <div className="p-4 mt-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Postavke grupa</p>
          <p className="text-xs text-gray-600">Odaberi da li grupa radi Kuran i/ili Sufaru.</p>
        </div>
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

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full max-w-none mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Setup nastavne godine</h1>
            <p className="text-sm text-gray-600 mt-1">
              Korak-po-korak: osnovni podaci → odabir razreda → dodjela učenika (sa opcijom split).
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
                      navigate('/');
                    }}
                    disabled={!isStep1Valid || !isStep2Valid || !isStep3Valid}
                    className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Spremi (JSON)
                  </button>
                )}
              </div>
            </div>
          </div>

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


