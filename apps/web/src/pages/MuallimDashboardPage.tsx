import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import CasEntryDrawer from '../components/CasEntryDrawer';
import WeekendDatePicker from '../components/WeekendDatePicker';
import { RasporedItem } from '../types/raspored';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface NastavniPlan {
  id: string;
  naziv: string;
  opis: string;
}

interface NastavnaGodina {
  id: string;
  naziv: string;
  opis: string | null;
  datumOd: string;
  datumDo: string;
  nastavniPlan: NastavniPlan;
}

interface Razred {
  id: string;
  name: string;
  ilmihal: string;
}

interface Grupa {
  id: string;
  naziv: string;
  kuran: boolean;
  sufara: boolean;
  brojUcenika: number;
  raspored: {
    id: string;
    dan: string;
    slot: string;
    lokacija: string | null;
    trajanje: number;
  } | null;
}

interface RazredData {
  id: string;
  razred: Razred;
  split: boolean;
  ukupnoUcenika: number;
  grupe: Grupa[];
}

interface DashboardData {
  nastavnaGodina: NastavnaGodina | null;
  razredi: RazredData[];
  raspored: RasporedItem[];
  sviRasporedi?: RasporedItem[]; // Svi slotovi za statistike (bez filtriranja po danu)
  statistike: {
    ukupnoRazreda: number;
    ukupnoUcenika: number;
    ukupnoGrupa: number;
    danasnjiCasovi: number;
  };
  odabraniDan: 'subota' | 'nedjelja';
}

export default function MuallimDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Postavi selectedDay na najbližu narednu subotu
  const [selectedDay, setSelectedDay] = useState<'subota' | 'nedjelja' | null>(() => {
    const today = new Date();
    const day = today.getDay();
    // Ako je danas subota (6) ili nedjelja (0), koristi taj dan
    if (day === 6) return 'subota';
    if (day === 0) return 'nedjelja';
    // Inače, postavi na najbližu narednu subotu
    return 'subota';
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const [showCasDrawer, setShowCasDrawer] = useState(false);
  const [selectedSlotForDrawer, setSelectedSlotForDrawer] = useState<RasporedItem | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null);
  // Postavi defaultni datum na danasnji ako je vikend
  const [selectedWeekendDate, setSelectedWeekendDate] = useState<Date | null>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    if (day === 6 || day === 0) {
      return today;
    }
    return null;
  });
  // Mapa za čuvanje informacije o casovima: key = `${slotId}-${datumISO}`, value = boolean
  const [casExistsMap, setCasExistsMap] = useState<Map<string, boolean>>(new Map());
  // Mapa za čuvanje broja časova po datumu: key = `YYYY-MM-DD`, value = { total, completed }
  const [casoviCounts, setCasoviCounts] = useState<Record<string, { total: number; completed: number }>>({});
  
  // Provjeri postojanje časa za sve slotove kada se promijeni datum ili dashboardData
  useEffect(() => {
    if (!dashboardData) {
      setCasExistsMap(new Map());
      return;
    }

    const checkCasExists = async () => {
      const newMap = new Map<string, boolean>();
      
      // Provjeri za sve slotove u dashboardData (raspored je array)
      const allSlots = dashboardData.raspored || [];

      // Grupiraj slotove po danu da provjerimo za oba datuma
      const slotsByDay = {
        subota: allSlots.filter((s: RasporedItem) => s.dan === 'subota'),
        nedjelja: allSlots.filter((s: RasporedItem) => s.dan === 'nedjelja'),
      };

      // Izračunaj datume za subotu i nedjelju - koristi tačan datum sa pickera
      let saturdayDate: Date;
      let sundayDate: Date;
      
      if (selectedWeekendDate) {
        const selectedDayOfWeek = selectedWeekendDate.getDay();
        if (selectedDayOfWeek === 6) {
          // Odabrana je subota - koristi tačan datum
          saturdayDate = new Date(selectedWeekendDate);
          saturdayDate.setHours(0, 0, 0, 0);
          sundayDate = new Date(selectedWeekendDate);
          sundayDate.setDate(sundayDate.getDate() + 1);
          sundayDate.setHours(0, 0, 0, 0);
        } else if (selectedDayOfWeek === 0) {
          // Odabrana je nedjelja - koristi tačan datum
          sundayDate = new Date(selectedWeekendDate);
          sundayDate.setHours(0, 0, 0, 0);
          saturdayDate = new Date(selectedWeekendDate);
          saturdayDate.setDate(saturdayDate.getDate() - 1);
          saturdayDate.setHours(0, 0, 0, 0);
        } else {
          // Fallback
          saturdayDate = getSlotDate('subota');
          sundayDate = getSlotDate('nedjelja');
        }
      } else {
        saturdayDate = getSlotDate('subota');
        sundayDate = getSlotDate('nedjelja');
      }

      const promises: Promise<void>[] = [];

      // Helper funkcija za formatiranje datuma bez vremenske zone problema
      const formatDateForAPI = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Provjeri za slotove subote
      slotsByDay.subota.forEach((slot: RasporedItem) => {
        const dateISO = formatDateForAPI(saturdayDate);
        promises.push(
          axios.get(`${API_URL}/cas/slot/${slot.id}`, {
            params: { datum: dateISO },
          })
            .then((response) => {
              const key = `${slot.id}-${dateISO}`;
              newMap.set(key, !!response.data);
            })
            .catch(() => {
              const key = `${slot.id}-${dateISO}`;
              newMap.set(key, false);
            })
        );
      });

      // Provjeri za slotove nedjelje
      slotsByDay.nedjelja.forEach((slot: RasporedItem) => {
        const dateISO = formatDateForAPI(sundayDate);
        promises.push(
          axios.get(`${API_URL}/cas/slot/${slot.id}`, {
            params: { datum: dateISO },
          })
            .then((response) => {
              const key = `${slot.id}-${dateISO}`;
              newMap.set(key, !!response.data);
            })
            .catch(() => {
              const key = `${slot.id}-${dateISO}`;
              newMap.set(key, false);
            })
        );
      });

      await Promise.all(promises);
      setCasExistsMap(newMap);
    };

    checkCasExists();
  }, [dashboardData, selectedWeekendDate]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { dan?: string; datum?: string } = {};
      
      // Ako je odabran konkretan datum, šalji datum i dan
      if (selectedWeekendDate) {
        const dateStr = selectedWeekendDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        params.datum = dateStr;
        // Uvijek šalji dan na osnovu odabranog datuma
        const dayOfWeek = selectedWeekendDate.getDay();
        params.dan = dayOfWeek === 6 ? 'subota' : dayOfWeek === 0 ? 'nedjelja' : (selectedDay || 'subota');
      } else if (selectedDay) {
        // Inače, šalji samo dan
        params.dan = selectedDay;
      }
      
      const response = await axios.get(`${API_URL}/muallimi/dashboard`, { params });
      // Debug: ispiši šta dolazi iz baze
      console.log('Dashboard data:', response.data);
      console.log('Params sent:', params);
      console.log('Raspored items:', response.data?.raspored?.length || 0);
      if (response.data?.razredi) {
        response.data.razredi.forEach((r: any) => {
          console.log(`Razred ${r.razred?.name}: ilmihal = "${r.razred?.ilmihal}" (type: ${typeof r.razred?.ilmihal})`);
        });
      }
      setDashboardData(response.data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  }, [selectedDay, selectedWeekendDate]);

  // Učitaj podatke kada je user dostupan (nakon login-a ili refresh-a) ili kada se promijeni selectedDay ili selectedWeekendDate
  useEffect(() => {
    console.log('MuallimDashboardPage useEffect:', { authLoading, user: user?.id, selectedDay, selectedWeekendDate, dashboardData: !!dashboardData });
    // Učitaj podatke ako:
    // 1. User je dostupan i authLoading je false
    // 2. DashboardData nije postavljen (npr. nakon refresh-a)
    if (!authLoading && user) {
      console.log('Calling fetchDashboardData...');
      fetchDashboardData();
    } else if (!authLoading && !user) {
      console.log('User not available, skipping fetchDashboardData');
    } else if (authLoading) {
      console.log('Auth still loading, waiting...');
    }
  }, [selectedDay, selectedWeekendDate, user, authLoading, fetchDashboardData]);

  // Dohvati broj časova po datumu kada je dashboardData dostupan
  useEffect(() => {
    const fetchCasoviCounts = async () => {
      if (!dashboardData?.nastavnaGodina || !user) {
        setCasoviCounts({});
        return;
      }

      try {
        // Pronađi muallim ID iz user objekta (trebamo ucenik ID)
        // Za sada koristimo user.id, ali možda treba pronaći ucenik ID
        // Pretpostavljamo da user ima ucenik relaciju ili možemo koristiti user.id direktno
        const response = await axios.get(`${API_URL}/cas/counts/by-date`, {
          params: {
            nastavnaGodinaId: dashboardData.nastavnaGodina.id,
            startDate: dashboardData.nastavnaGodina.datumOd,
            endDate: dashboardData.nastavnaGodina.datumDo,
          },
        });
        setCasoviCounts(response.data || {});
      } catch (err: any) {
        console.error('Error fetching casovi counts:', err);
        setCasoviCounts({});
      }
    };

    fetchCasoviCounts();
  }, [dashboardData, user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
      'januar', 'februar', 'mart', 'april', 'maj', 'jun',
      'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}. ${month} ${year}`;
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };

  const getDayName = (dan: string) => {
    return dan === 'subota' ? 'Subota' : 'Nedjelja';
  };

  // Timeline constants
  const TIMELINE_START_HOUR = 8; // 08:00
  const TIMELINE_END_HOUR = 16; // 16:00
  const TIMELINE_HEIGHT = 640; // px (povećano sa 480)
  const WEEKEND_DAYS: ('subota' | 'nedjelja')[] = ['subota', 'nedjelja'];

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

  const getEndTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = (startTime: string, duration: number): { minutes: number; seconds: number } => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startTotalSeconds = hours * 3600 + minutes * 60;
    const endTotalSeconds = startTotalSeconds + duration * 60;
    
    const now = currentTime;
    const nowTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    const remainingSeconds = Math.max(0, endTotalSeconds - nowTotalSeconds);
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingSecs = remainingSeconds % 60;
    
    return { minutes: remainingMinutes, seconds: remainingSecs };
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

  // Collect slots for a specific day with stacking algorithm (same as SetupNastavnaGodinaPage)
  const collectDaySlots = (day: 'subota' | 'nedjelja') => {
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
      item: RasporedItem;
    }[] = [];

    raspored
      .filter((item) => item.dan === day)
      .forEach((item) => {
        const info = getIlmihalInfo(item.grupa.razred.ilmihal);
        const startMin = timeToMinutes(item.slot);
        const endMin = startMin + item.trajanje;
        const grupaLabel = item.grupa.naziv === 'A' ? 'Grupa 1' : item.grupa.naziv === 'B' ? 'Grupa 2' : `Grupa ${item.grupa.naziv}`;
        const label = `${item.grupa.razred.name} • ${grupaLabel}`;
        
        slots.push({
          start: item.slot,
          end: getEndTime(item.slot, item.trajanje),
          label,
          color: info.color,
          startMin,
          endMin,
          item,
        });
      });

    // Improved stacking algorithm (same as SetupNastavnaGodinaPage)
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

      // Remove slots that have ended before or exactly when this one starts
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].end <= start) {
          active.splice(i, 1);
        }
      }

      // Find the first available column
      let col = -1;
      const usedCols = new Set(active.map(a => a.col));
      for (let c = 0; c <= active.length; c++) {
        if (!usedCols.has(c)) {
          col = c;
          break;
        }
      }

      if (col === -1) {
        col = active.length;
      }

      active.push({ end, col, idx });
      sorted[idx] = {
        ...sorted[idx],
        stackIndex: col,
      };
    });

    // Calculate max stack count for each slot
    sorted.forEach((slot, idx) => {
      const start = slot.startMin ?? timeToMinutes(slot.start);
      const end = slot.endMin ?? timeToMinutes(slot.end);
      
      const overlappingSlots = sorted.filter((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const otherStart = other.startMin ?? timeToMinutes(other.start);
        const otherEnd = other.endMin ?? timeToMinutes(other.end);
        return start < otherEnd && end > otherStart;
      });

      const timePoints = new Set<number>();
      timePoints.add(start);
      overlappingSlots.forEach(other => {
        const otherStart = other.startMin ?? timeToMinutes(other.start);
        const otherEnd = other.endMin ?? timeToMinutes(other.end);
        if (otherStart >= start && otherStart < end) timePoints.add(otherStart);
        if (otherEnd > start && otherEnd < end) timePoints.add(otherEnd);
      });

      let maxCount = 1;
      if (timePoints.size > 0) {
        timePoints.forEach(timePoint => {
          let count = 1;
          sorted.forEach((other, otherIdx) => {
            if (otherIdx === idx) return;
            const otherStart = other.startMin ?? timeToMinutes(other.start);
            const otherEnd = other.endMin ?? timeToMinutes(other.end);
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
        hasOverlap: maxCount > 1,
      };
    });

    return sorted;
  };

  const formatIlmihal = (ilmihal: string) => {
    // Prisma enum vraća ILMIHAL_I, ILMIHAL_II, ILMIHAL_III
    // Konvertujemo u format bez underscore-a: ILMIHAL 1, ILMIHAL 2, ILMIHAL 3
    if (ilmihal === 'ILMIHAL_I' || ilmihal === 'ILMIHAL I') return 'ILMIHAL 1';
    if (ilmihal === 'ILMIHAL_II' || ilmihal === 'ILMIHAL II') return 'ILMIHAL 2';
    if (ilmihal === 'ILMIHAL_III' || ilmihal === 'ILMIHAL III') return 'ILMIHAL 3';
    // Fallback: zamijeni underscore sa razmakom
    return ilmihal.replace(/_/g, ' ');
  };

  const getIlmihalInfo = (ilmihal: string) => {
    // Prisma enum vraća ILMIHAL_I, ILMIHAL_II, ILMIHAL_III (sa underscore-om)
    // Provjeravamo i sa underscore-om i bez (za slučaj da API vraća mapiranu vrijednost)
    
    // Normalizujemo za poređenje
    const normalized = ilmihal.trim().toUpperCase();
    
    if (normalized === 'ILMIHAL_I' || normalized === 'ILMIHAL I' || normalized.includes('ILMIHAL I')) {
      return {
        label: 'ILMIHAL 1',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        bg: 'bg-emerald-100',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600',
      };
    }
    if (normalized === 'ILMIHAL_II' || normalized === 'ILMIHAL II' || normalized.includes('ILMIHAL II')) {
      return {
        label: 'ILMIHAL 2',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        border: 'border-purple-200',
        iconBg: 'bg-purple-100',
        iconText: 'text-purple-600',
      };
    }
    if (normalized === 'ILMIHAL_III' || normalized === 'ILMIHAL III' || normalized.includes('ILMIHAL III')) {
      return {
        label: 'ILMIHAL 3',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        border: 'border-amber-200',
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-600',
      };
    }
    // Fallback
    return {
      label: formatIlmihal(ilmihal),
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200',
      iconBg: 'bg-gray-100',
      iconText: 'text-gray-600',
    };
  };

  const calculateProgress = (datumOd: string, datumDo: string) => {
    const start = new Date(datumOd);
    start.setHours(0, 0, 0, 0);
    const end = new Date(datumDo);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const startTime = start.getTime();
    const endTime = end.getTime();
    const nowTime = now.getTime();
    
    if (nowTime < startTime) return 0;
    if (nowTime > endTime) return 100;
    
    const total = endTime - startTime;
    const elapsed = nowTime - startTime;
    const progress = (elapsed / total) * 100;
    return Math.round(progress);
  };

  // Helper funkcija za tamniju boju lijevog bordera na osnovu statusa slota
  const getLeftBorderClass = (isActive: boolean, isPastSlot: boolean, isCompletedSlot: boolean) => {
    if (isActive) {
      return 'border-l-4 border-l-blue-800';
    }
    if (isPastSlot && !isCompletedSlot) {
      return 'border-l-4 border-l-amber-400';
    }
    if (isPastSlot && isCompletedSlot) {
      return 'border-l-4 border-l-emerald-500';
    }
    // Budući casovi
    return 'border-l-4 border-l-blue-400';
  };

  const isTodayWeekend = () => {
    const today = new Date();
    const day = today.getDay();
    return day === 0 || day === 6; // 0 = nedjelja, 6 = subota
  };

  const getTodayWeekendDay = (): 'subota' | 'nedjelja' | null => {
    const today = new Date();
    const day = today.getDay();
    if (day === 6) return 'subota';
    if (day === 0) return 'nedjelja';
    return null;
  };

  const getSlotDate = (dan: 'subota' | 'nedjelja'): Date => {
    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = dan === 'subota' ? 6 : 0; // 6 = subota, 0 = nedjelja
    
    // Ako je danas taj dan, vrati danas
    if (currentDay === targetDay) {
      return new Date(today);
    }
    
    // Izračunaj najbližu narednu subotu ili nedjelju
    const date = new Date(today);
    let daysUntilTarget = targetDay - currentDay;
    
    // Ako je target dan prošao ovu sedmicu, dodaj 7 dana
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    
    date.setDate(date.getDate() + daysUntilTarget);
    return date;
  };

  const formatSlotDate = (date: Date): string => {
    const day = date.getDate();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
    const month = monthNames[date.getMonth()];
    return `${day}. ${month}`;
  };

  const formatSlotDayName = (date: Date): string => {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 6 ? 'Subota' : dayOfWeek === 0 ? 'Nedjelja' : '';
  };


  const getCurrentTimeSlots = (raspored: RasporedItem[]) => {
    if (!isTodayWeekend()) return [];
    
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 'nedjelja' : 'subota';
    
    return raspored.filter((item) => {
      if (item.dan !== currentDay) return false;
      
      const [hours, minutes] = item.slot.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + item.trajanje);
      
      return now >= startTime && now <= endTime;
    });
  };

  const getCurrentTimePosition = (): number | null => {
    if (!isTodayWeekend()) return null;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Only show if within timeline hours
    if (hours < TIMELINE_START_HOUR || hours >= TIMELINE_END_HOUR) return null;
    
    return timeToPosition(timeString);
  };

  const isSlotStartedToday = (item: RasporedItem): boolean => {
    const todayDay = getTodayWeekendDay();
    if (!todayDay || item.dan !== todayDay) return false;

    const now = new Date();
    const [hours, minutes] = item.slot.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);

    return now >= startTime;
  };

  const isSlotPastToday = (item: RasporedItem): boolean => {
    const todayDay = getTodayWeekendDay();
    if (!todayDay || item.dan !== todayDay) return false;

    const now = new Date();
    const [hours, minutes] = item.slot.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + item.trajanje);

    return now > endTime;
  };

  // Provjeri da li je slot prošao na osnovu datuma
  const isSlotPast = (item: RasporedItem, slotDate: Date): boolean => {
    const now = new Date();
    const [hours, minutes] = item.slot.split(':').map(Number);
    const slotDateTime = new Date(slotDate);
    slotDateTime.setHours(hours, minutes, 0, 0);
    const endTime = new Date(slotDateTime);
    endTime.setMinutes(endTime.getMinutes() + item.trajanje);

    return now > endTime;
  };

  const getWeekendCount = (): number => {
    if (!nastavnaGodina) return 0;
    
    const start = new Date(nastavnaGodina.datumOd);
    start.setHours(0, 0, 0, 0);
    const end = new Date(nastavnaGodina.datumDo);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Izračunaj datum do kojeg treba računati - do trenutnog vikenda
    let checkDate = new Date(now);
    const currentDay = now.getDay();
    
    // Ako je danas subota (6) ili nedjelja (0), koristi danas
    // Ako nije vikend, idi na prošlu nedjelju (kraj prošlog vikenda)
    if (currentDay === 6) {
      // Subota - koristi danas
      checkDate = new Date(now);
    } else if (currentDay === 0) {
      // Nedjelja - koristi danas
      checkDate = new Date(now);
    } else {
      // Nije vikend - idi na prošlu nedjelju
      const daysToLastSunday = currentDay; // 1 = ponedjeljak -> 1 dan unazad, 2 = utorak -> 2 dana unazad, itd.
      checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - daysToLastSunday);
    }
    
    // Ne računaj dalje od kraja nastavne godine
    if (checkDate > end) {
      checkDate = end;
    }
    
    let count = 0;
    const currentDate = new Date(start);
    
    // Count weekends (pairs of Saturday and Sunday)
    // Vikend = subota + nedjelja zajedno
    const processedWeekends = new Set<string>();
    
    while (currentDate <= checkDate) {
      const day = currentDate.getDay();
      if (day === 6) { // Saturday
        // Check if Sunday exists in this weekend
        const sunday = new Date(currentDate);
        sunday.setDate(sunday.getDate() + 1);
        if (sunday <= checkDate) {
          // Create unique key for this weekend (year-week)
          const year = currentDate.getFullYear();
          const week = getWeekNumber(currentDate);
          const weekendKey = `${year}-${week}`;
          
          if (!processedWeekends.has(weekendKey)) {
            processedWeekends.add(weekendKey);
            count++;
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getDaysUntilNextWeekend = (): number => {
    const now = new Date();
    const day = now.getDay();
    
    if (day === 0) return 0; // Nedjelja
    if (day === 6) return 0; // Subota
    
    // Days until Saturday
    const daysUntilSaturday = 6 - day;
    return daysUntilSaturday;
  };

  const getTimeUntilNextWeekend = () => {
    const now = new Date();
    const day = now.getDay();

    if (day === 0 || day === 6) {
      return { days: 0, hours: 0 };
    }

    const target = new Date(now);
    const daysUntilSaturday = 6 - day;
    target.setDate(target.getDate() + daysUntilSaturday);
    target.setHours(TIMELINE_START_HOUR, 0, 0, 0);

    const diffMs = target.getTime() - now.getTime();
    const totalHours = Math.max(0, Math.round(diffMs / 3600000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    return { days, hours };
  };

  const getNextClassInfo = () => {
    if (!dashboardData) return null;

    const allSlots = dashboardData.sviRasporedi || dashboardData.raspored || [];
    if (!allSlots.length) return null;

    const now = new Date();
    let nextDate: Date | null = null;
    let nextSlot: RasporedItem | null = null;

    allSlots.forEach((slot) => {
      const target = new Date(now);
      const targetDayOfWeek = slot.dan === 'subota' ? 6 : 0; // 6 = subota, 0 = nedjelja
      let diffDays = targetDayOfWeek - target.getDay();
      if (diffDays < 0) diffDays += 7;
      target.setDate(target.getDate() + diffDays);

      const [hours, minutes] = slot.slot.split(':').map(Number);
      target.setHours(hours, minutes, 0, 0);

      if (target <= now) {
        target.setDate(target.getDate() + 7);
      }

      if (!nextDate || target < nextDate) {
        nextDate = target;
        nextSlot = slot;
      }
    });

    if (!nextDate || !nextSlot) return null;

    const diffMs = nextDate.getTime() - new Date().getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);

    return { slot: nextSlot, date: nextDate, days, hours };
  };

  const getTotalWeeklyHours = (): number => {
    // Calculate total hours from ALL slots (all days) - use sviRasporedi if available, otherwise fallback to raspored
    const allSlots = dashboardData?.sviRasporedi || raspored;
    const totalMinutes = allSlots.reduce((sum, item) => sum + item.trajanje, 0);
    return Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-8 text-slate-600 text-lg font-semibold">Učitavanje podataka...</p>
          <p className="mt-2 text-slate-400 text-sm">Molimo sačekajte</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full border border-red-100">
          <div className="text-center">
            <div className="bg-gradient-to-br from-red-100 to-red-50 rounded-full p-5 w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-lg">
              <svg
                className="h-12 w-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Greška</h3>
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={() => fetchDashboardData()}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Pokušaj ponovo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { nastavnaGodina, razredi, raspored, statistike, odabraniDan } = dashboardData;
  const todayIsWeekend = isTodayWeekend();
  const todayWeekendDay = getTodayWeekendDay();
  const timeUntilWeekend = !todayIsWeekend ? getTimeUntilNextWeekend() : null;
  const nextClassInfo = !todayIsWeekend ? getNextClassInfo() : null;
  // Ako je odabran datum u picker-u, koristi selectedDay, inače koristi odabraniDan iz backend-a
  const effectiveSelectedDay = (selectedWeekendDate ? selectedDay : (selectedDay || odabraniDan)) as 'subota' | 'nedjelja';
  const allSlotsForStats = dashboardData.sviRasporedi || raspored;
  const totalWeekendSlots = allSlotsForStats.length;
  const totalWeekendHours = Math.round(
    (allSlotsForStats.reduce((sum, item) => sum + item.trajanje, 0) / 60) * 10,
  ) / 10;
  const todaySlotsForSummary =
    todayWeekendDay != null ? raspored.filter((item) => item.dan === todayWeekendDay) : [];
  const pastTodaySlots = todaySlotsForSummary.filter((item) => isSlotPastToday(item));
  const completedPastTodaySlots = pastTodaySlots.filter((item) => item.imaUnosCasa).length;
  const allTodaySlotsCompleted =
    pastTodaySlots.length > 0 && completedPastTodaySlots === pastTodaySlots.length;
  const progress = nastavnaGodina ? calculateProgress(nastavnaGodina.datumOd, nastavnaGodina.datumDo) : 0;
  const currentSlots = getCurrentTimeSlots(raspored);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="flex h-screen overflow-hidden gap-4 p-4">
        {/* Left Side - Calendar View (60%) */}
        <div className="flex-[60] overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl text-slate-900 mb-1">
                    {user?.ime && user?.prezime ? (
                      <>
                        <span className="font-normal text-gray-600">Esselamu alejkum, </span>
                        <span className="font-bold">{user.ime} {user.prezime}</span>
                      </>
                    ) : (
                      <span className="font-bold">Dashboard</span>
                    )}
                  </h1>
                  <p className="text-slate-500 text-sm">Raspored časova</p>
                </div>
                {nastavnaGodina && (
                <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {(() => {
                        const now = new Date();
                        const day = now.getDate();
                        const monthNames = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
                        const weekdayNames = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
                        const month = monthNames[now.getMonth()];
                        const year = now.getFullYear();
                        const weekday = weekdayNames[now.getDay()];
                        return `${day}. ${month} ${year}, ${weekday}`;
                      })()}
                    </div>
                </div>
                )}
              </div>
            </div>

            {/* Current Active Slot Banner */}
            {currentSlots.length > 0 && (() => {
              return (
                <div className="mb-4 w-full bg-gradient-to-br from-blue-50 via-indigo-50 via-purple-50 to-blue-50 border border-blue-200 rounded-xl p-5 shadow-md relative overflow-hidden transition-all duration-500 ease-out animate-[fadeInSlide_0.5s_ease-out]">
                  <style>{`
                    @keyframes fadeInSlide {
                      from {
                        opacity: 0;
                        transform: translateY(-10px);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0);
                      }
                    }
                  `}</style>
                  {/* Animated background effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-indigo-400/10 via-purple-400/10 to-blue-400/0 animate-pulse"></div>
                  {/* Additional subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-100/20 via-indigo-100/20 to-purple-100/20"></div>
                  
                  <div className="relative z-10">
                    {/* Header with LIVE indicator */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-3 h-3 rounded-full bg-red-600 animate-ping absolute"></div>
                          <div className="w-3 h-3 rounded-full bg-red-600 relative"></div>
                        </div>
                        <div className="text-sm font-bold text-red-600 uppercase tracking-wider animate-pulse">
                          LIVE
                        </div>
                        <div className="text-sm font-semibold text-gray-700">
                          {currentTime.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Groups grid - one per column */}
                    <div className={`grid gap-3 ${currentSlots.length === 1 ? 'grid-cols-1' : currentSlots.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {currentSlots.map((slot, idx) => {
                        return (
                          <button
                            key={slot.id || idx}
                            onClick={() => {
                              setSelectedSlotForDrawer(slot);
                              setShowCasDrawer(true);
                            }}
                            className="bg-white/80 backdrop-blur-sm border border-blue-200 rounded-lg p-4 text-left cursor-pointer"
                          >
                            <div className="flex flex-col gap-2">
                              {/* Termin sa ikonicom */}
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-sm font-bold text-gray-900">
                                  {formatTime(slot.slot)} - {getEndTime(slot.slot, slot.trajanje)}
                                </div>
                              </div>
                              
                              {/* Grupa sa ikonicom */}
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <div className="text-sm font-semibold text-gray-900">
                                  {slot.grupa.razred.name} - Grupa {slot.grupa.naziv}
                                </div>
                              </div>
                              
                              {/* Lokacija sa ikonicom */}
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div className="text-sm font-normal text-gray-600">
                                  {slot.lokacija === 'divanhana' ? 'Divanhana' : slot.lokacija === 'ucionica' ? 'Učionica' : slot.lokacija || 'Nije određeno'}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sažetak unosa za današnji vikend dan (kada nema više aktivnih časova) – samo ako fale podaci */}
            {todayIsWeekend &&
              currentSlots.length === 0 &&
              todaySlotsForSummary.length > 0 &&
              !allTodaySlotsCompleted && (
                <div className="mb-4 w-full bg-gradient-to-br from-amber-50 via-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-md relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-300/0 via-amber-300/10 to-orange-300/0 pointer-events-none" />
                  <div className="relative z-10 flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v3m0 3h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                      />
                    </svg>
                    <span>Nisu uneseni podaci za sve grupe danas.</span>
                  </div>
                </div>
              )}

            {/* Info banner za naredni čas i vikend statistiku (radni dani, nema LIVE časa) */}
            {currentSlots.length === 0 && !todayIsWeekend && nextClassInfo && timeUntilWeekend && (
              <div className="mb-4 w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 shadow-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-indigo-400/5 to-purple-400/0 pointer-events-none" />
                <div className="relative z-10 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Naredni čas i vikend</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Naredni čas</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center">
                            {getDayName(nextClassInfo.slot.dan)},{' '}
                            {(() => {
                              const d = nextClassInfo.date;
                              const day = d.getDate();
                              const monthNames = [
                                'januar',
                                'februar',
                                'mart',
                                'april',
                                'maj',
                                'jun',
                                'jul',
                                'avgust',
                                'septembar',
                                'oktobar',
                                'novembar',
                                'decembar',
                              ];
                              const month = monthNames[d.getMonth()];
                              const year = d.getFullYear();
                              return ` ${day}. ${month} ${year}`;
                            })()}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span>{formatTime(nextClassInfo.slot.slot)}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Za {nextClassInfo.days} {nextClassInfo.days === 1 ? 'dan' : 'dana'} i {nextClassInfo.hours}{' '}
                          {nextClassInfo.hours === 1 ? 'sat' : 'sati'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vikend raspored</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {totalWeekendSlots} čas{totalWeekendSlots === 1 ? '' : 'a'} • {totalWeekendHours} h nastave
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weekend Date Picker - pretraga po vikendima */}
            {nastavnaGodina && (
              <div className="mb-4 w-full">
                <WeekendDatePicker
                  selectedDate={selectedWeekendDate}
                  onDateSelect={(date) => {
                    console.log('WeekendDatePicker onDateSelect:', date);
                    if (date) {
                      const dayOfWeek = date.getDay();
                      console.log('Day of week:', dayOfWeek);
                      const day = dayOfWeek === 6 ? 'subota' : dayOfWeek === 0 ? 'nedjelja' : null;
                      if (day) {
                        console.log('Setting selectedDay to', day);
                        setSelectedDay(day);
                        setSelectedWeekendDate(date);
                      }
                    } else {
                      console.log('Date is null, resetting selectedDay');
                      setSelectedDay(null);
                      setSelectedWeekendDate(null);
                    }
                  }}
                  onResetToToday={() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dayOfWeek = today.getDay();
                    if (dayOfWeek === 6) {
                      // Ako je danas subota, postavi subotu
                      setSelectedWeekendDate(today);
                      setSelectedDay('subota');
                    } else if (dayOfWeek === 0) {
                      // Ako je danas nedjelja, postavi subotu iz istog vikenda (dan prije)
                      const saturday = new Date(today);
                      saturday.setDate(saturday.getDate() - 1);
                      setSelectedWeekendDate(saturday);
                      setSelectedDay('subota');
                    } else {
                      // Ako nije vikend, resetuj odabir
                      setSelectedWeekendDate(null);
                      setSelectedDay('subota'); // Defaultno postavi subotu
                    }
                  }}
                  startDate={new Date(nastavnaGodina.datumOd)}
                  endDate={new Date(nastavnaGodina.datumDo)}
                  casoviCounts={casoviCounts}
                />
              </div>
            )}

            {/* Legenda/Agenda */}
            <div className="mb-4 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Legenda</h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-amber-300 bg-amber-50"></div>
                  <span className="text-xs text-slate-700">Prošli časovi bez časa</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-emerald-300 bg-emerald-50"></div>
                  <span className="text-xs text-slate-700">Prošli časovi sa čason</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-blue-300 bg-blue-50"></div>
                  <span className="text-xs text-slate-700">Budući časovi</span>
                </div>
              </div>
            </div>

            {/* Calendar View - Same style as SetupNastavnaGodinaPage but single day */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Header with day labels */}
                <div className="flex border-b border-gray-200 bg-white">
                  <div className="w-16 border-r border-gray-200 px-3 py-4 bg-gray-50/50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  {(() => {
                    // Uvijek prikaži oba dana sa indikatorima
                    const subotaSlots = collectDaySlots('subota');
                    const nedjeljaSlots = collectDaySlots('nedjelja');
                    
                    return (
                      <>
                        <div className="flex-1 relative">
                          <button
                            onClick={() => setSelectedDay('subota')}
                            className={`w-full px-6 py-4 text-sm font-medium transition-all duration-200 relative ${
                              effectiveSelectedDay === 'subota'
                                ? 'bg-blue-50 text-blue-700 border-b-2 border-b-blue-600'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Subota</span>
                              {subotaSlots.length > 0 && (
                                <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-[10px] font-semibold ${
                                  effectiveSelectedDay === 'subota'
                                    ? 'bg-blue-200 text-blue-800'
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {subotaSlots.length}
                                </span>
                              )}
                            </span>
                            {effectiveSelectedDay === 'subota' && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                            )}
                          </button>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="flex-1 relative">
                          <button
                            onClick={() => setSelectedDay('nedjelja')}
                            className={`w-full px-6 py-4 text-sm font-medium transition-all duration-200 relative ${
                              effectiveSelectedDay === 'nedjelja'
                                ? 'bg-blue-50 text-blue-700 border-b-2 border-b-blue-600'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Nedjelja</span>
                              {nedjeljaSlots.length > 0 && (
                                <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-[10px] font-semibold ${
                                  effectiveSelectedDay === 'nedjelja'
                                    ? 'bg-blue-200 text-blue-800'
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {nedjeljaSlots.length}
                                </span>
                              )}
                            </span>
                            {effectiveSelectedDay === 'nedjelja' && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                            )}
                          </button>
                        </div>
                      </>
                    );
                  })()}
              </div>

                {/* Timeline container */}
                <div className="relative flex bg-white">
                  {/* Time labels column */}
                  <div className="w-16 border-r border-gray-200 bg-gray-50/30 relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                    {/* Hour lines - diskretne linije za početak svakog sata */}
                    {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => {
                      const hour = TIMELINE_START_HOUR + i;
                      const time = `${hour.toString().padStart(2, '0')}:00`;
                      const position = timeToPosition(time);
                      return (
                        <div
                          key={`hour-line-${hour}`}
                          className="absolute left-0 right-0 border-t border-gray-200"
                          style={{ top: `${position}px` }}
                        />
                      );
                    })}
                    
                    {/* Half-hour lines - diskretne linije za pola sata */}
                    {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }, (_, i) => {
                      const hour = TIMELINE_START_HOUR + i;
                      const time = `${hour.toString().padStart(2, '0')}:30`;
                      const position = timeToPosition(time);
                      return (
                        <div
                          key={`half-hour-line-${hour}`}
                          className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                          style={{ top: `${position}px` }}
                        />
                      );
                    })}
                    
                    {/* Time labels - centrirana u sredini svakog sata */}
                    {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => {
                      const hour = TIMELINE_START_HOUR + i;
                      const time = `${hour.toString().padStart(2, '0')}:00`;
                      const position = timeToPosition(time);
                      // Izračunaj poziciju za sljedeći sat da bismo dobili sredinu
                      const nextHour = hour + 1;
                      const nextTime = nextHour <= TIMELINE_END_HOUR 
                        ? `${nextHour.toString().padStart(2, '0')}:00`
                        : `${TIMELINE_END_HOUR.toString().padStart(2, '0')}:59`;
                      const nextPosition = timeToPosition(nextTime);
                      const hourHeight = nextPosition - position;
                      const centerPosition = position + (hourHeight / 2);
                      return (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 flex items-center justify-center z-10"
                          style={{ top: `${centerPosition}px`, transform: 'translateY(-50%)' }}
                        >
                          <div className="text-xs font-bold text-gray-800 bg-gray-50/30 px-1 rounded">
                            {hour}:00
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Timeline area – prikaz vikend rasporeda */}
                  <div className="flex-1 relative bg-white" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                    {/* Hour grid lines - diskretne linije za početak svakog sata */}
                    {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => {
                      const hour = TIMELINE_START_HOUR + i;
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

                    {/* Half-hour markers - diskretne linije za pola sata */}
                    {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }, (_, i) => {
                      const hour = TIMELINE_START_HOUR + i;
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

                    {/* Current time indicator */}
                    {(() => {
                      const currentPos = getCurrentTimePosition();
                      const currentDay = new Date().getDay();
                      const isCurrentDay = (currentDay === 0 && effectiveSelectedDay === 'nedjelja') || 
                                          (currentDay === 6 && effectiveSelectedDay === 'subota');
                      
                      if (currentPos !== null && isCurrentDay) {
              return (
                          <div
                            className="absolute left-0 right-0 pointer-events-none z-50"
                            style={{ top: `${currentPos}px` }}
                          >
                            <div className="absolute left-0 right-0 h-0.5 bg-red-500"></div>
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                              {new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-md"></div>
                </div>
              );
                      }
                      return null;
            })()}

                    {/* Occupied slots - prikaz oba dana; klik dozvoljen samo za trenutni vikend dan */}
                    {/* Ako je odabran datum u picker-u, prikaži samo slotove za odabrani dan, inače prikaži oba dana */}
                    {(selectedWeekendDate 
                      ? [effectiveSelectedDay]
                      : WEEKEND_DAYS
                    ).flatMap((day) =>
                      collectDaySlots(day).map((slot) => ({ ...slot, dan: day })),
                    ).map((slot, idx) => {
                      const top = timeToPosition(slot.start);
                      const height = timeToPosition(slot.end) - top;
                      const isOverlap = !!slot.hasOverlap;
                      const columns = slot.stackCount ?? 1;
                      const index = slot.stackIndex ?? 0;
                      const widthPct = 100 / columns;
                      const leftPct = widthPct * index;
                      const margin = 2;
                      const isActive = currentSlots.some((s) => s.id === slot.item.id);
                      const isSlotOnSelectedDay = slot.item.dan === effectiveSelectedDay;
                      const isTodaySlot = !!todayWeekendDay && slot.item.dan === todayWeekendDay;
                      // Izračunaj tačan datum za ovaj slot na osnovu pickera
                      let slotDate: Date;
                      if (selectedWeekendDate) {
                        const selectedDayOfWeek = selectedWeekendDate.getDay();
                        const slotDay = slot.item.dan === 'subota' ? 6 : 0;
                        
                        if (selectedDayOfWeek === slotDay) {
                          // Slot je za isti dan kao odabrani datum - koristi tačan datum
                          slotDate = new Date(selectedWeekendDate);
                          slotDate.setHours(0, 0, 0, 0);
                        } else if (slotDay === 6 && selectedDayOfWeek === 0) {
                          // Slot je za subotu, a odabrana je nedjelja - vrati subotu prije
                          slotDate = new Date(selectedWeekendDate);
                          slotDate.setDate(slotDate.getDate() - 1);
                          slotDate.setHours(0, 0, 0, 0);
                        } else if (slotDay === 0 && selectedDayOfWeek === 6) {
                          // Slot je za nedjelju, a odabrana je subota - vrati nedjelju poslije
                          slotDate = new Date(selectedWeekendDate);
                          slotDate.setDate(slotDate.getDate() + 1);
                          slotDate.setHours(0, 0, 0, 0);
                        } else {
                          // Fallback
                          slotDate = getSlotDate(slot.item.dan as 'subota' | 'nedjelja');
                        }
                      } else {
                        slotDate = getSlotDate(slot.item.dan as 'subota' | 'nedjelja');
                      }
                      
                      const isPastSlot = isSlotPast(slot.item, slotDate);
                      const canOpenDrawerForSlot =
                        isPastSlot || (isTodaySlot && isSlotStartedToday(slot.item));
                      
                      // Provjeri da li postoji čas za specifičan datum i slot
                      // Koristi format koji ne ovisi o vremenskoj zoni
                      const formatDateForAPI = (date: Date): string => {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      };
                      const dateISO = formatDateForAPI(slotDate);
                      const casKey = `${slot.item.id}-${dateISO}`;
                      const isCompletedSlot = casExistsMap.get(casKey) ?? false;

                      // Boje na osnovu statusa casa
                      const getSlotStyle = () => {
                        if (isActive) {
                          // Active slot - darker blue with very thin border
                          return 'bg-blue-600 border-[0.5px] border-blue-500/30 text-white shadow-lg';
                        }

                        // Prošli casovi bez casa - žuti
                        if (isPastSlot && !isCompletedSlot) {
                          return isOverlap
                            ? 'bg-amber-50 border-[0.5px] border-amber-200/50 text-amber-900 shadow-sm ring-1 ring-amber-300/60'
                            : 'bg-amber-50 border-[0.5px] border-amber-200/50 text-amber-900';
                        }

                        // Prošli casovi sa casom - zeleni
                        if (isPastSlot && isCompletedSlot) {
                          return isOverlap
                            ? 'bg-emerald-50 border-[0.5px] border-emerald-200/50 text-emerald-900 shadow-sm ring-1 ring-emerald-300/60'
                            : 'bg-emerald-50 border-[0.5px] border-emerald-200/50 text-emerald-900';
                        }

                        // Budući casovi - plavi
                        const base =
                          isOverlap
                            ? 'bg-blue-100 border-[0.5px] border-blue-300/50 text-blue-900 shadow-sm ring-0.5 ring-blue-300/50'
                            : 'bg-blue-50 border-[0.5px] border-blue-200/50 text-blue-900/90';

                        return isSlotOnSelectedDay ? base : `${base} opacity-55`;
                      };

                      const actualWidth = `calc(${widthPct}% - ${margin * 2}px)`;
                      const actualLeft = `calc(${leftPct}% + ${margin}px)`;

                      return (
                        <button
                          key={`slot-${slot.dan}-${idx}`}
                          type="button"
                          onClick={() => {
                            if (!canOpenDrawerForSlot) return;
                            setSelectedSlotForDrawer(slot.item);
                            setShowCasDrawer(true);
                            // Spremi datum za drawer
                            setSelectedSlotDate(slotDate);
                          }}
                          className={`absolute rounded-md ${getSlotStyle()} ${getLeftBorderClass(isActive, isPastSlot, isCompletedSlot)} px-3 py-2 text-[14px] font-medium text-left ${
                            canOpenDrawerForSlot 
                              ? 'cursor-pointer hover:shadow-md transition-shadow' 
                              : 'cursor-not-allowed opacity-60'
                          }`}
                          disabled={!canOpenDrawerForSlot}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 34)}px`,
                            left: actualLeft,
                            width: actualWidth,
                            minHeight: '34px',
                            zIndex: isActive ? 40 : (isOverlap ? 15 : 10),
                          }}
                          title={`${slot.start} - ${slot.end} • ${slot.label}`}
                        >
                          <div className="flex items-center justify-between h-full gap-2 w-full">
                            <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                              <div className={`flex items-center gap-2 text-[13px] font-bold leading-tight ${isActive ? 'text-white' : ''}`}>
                                {/* Vrijeme i dan */}
                                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                  <span className={`truncate font-bold ${isActive ? 'text-white' : ''}`}>{slot.start} - {slot.end}</span>
                                  <div className={`text-[11px] font-normal whitespace-nowrap flex-shrink-0 ${isActive ? 'text-white/90' : 'opacity-80'}`}>
                                    • {formatSlotDate(slotDate)}
                                  </div>
                                </div>
                      </div>
                              {height >= 32 && (
                                <>
                                  <div className={`flex items-center gap-1.5 text-[13px] font-normal leading-tight truncate mt-0.5 ${isActive ? 'text-white/90' : 'opacity-90'}`}>
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    {slot.label}
                                  </div>
                                  {slot.item.lokacija && (
                                    <div className={`flex items-center gap-1 text-[13px] font-normal leading-tight truncate mt-0.5 ${isActive ? 'text-white/80' : 'opacity-75'}`}>
                                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      {slot.item.lokacija === 'divanhana' ? 'Divanhana' : slot.item.lokacija === 'ucionica' ? 'Učionica' : slot.item.lokacija}
                    </div>
                                  )}
                                </>
                              )}
                              {height < 30 && (
                                <div className={`text-[13px] font-normal leading-tight truncate ${isActive ? 'text-white/80' : 'opacity-75'}`}>
                                  {slot.label.split(' • ')[0]}
                                </div>
                        )}
                            </div>
                            {/* Badge na desnoj strani */}
                            <div className="flex-shrink-0 flex flex-col items-end gap-1">
                              {/* Badge za prošle termine bez casa */}
                              {isPastSlot && !isCompletedSlot && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Nema časa
                                </span>
                              )}
                              {/* Badge za termine sa casom */}
                              {isCompletedSlot && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Čas dodan
                                </span>
                              )}
                            </div>
                    </div>
                  </button>
                );
              })}

            </div>
          </div>
            </div>
      </div>
        </div>

        {/* Right Side - Sidebar with Details (40%) */}
        <div className="flex-[40] bg-white rounded-xl shadow-sm border border-slate-200 overflow-y-auto">
          <div className="p-6">
            {nastavnaGodina ? (
              <>
                {/* Nastavna Godina Header */}
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">{nastavnaGodina.naziv}</h2>
                  <p className="text-sm text-slate-500">{nastavnaGodina.nastavniPlan.naziv}</p>
                </div>

                {/* Progress */}
                <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">Napredak godine</span>
                    <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                  </div>
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>{formatDate(nastavnaGodina.datumOd)}</span>
                    <span>{formatDate(nastavnaGodina.datumDo)}</span>
                  </div>
                </div>

                {/* Statistics */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Statistike</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-2xl font-bold text-gray-900">{statistike.ukupnoRazreda}</div>
                          <div className="text-xs text-gray-600 mt-0.5 font-medium">Razreda</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-2xl font-bold text-gray-900">{statistike.ukupnoUcenika}</div>
                          <div className="text-xs text-gray-600 mt-0.5 font-medium">Učenika</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-2xl font-bold text-gray-900">{statistike.ukupnoGrupa}</div>
                          <div className="text-xs text-gray-600 mt-0.5 font-medium">Grupa</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-2xl font-bold text-gray-900">{getTotalWeeklyHours()}</div>
                          <div className="text-xs text-gray-600 mt-0.5 font-medium">Sati/sedmici</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Razredi */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Razredi</h3>
                  {razredi.length === 0 ? (
                    <p className="text-slate-400 text-center py-8 text-sm">Nema dodijeljenih razreda</p>
                  ) : (
                    <div className="space-y-3">
                      {razredi.map((razred) => {
                        const info = getIlmihalInfo(razred.razred.ilmihal);
                        return (
                          <div
                            key={razred.id}
                            className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-lg font-bold text-gray-900">{razred.razred.name}</div>
                              <div className={`inline-flex text-xs px-3 py-1 rounded-full border font-semibold ${info.color}`}>
                                {info.label}
                              </div>
                            </div>
                            
                            {/* Grupe */}
                            <div className="space-y-2">
                              {razred.grupe.map((grupa, idx) => {
                                const programBadges = [];
                                if (grupa.kuran) programBadges.push('Kuran');
                                if (grupa.sufara) programBadges.push('Sufara');
                                const groupSlots = allSlotsForStats.filter((item) => item.grupa.id === grupa.id);
                                
                                return (
                                  <div
                                    key={grupa.id || idx}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-900">
                                          {grupa.naziv === 'A' ? 'Grupa 1' : grupa.naziv === 'B' ? 'Grupa 2' : `Grupa ${grupa.naziv}`}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          <span className="text-xs text-gray-600 font-medium">
                                            {grupa.brojUcenika} {grupa.brojUcenika === 1 ? 'dijete' : 'djece'}
                                          </span>
                                          {programBadges.length > 0 && (
                                            <>
                                              <span className="text-gray-300">•</span>
                                              <div className="flex items-center gap-1.5">
                                                {grupa.kuran && (
                                                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                                    Kuran
                                                  </span>
                                                )}
                                                {grupa.sufara && (
                                                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold">
                                                    Sufara
                                                  </span>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {groupSlots.length > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-gray-600 ml-3 whitespace-nowrap">
                                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="font-semibold">
                                          {groupSlots
                                            .map((slot) => `${getDayName(slot.dan)} ${formatTime(slot.slot)}-${getEndTime(slot.slot, slot.trajanje)}`)
                                            .join(' | ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
          </div>
        )}
                </div>
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <p className="text-amber-800 text-sm">Nema aktivne nastavne godine</p>
          </div>
        )}
      </div>
        </div>
      </div>

      <CasEntryDrawer
        open={showCasDrawer}
        slot={selectedSlotForDrawer}
        slotDate={selectedSlotDate}
        onClose={() => {
          setShowCasDrawer(false);
          setSelectedSlotForDrawer(null);
          setSelectedSlotDate(null);
        }}
        onSave={async () => {
          // Nakon spremanja, osvježi mapu casova
          if (selectedSlotForDrawer && selectedSlotDate) {
            const dateISO = selectedSlotDate.toISOString().split('T')[0];
            const key = `${selectedSlotForDrawer.id}-${dateISO}`;
            setCasExistsMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(key, true);
              return newMap;
            });
          }
          // Također osvježi dashboard podatke
          await fetchDashboardData();
        }}
      />
    </div>
  );
}
