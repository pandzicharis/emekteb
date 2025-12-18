import { useState, useRef, useEffect } from 'react';

type ViewType = 'month' | 'week' | 'day';

interface CasoviDateFilterProps {
  view: ViewType;
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  onResetToToday?: () => void;
  startDate: Date; // Početak nastavne godine
  endDate: Date; // Kraj nastavne godine
}

export default function CasoviDateFilter({
  view,
  selectedDate,
  onDateSelect,
  onResetToToday,
  startDate,
  endDate,
}: CasoviDateFilterProps) {
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
  }, [isOpen]);

  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const monthNames = [
      'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
      'jul', 'avg', 'sep', 'okt', 'nov', 'dec',
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}. ${month} ${year}`;
  };

  const formatMonthYear = (date: Date): string => {
    const months = [
      'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
      'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatWeekRange = (saturday: Date): string => {
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
    const startStr = `${saturday.getDate()}. ${months[saturday.getMonth()]}`;
    const endStr = `${sunday.getDate()}. ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  };

  const isSameDate = (date1: Date, date2: Date): boolean => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isSameMonth = (date1: Date, date2: Date): boolean => {
    return (
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    setIsOpen(false);
  };

  // Generiši mjesece u nastavnoj godini
  const getMonths = (): Date[] => {
    const months: Date[] = [];
    const current = new Date(startDate);
    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  };

  // Generiši vikende (parovi subota + nedjelja) u nastavnoj godini
  const getWeekends = (): { saturday: Date; sunday: Date }[] => {
    const weekends: { saturday: Date; sunday: Date }[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Pronađi prvu subotu
    while (current <= end) {
      if (current.getDay() === 6) { // Subota
        const sunday = new Date(current);
        sunday.setDate(sunday.getDate() + 1);
        
        if (sunday <= end) {
          weekends.push({
            saturday: new Date(current),
            sunday: sunday,
          });
        }
        current.setDate(current.getDate() + 7); // Sledeća sedmica
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    return weekends;
  };

  // Generiši sve vikend dane
  const getWeekendDays = (): Date[] => {
    const days: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const formatInputDate = (): string => {
    if (!selectedDate) return 'Odaberi datum';
    
    if (view === 'month') {
      return formatMonthYear(selectedDate);
    } else if (view === 'week') {
      // Za week view, selectedDate je već subota, ali ipak provjerimo
      const saturday = getSaturdayForDate(selectedDate);
      return formatWeekRange(saturday);
    } else {
      const dayName = selectedDate.getDay() === 0 ? 'Ned' : 'Sub';
      return `${dayName}, ${formatDate(selectedDate)}`;
    }
  };

  const getSaturdayForDate = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  };

  const renderContent = () => {
    if (view === 'month') {
      const months = getMonths();
      return (
        <div className="space-y-2">
          {months.map((month, idx) => {
            const isSelected = selectedDate && isSameMonth(month, selectedDate);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateClick(month)}
                className={`
                  w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                      }
                    `}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMonthYear(month)}
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      );
    } else if (view === 'week') {
      const weekends = getWeekends();
      return (
        <div className="space-y-2">
          {weekends.map((weekend, idx) => {
            const saturday = getSaturdayForDate(weekend.saturday);
            const isSelected = selectedDate && isSameDate(selectedDate, saturday);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateClick(saturday)}
                className={`
                  w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-indigo-100 text-indigo-600'
                      }
                    `}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatWeekRange(saturday)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Subota - Nedjelja
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      );
    } else {
      // DAN view - pojedinačni vikend dani
      const days = getWeekendDays();
      return (
        <div className="space-y-2">
          {days.map((day, idx) => {
            const isSelected = selectedDate && isSameDate(day, selectedDate);
            const dayName = day.getDay() === 0 ? 'Nedjelja' : 'Subota';
            const dayNumber = day.getDate();
            const month = day.getMonth() + 1;
            const year = day.getFullYear();
            
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateClick(day)}
                className={`
                  w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold flex-shrink-0
                    ${isSelected
                      ? 'bg-blue-600 text-white'
                      : day.getDay() === 0
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }
                  `}>
                    <span className="text-[10px] leading-tight">{dayName.substring(0, 3)}</span>
                    <span className="text-sm leading-tight">{dayNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {dayName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {dayNumber}. {month}. {year}
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      );
    }
  };

  const getTitle = () => {
    if (view === 'month') return 'Mjeseci';
    if (view === 'week') return 'Vikendi';
    return 'Vikend dani';
  };

  const getTitleIcon = () => {
    if (view === 'month') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    } else if (view === 'week') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
  };

  const getItemCount = () => {
    if (view === 'month') return getMonths().length;
    if (view === 'week') return getWeekends().length;
    return getWeekendDays().length;
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
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
            ${isOpen
              ? 'bg-blue-100 text-blue-600'
              : selectedDate
              ? 'bg-slate-100 text-slate-600'
              : 'bg-slate-50 text-slate-400'
            }
          `}>
            {view === 'month' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : view === 'week' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <span className={`text-sm font-medium truncate ${selectedDate ? 'text-slate-900' : 'text-slate-400'}`}>
            {formatInputDate()}
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
        <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-96 w-[400px] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  {getTitleIcon()}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{getTitle()}</h3>
              </div>
              <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {getItemCount()} {getItemCount() === 1 ? 'stavka' : 'stavki'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 p-3">
            {renderContent()}
          </div>
          {/* Reset button */}
          {onResetToToday && (
            <div className="border-t border-slate-200 bg-slate-50 p-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  onResetToToday();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 text-sm font-medium text-slate-700 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resetuj filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

