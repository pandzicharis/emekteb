import { DIPLOMA_TYPES } from './constants';

interface DiplomaTypeSelectionStepProps {
  selectedType: string | null;
  onSelect: (typeId: string) => void;
  onNext: () => void;
}

export default function DiplomaTypeSelectionStep({
  selectedType,
  onSelect,
  onNext,
}: DiplomaTypeSelectionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Odaberite tip diplome</h2>
        <p className="text-gray-600">Izaberite tip diplome koji želite generisati</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DIPLOMA_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={`p-6 rounded-lg border-2 text-left transition-all hover:shadow-md ${
              selectedType === type.id
                ? 'border-indigo-600 bg-indigo-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{type.name}</h3>
                {type.description && (
                  <p className="text-sm text-gray-600">{type.description}</p>
                )}
              </div>
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedType === type.id
                    ? 'border-indigo-600 bg-indigo-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selectedType === type.id && (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Potrebno polja: {type.customFields.filter((f) => f.required).length} obavezno,{' '}
                {type.customFields.filter((f) => !f.required).length} opciono
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onNext}
          disabled={!selectedType}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>Dalje</span>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}



