import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import CasoviDateFilter from '../components/CasoviDateFilter';
import CasEntryDrawer from '../components/CasEntryDrawer';
import SkolaHifzaCasDrawer from '../components/SkolaHifzaCasDrawer';
import { RasporedItem } from '../types/raspored';

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

interface SlobodanDan {
  datum: string; // YYYY-MM-DD format
  razlog: string;
}

interface NastavnaGodina {
  id: string;
  naziv: string;
  datumOd: string;
  datumDo: string;
}

interface CasoviResponse {
  nastavnaGodina: NastavnaGodina | null;
  casovi: Cas[];
  slobodniDani?: SlobodanDan[];
}

// Helper funkcija za pronalaženje najbliže subote (može biti prošla ili sljedeća)
const getNearestSaturday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  
  // Ako je već subota (6), vrati taj datum
  if (day === 6) {
    return d;
  }
  
  // Ako je nedjelja (0), vrati prošlu subotu
  if (day === 0) {
    d.setDate(d.getDate() - 1);
    return d;
  }
  
  // Za ostale dane, nađi najbližu subotu
  // Ako je danas prije srijede (ponedjeljak, utorak), idi unazad do prošle subote
  // Ako je danas srijeda ili poslije, idi naprijed do sljedeće subote
  const daysUntilSaturday = 6 - day;
  if (daysUntilSaturday <= 3) {
    // Idi naprijed do sljedeće subote
    d.setDate(d.getDate() + daysUntilSaturday);
  } else {
    // Idi unazad do prošle subote
    d.setDate(d.getDate() - (7 - daysUntilSaturday));
  }
  return d;
};

// Inicijalizuj currentDate: ako je danas vikend, koristi danas, inače najbližu subotu
const getInitialDate = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  
  // Ako je danas subota (6) ili nedjelja (0), koristi danas
  if (day === 6 || day === 0) {
    return today;
  }
  
  // Inače, koristi najbližu subotu
  return getNearestSaturday(today);
};

export default function CasoviPage() {
  const { user } = useAuth();
  
  const [view, setView] = useState<ViewType>('day');
  const [currentDate, setCurrentDate] = useState<Date>(getInitialDate());
  const [casovi, setCasovi] = useState<Cas[]>([]);
  const [nastavnaGodina, setNastavnaGodina] = useState<NastavnaGodina | null>(null);
  const [slobodniDani, setSlobodniDani] = useState<SlobodanDan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCas, setSelectedCas] = useState<Cas | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilterDate, setSelectedFilterDate] = useState<Date | null>(null);
  const [showCasDrawer, setShowCasDrawer] = useState(false);
  const [selectedSlotForDrawer, setSelectedSlotForDrawer] = useState<RasporedItem | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null);

  // Helper funkcije za slobodne dane
  const formatDateForComparison = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSlobodanDan = (datum: Date): boolean => {
    if (!slobodniDani.length) return false;
    const dateStr = formatDateForComparison(datum);
    return slobodniDani.some((sd) => sd.datum === dateStr);
  };

  const getSlobodanDanInfo = (datum: Date): SlobodanDan | null => {
    if (!slobodniDani.length) return null;
    const dateStr = formatDateForComparison(datum);
    return slobodniDani.find((sd) => sd.datum === dateStr) || null;
  };

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getIlmihalAccentClass = (ilmihal: string) => {
    const normalized = (ilmihal || '').trim().toUpperCase();

    if (normalized === 'SKOLA_HIFZA' || normalized === 'ŠKOLA HIFZA' || normalized.includes('SKOLA_HIFZA') || normalized.includes('ŠKOLA HIFZA')) {
      return 'bg-purple-500';
    }
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

  // Helper: label za razred (za SKOLA_HIFZA vraća "Škola hifza")
  const getRazredLabel = (razred: { name: string; ilmihal: string }, grupaLabel: string): string => {
    const isSkolaHifza = razred.ilmihal === 'SKOLA_HIFZA' || razred.ilmihal === 'ŠKOLA HIFZA';
    if (isSkolaHifza) {
      return 'Škola hifza';
    }
    return `${razred.name} ${grupaLabel}`;
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

  // Helper functions for current time detection
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

  const isSlotActive = (cas: Cas, slotDate: Date): boolean => {
    if (!isTodayWeekend()) return false;
    
    const todayDay = getTodayWeekendDay();
    if (!todayDay || cas.raspored.dan !== todayDay) return false;
    
    // Provjeri da li je datum isti kao danas
    const today = new Date();
    const slotDateOnly = new Date(slotDate);
    today.setHours(0, 0, 0, 0);
    slotDateOnly.setHours(0, 0, 0, 0);
    if (today.getTime() !== slotDateOnly.getTime()) return false;
    
    const now = currentTime;
    const [hours, minutes] = cas.raspored.slot.split(':').map(Number);
    const startTime = new Date(slotDate);
    startTime.setHours(hours, minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + cas.raspored.trajanje);
    
    return now >= startTime && now <= endTime;
  };

  const getCurrentTimePosition = (slotDate: Date): number | null => {
    if (!isTodayWeekend()) return null;
    
    const today = new Date();
    const slotDateOnly = new Date(slotDate);
    today.setHours(0, 0, 0, 0);
    slotDateOnly.setHours(0, 0, 0, 0);
    if (today.getTime() !== slotDateOnly.getTime()) return null;
    
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Only show if within timeline hours
    if (hours < TIMELINE_START_HOUR || hours >= TIMELINE_END_HOUR) return null;
    
    return timeToPosition(timeString);
  };

  // Generiši osnovnu boju prema statusu slota:
  // OBICNI CASOVI:
  // - nije nastupio  -> svjetlo plava
  // - nastupio, nema cas -> žuta
  // - nastupio, ima cas  -> jaka plava
  //
  // HIFZ CASOVI:
  // - nije nastupio  -> svjetlo ljubičasta
  // - nastupio, nema cas -> žuta
  // - nastupio, ima cas  -> jaka ljubičasta
  //
  // SLOBODAN DAN:
  // - svi slotovi -> crveni
  const getSlotStatusClass = (slotDate: Date, cas: Cas, variant: 'chip' | 'block' = 'block') => {
    // Provjeri da li je datum slobodan dan - ako jeste, vrati crveni stil
    const isSlotDateSlobodanDan = isSlobodanDan(slotDate);
    if (isSlotDateSlobodanDan) {
      return variant === 'chip'
        ? 'bg-red-50 border border-red-200 text-red-900'
        : 'bg-red-50 border border-red-200 text-red-900';
    }

    const isSkolaHifza =
      cas.raspored.grupa.razred.ilmihal === 'SKOLA_HIFZA' ||
      cas.raspored.grupa.razred.ilmihal === 'ŠKOLA HIFZA';
    const isActive = isSlotActive(cas, slotDate);
    
    const strongBlue =
      variant === 'chip'
        ? 'bg-blue-600 border-[0.5px] border-blue-500/30 text-white shadow-lg'
        : 'bg-blue-600 border-[0.5px] border-blue-500/30 text-white shadow-lg';
    const strongPurple =
      variant === 'chip'
        ? 'bg-purple-600 border-[0.5px] border-purple-500/30 text-white shadow-lg'
        : 'bg-purple-600 border-[0.5px] border-purple-500/30 text-white shadow-lg';
    const lightBlue =
      variant === 'chip'
        ? 'bg-blue-50 border border-blue-200 text-blue-900'
        : 'bg-blue-50 border border-blue-200 text-blue-900';
    const lightPurple =
      variant === 'chip'
        ? 'bg-purple-50 border border-purple-200 text-purple-900'
        : 'bg-purple-50 border border-purple-200 text-purple-900';
    const yellow =
      variant === 'chip'
        ? 'bg-amber-50 border border-amber-200 text-amber-900'
        : 'bg-amber-50 border border-amber-200 text-amber-900';

    // Aktivni slotovi – tretiramo kao \"nastupio, ima cas\" sa jakom bojom
    if (isActive) {
      return isSkolaHifza ? strongPurple : strongBlue;
    }

    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + cas.raspored.trajanje);

    const isPast = end < now;

    if (isPast) {
      if (cas.imaCas) {
        // Prošli slotovi sa časom – jaka plava / ljubičasta
        return isSkolaHifza ? strongPurple : strongBlue;
      }
      // Prošli bez časa – žuti za sve
      return yellow;
    }

    // Budući slotovi (nije nastupio) – svjetlo plava / ljubičasta
    return isSkolaHifza ? lightPurple : lightBlue;
  };

  // Helper za lijevi border (deblji i jača nijansa)
  const getLeftBorderClass = (slotDate: Date, cas: Cas) => {
    // Provjeri da li je datum slobodan dan - ako jeste, vrati crveni border
    const isSlotDateSlobodanDan = isSlobodanDan(slotDate);
    if (isSlotDateSlobodanDan) {
      return 'border-l-4 border-l-red-600';
    }

    const isSkolaHifza =
      cas.raspored.grupa.razred.ilmihal === 'SKOLA_HIFZA' ||
      cas.raspored.grupa.razred.ilmihal === 'ŠKOLA HIFZA';
    const isActive = isSlotActive(cas, slotDate);
    
    if (isActive) {
      // Aktivni slotovi – jaka nijansa (plava / ljubičasta)
      return isSkolaHifza ? 'border-l-4 border-l-purple-800' : 'border-l-4 border-l-blue-800';
    }

    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + cas.raspored.trajanje);

    const isPast = end < now;

    if (isPast) {
      if (cas.imaCas) {
        // Prošli sa časom – jaka plava / ljubičasta
        return isSkolaHifza ? 'border-l-4 border-l-purple-700' : 'border-l-4 border-l-blue-700';
      }
      // Prošli bez časa – žuti border
      return 'border-l-4 border-l-amber-400';
    }

    // Budući slotovi – svjetliji plavi ili ljubičasti border
    return isSkolaHifza ? 'border-l-4 border-l-purple-400' : 'border-l-4 border-l-blue-400';
  };


  // Konvertuj Cas u RasporedItem format za drawer
  const convertCasToRasporedItem = (cas: Cas): RasporedItem => {
    const [startHours, startMinutes] = cas.raspored.slot.split(':').map(Number);
    const totalEndMinutes = startMinutes + cas.raspored.trajanje;
    const endHours = startHours + Math.floor(totalEndMinutes / 60);
    const endMins = totalEndMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    // Izvuci učenike iz prisustva (ako postoje)
    const ucenici = cas.prisustva?.map((p) => ({
      id: p.ucenikId,
      ime: p.ucenik.ime,
      prezime: p.ucenik.prezime,
      godinaRodjenja: null,
    })) || [];

    return {
      id: cas.raspored.id,
      dan: cas.raspored.dan,
      slot: cas.raspored.slot,
      lokacija: cas.raspored.lokacija,
      trajanje: cas.raspored.trajanje,
      startTime: cas.raspored.slot,
      endTime: endTime,
      grupa: {
        id: cas.raspored.grupa.id,
        naziv: cas.raspored.grupa.naziv,
        razred: {
          id: cas.raspored.grupa.razred.id,
          name: cas.raspored.grupa.razred.name,
          ilmihal: cas.raspored.grupa.razred.ilmihal,
        },
        kuran: false, // Nije dostupno u Cas tipu, postavljamo na false
        sufara: false, // Nije dostupno u Cas tipu, postavljamo na false
        brojUcenika: ucenici.length,
        ucenici: ucenici.length > 0 ? ucenici : undefined, // Postavi samo ako ima učenika
      },
      trenutniCasId: cas.id,
    };
  };

  // Provjeri da li je slot prošao
  const isPastSlot = (cas: Cas, slotDate: Date): boolean => {
    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + cas.raspored.trajanje);
    
    return end < now;
  };

  // Provjeri da li je slot danas
  const isTodaySlot = (cas: Cas, slotDate: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotDateOnly = new Date(slotDate);
    slotDateOnly.setHours(0, 0, 0, 0);
    
    return today.getTime() === slotDateOnly.getTime();
  };

  // Provjeri da li je slot budući
  const isFutureSlot = (cas: Cas, slotDate: Date): boolean => {
    const now = new Date();
    const [h, m] = cas.raspored.slot.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(h, m, 0, 0);
    
    return start > now;
  };

  // Handler za klik na slot
  const handleSlotClick = (cas: Cas, slotDate: Date) => {
    const past = isPastSlot(cas, slotDate);
    const today = isTodaySlot(cas, slotDate);
    const future = isFutureSlot(cas, slotDate);
    
    // Ako je slot prošao ili je danas, otvori drawer
    if (past || today) {
      const rasporedItem = convertCasToRasporedItem(cas);
      setSelectedSlotForDrawer(rasporedItem);
      setSelectedSlotDate(slotDate);
      setShowCasDrawer(true);
    } else if (future) {
      // Za buduće slotove, otvori minimalni modal
      setSelectedCas(cas);
    }
  };

  // Izračunaj opseg datuma na osnovu view-a i trenutnog datuma (samo vikend dani)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // NOTE: casovi are already filtered by muallim from backend, so all casovi here belong to current muallim
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
  // NOTE: Backend endpoint /cas/muallim/range already filters casovi by the authenticated muallim
  // All casovi returned are only for the current logged-in muallim
  useEffect(() => {
    const fetchCasovi = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // API endpoint automatically filters by authenticated muallim (see cas.controller.ts line 106-411)
        const response = await axios.get<CasoviResponse>(`${API_URL}/cas/muallim/range`);
        
        console.log('Received data:', response.data);
        if (response.data) {
          setNastavnaGodina(response.data.nastavnaGodina || null);
          setCasovi(response.data.casovi || []);
          const slobodniDaniData = response.data.slobodniDani || [];
          setSlobodniDani(slobodniDaniData);
          
          // Postavi currentDate na današnji datum (ili najbližu subotu) ako je unutar opsega nastavne godine
          // Inače, koristi prvi vikend dan nastavne godine
          if (response.data.nastavnaGodina) {
            const nastavnaStart = new Date(response.data.nastavnaGodina.datumOd);
            nastavnaStart.setHours(0, 0, 0, 0);
            const nastavnaEnd = new Date(response.data.nastavnaGodina.datumDo);
            nastavnaEnd.setHours(23, 59, 59, 999);
            
            // Provjeri da li je trenutni currentDate (današnji/najbliža subota) unutar opsega
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const day = today.getDay();
            
            let targetDate: Date;
            if (day === 6 || day === 0) {
              // Ako je danas vikend, koristi danas
              targetDate = new Date(today);
            } else {
              // Inače, koristi najbližu subotu
              targetDate = getNearestSaturday(today);
            }
            
            // Provjeri da li je targetDate unutar opsega nastavne godine
            if (targetDate >= nastavnaStart && targetDate <= nastavnaEnd) {
              // Koristi targetDate (današnji/najbliža subota)
              setCurrentDate(targetDate);
            } else {
              // Ako nije unutar opsega, koristi prvi vikend dan nastavne godine
              const start = new Date(nastavnaStart);
              const startDay = start.getDay();
              if (startDay !== 6 && startDay !== 0) {
                // Ako nije vikend, idi na prvu subotu
                const diff = 6 - startDay;
                start.setDate(start.getDate() + diff);
              }
              setCurrentDate(start);
            }
          }
        }
      } catch (err: unknown) {
        console.error('Error fetching casovi:', err);
        const errorMessage = err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'message' in err.response.data && typeof err.response.data.message === 'string' ? err.response.data.message : 'Greška pri učitavanju časova';
        setError(errorMessage);
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

  // Update current time every second for timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Resetuj filter kada se promijeni view
  useEffect(() => {
    setSelectedFilterDate(null);
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
        <div className="grid grid-cols-2 border-b-2 border-gray-300 bg-white sticky top-0 z-10 shadow-sm h-16">
          <div className="h-16 text-center text-sm font-semibold text-gray-700 border-r border-gray-300 uppercase tracking-wide flex items-center justify-center">
            Subota
          </div>
          <div className="h-16 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center justify-center">
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

              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isDateSlobodanDan = isSlobodanDan(date);

              return (
                <div
                  key={dateKey}
                  className={`min-h-[120px] border-b border-r border-gray-200 p-3 transition-colors ${
                    isDateSlobodanDan
                      ? 'bg-red-50/80 border-red-200'
                      : isCurrentMonth
                      ? 'bg-white hover:bg-gray-50'
                      : 'bg-gray-50/50'
                  }`}
                >
                  <div className="mb-3 flex items-baseline gap-1.5">
                    {isDateSlobodanDan && (
                      <div className="w-2 h-2 rounded-full bg-red-600 mr-1 flex-shrink-0 mt-1"></div>
                    )}
                    <div
                      className={`text-xl font-bold ${
                        isDateSlobodanDan
                          ? 'text-red-700'
                          : isCurrentMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div
                      className={`text-xs font-light ${
                        isCurrentMonth
                          ? 'text-gray-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'][date.getMonth()]}
                    </div>
                  </div>
                  {isDateSlobodanDan && (
                    <div className="mb-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Slobodan dan
                      </span>
                    </div>
                  )}
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
                          const statusClass = getSlotStatusClass(date, cas, 'chip');
                      const grupaLabel =
                        cas.raspored.grupa.naziv === 'A'
                          ? 'Grupa 1'
                          : cas.raspored.grupa.naziv === 'B'
                          ? 'Grupa 2'
                          : `Grupa ${cas.raspored.grupa.naziv}`;

                      const slotDate = new Date(date);
                      slotDate.setHours(0, 0, 0, 0);
                      const isSlotDateSlobodanDan = isSlobodanDan(slotDate);
                      
                      return (
                        <button
                          key={cas.id || cas.raspored.id}
                          onClick={() => handleSlotClick(cas, slotDate)}
                          className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${statusClass} ${getLeftBorderClass(date, cas)} ${
                            cas.imaCas ? 'font-medium hover:shadow-md' : 'font-normal hover:shadow-sm'
                          }`}
                          title={`${startTime} - ${endTime} • ${getRazredLabel(cas.raspored.grupa.razred, grupaLabel)}${cas.raspored.lokacija ? ` • ${cas.raspored.lokacija}` : ''}`}
                        >
                          <div className="space-y-1">
                            {/* Početak - Završetak */}
                            <div className="flex items-center gap-1.5">
                              {isSlotDateSlobodanDan && (
                                <svg className="w-3 h-3 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className={`font-semibold ${isSlotDateSlobodanDan ? 'text-red-900' : ''}`}>
                                {startTime} - {endTime}
                              </span>
                            </div>
                            {/* Grupa */}
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              <span className="truncate">
                                {getRazredLabel(cas.raspored.grupa.razred, grupaLabel)}
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
                            const firstCas = allForDay[0];
                            const slotDate = new Date(date);
                            slotDate.setHours(0, 0, 0, 0);
                            handleSlotClick(firstCas, slotDate);
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
        <div className="flex bg-white sticky top-0 z-10 shadow-sm h-16 border-b-[3px] border-gray-300">
          <div className="w-20 h-16 border-r border-gray-300 bg-white flex items-center justify-center">
          </div>
          {days.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayName = idx === 0 ? 'Subota' : 'Nedjelja';
            const isDateSlobodanDan = isSlobodanDan(date);
            return (
              <div
                key={idx}
                className={`flex-1 border-b-2 h-16 border-r border-gray-200 last:border-r-0 flex flex-col items-center justify-center ${
                  isDateSlobodanDan
                    ? 'bg-red-50 border-red-300'
                    : isToday
                    ? 'bg-blue-50'
                    : 'bg-white'
                }`}
              >
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5 flex items-center justify-center">
                  {dayName}
                </div>
                {isDateSlobodanDan && (
                  <div className="w-2 h-2 rounded-full bg-red-600 mb-1"></div>
                )}
                <div
                  className={`text-2xl font-bold ${
                    isDateSlobodanDan
                      ? 'text-red-700'
                      : isToday
                      ? 'text-blue-600'
                      : 'text-gray-900'
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
          {days.map((date) => {
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
                className={`flex-1 border-r border-gray-200 last:border-r-0 ${isSlobodanDan(date) ? 'bg-red-50/30' : 'bg-white'}`}
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

                  {/* Current time indicator */}
                  {(() => {
                    const currentPos = getCurrentTimePosition(date);
                    if (currentPos !== null) {
                      return (
                        <div
                          className="absolute left-0 right-0 pointer-events-none z-50"
                          style={{ top: `${currentPos}px` }}
                        >
                          <div className="absolute left-0 right-0 h-0.5 bg-red-500"></div>
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                            {currentTime.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-md"></div>
                        </div>
                      );
                    }
                    return null;
                  })()}

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
                    const isActive = isSlotActive(cas, slotDate);
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

                    const slotDateForClick = new Date(date);
                    slotDateForClick.setHours(0, 0, 0, 0);
                    const isSlotDateSlobodanDan = isSlobodanDan(slotDate);
                    
                    return (
                      <button
                        key={cas.id || cas.raspored.id}
                        onClick={() => handleSlotClick(cas, slotDateForClick)}
                        className={`absolute rounded-md px-2.5 py-1.5 text-[11px] cursor-pointer transition-all duration-150 ${statusClass} ${getLeftBorderClass(slotDate, cas)} ${
                          isActive 
                            ? 'shadow-lg hover:shadow-xl z-40' 
                            : cas.imaCas 
                            ? 'shadow-md hover:shadow-lg z-10' 
                            : 'shadow-sm hover:shadow-md z-10'
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          minHeight: '40px',
                          width: `calc(${widthPct}% - ${margin * 2}px)`,
                          left: `calc(${leftPct}% + ${margin}px)`,
                        }}
                        title={`${cas.raspored.slot} - ${endTime} • ${getRazredLabel(cas.raspored.grupa.razred, grupaLabel)}${cas.raspored.lokacija ? ` • ${cas.raspored.lokacija}` : ''}`}
                      >
                        <div className="space-y-1">
                          {/* Početak - Završetak */}
                          <div className="flex items-center gap-1.5">
                            {isSlotDateSlobodanDan && (
                              <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            )}
                            <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className={`font-semibold ${isActive ? 'text-white' : isSlotDateSlobodanDan ? 'text-red-900' : ''}`}>
                              {cas.raspored.slot} - {endTime}
                            </span>
                          </div>
                          {/* Grupa */}
                          <div className="flex items-center gap-1.5">
                            <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className={`truncate ${isActive ? 'text-white/90' : ''}`}>
                              {getRazredLabel(cas.raspored.grupa.razred, grupaLabel)}
                            </span>
                          </div>
                          {/* Lokacija */}
                          {cas.raspored.lokacija && (
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className={`truncate text-[10px] ${isActive ? 'text-white/80' : ''}`}>
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
        <div className={`flex border-b-2 ${isSlobodanDan(currentDate) ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} sticky top-0 z-10 shadow-sm h-16`}>
          <div className="w-20 h-16 border-r border-gray-300 bg-white flex items-center justify-center">
          </div>
          <div className="flex-1 h-16 flex items-center justify-center">
            <div className={`text-base font-semibold ${isSlobodanDan(currentDate) ? 'text-red-700' : 'text-gray-700'} uppercase tracking-wide`}>{formatDay(currentDate)}</div>
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

              {/* Current time indicator */}
              {(() => {
                const currentPos = getCurrentTimePosition(currentDate);
                if (currentPos !== null) {
                  return (
                    <div
                      className="absolute left-0 right-0 pointer-events-none z-50"
                      style={{ top: `${currentPos}px` }}
                    >
                      <div className="absolute left-0 right-0 h-0.5 bg-red-500"></div>
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                        {currentTime.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-md"></div>
                    </div>
                  );
                }
                return null;
              })()}

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
                const isActive = isSlotActive(cas, slotDate);
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
                
                const slotDateForClick = new Date(currentDate);
                slotDateForClick.setHours(0, 0, 0, 0);
                const isSlotDateSlobodanDan = isSlobodanDan(slotDate);
                
                return (
                  <button
                    key={cas.id || cas.raspored.id}
                    onClick={() => handleSlotClick(cas, slotDateForClick)}
                    className={`absolute rounded-md px-2.5 py-1.5 text-[11px] cursor-pointer transition-all duration-150 ${statusClass} ${getLeftBorderClass(slotDate, cas)} ${
                      isActive 
                        ? 'shadow-lg hover:shadow-xl z-40' 
                        : cas.imaCas 
                        ? 'shadow-md hover:shadow-lg z-10' 
                        : 'shadow-sm hover:shadow-md z-10'
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
                        {isSlotDateSlobodanDan && (
                          <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                        <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`font-semibold ${isActive ? 'text-white' : isSlotDateSlobodanDan ? 'text-red-900' : ''}`}>
                          {cas.raspored.slot} - {endTime}
                        </span>
                      </div>
                      {/* Grupa */}
                      <div className="flex items-center gap-1.5">
                        <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className={`truncate ${isActive ? 'text-white/90' : ''}`}>
                          {getRazredLabel(cas.raspored.grupa.razred, grupaLabel)}
                        </span>
                      </div>
                      {/* Lokacija */}
                      {cas.raspored.lokacija && (
                        <div className="flex items-center gap-1.5">
                          <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className={`truncate text-[10px] ${isActive ? 'text-white/80' : ''}`}>
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
    <div className="bg-white min-h-full p-6 lg:p-10">
      <div className="w-full max-w-none mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Časovi</h1>
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
              <div className="ml-2 text-lg font-semibold text-gray-900">
                {getDateTitle()}
              </div>
            </div>

            {/* View Selector i Filter */}
            <div className="flex items-center gap-3">
              {/* Filter */}
              {nastavnaGodina && (
                <div className="w-64">
                  <CasoviDateFilter
                    view={view}
                    selectedDate={selectedFilterDate}
                    onDateSelect={(date) => {
                      setSelectedFilterDate(date);
                      if (date) {
                        // Postavi currentDate na odabrani datum ovisno o view-u
                        if (view === 'month') {
                          // Za mjesec, postavi prvi dan mjeseca
                          const firstDay = new Date(date);
                          firstDay.setDate(1);
                          firstDay.setHours(0, 0, 0, 0);
                          setCurrentDate(firstDay);
                        } else if (view === 'week') {
                          // Za sedmicu, postavi subotu za taj vikend
                          const saturday = getSaturdayForDate(date);
                          setCurrentDate(saturday);
                        } else {
                          // Za dan, postavi taj dan direktno
                          setCurrentDate(date);
                        }
                      }
                    }}
                    onResetToToday={() => {
                      setSelectedFilterDate(null);
                      navigateDate('today');
                    }}
                    startDate={new Date(nastavnaGodina.datumOd)}
                    endDate={new Date(nastavnaGodina.datumDo)}
                  />
                </div>
              )}

              {/* View Selector - Month/Week/Day */}
              <div className="flex items-center gap-0 border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => setView('month')}
                  className={`relative px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    view === 'month'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title="Mjesečni prikaz"
                >
                  Mjesec
                </button>
                <div className="h-6 w-px bg-gray-200"></div>
                <button
                  onClick={() => setView('week')}
                  className={`relative px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    view === 'week'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title="Sedmični prikaz"
                >
                  Sedmica
                </button>
                <div className="h-6 w-px bg-gray-200"></div>
                <button
                  onClick={() => setView('day')}
                  className={`relative px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    view === 'day'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title="Dnevni prikaz"
                >
                  Dan
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Slobodan dan banner - ako je trenutno prikazani datum slobodan dan */}
        {(() => {
          const dateToCheck = new Date(currentDate);
          dateToCheck.setHours(0, 0, 0, 0);
          
          // Provjeri da li je trenutno prikazani datum slobodan dan
          if (isSlobodanDan(dateToCheck)) {
            const info = getSlobodanDanInfo(dateToCheck);
            
            if (info) {
              const day = dateToCheck.getDate();
              const monthNames = [
                'januar', 'februar', 'mart', 'april', 'maj', 'jun',
                'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'
              ];
              const month = monthNames[dateToCheck.getMonth()];
              const year = dateToCheck.getFullYear();
              const formattedDate = `${day}. ${month} ${year}`;
              
              return (
                <div className="mb-4 rounded-lg bg-red-50 border-l-4 border-red-500 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-semibold text-red-800">Slobodan dan - nema nastave</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p className="font-medium mb-1">{formattedDate}</p>
                        <p>{info.razlog || 'Nema navedenog razloga'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          }
          return null;
        })()}

        {/* Legenda */}
        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Legenda</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-amber-300 bg-amber-50"></div>
              <span className="text-xs text-gray-700">Prošli časovi bez časa</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-emerald-300 bg-emerald-50"></div>
              <span className="text-xs text-gray-700">Prošli časovi sa čason</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-blue-300 bg-blue-50"></div>
              <span className="text-xs text-gray-700">Budući časovi</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-purple-300 bg-purple-50"></div>
              <span className="text-xs text-gray-700">Škola hifza</span>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-100">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </div>

        {/* Event Details Modal - samo za buduće slotove */}
        {selectedCas && (() => {
          // Provjeri da li je slot budući
          const slotDate = new Date(selectedCas.datum);
          slotDate.setHours(0, 0, 0, 0);
          const isFuture = isFutureSlot(selectedCas, slotDate);
          
          // Ako nije budući, ne prikazuj modal (drawer će se otvoriti)
          if (!isFuture) {
            return null;
          }

          // Broj djece - koristimo prisustva ako postoje, inače prikazujemo "N/A"
          const brojDjece = selectedCas.prisustva?.length ?? 0;

          return (
            <div 
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedCas(null)}
            >
              <div 
                className="bg-white rounded-xl shadow-2xl max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
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
                  {/* Datum */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Datum</div>
                    <div className="text-base font-semibold text-gray-900">
                      {(() => {
                        const date = new Date(selectedCas.datum);
                        const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
                        const months = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
                        return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
                      })()}
                    </div>
                  </div>

                  {/* Razred */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Razred</div>
                    <div className="text-base font-semibold text-gray-900">
                      {getRazredLabel(selectedCas.raspored.grupa.razred, '')}
                    </div>
                  </div>

                  {/* Grupa */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grupa</div>
                    <div className="text-base font-semibold text-gray-900">
                      {selectedCas.raspored.grupa.naziv === 'A' ? 'Grupa 1' : selectedCas.raspored.grupa.naziv === 'B' ? 'Grupa 2' : `Grupa ${selectedCas.raspored.grupa.naziv}`}
                    </div>
                  </div>

                  {/* Broj djece */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Broj djece</div>
                    <div className="text-base font-semibold text-gray-900">
                      {brojDjece > 0 ? brojDjece : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* CasEntryDrawer ili SkolaHifzaCasDrawer */}
        {(() => {
          const ilmihal = selectedSlotForDrawer?.grupa?.razred?.ilmihal;
          const isSkolaHifza = ilmihal === 'SKOLA_HIFZA' || ilmihal === 'ŠKOLA HIFZA';
          console.log('🔍 [CASOVI] Checking drawer type:', { ilmihal, isSkolaHifza, slot: selectedSlotForDrawer });
          return isSkolaHifza;
        })() ? (
          <SkolaHifzaCasDrawer
            open={showCasDrawer}
            slot={selectedSlotForDrawer}
            slotDate={selectedSlotDate}
            onClose={() => {
              setShowCasDrawer(false);
              setSelectedSlotForDrawer(null);
              setSelectedSlotDate(null);
            }}
            onSave={async () => {
              // Nakon spremanja, osvježi podatke
              try {
                const response = await axios.get<CasoviResponse>(`${API_URL}/cas/muallim/range`);
                if (response.data) {
                  setNastavnaGodina(response.data.nastavnaGodina || null);
                  setCasovi(response.data.casovi || []);
                  setSlobodniDani(response.data.slobodniDani || []);
                }
              } catch (err) {
                console.error('Error refreshing casovi:', err);
              }
            }}
          />
        ) : (
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
              // Nakon spremanja, osvježi podatke
              try {
                const response = await axios.get<CasoviResponse>(`${API_URL}/cas/muallim/range`);
                if (response.data) {
                  setNastavnaGodina(response.data.nastavnaGodina || null);
                  setCasovi(response.data.casovi || []);
                  setSlobodniDani(response.data.slobodniDani || []);
                }
              } catch (err) {
                console.error('Error refreshing casovi:', err);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
