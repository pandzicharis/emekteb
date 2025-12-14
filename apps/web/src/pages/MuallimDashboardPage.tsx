import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

interface RasporedItem {
  id: string;
  grupa: {
    id: string;
    naziv: string;
    razred: Razred;
    kuran: boolean;
    sufara: boolean;
    brojUcenika: number;
  };
  dan: string;
  slot: string;
  lokacija: string | null;
  trajanje: number;
  startTime: string;
  endTime: string;
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
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<'subota' | 'nedjelja' | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Auto-select today's day if it's weekend
  useEffect(() => {
    if (isTodayWeekend() && !selectedDay) {
      const today = new Date().getDay();
      const todayDay = today === 0 ? 'nedjelja' : 'subota';
      setSelectedDay(todayDay);
    }
  }, []);

  // Update current time every second for timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const [showCasModal, setShowCasModal] = useState(false);
  const [selectedSlotForModal, setSelectedSlotForModal] = useState<RasporedItem | null>(null);
  const [casFormData, setCasFormData] = useState({
    lekcija: '',
    napomene: '',
    prisutniUcenici: [] as string[],
  });

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDay]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = selectedDay ? { dan: selectedDay } : {};
      const response = await axios.get(`${API_URL}/muallimi/dashboard`, { params });
      // Debug: ispiši šta dolazi iz baze
      console.log('Dashboard data:', response.data);
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
  };

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
        const label = `${item.grupa.razred.name}${item.grupa.naziv !== 'A' ? ` • Grupa ${item.grupa.naziv}` : ''}`;
        
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

  const isTodayWeekend = () => {
    const today = new Date();
    const day = today.getDay();
    return day === 0 || day === 6; // 0 = nedjelja, 6 = subota
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

  const getWeekendCount = (): number => {
    if (!nastavnaGodina) return 0;
    
    const start = new Date(nastavnaGodina.datumOd);
    start.setHours(0, 0, 0, 0);
    const end = new Date(nastavnaGodina.datumDo);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const checkDate = now < end ? now : end;
    
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
                    <div className="text-xs text-gray-500 mt-1">
                      {getWeekendCount()}. vikend od početka nastavne godine
                    </div>
                    {!isTodayWeekend() && (
                      <div className="text-xs text-blue-600 font-medium mt-1">
                        {getDaysUntilNextWeekend()} {getDaysUntilNextWeekend() === 1 ? 'dan' : 'dana'} do sljedećeg vikenda
                      </div>
                    )}
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
                              setSelectedSlotForModal(slot);
                              setShowCasModal(true);
                            }}
                            className="bg-white/80 backdrop-blur-sm border border-blue-200 rounded-lg p-4 hover:bg-white hover:shadow-md transition-all text-left"
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

            {/* Calendar View - Same style as SetupNastavnaGodinaPage but single day */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Header with day labels */}
                <div className="flex border-b border-gray-200 bg-white">
                  <div className="w-16 border-r border-gray-200 px-3 py-4 bg-gray-50/50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => setSelectedDay('subota')}
                      className={`w-full px-6 py-4 text-sm font-medium transition-all duration-200 ${
                        (selectedDay || odabraniDan) === 'subota'
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
                </div>
                  <div className="flex-1 border-l border-gray-200">
                    <button
                      onClick={() => setSelectedDay('nedjelja')}
                      className={`w-full px-6 py-4 text-sm font-medium transition-all duration-200 ${
                        (selectedDay || odabraniDan) === 'nedjelja'
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
                  {/* Time labels column */}
                  <div className="w-16 border-r border-gray-200 bg-gray-50/30 relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                    {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => {
                      const hour = TIMELINE_START_HOUR + i;
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

                  {/* Timeline area for selected day only */}
                  <div className="flex-1 relative bg-white" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                    {/* Hour grid lines */}
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

                    {/* Half-hour markers */}
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
                      const isCurrentDay = (currentDay === 0 && (selectedDay || odabraniDan) === 'nedjelja') || 
                                          (currentDay === 6 && (selectedDay || odabraniDan) === 'subota');
                      
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

                    {/* Occupied slots - with ILMIHAL colors */}
                    {collectDaySlots(selectedDay || odabraniDan).map((slot, idx) => {
                      const top = timeToPosition(slot.start);
                      const height = timeToPosition(slot.end) - top;
                      const isOverlap = !!slot.hasOverlap;
                      const columns = slot.stackCount ?? 1;
                      const index = slot.stackIndex ?? 0;
                      const widthPct = 100 / columns;
                      const leftPct = widthPct * index;
                      const margin = 2;
                      const isActive = currentSlots.some(s => s.id === slot.item.id);
                      const info = getIlmihalInfo(slot.item.grupa.razred.ilmihal);

                      // Use light blue colors for all slots (like SetupNastavnaGodinaPage)
                      const getSlotStyle = () => {
                        if (isActive) {
                          // Active slot - darker blue with very thin border
                          return 'bg-blue-600 border border-blue-500/30 text-white shadow-lg';
                        }
                        
                        // Normal slot - light blue colors
                        return isOverlap
                          ? 'bg-blue-100 border-[0.5px] border-blue-300 text-blue-900 shadow-sm ring-0.5 ring-blue-300/50'
                          : 'bg-blue-50 border-[0.5px] border-blue-200 text-blue-900/90';
                      };

                      const actualWidth = `calc(${widthPct}% - ${margin * 2}px)`;
                      const actualLeft = `calc(${leftPct}% + ${margin}px)`;

                return (
                  <div
                          key={`slot-${selectedDay || odabraniDan}-${idx}`}
                          className={`absolute rounded-md border-[0.5px] ${getSlotStyle()} px-3 py-2 text-[14px] font-medium`}
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
                          <div className="flex items-center justify-between h-full gap-1">
                            <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                              <div className={`flex items-center gap-1 text-[13px] font-bold leading-tight truncate ${isActive ? 'text-white' : ''}`}>
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {slot.start} - {slot.end}
                      </div>
                              {height >= 32 && (
                                <>
                                  <div className={`flex items-center gap-1 text-[13px] font-normal leading-tight truncate mt-0.5 ${isActive ? 'text-white/90' : 'opacity-90'}`}>
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
                    </div>
                  </div>
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

      {/* Modal za unos detalja o trenutnom casu */}
      {showCasModal && selectedSlotForModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detalji o času</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedSlotForModal.grupa.razred.name} - Grupa {selectedSlotForModal.grupa.naziv} • {formatTime(selectedSlotForModal.slot)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCasModal(false);
                  setSelectedSlotForModal(null);
                  setCasFormData({ lekcija: '', napomene: '', prisutniUcenici: [] });
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Lekcija */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lekcija *
                </label>
                <input
                  type="text"
                  value={casFormData.lekcija}
                  onChange={(e) => setCasFormData(prev => ({ ...prev, lekcija: e.target.value }))}
                  placeholder="Unesite naziv lekcije..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Napomene */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Napomene
                </label>
                <textarea
                  value={casFormData.napomene}
                  onChange={(e) => setCasFormData(prev => ({ ...prev, napomene: e.target.value }))}
                  placeholder="Dodatne napomene o času..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Prisutni učenici */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Prisutni učenici
                </label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto bg-gray-50">
                  {selectedSlotForModal.grupa.brojUcenika === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Nema učenika u ovoj grupi</p>
                  ) : (
                    <div className="space-y-2">
                      {/* TODO: Ovdje će se prikazati lista učenika kada API vrati podatke */}
                      <p className="text-sm text-gray-500">Lista učenika će se učitati...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCasModal(false);
                    setSelectedSlotForModal(null);
                    setCasFormData({ lekcija: '', napomene: '', prisutniUcenici: [] });
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Odustani
                </button>
                <button
                  onClick={async () => {
                    // TODO: Implementirati spremanje podataka
                    console.log('Spremanje detalja o casu:', casFormData);
                    setShowCasModal(false);
                    setSelectedSlotForModal(null);
                    setCasFormData({ lekcija: '', napomene: '', prisutniUcenici: [] });
                  }}
                  disabled={!casFormData.lekcija.trim()}
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Spremi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
