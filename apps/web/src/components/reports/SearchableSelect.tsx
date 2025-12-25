import { useState, useRef, useEffect } from 'react';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string; [key: string]: any }>;
  disabled?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Odaberite opciju...',
  icon,
  loading = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className={`
            w-full px-4 py-3 text-left bg-white border-2 rounded-lg shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400
            flex items-center justify-between
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}
            transition-all duration-200
          `}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
            <span className={selectedOption ? 'text-gray-900' : 'text-gray-500 truncate'}>
              {loading ? 'Učitavanje...' : selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isOpen && !disabled && !loading && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pretraži..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-48">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`
                  w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors
                  ${!value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                `}
              >
                {placeholder}
              </button>
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  Nema rezultata
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`
                      w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors
                      ${value === option.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                    `}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
            {filteredOptions.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
                {filteredOptions.length} {filteredOptions.length === 1 ? 'opcija' : 'opcija'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

