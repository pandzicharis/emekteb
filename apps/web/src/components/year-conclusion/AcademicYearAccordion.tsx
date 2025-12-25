import { useState } from 'react';

interface AcademicYearAccordionProps {
  year: {
    id: string;
    naziv: string;
    status?: string;
    razredi: Array<{
      id: string;
      razred: {
        id: string;
        name: string;
        ilmihal: string;
      };
      ucenici: Array<{
        id: string;
        ime: string;
        prezime: string;
        fotografija?: string | null;
      }>;
    }>;
  };
  isExpanded: boolean;
  onExpand: () => void;
  onStudentClick: (studentId: string, razredId: string) => void;
}

export default function AcademicYearAccordion({
  year,
  isExpanded,
  onExpand,
  onStudentClick,
}: AcademicYearAccordionProps) {
  const [expandedRazredi, setExpandedRazredi] = useState<Set<string>>(new Set());

  const toggleRazred = (razredId: string) => {
    const newExpanded = new Set(expandedRazredi);
    if (newExpanded.has(razredId)) {
      newExpanded.delete(razredId);
    } else {
      newExpanded.add(razredId);
    }
    setExpandedRazredi(newExpanded);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onExpand();
        }}
        className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
        type="button"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${year.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`} />
          <div className="text-left min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{year.naziv}</h3>
            <p className="text-sm text-gray-500">
              {year.razredi.length} razred{year.razredi.length !== 1 ? 'a' : ''}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-white">
          {year.razredi.map((razred) => (
            <div key={razred.id} className="border-b border-gray-200 last:border-b-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRazred(razred.id);
                }}
                className="w-full px-6 py-3 bg-white hover:bg-gray-50 flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
                type="button"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{razred.razred.name}</span>
                  <span className="text-sm text-gray-500">
                    ({razred.ucenici.length} učenik{razred.ucenici.length !== 1 ? 'a' : ''})
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                    expandedRazredi.has(razred.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedRazredi.has(razred.id) && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {razred.ucenici.map((ucenik) => (
                      <button
                        key={ucenik.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStudentClick(ucenik.id, razred.id);
                        }}
                        className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 text-left border border-gray-200 hover:border-indigo-300 hover:ring-2 hover:ring-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          {ucenik.fotografija ? (
                            <img
                              src={`${import.meta.env['VITE_API_URL'] || 'http://localhost:3000'}${ucenik.fotografija}`}
                              alt={`${ucenik.ime} ${ucenik.prezime}`}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold flex-shrink-0">
                              {ucenik.ime.charAt(0).toUpperCase()}
                              {ucenik.prezime.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {ucenik.ime} {ucenik.prezime}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

