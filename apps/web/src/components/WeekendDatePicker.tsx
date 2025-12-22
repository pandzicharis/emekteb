import { useState, useRef, useEffect } from 'react';

interface WeekendDatePickerProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  onResetToToday?: () => void;
  startDate: Date; // Početak nastavne godine
  endDate: Date; // Kraj nastavne godine
  casExistsMap?: Map<string, boolean>; // Mapa za provjeru postojanja časa: key = `${slotId}-${datumISO}`
  dashboardData?: { raspored?: Array<{ id: string; dan: string }> }; // Dashboard podaci za provjeru slotova
  casoviCounts?: Record<string, { total: number; completed: number }>; // Map datuma na broj časova
  /**
   * Opcionalno ograničavanje na dane u kojima razred/grupa ima čas.
   * npr. ['subota'] ili ['nedjelja'] ili ['subota','nedjelja'].
   * Ako nije zadano, prikazuju se svi vikendi u opsegu.
   */
  allowedDays?: Array<'subota' | 'nedjelja'>;
  /**
   * Ako je true, prikazuje datume u jednoj koloni umjesto dvije.
   * Korisno kada ima samo jedan tip dana (npr. samo subota ili samo nedjelja).
   */
  singleColumn?: boolean;
}

export default function WeekendDatePicker({
  selectedDate,
  onDateSelect,
  onResetToToday,
  startDate,
  endDate,
  casoviCounts = {},
  allowedDays,
  singleColumn = false,
}: WeekendDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Zatvori picker kada se klikne izvan njega
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Generiši sve vikend dane u opsegu, opciono filtrirane po allowedDays
  const getWeekendDates = (): Date[] => {
    const weekends: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = nedjelja, 6 = subota
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const isSunday = dayOfWeek === 0;
        const danKey: 'subota' | 'nedjelja' = isSunday ? 'nedjelja' : 'subota';

        // Ako su zadani allowedDays, preskoči dane koji nisu dozvoljeni
        if (allowedDays && allowedDays.length > 0 && !allowedDays.includes(danKey)) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        weekends.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return weekends;
  };

  const weekendDates = getWeekendDates();

  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const monthNames = [
      'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
      'jul', 'avg', 'sep', 'okt', 'nov', 'dec',
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const dayName = date.getDay() === 0 ? 'Ned' : 'Sub';
    return `${dayName}, ${day}. ${month} ${year}`;
  };

  const formatInputDate = (date: Date | null): string => {
    if (!date) return 'Odaberi datum';
    return formatDate(date);
  };

  const isSameDate = (date1: Date, date2: Date): boolean => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  // Provjeri da li je datum prošao
  const isDatePast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isPastDate = (date: Date): boolean => {
    return isDatePast(date);
  };

  const getDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCasoviInfo = (date: Date): { total: number; completed: number } | null => {
    if (!isPastDate(date)) {
      return null;
    }
    const dateKey = getDateKey(date);
    return casoviCounts[dateKey] || null;
  };


  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Input */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-4 py-2.5 rounded-lg border transition-all duration-200 h-[41px]
          ${isOpen
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
          }
          cursor-pointer
          flex items-center justify-between gap-2
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={`text-sm font-medium truncate ${selectedDate ? 'text-slate-900' : 'text-slate-400'}`}>
            {formatInputDate(selectedDate)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-96 w-[560px] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Vikend dani</h3>
              <span className="text-xs text-slate-600 font-medium">
                {weekendDates.length} {weekendDates.length === 1 ? 'dan' : 'dana'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 p-3">
            {weekendDates.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nema vikend dana u ovom opsegu
              </div>
            ) : (
              <div className="space-y-2">
                {/* "Danas" opcija na vrhu liste - full width */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dayOfWeek = today.getDay();
                  const isTodayWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isTodayInRange = isTodayWeekend && today >= startDate && today <= endDate;
                  
                  if (isTodayInRange) {
                    const isTodaySelected = selectedDate && isSameDate(today, selectedDate);
                    const dayName = today.getDay() === 0 ? 'Nedjelja' : 'Subota';
                    const dayNumber = today.getDate();
                    const month = today.getMonth() + 1;
                    const year = today.getFullYear();
                    
                    return (
                      <button
                        type="button"
                        onClick={() => handleDateClick(today)}
                        className={`
                          w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
                          ${isTodaySelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`
                              w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold
                              ${isTodaySelected
                                ? 'bg-blue-600 text-white'
                                : today.getDay() === 0
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }
                            `}>
                              <span className="text-xs leading-tight">{dayName.substring(0, 3)}</span>
                              <span className="text-lg leading-tight">{dayNumber}</span>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                {dayName}
                                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
                                  Danas
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {dayNumber}. {month}. {year}
                              </div>
                            </div>
                          </div>
                          {isTodaySelected && (
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  }
                  return null;
                })()}
                
                {/* Grupisanje vikend dana po sedmicama - Subota i Nedjelja zajedno */}
                {(() => {
                  const filteredDates = weekendDates.filter((date) => {
                    // Filtriraj danas ako je već prikazan na vrhu
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dayOfWeek = today.getDay();
                    const isTodayWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isTodayInRange = isTodayWeekend && today >= startDate && today <= endDate;
                    if (isTodayInRange && isSameDate(date, today)) {
                      return false;
                    }
                    return true;
                  });

                  // Grupiši dane po sedmicama (Subota + Nedjelja)
                  const weekMap = new Map<string, { saturday?: Date; sunday?: Date }>();

                  filteredDates.forEach((date) => {
                    const dayOfWeek = date.getDay();
                    const dateCopy = new Date(date);
                    dateCopy.setHours(0, 0, 0, 0);
                    
                    // Pronađi subotu te sedmice
                    const saturday = new Date(dateCopy);
                    if (dayOfWeek === 0) {
                      // Ako je nedjelja, subota je prethodni dan
                      saturday.setDate(saturday.getDate() - 1);
                    } else if (dayOfWeek !== 6) {
                      // Ako nije subota, pronađi najbližu subotu
                      const daysToSaturday = 6 - dayOfWeek;
                      saturday.setDate(saturday.getDate() + daysToSaturday);
                    }
                    
                    const weekKey = `${saturday.getFullYear()}-${saturday.getMonth()}-${saturday.getDate()}`;
                    
                    if (!weekMap.has(weekKey)) {
                      weekMap.set(weekKey, {});
                    }
                    
                    const week = weekMap.get(weekKey)!;
                    if (dayOfWeek === 6) {
                      week.saturday = date;
                    } else if (dayOfWeek === 0) {
                      week.sunday = date;
                    }
                  });

                  // Konvertuj u array i sortiraj
                  const groupedByWeek: { saturday?: Date; sunday?: Date; weekKey: string }[] = [];
                  Array.from(weekMap.entries()).forEach(([weekKey, week]) => {
                    groupedByWeek.push({ ...week, weekKey });
                  });

                  groupedByWeek.sort((a, b) => {
                    const dateA = a.saturday || a.sunday!;
                    const dateB = b.saturday || b.sunday!;
                    return dateA.getTime() - dateB.getTime();
                  });

                  // U singleColumn modu prikazujemo jednostavnu listu datuma (bez praznih placeholdera)
                  if (singleColumn) {
                    const flatDates: Date[] = [];
                    groupedByWeek.forEach((week) => {
                      if (week.saturday) flatDates.push(week.saturday);
                      if (week.sunday) flatDates.push(week.sunday);
                    });

                    return (
                      <div className="space-y-1">
                        {flatDates.map((date, idx) => {
                          const isSelected = selectedDate && isSameDate(date, selectedDate);
                          const dayNumber = date.getDate();
                          const month = date.getMonth() + 1;
                          const year = date.getFullYear();
                          const isPast = isDatePast(date);
                          const dayOfWeek = date.getDay();
                          const isSunday = dayOfWeek === 0;
                          const dayShort = isSunday ? 'Ned' : 'Sub';
                          const dayFull = isSunday ? 'Nedjelja' : 'Subota';
                          const badgeBg = isSunday ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700';

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleDateClick(date)}
                              className={`
                                w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
                                ${isSelected
                                  ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md'
                                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                }
                              `}
                            >
                              <div className="flex items-center gap-3 relative">
                                <div
                                  className={`
                                    w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold flex-shrink-0
                                    ${isSelected ? 'bg-blue-600 text-white' : badgeBg}
                                  `}
                                >
                                  <span className="text-[10px] leading-tight">{dayShort}</span>
                                  <span className="text-sm leading-tight">{dayNumber}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {dayFull}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {dayNumber}. {month}. {year}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {/* Chip za prošle datume - desno u kutu */}
                                  {isPast && (() => {
                                    const casoviInfo = getCasoviInfo(date);
                                    if (casoviInfo) {
                                      return (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                          {casoviInfo.completed}/{casoviInfo.total}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {isSelected && (
                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {groupedByWeek.map((week, weekIdx) => (
                        <div
                          key={weekIdx}
                          className="grid grid-cols-2 gap-3"
                        >
                          {/* Subota */}
                          {week.saturday ? (() => {
                            const date = week.saturday!;
                            const isSelected = selectedDate && isSameDate(date, selectedDate);
                            const dayNumber = date.getDate();
                            const month = date.getMonth() + 1;
                            const year = date.getFullYear();
                            const isPast = isDatePast(date);

                            return (
                              <button
                                type="button"
                                onClick={() => handleDateClick(date)}
                                className={`
                                  text-left px-4 py-3 rounded-lg border transition-all duration-200
                                  ${isSelected
                                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-3 relative">
                                  <div className={`
                                    w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold flex-shrink-0
                                    ${isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-emerald-100 text-emerald-700'
                                    }
                                  `}>
                                    <span className="text-[10px] leading-tight">Sub</span>
                                    <span className="text-sm leading-tight">{dayNumber}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                      Subota
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {dayNumber}. {month}. {year}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {/* Chip za prošle datume - desno u kutu */}
                                    {isPast && (() => {
                                      const casoviInfo = getCasoviInfo(date);
                                      if (casoviInfo) {
                                        return (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                            {casoviInfo.completed}/{casoviInfo.total}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {isSelected && (
                                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })() : (
                            <div className="px-3 py-2.5 rounded-lg border border-transparent" />
                          )}
                          
                          {/* Nedjelja */}
                          {week.sunday ? (() => {
                            const date = week.sunday!;
                            const isSelected = selectedDate && isSameDate(date, selectedDate);
                            const dayNumber = date.getDate();
                            const month = date.getMonth() + 1;
                            const year = date.getFullYear();
                            const isPast = isDatePast(date);

                            return (
                              <button
                                type="button"
                                onClick={() => handleDateClick(date)}
                                className={`
                                  text-left px-4 py-3 rounded-lg border transition-all duration-200
                                  ${isSelected
                                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-3 relative">
                                  <div className={`
                                    w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold flex-shrink-0
                                    ${isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-purple-100 text-purple-700'
                                    }
                                  `}>
                                    <span className="text-[10px] leading-tight">Ned</span>
                                    <span className="text-sm leading-tight">{dayNumber}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                      Nedjelja
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {dayNumber}. {month}. {year}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {/* Chip za prošle datume - desno u kutu */}
                                    {isPast && (() => {
                                      const casoviInfo = getCasoviInfo(date);
                                      if (casoviInfo) {
                                        return (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                            {casoviInfo.completed}/{casoviInfo.total}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {isSelected && (
                                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })() : (
                            <div className="px-3 py-2.5 rounded-lg border border-transparent" />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          {/* Fixed "Danas" button na dnu - uvijek vidljiv za reset filtera */}
          <div className="border-t border-slate-200 bg-slate-50 p-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onResetToToday) {
                  onResetToToday();
                } else {
                  // Fallback - resetuj na današnji dan ako je vikend
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dayOfWeek = today.getDay();
                  if (dayOfWeek === 0 || dayOfWeek === 6) {
                    if (today >= startDate && today <= endDate) {
                      handleDateClick(today);
                    }
                  } else {
                    onDateSelect(null);
                  }
                }
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold bg-slate-100 text-slate-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    Vrati na današnji dan
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
                      Danas
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Prikaži naredni termin
                  </div>
                </div>
              </div>
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

