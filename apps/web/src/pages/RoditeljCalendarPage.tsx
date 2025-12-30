import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

type ViewType = 'month' | 'week' | 'day';

interface DashboardData {
  nastavnaGodina: {
    id: string;
    naziv: string;
    datumOd: string;
    datumDo: string;
  } | null;
  ucenici: Array<{ id: string; ime: string; prezime: string; razred: any }>;
}

interface RasporedSlot {
  id: string;
  dan: 'subota' | 'nedjelja';
  slot: string; // "10:00"
  lokacija: string | null;
  trajanje: number;
  razred: {
    id: string;
    name: string;
    ilmihal: string;
  };
  grupa?: {
    naziv: string;
  };
}

interface CasSlot {
  slotId: string;
  datum: string; // YYYY-MM-DD
  dan: 'subota' | 'nedjelja';
  slot: string;
  lokacija: string | null;
  trajanje: number;
  razred: string;
  grupa?: string;
  prisustvo?: {
    ucenikId: string;
    ucenikIme: string;
    status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN';
    napomena?: string;
  }[];
  ocjene?: {
    ucenikId: string;
    ucenikIme: string;
    ocjena: number;
    lekcija: string;
    komentar?: string;
  }[];
}

export default function RoditeljCalendarPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewType>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    if (day === 6 || day === 0) return today;
    // Find nearest Saturday
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + (6 - day));
    return saturday;
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedUcenikId, setSelectedUcenikId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rasporedData, setRasporedData] = useState<Record<string, RasporedSlot>>({});
  const [casSlots, setCasSlots] = useState<CasSlot[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Timeline constants
  const TIMELINE_START_HOUR = 8;
  const TIMELINE_END_HOUR = 15;
  const TIMELINE_HEIGHT = 700;

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const timeToPosition = (time: string): number => {
    const totalMinutes = timeToMinutes(time);
    const startMinutes = TIMELINE_START_HOUR * 60;
    const endMinutes = TIMELINE_END_HOUR * 60 + 59;
    const range = endMinutes - startMinutes;
    const position = ((totalMinutes - startMinutes) / range) * TIMELINE_HEIGHT;
    return Math.max(0, Math.min(TIMELINE_HEIGHT, position));
  };

  const getSaturdayForDate = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  };

  // Generate all weekend dates in range
  const getWeekendDates = (startDate: Date, endDate: Date): Date[] => {
    const dates: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    // Find first Saturday
    while (current.getDay() !== 6 && current <= endDate) {
      current.setDate(current.getDate() + 1);
    }

    while (current <= endDate) {
      dates.push(new Date(current)); // Saturday
      const sunday = new Date(current);
      sunday.setDate(sunday.getDate() + 1);
      if (sunday <= endDate) {
        dates.push(sunday); // Sunday
      }
      current.setDate(current.getDate() + 7); // Next Saturday
    }

    return dates;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch dashboard
        const dashboardRes = await axios.get<DashboardData>(`${API_URL}/roditelj/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDashboardData(dashboardRes.data);

        if (dashboardRes.data.ucenici.length > 0) {
          // Fetch raspored and data for all children
          const rasporedMap: Record<string, RasporedSlot> = {};
          const slots: CasSlot[] = [];

          for (const ucenik of dashboardRes.data.ucenici) {
            try {
              // Fetch raspored
              const rasporedRes = await axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/raspored`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              if (rasporedRes.data.raspored) {
                const raspored = rasporedRes.data.raspored;
                rasporedMap[ucenik.id] = {
                  id: raspored.id,
                  dan: raspored.dan,
                  slot: raspored.slot,
                  lokacija: raspored.lokacija,
                  trajanje: raspored.trajanje,
                  razred: rasporedRes.data.razred || { id: '', name: '', ilmihal: '' },
                };

                // Fetch prisustvo and ocjene to build slots
                const [prisustvoRes, ocjeneRes] = await Promise.all([
                  axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/prisustvo`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).catch(() => ({ data: { prisustva: [] } })),
                  axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/ocjene`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).catch(() => ({ data: { ocjene: [] } })),
                ]);

                // Build slots for each weekend date in nastavna godina range
                if (dashboardRes.data.nastavnaGodina) {
                  const startDate = new Date(dashboardRes.data.nastavnaGodina.datumOd);
                  const endDate = new Date(dashboardRes.data.nastavnaGodina.datumDo);
                  const weekendDates = getWeekendDates(startDate, endDate);

                  weekendDates.forEach((date) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayOfWeek = date.getDay() === 6 ? 'subota' : 'nedjelja';

                    if (raspored.dan === dayOfWeek) {
                      // Find prisustvo and ocjene for this date
                      const dayPrisustva = (prisustvoRes.data.prisustva || []).filter((p: any) => {
                        const pDate = new Date(p.datum).toISOString().split('T')[0];
                        return pDate === dateStr;
                      });

                      const dayOcjene = (ocjeneRes.data.ocjene || []).filter((o: any) => {
                        const oDate = new Date(o.datum).toISOString().split('T')[0];
                        return oDate === dateStr;
                      });

                      slots.push({
                        slotId: `${ucenik.id}-${raspored.id}-${dateStr}`,
                        datum: dateStr,
                        dan: dayOfWeek,
                        slot: raspored.slot,
                        lokacija: raspored.lokacija,
                        trajanje: raspored.trajanje,
                        razred: rasporedRes.data.razred?.name || '',
                        prisustvo: dayPrisustva.map((p: any) => ({
                          ucenikId: ucenik.id,
                          ucenikIme: `${ucenik.ime} ${ucenik.prezime}`,
                          status: p.status,
                          napomena: p.napomena,
                        })),
                        ocjene: dayOcjene.map((o: any) => ({
                          ucenikId: ucenik.id,
                          ucenikIme: `${ucenik.ime} ${ucenik.prezime}`,
                          ocjena: o.ocjena,
                          lekcija: o.lekcija?.naslov || '',
                          komentar: o.komentar,
                        })),
                      });
                    }
                  });
                }
              }
            } catch (err) {
              console.error(`Error fetching data for ${ucenik.id}:`, err);
            }
          }

          setRasporedData(rasporedMap);
          setCasSlots(slots);

          // Set first child as selected if none selected
          if (!selectedUcenikId && dashboardRes.data.ucenici.length > 0) {
            setSelectedUcenikId(dashboardRes.data.ucenici[0].id);
          }
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update current time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter slots by selected child and view date range
  const filteredSlots = useMemo(() => {
    let filtered = casSlots;

    // Filter by selected child
    if (selectedUcenikId) {
      filtered = filtered.filter((slot) => {
        return slot.prisustvo?.some((p) => p.ucenikId === selectedUcenikId) ||
               slot.ocjene?.some((o) => o.ucenikId === selectedUcenikId);
      });
    }

    // Filter by date range based on view
    const saturday = getSaturdayForDate(currentDate);
    saturday.setHours(0, 0, 0, 0);
    
    if (view === 'day') {
      const dateStr = saturday.toISOString().split('T')[0];
      filtered = filtered.filter((slot) => slot.datum === dateStr);
    } else if (view === 'week') {
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      const endDateStr = sunday.toISOString().split('T')[0];
      const startDateStr = saturday.toISOString().split('T')[0];
      filtered = filtered.filter((slot) => slot.datum >= startDateStr && slot.datum <= endDateStr);
    }
    // For month view, show all slots (already filtered by nastavna godina range)

    return filtered;
  }, [casSlots, selectedUcenikId, currentDate, view]);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map = new Map<string, CasSlot[]>();
    filteredSlots.forEach((slot) => {
      if (!map.has(slot.datum)) {
        map.set(slot.datum, []);
      }
      map.get(slot.datum)!.push(slot);
    });
    return map;
  }, [filteredSlots]);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);

    if (direction === 'today') {
      const today = new Date();
      const day = today.getDay();
      if (day === 6 || day === 0) {
        setCurrentDate(today);
      } else {
        setCurrentDate(getSaturdayForDate(today));
      }
      return;
    }

    if (view === 'day' || view === 'week') {
      const saturday = getSaturdayForDate(newDate);
      if (direction === 'prev') {
        saturday.setDate(saturday.getDate() - 7);
      } else {
        saturday.setDate(saturday.getDate() + 7);
      }
      setCurrentDate(saturday);
    } else {
      // month view
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      setCurrentDate(newDate);
    }
  };

  const formatDateTitle = () => {
    if (view === 'month') {
      const months = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
      return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === 'week') {
      const saturday = getSaturdayForDate(currentDate);
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
      return `${saturday.getDate()}. ${months[saturday.getMonth()]} - ${sunday.getDate()}. ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;
    }
    // day
    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    const months = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
    return `${days[currentDate.getDay()]}, ${currentDate.getDate()}. ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  // Render week view with timeline
  const renderWeekView = () => {
    const saturday = getSaturdayForDate(currentDate);
    saturday.setHours(0, 0, 0, 0);
    const sunday = new Date(saturday);
    sunday.setDate(sunday.getDate() + 1);
    sunday.setHours(0, 0, 0, 0);
    const days = [saturday, sunday];

    return (
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="flex bg-white sticky top-0 z-10 shadow-sm h-16 border-b-2 border-gray-300">
          <div className="w-20 h-16 border-r border-gray-300 bg-white"></div>
          {days.map((date, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            const daySlots = slotsByDate.get(dateStr) || [];
            const isToday = date.toDateString() === new Date().toDateString();
            const dayName = idx === 0 ? 'Subota' : 'Nedjelja';

            return (
              <div
                key={idx}
                className={`flex-1 border-r border-gray-200 last:border-r-0 h-16 flex flex-col items-center justify-center ${
                  isToday ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                  {dayName}
                </div>
                <div className={`text-2xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
                {daySlots.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">{daySlots.length} termin{daySlots.length !== 1 ? 'a' : ''}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="flex bg-white">
          {/* Time column */}
          <div className="w-20 border-r border-gray-300 bg-gray-50/30 relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
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
            {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => {
              const hour = TIMELINE_START_HOUR + i;
              const time = `${hour.toString().padStart(2, '0')}:00`;
              const position = timeToPosition(time);
              const nextHour = hour + 1;
              const nextTime = nextHour <= TIMELINE_END_HOUR ? `${nextHour.toString().padStart(2, '0')}:00` : `${TIMELINE_END_HOUR.toString().padStart(2, '0')}:59`;
              const nextPosition = timeToPosition(nextTime);
              const centerPosition = position + (nextPosition - position) / 2;
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

          {/* Day columns */}
          {days.map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const daySlots = slotsByDate.get(dateStr) || [];
            const dayOfWeek = date.getDay() === 6 ? 'subota' : 'nedjelja';

            // Stack slots
            type StackedSlot = CasSlot & {
              startMin: number;
              endMin: number;
              stackIndex: number;
              stackCount: number;
            };

            const stacked: StackedSlot[] = daySlots
              .filter((slot) => slot.dan === dayOfWeek)
              .map((slot) => {
                const [h, m] = slot.slot.split(':').map(Number);
                const startMin = h * 60 + m;
                return {
                  ...slot,
                  startMin,
                  endMin: startMin + slot.trajanje,
                  stackIndex: 0,
                  stackCount: 1,
                };
              })
              .sort((a, b) => a.startMin - b.startMin);

            // Calculate stacking
            const active: { end: number; col: number }[] = [];
            stacked.forEach((slot) => {
              for (let j = active.length - 1; j >= 0; j--) {
                if (active[j].end <= slot.startMin) {
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
              active.push({ end: slot.endMin, col });
              slot.stackIndex = col;
            });

            stacked.forEach((slot) => {
              let maxCount = 1;
              stacked.forEach((other) => {
                if (slot.startMin < other.endMin && slot.endMin > other.startMin) {
                  maxCount = Math.max(maxCount, Math.max(slot.stackIndex, other.stackIndex) + 1);
                }
              });
              slot.stackCount = maxCount;
            });

            return (
              <div key={dateStr} className="flex-1 border-r border-gray-200 last:border-r-0 bg-white relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
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

                {/* Current time indicator */}
                {(() => {
                  const today = new Date();
                  const dateOnly = new Date(date);
                  today.setHours(0, 0, 0, 0);
                  dateOnly.setHours(0, 0, 0, 0);
                  if (today.getTime() === dateOnly.getTime()) {
                    const hours = currentTime.getHours();
                    const minutes = currentTime.getMinutes();
                    if (hours >= TIMELINE_START_HOUR && hours < TIMELINE_END_HOUR) {
                      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      const pos = timeToPosition(timeString);
                      return (
                        <div className="absolute left-0 right-0 pointer-events-none z-50" style={{ top: `${pos}px` }}>
                          <div className="absolute left-0 right-0 h-0.5 bg-red-500"></div>
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                            {currentTime.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-md"></div>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}

                {/* Slots */}
                {stacked.map((slot) => {
                  const top = timeToPosition(slot.slot);
                  const [startHours, startMinutes] = slot.slot.split(':').map(Number);
                  const totalEndMinutes = startMinutes + slot.trajanje;
                  const endHours = startHours + Math.floor(totalEndMinutes / 60);
                  const endMins = totalEndMinutes % 60;
                  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
                  const endPosition = timeToPosition(endTime);
                  const height = Math.max(endPosition - top, 60);
                  const columns = slot.stackCount || 1;
                  const widthPct = 100 / columns;
                  const leftPct = widthPct * slot.stackIndex;
                  const margin = 2;

                  const hasPrisustvo = slot.prisustvo && slot.prisustvo.length > 0;
                  const hasOcjene = slot.ocjene && slot.ocjene.length > 0;
                  const prisustvoStatus = slot.prisustvo?.[0]?.status;

                  let bgColor = 'bg-blue-50 border-blue-200';
                  if (prisustvoStatus === 'PRISUTAN') bgColor = 'bg-green-50 border-green-300';
                  else if (prisustvoStatus === 'OPRAVDAN') bgColor = 'bg-yellow-50 border-yellow-300';
                  else if (prisustvoStatus === 'NEOPRAVDAN') bgColor = 'bg-red-50 border-red-300';

                  return (
                    <button
                      key={slot.slotId}
                      className={`absolute rounded-md px-2.5 py-1.5 text-[11px] cursor-pointer transition-all border-l-4 ${bgColor} shadow-md hover:shadow-lg z-10`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        minHeight: '60px',
                        width: `calc(${widthPct}% - ${margin * 2}px)`,
                        left: `calc(${leftPct}% + ${margin}px)`,
                      }}
                      title={`${slot.slot} - ${endTime} • ${slot.razred}${slot.lokacija ? ` • ${slot.lokacija}` : ''}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">{slot.slot} - {endTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span className="truncate">{slot.razred}</span>
                        </div>
                        {hasPrisustvo && (
                          <div className="text-xs mt-1">
                            <span className={`font-semibold ${
                              prisustvoStatus === 'PRISUTAN' ? 'text-green-700' :
                              prisustvoStatus === 'OPRAVDAN' ? 'text-yellow-700' :
                              'text-red-700'
                            }`}>
                              {prisustvoStatus === 'PRISUTAN' ? 'Prisutan' :
                               prisustvoStatus === 'OPRAVDAN' ? 'Opravdan' :
                               'Neopravdan'}
                            </span>
                          </div>
                        )}
                        {hasOcjene && (
                          <div className="text-xs mt-1 flex items-center gap-1">
                            <span className="text-amber-600 font-bold">{slot.ocjene?.[0]?.ocjena}</span>
                            <span className="text-gray-600 truncate">{slot.ocjene?.[0]?.lekcija}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje podataka...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Nazad na Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Kalendar</h1>
          <p className="mt-2 text-gray-600">Pregled prisustva i ocjena po terminima</p>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Navigation */}
              <div className="flex items-center gap-2 border border-gray-300 rounded-md overflow-hidden bg-gray-50">
                <button
                  onClick={() => navigateDate('prev')}
                  className="p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <button
                  onClick={() => navigateDate('next')}
                  className="p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="text-lg font-semibold text-gray-900">{formatDateTitle()}</div>
            </div>

            <div className="flex items-center gap-4">
              {/* Filter by child */}
              {dashboardData && dashboardData.ucenici.length > 1 && (
                <select
                  value={selectedUcenikId || ''}
                  onChange={(e) => setSelectedUcenikId(e.target.value || null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Sva djeca</option>
                  {dashboardData.ucenici.map((ucenik) => (
                    <option key={ucenik.id} value={ucenik.id}>
                      {ucenik.ime} {ucenik.prezime}
                    </option>
                  ))}
                </select>
              )}

              {/* View selector */}
              <div className="flex items-center gap-0 border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => setView('month')}
                  className={`px-4 py-2.5 text-sm font-semibold transition-all ${
                    view === 'month' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Mjesec
                </button>
                <div className="h-6 w-px bg-gray-200"></div>
                <button
                  onClick={() => setView('week')}
                  className={`px-4 py-2.5 text-sm font-semibold transition-all ${
                    view === 'week' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Sedmica
                </button>
                <div className="h-6 w-px bg-gray-200"></div>
                <button
                  onClick={() => setView('day')}
                  className={`px-4 py-2.5 text-sm font-semibold transition-all ${
                    view === 'day' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Dan
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Legenda:</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded border-2 border-green-300 bg-green-50"></div>
              <span className="text-sm text-gray-700">Prisutan</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded border-2 border-yellow-300 bg-yellow-50"></div>
              <span className="text-sm text-gray-700">Opravdan</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded border-2 border-red-300 bg-red-50"></div>
              <span className="text-sm text-gray-700">Neopravdan</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded border-2 border-blue-300 bg-blue-50"></div>
              <span className="text-sm text-gray-700">Nema podataka</span>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {view === 'week' && renderWeekView()}
          {(view === 'day' || view === 'month') && (
            <div className="p-8 text-center text-gray-500">
              {view === 'day' ? 'Dnevni prikaz u izradi...' : 'Mjesečni prikaz u izradi...'}
              <div className="mt-4">
                <button
                  onClick={() => setView('week')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Prikaži sedmični prikaz
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
