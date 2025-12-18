import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

type ViewType = 'month' | 'week' | 'day';

interface Cas {
  id: string | null;
  datum: string;
  tipovi: string[];
  napomena: string | null;
  kreiran: string | null;
  raspored: {
    id: string;
    dan: string;
    slot: string;
    lokacija: string | null;
    trajanje: number;
    grupa: {
      id: string;
      naziv: string;
      razred: {
        id: string;
        name: string;
        ilmihal: string;
      };
    };
  };
  lekcije: Array<{ id: string; naslov: string }>;
  prisustva: Array<{
    ucenikId: string;
    status: string;
    ucenik: {
      ime: string;
      prezime: string;
    };
  }>;
  imaCas: boolean;
}

interface NastavnaGodina {
  id: string;
  naziv: string;
  datumOd: string;
  datumDo: string;
}

export default function CasoviPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [casovi, setCasovi] = useState<Cas[]>([]);
  const [nastavnaGodina, setNastavnaGodina] = useState<NastavnaGodina | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCas, setSelectedCas] = useState<Cas | null>(null);

  // Helper: pronađi subotu za dati datum (uvijek ide unazad do prošle subote)
  const getSaturdayForDate = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  };

  // Helper: jača boja po ilmihalu (za vertikalnu liniju unutar slota – isti princip kao na MuallimDashboardPage)
  const getIlmihalAccentClass = (ilmihal: string) => {
    const normalized = (ilmihal || '').trim().toUpperCase();

    if (normalized === 'ILMIHAL_I' || normalized === 'ILMIHAL I' || normalized.includes('ILMIHAL I')) {
      return 'bg-emerald-500';
    }
    if (normalized === 'ILMIHAL_II' || normalized === 'ILMIHAL II' || normalized.includes('ILMIHAL II')) {
      return 'bg-purple-500';
    }
    if (normalized === 'ILMIHAL_III' || normalized === 'ILMIHAL III' || normalized.includes('ILMIHAL III')) {
      return 'bg-amber-500';
    }

    return 'bg-blue-500';
  };

  // Timeline constants (kao u MuallimDashboardPage)
  const TIMELINE_START_HOUR = 8; // 08:00
  const TIMELINE_END_HOUR = 15; // 15:00 (16:00 se ne prikazuje jer nema nastave)
  const TIMELINE_HEIGHT = 700; // px - increased to accommodate slots ending at 15:00

  // Helper functions for timeline (kao u MuallimDashboardPage)
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const timeToPosition = (time: string): number => {
    const totalMinutes = timeToMinutes(time);
    const startMinutes = TIMELINE_START_HOUR * 60;
    // Use 15:59 as end to ensure slots ending at 15:00 are fully visible
    const endMinutes = TIMELINE_END_HOUR * 60 + 59;
    const range = endMinutes - startMinutes;
    const position = ((totalMinutes - startMinutes) / range) * TIMELINE_HEIGHT;
    return Math.max(0, Math.min(TIMELINE_HEIGHT, position));
  };

  // Generiši osnovnu boju prema statusu slota:
  // - budući slotovi: plavi
  // - prošli slotovi sa časom: zeleni
  // - prošli slotovi bez časa: žuti
  const getSlotStatusClass = (slotDate: Date, cas: Cas, variant: 'chip' | 'block' = 'block') => {
    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + cas.raspored.trajanje);

    const isPast = end < now;

    if (isPast) {
      if (cas.imaCas) {
        // Prošli sa časom – zeleni
        return variant === 'chip'
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
          : 'bg-emerald-50 border border-emerald-200 text-emerald-900';
      }
      // Prošli bez časa – žuti
      return variant === 'chip'
        ? 'bg-amber-50 border border-amber-200 text-amber-900'
        : 'bg-amber-50 border border-amber-200 text-amber-900';
    }

    // Budući slotovi – plavi
    return variant === 'chip'
      ? 'bg-blue-50 border border-blue-200 text-blue-900'
      : 'bg-blue-50 border border-blue-200 text-blue-900';
  };

  // Helper za lijevi border (deblji i jača nijansa)
  const getLeftBorderClass = (slotDate: Date, cas: Cas) => {
    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + cas.raspored.trajanje);

    const isPast = end < now;

    if (isPast) {
      if (cas.imaCas) {
        // Prošli sa časom – zeleni border
        return 'border-l-4 border-l-emerald-500';
      }
      // Prošli bez časa – žuti border
      return 'border-l-4 border-l-amber-400';
    }

    // Budući slotovi – plavi border
    return 'border-l-4 border-l-blue-400';
  };

  // Helper za boju eventa u modal-u
  const getEventColor = (cas: Cas) => {
    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const slotDate = new Date(cas.datum);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + cas.raspored.trajanje);

    const isPast = end < now;

    if (isPast) {
      if (cas.imaCas) {
        return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
      }
      return { bg: 'bg-amber-100', text: 'text-amber-600' };
    }

    return { bg: 'bg-blue-100', text: 'text-blue-600' };
  };

  // Izračunaj opseg datuma na osnovu view-a i trenutnog datuma (samo vikend dani)
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'month') {
      // Prvi dan mjeseca
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // Posljednji dan mjeseca
      const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setDate(lastDay.getDate());
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      // Koristi helper da dobiješ subotu za trenutni datum
      const saturday = getSaturdayForDate(start);
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      start.setTime(saturday.getTime());
      end.setTime(sunday.getTime());
      end.setHours(23, 59, 59, 999);
    } else {
      // Dnevni prikaz - ako nije vikend, pomjeri se na prošlu subotu
      const saturday = getSaturdayForDate(start);
      start.setTime(saturday.getTime());
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [view, currentDate]);

  // Grupiraj časove po datumu - koristi YYYY-MM-DD format
  const casoviByDate = useMemo(() => {
    const map = new Map<string, Cas[]>();
    casovi.forEach((cas) => {
      // Koristi datum direktno (već je YYYY-MM-DD format iz API-ja)
      const dateKey = cas.datum;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(cas);
    });
    return map;
  }, [casovi]);

  // Dohvati sve slotove za nastavnu godinu (jednom, ne ovisno o view-u)
  useEffect(() => {
    const fetchCasovi = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`${API_URL}/cas/muallim/range`);
        
        console.log('Received data:', response.data);
        if (response.data) {
          setNastavnaGodina(response.data.nastavnaGodina || null);
          setCasovi(response.data.casovi || []);
          
          // Postavi currentDate na prvi vikend dan nastavne godine ako je dostupna
          if (response.data.nastavnaGodina) {
            const start = new Date(response.data.nastavnaGodina.datumOd);
            const day = start.getDay();
            if (day !== 6 && day !== 0) {
              // Ako nije vikend, idi na prvu subotu
              const diff = 6 - day;
              start.setDate(start.getDate() + diff);
            }
            setCurrentDate(start);
          }
        }
      } catch (err: any) {
        console.error('Error fetching casovi:', err);
        setError(err.response?.data?.message || 'Greška pri učitavanju časova');
        setCasovi([]);
        setNastavnaGodina(null);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCasovi();
    }
  }, [user]);

  // Kada se prebaci na prikaz dana, postavi najbližu subotu
  useEffect(() => {
    if (view === 'day') {
      const saturday = getSaturdayForDate(new Date());
      setCurrentDate(saturday);
    }
  }, [view]);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (!nastavnaGodina) return;
    
    const newDate = new Date(currentDate);

    // Sirovi početak/kraj nastavne godine
    const nastavnaStart = new Date(nastavnaGodina.datumOd);
    nastavnaStart.setHours(0, 0, 0, 0);
    const nastavnaEnd = new Date(nastavnaGodina.datumDo);
    nastavnaEnd.setHours(23, 59, 59, 999);

    // Efektivni vikend-opseg:
    // - prvi dan koji se smije filtrirati: PRVA SUBOTA nakon (ili na) početku nastavne godine
    // - zadnji dan koji se smije filtrirati: ZADNJA NEDJELJA prije (ili na) kraju nastavne godine
    const weekendStart = new Date(nastavnaStart);
    while (weekendStart.getDay() !== 6) {
      weekendStart.setDate(weekendStart.getDate() + 1);
    }

    const weekendEnd = new Date(nastavnaEnd);
    while (weekendEnd.getDay() !== 0) {
      weekendEnd.setDate(weekendEnd.getDate() - 1);
    }
    
    if (direction === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ako je već vikend, koristi taj dan
      let target = new Date(today);
      if (today.getDay() !== 6 && today.getDay() !== 0) {
        // Nađi prošlu i sljedeću subotu, pa izaberi bližu
        const prevSaturday = getSaturdayForDate(today);
        const nextSaturday = new Date(prevSaturday);
        nextSaturday.setDate(nextSaturday.getDate() + 7);

        const diffPrev = Math.abs(today.getTime() - prevSaturday.getTime());
        const diffNext = Math.abs(nextSaturday.getTime() - today.getTime());
        target = diffPrev <= diffNext ? prevSaturday : nextSaturday;
      }

      // Ograniči na efektivni vikend-opseg nastavne godine
      if (target < weekendStart) {
        setCurrentDate(weekendStart);
      } else if (target > weekendEnd) {
        setCurrentDate(weekendEnd);
      } else {
        setCurrentDate(target);
      }
    } else if (direction === 'prev') {
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
        // Ograniči na mjesec koji još pripada opsegu vikenda
        if (newDate < weekendStart) {
          newDate.setTime(weekendStart.getTime());
        }
      } else if (view === 'week') {
        // Idi na prethodni vikend (uvijek -7 dana od trenutne subote)
        const saturday = getSaturdayForDate(newDate);
        saturday.setDate(saturday.getDate() - 7);
        newDate.setTime(saturday.getTime());
        // Ograniči na efektivni vikend-opseg
        if (newDate < weekendStart) {
          newDate.setTime(weekendStart.getTime());
        }
      } else {
        // Dnevni prikaz: prikazujemo SAMO SUBOTE – pomjeri subotu za 7 dana unazad
        const saturday = getSaturdayForDate(newDate);
        saturday.setDate(saturday.getDate() - 7);
        newDate.setTime(saturday.getTime());
        // Ograniči na efektivni vikend-opseg
        if (newDate < weekendStart) {
          newDate.setTime(weekendStart.getTime());
        }
      }
      setCurrentDate(newDate);
    } else {
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
        // Ograniči na mjesec koji još pripada opsegu vikenda
        if (newDate > weekendEnd) {
          newDate.setTime(weekendEnd.getTime());
        }
      } else if (view === 'week') {
        // Idi na sljedeći vikend (uvijek +7 dana od trenutne subote)
        const saturday = getSaturdayForDate(newDate);
        saturday.setDate(saturday.getDate() + 7);
        newDate.setTime(saturday.getTime());
        // Ograniči na efektivni vikend-opseg
        if (newDate > weekendEnd) {
          newDate.setTime(weekendEnd.getTime());
        }
      } else {
        // Dnevni prikaz: prikazujemo SAMO SUBOTE – pomjeri subotu za 7 dana naprijed
        const saturday = getSaturdayForDate(newDate);
        saturday.setDate(saturday.getDate() + 7);
        newDate.setTime(saturday.getTime());
        // Ograniči na efektivni vikend-opseg
        if (newDate > weekendEnd) {
          newDate.setTime(weekendEnd.getTime());
        }
      }
      setCurrentDate(newDate);
    }
  };

  const formatMonthYear = (date: Date) => {
    const months = [
      'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
      'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatWeekRange = (date: Date) => {
    // Koristi isti helper kao i za week view
    const saturday = getSaturdayForDate(date);
    const sunday = new Date(saturday);
    sunday.setDate(sunday.getDate() + 1);
    
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
    const startStr = `${saturday.getDate()}. ${months[saturday.getMonth()]}`;
    const endStr = `${sunday.getDate()}. ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  };

  const formatDay = (date: Date) => {
    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    const months = [
      'januar', 'februar', 'mart', 'april', 'maj', 'jun',
      'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'
    ];
    return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getDateTitle = () => {
    if (view === 'month') return formatMonthYear(currentDate);
    if (view === 'week') return formatWeekRange(currentDate);
    return formatDay(currentDate);
  };

  const getNavigationLabel = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      return direction === 'prev' ? 'Prethodni mjesec' : 'Sljedeći mjesec';
    }
    if (view === 'week') {
      return direction === 'prev' ? 'Prethodni vikend' : 'Sljedeći vikend';
    }
    // day view
    return direction === 'prev' ? 'Prethodna subota' : 'Sljedeća subota';
  };


  // Render mjesečni prikaz - samo vikend dani
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Pronađi sve subote i nedjelje u mjesecu
    const weekendDays: Date[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 6 || dayOfWeek === 0) { // 6 = subota, 0 = nedjelja
        weekendDays.push(date);
      }
    }

    // Grupiši po vikendima (subota + nedjelja)
    const weekends: Date[][] = [];
    for (let i = 0; i < weekendDays.length; i++) {
      const day = weekendDays[i];
      const dayOfWeek = day.getDay();
      
      if (dayOfWeek === 6) { // Subota
        // Provjeri da li postoji nedjelja sljedećeg dana
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        if (nextDay.getMonth() === month && nextDay.getDay() === 0) {
          weekends.push([day, nextDay]);
          i++; // Preskoči nedjelju jer smo je već dodali
        } else {
          weekends.push([day]);
        }
      } else if (dayOfWeek === 0) { // Nedjelja
        weekends.push([day]);
      }
    }

    return (
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-50">
        <div className="grid grid-cols-2 border-b-2 border-gray-300 bg-gradient-to-b from-gray-50 to-white sticky top-0 z-10 shadow-sm h-16">
          <div className="h-16 text-center text-sm font-semibold text-gray-700 border-r border-gray-300 uppercase tracking-wide flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Subota
          </div>
          <div className="h-16 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Nedjelja
          </div>
        </div>
        <div className="grid grid-cols-2 auto-rows-fr">
          {weekends.flatMap((weekend, weekendIdx) =>
            [0, 1].map((dayIdx) => {
              const date = weekend[dayIdx];

              // Ako nema datuma (npr. nema nedjelje u zadnjem vikendu), prikaži praznu ali potpuno jednaku ćeliju
              if (!date) {
                return (
                  <div
                    key={`empty-${weekendIdx}-${dayIdx}`}
                    className="min-h-[120px] border-b border-r border-gray-200 bg-gray-50"
                  />
                );
              }

              const year = date.getFullYear();
              const monthStr = String(date.getMonth() + 1).padStart(2, '0');
              const dayStr = String(date.getDate()).padStart(2, '0');
              const dateKey = `${year}-${monthStr}-${dayStr}`;

              const allDayCasovi = casoviByDate.get(dateKey) || [];
              const dayOfWeek = date.getDay();
              const expectedDan = dayOfWeek === 6 ? 'subota' : dayOfWeek === 0 ? 'nedjelja' : null;
              const dayCasovi = expectedDan
                ? allDayCasovi.filter((cas) => cas.raspored.dan === expectedDan)
                : [];

              const isToday = date.toDateString() === new Date().toDateString();
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const dayName = dayOfWeek === 6 ? 'Subota' : 'Nedjelja';

              return (
                <div
                  key={dateKey}
                  className={`min-h-[120px] border-b border-r border-gray-200 p-3 transition-colors ${
                    isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50'
                  } ${isToday ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="mb-3 flex items-baseline gap-1.5">
                    <div
                      className={`text-xl font-bold ${
                        isToday
                          ? 'text-blue-600'
                          : isCurrentMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div
                      className={`text-xs font-light ${
                        isToday
                          ? 'text-blue-500'
                          : isCurrentMonth
                          ? 'text-gray-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'][date.getMonth()]}
                    </div>
                  </div>
                      <div className="space-y-1.5">
                    {dayCasovi.slice(0, 5).map((cas) => {
                      const [h, m] = cas.raspored.slot.split(':').map(Number);
                      const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      const totalEndMinutes = m + cas.raspored.trajanje;
                      const endHours = h + Math.floor(totalEndMinutes / 60);
                      const endMins = totalEndMinutes % 60;
                      const endTime = `${String(endHours).padStart(2, '0')}:${String(
                        endMins,
                      ).padStart(2, '0')}`;
                          const duration = cas.raspored.trajanje;
                          const statusClass = getSlotStatusClass(date, cas, 'chip');
                      const grupaLabel =
                        cas.raspored.grupa.naziv === 'A'
                          ? 'Grupa 1'
                          : cas.raspored.grupa.naziv === 'B'
                          ? 'Grupa 2'
                          : `Grupa ${cas.raspored.grupa.naziv}`;

                      return (
                        <button
                          key={cas.id || cas.raspored.id}
                          onClick={() => setSelectedCas(cas)}
                          className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${statusClass} ${getLeftBorderClass(date, cas)} ${
                            cas.imaCas ? 'font-medium hover:shadow-md' : 'font-normal hover:shadow-sm'
                          }`}
                          title={`${startTime} - ${endTime} • ${cas.raspored.grupa.razred.name} ${grupaLabel}${cas.raspored.lokacija ? ` • ${cas.raspored.lokacija}` : ''}`}
                        >
                          <div className="space-y-1">
                            {/* Početak - Završetak */}
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-semibold">
                                {startTime} - {endTime}
                              </span>
                            </div>
                            {/* Grupa */}
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              <span className="truncate">
                                {cas.raspored.grupa.razred.name} {grupaLabel}
                              </span>
                            </div>
                            {/* Lokacija */}
                            {cas.raspored.lokacija && (
                              <div className="flex items-center gap-1.5">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate text-[10px]">
                                  {cas.raspored.lokacija === 'divanhana' ? 'Divanhana' : cas.raspored.lokacija === 'ucionica' ? 'Učionica' : cas.raspored.lokacija}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {dayCasovi.length > 5 && (
                      <button
                        onClick={() => {
                          const allForDay = dayCasovi;
                          if (allForDay.length > 0) {
                            setSelectedCas(allForDay[0]);
                          }
                        }}
                        className="w-full text-left text-[10px] text-gray-600 hover:text-gray-900 px-2 py-1 font-medium"
                      >
                        +{dayCasovi.length - 5} više termina
                      </button>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    );
  };

  // Render sedmični prikaz - samo vikend dani (subota i nedjelja)
  const renderWeekView = () => {
    // Pronađi subotu za trenutni datum (uvijek ista logika)
    const saturday = getSaturdayForDate(currentDate);
    saturday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    sunday.setHours(0, 0, 0, 0);
    
    const days = [saturday, sunday];
    
    return (
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-50">
        {/* Header sa danima (mali, sticky) */}
        <div className="flex bg-gradient-to-b from-gray-50 to-white sticky top-0 z-10 shadow-sm h-16 border-b-[3px] border-gray-300">
          <div className="w-20 h-16 border-r border-gray-300 bg-gray-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {days.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayName = idx === 0 ? 'Subota' : 'Nedjelja';
            return (
              <div
                key={idx}
                className={`flex-1 border-b-2 h-16 border-r border-gray-200 last:border-r-0 flex flex-col items-center justify-center ${
                  isToday ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {dayName}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline tijelo: lijevo vrijeme, desno dani */}
        <div className="flex bg-white">
          {/* Kolona sa vremenom */}
          <div
            className="w-20 border-r border-gray-300 bg-gray-50/30 relative"
            style={{ height: `${TIMELINE_HEIGHT}px` }}
          >
            {/* Hour lines */}
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

            {/* Half-hour lines */}
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

            {/* Time labels - u sredini svakog sata */}
            {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => {
              const hour = TIMELINE_START_HOUR + i;
              const time = `${hour.toString().padStart(2, '0')}:00`;
              const position = timeToPosition(time);
              const nextHour = hour + 1;
              const nextTime =
                nextHour <= TIMELINE_END_HOUR
                  ? `${nextHour.toString().padStart(2, '0')}:00`
                  : `${TIMELINE_END_HOUR.toString().padStart(2, '0')}:59`;
              const nextPosition = timeToPosition(nextTime);
              const hourHeight = nextPosition - position;
              const centerPosition = position + hourHeight / 2;
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

          {/* Kolone za dane vikenda */}
          {days.map((date, idx) => {
            // Generiši dateKey bez timezone problema
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            const allDayCasovi = casoviByDate.get(dateKey) || [];
            // Filtriraj termine po danu - samo oni koji odgovaraju danu datuma
            const dayOfWeek = date.getDay();
            const expectedDan = dayOfWeek === 6 ? 'subota' : dayOfWeek === 0 ? 'nedjelja' : null;
            const rawDayCasovi: Cas[] = expectedDan
              ? allDayCasovi.filter((cas: Cas) => cas.raspored.dan === expectedDan)
              : [];

            // Stacking algoritam za preklopljene termine (kao collectDaySlots)
            type StackedCas = Cas & {
              startMin: number;
              endMin: number;
              stackIndex: number;
              stackCount: number;
            };

            const slots: StackedCas[] = rawDayCasovi.map((cas) => {
              const [h, m] = cas.raspored.slot.split(':').map(Number);
              const startMin = h * 60 + m;
              const endMin = startMin + cas.raspored.trajanje;
              return {
                ...cas,
                startMin,
                endMin,
                stackIndex: 0,
                stackCount: 1,
              };
            });

            // Sortiraj po početku, pa po kraju
            const sorted = [...slots].sort((a, b) => {
              const diffStart = a.startMin - b.startMin;
              if (diffStart !== 0) return diffStart;
              return a.endMin - b.endMin;
            });

            // Dodijeli kolone
            const active: { end: number; col: number; idx: number }[] = [];

            sorted.forEach((slot, i) => {
              const start = slot.startMin;
              const end = slot.endMin;

              // Ukloni slotove koji su završili
              for (let j = active.length - 1; j >= 0; j--) {
                if (active[j].end <= start) {
                  active.splice(j, 1);
                }
              }

              let col = -1;
              const used = new Set(active.map((a) => a.col));
              for (let c = 0; c <= active.length; c++) {
                if (!used.has(c)) {
                  col = c;
                  break;
                }
              }
              if (col === -1) col = active.length;

              active.push({ end, col, idx: i });
              sorted[i] = { ...sorted[i], stackIndex: col };
            });

            // Izračunaj stackCount (koliko kolona treba)
            sorted.forEach((slot, i) => {
              const start = slot.startMin;
              const end = slot.endMin;

              let maxCount = 1;
              sorted.forEach((other, j) => {
                if (i === j) return;
                const oStart = other.startMin;
                const oEnd = other.endMin;
                if (start < oEnd && end > oStart) {
                  // Overlap
                  maxCount = Math.max(maxCount, Math.max(slot.stackIndex, other.stackIndex) + 1);
                }
              });

              sorted[i] = { ...sorted[i], stackCount: maxCount };
            });

            return (
              <div
                key={dateKey}
                className="flex-1 border-r border-gray-200 last:border-r-0 bg-white"
              >
                <div className="relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
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

                  {sorted.map((cas) => {
                    const slotDate = date;
                    const top = timeToPosition(cas.raspored.slot);
                    const [startHours, startMinutes] = cas.raspored.slot.split(':').map(Number);
                    const totalEndMinutes = startMinutes + cas.raspored.trajanje;
                    const endHours = startHours + Math.floor(totalEndMinutes / 60);
                    const endMins = totalEndMinutes % 60;
                    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(
                      2,
                      '0',
                    )}`;
                    const endPosition = timeToPosition(endTime);
                    // Ensure height doesn't exceed timeline bounds
                    const maxBottom = TIMELINE_HEIGHT;
                    const calculatedHeight = endPosition - top;
                    const height = Math.max(Math.min(calculatedHeight, maxBottom - top), 40);
                    const statusClass = getSlotStatusClass(slotDate, cas, 'block');
                    const columns = cas.stackCount || 1;
                    const indexCol = cas.stackIndex || 0;
                    const widthPct = 100 / columns;
                    const leftPct = widthPct * indexCol;
                    const margin = 2;
                    const grupaLabel =
                      cas.raspored.grupa.naziv === 'A'
                        ? 'Grupa 1'
                        : cas.raspored.grupa.naziv === 'B'
                        ? 'Grupa 2'
                        : `Grupa ${cas.raspored.grupa.naziv}`;

                    return (
                      <button
                        key={cas.id || cas.raspored.id}
                        onClick={() => setSelectedCas(cas)}
                        className={`absolute rounded-md px-2.5 py-1.5 text-[11px] cursor-pointer z-10 transition-all duration-150 ${statusClass} ${getLeftBorderClass(slotDate, cas)} ${
                          cas.imaCas ? 'shadow-md hover:shadow-lg' : 'shadow-sm hover:shadow-md'
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          minHeight: '40px',
                          width: `calc(${widthPct}% - ${margin * 2}px)`,
                          left: `calc(${leftPct}% + ${margin}px)`,
                        }}
                        title={`${cas.raspored.slot} - ${endTime} • ${cas.raspored.grupa.razred.name} ${grupaLabel}${cas.raspored.lokacija ? ` • ${cas.raspored.lokacija}` : ''}`}
                      >
                        <div className="space-y-1">
                          {/* Početak - Završetak */}
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold">
                              {cas.raspored.slot} - {endTime}
                            </span>
                          </div>
                          {/* Grupa */}
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className="truncate">
                              {cas.raspored.grupa.razred.name} {grupaLabel}
                            </span>
                          </div>
                          {/* Lokacija */}
                          {cas.raspored.lokacija && (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate text-[10px]">
                                {cas.raspored.lokacija === 'divanhana' ? 'Divanhana' : cas.raspored.lokacija === 'ucionica' ? 'Učionica' : cas.raspored.lokacija}
                              </span>
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
    );
  };

  // Render dnevni prikaz
  const renderDayView = () => {
    // Generiši dateKey bez timezone problema
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    const allDayCasovi = casoviByDate.get(dateKey) || [];
    // Filtriraj termine po danu - samo oni koji odgovaraju danu datuma
    const dayOfWeek = currentDate.getDay();
    const expectedDan = dayOfWeek === 6 ? 'subota' : dayOfWeek === 0 ? 'nedjelja' : null;
    const dayCasovi: Cas[] = expectedDan 
      ? allDayCasovi.filter((cas: Cas) => cas.raspored.dan === expectedDan)
      : [];

    // Stacking algoritam za dnevni prikaz (isti princip kao u MuallimDashboardPage)
    type StackedCas = Cas & {
      startMin: number;
      endMin: number;
      stackIndex: number;
      stackCount: number;
    };

    const slots: StackedCas[] = dayCasovi.map((cas) => {
      const [h, m] = cas.raspored.slot.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + cas.raspored.trajanje;
      return {
        ...cas,
        startMin,
        endMin,
        stackIndex: 0,
        stackCount: 1,
      };
    });

    // Sortiraj po početku, pa po kraju
    const sorted = [...slots].sort((a, b) => {
      const diffStart = a.startMin - b.startMin;
      if (diffStart !== 0) return diffStart;
      return a.endMin - b.endMin;
    });

    // Dodijeli kolone
    const active: { end: number; col: number; idx: number }[] = [];

    sorted.forEach((slot, i) => {
      const start = slot.startMin;
      const end = slot.endMin;

      // Ukloni slotove koji su završili
      for (let j = active.length - 1; j >= 0; j--) {
        if (active[j].end <= start) {
          active.splice(j, 1);
        }
      }

      let col = -1;
      const used = new Set(active.map((a) => a.col));
      for (let c = 0; c <= active.length; c++) {
        if (!used.has(c)) {
          col = c;
          break;
        }
      }
      if (col === -1) col = active.length;

      active.push({ end, col, idx: i });
      sorted[i] = { ...sorted[i], stackIndex: col };
    });

    // Izračunaj stackCount (koliko kolona treba)
    sorted.forEach((slot, i) => {
      const start = slot.startMin;
      const end = slot.endMin;

      let maxCount = 1;
      sorted.forEach((other, j) => {
        if (i === j) return;
        const oStart = other.startMin;
        const oEnd = other.endMin;
        if (start < oEnd && end > oStart) {
          // Overlap
          maxCount = Math.max(maxCount, Math.max(slot.stackIndex, other.stackIndex) + 1);
        }
      });

      sorted[i] = { ...sorted[i], stackCount: maxCount };
    });
    
    return (
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-50">
        {/* Header sa danom */}
        <div className="flex border-b-2 border-gray-300 bg-gradient-to-b from-gray-50 to-white sticky top-0 z-10 shadow-sm h-16">
          <div className="w-20 h-16 border-r border-gray-300 bg-gray-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 h-16 flex items-center justify-center">
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-base font-semibold text-gray-700 uppercase tracking-wide">{formatDay(currentDate)}</div>
            </div>
          </div>
        </div>

        {/* Timeline tijelo: lijevo vrijeme, desno dan */}
        <div className="flex bg-white">
          {/* Kolona sa vremenom */}
          <div
            className="w-20 border-r border-gray-300 bg-gray-50/30 relative"
            style={{ height: `${TIMELINE_HEIGHT}px` }}
          >
            {/* Hour lines */}
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
            
            {/* Half-hour lines */}
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

          {/* Kolona za dan */}
          <div className="flex-1 border-r border-gray-200 bg-white">
            <div className="relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
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

              {sorted.map((cas) => {
                const slotDate = currentDate;
                const top = timeToPosition(cas.raspored.slot);
                const [startHours, startMinutes] = cas.raspored.slot.split(':').map(Number);
                const totalEndMinutes = startMinutes + cas.raspored.trajanje;
                const endHours = startHours + Math.floor(totalEndMinutes / 60);
                const endMins = totalEndMinutes % 60;
                const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
                const endPosition = timeToPosition(endTime);
                // Ensure height doesn't exceed timeline bounds
                const maxBottom = TIMELINE_HEIGHT;
                const calculatedHeight = endPosition - top;
                const height = Math.max(Math.min(calculatedHeight, maxBottom - top), 60);
                const statusClass = getSlotStatusClass(slotDate, cas, 'block');
                const columns = cas.stackCount || 1;
                const indexCol = cas.stackIndex || 0;
                const widthPct = 100 / columns;
                const leftPct = widthPct * indexCol;
                const margin = 3;
                const grupaLabel =
                  cas.raspored.grupa.naziv === 'A'
                    ? 'Grupa 1'
                    : cas.raspored.grupa.naziv === 'B'
                    ? 'Grupa 2'
                    : `Grupa ${cas.raspored.grupa.naziv}`;
                
                return (
                  <button
                    key={cas.id || cas.raspored.id}
                    onClick={() => setSelectedCas(cas)}
                    className={`absolute rounded-md px-2.5 py-1.5 text-[11px] cursor-pointer z-10 transition-all duration-150 ${statusClass} ${getLeftBorderClass(slotDate, cas)} ${
                      cas.imaCas ? 'shadow-md hover:shadow-lg' : 'shadow-sm hover:shadow-md'
                    }`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      minHeight: '40px',
                      width: `calc(${widthPct}% - ${margin * 2}px)`,
                      left: `calc(${leftPct}% + ${margin}px)`,
                    }}
                  >
                    <div className="space-y-0.5">
                      {/* Početak - Završetak */}
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">
                          {cas.raspored.slot} - {endTime}
                        </span>
                      </div>
                      {/* Grupa */}
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="truncate">
                          {cas.raspored.grupa.razred.name} {grupaLabel}
                        </span>
                      </div>
                      {/* Lokacija */}
                      {cas.raspored.lokacija && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate text-[10px]">
                            {cas.raspored.lokacija === 'divanhana' ? 'Divanhana' : cas.raspored.lokacija === 'ucionica' ? 'Učionica' : cas.raspored.lokacija}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-full p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje časova...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-full p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full max-w-none mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Casovi</h1>
              <p className="text-sm text-gray-600 mt-1">Upravljanje časovima</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden bg-gray-50">
                  <button
                    onClick={() => navigateDate('prev')}
                    className="p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                    title={getNavigationLabel('prev')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="h-6 w-px bg-gray-300"></div>
                  <button
                    onClick={() => navigateDate('next')}
                    className="p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                    title={getNavigationLabel('next')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="ml-2 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {getDateTitle()}
              </div>
            </div>

            {/* View Selector */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shadow-inner">
              {(['month', 'week', 'day'] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 text-sm font-medium rounded transition-all flex items-center gap-2 ${
                    view === v
                      ? 'bg-white text-gray-900 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {v === 'month' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {v === 'week' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )}
                  {v === 'day' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {v === 'month' ? 'Mjesec' : v === 'week' ? 'Sedmica' : 'Dan'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-100">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </div>

        {/* Event Details Modal */}
        {selectedCas && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCas(null)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Detalji termina</h3>
                <button
                  onClick={() => setSelectedCas(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getEventColor(selectedCas).bg} ${getEventColor(selectedCas).text}`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedCas.raspored.slot} - {(() => {
                          const [hours, minutes] = selectedCas.raspored.slot.split(':').map(Number);
                          const endMinutes = minutes + selectedCas.raspored.trajanje;
                          const endHours = hours + Math.floor(endMinutes / 60);
                          const finalMinutes = endMinutes % 60;
                          return `${String(endHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
                        })()}
                      </div>
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const date = new Date(selectedCas.datum);
                          const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
                          const months = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
                          return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Razred i grupa</div>
                    <div className="text-base font-semibold text-gray-900">
                      {selectedCas.raspored.grupa.razred.name} - {selectedCas.raspored.grupa.naziv === 'A' ? 'Grupa 1' : selectedCas.raspored.grupa.naziv === 'B' ? 'Grupa 2' : `Grupa ${selectedCas.raspored.grupa.naziv}`}
                    </div>
                  </div>

                  {selectedCas.raspored.lokacija && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Lokacija</div>
                      <div className="text-base text-gray-900 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {selectedCas.raspored.lokacija === 'divanhana' ? 'Divanhana' : selectedCas.raspored.lokacija === 'ucionica' ? 'Učionica' : selectedCas.raspored.lokacija}
                      </div>
                    </div>
                  )}

                  {selectedCas.imaCas && (
                    <>
                      {selectedCas.lekcije.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lekcije</div>
                          <div className="space-y-1">
                            {selectedCas.lekcije.map((lekcija) => (
                              <div key={lekcija.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                                <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span className="text-sm text-gray-900">{lekcija.naslov}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedCas.prisustva.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prisustvo</div>
                          <div className="space-y-1">
                            {selectedCas.prisustva.map((p) => (
                              <div key={p.ucenikId} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-900">
                                  {p.ucenik.ime} {p.ucenik.prezime}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                  p.status === 'PRISUTAN' ? 'bg-green-100 text-green-800' :
                                  p.status === 'OPRAVDAN' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {p.status === 'PRISUTAN' ? 'Prisutan' : p.status === 'OPRAVDAN' ? 'Opravdan' : 'Neopravdan'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedCas.napomena && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Napomena</div>
                          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                            {selectedCas.napomena}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!selectedCas.imaCas && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-amber-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-semibold">Nema zabilježenog časa za ovaj termin</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
