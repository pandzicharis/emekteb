import { StudentDiplomaData } from './types';
import { getDiplomaTypeById } from './constants';

interface ReviewStepProps {
  studentsData: StudentDiplomaData[];
  onGenerate: () => void;
  onBack: () => void;
  onReset: () => void;
  loading?: boolean;
  successMessage?: string | null;
}

export default function ReviewStep({
  studentsData,
  onGenerate,
  onBack,
  onReset,
  loading = false,
  successMessage = null,
}: ReviewStepProps) {
  if (studentsData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Nema podataka za pregled</p>
      </div>
    );
  }

  const diplomaType = studentsData[0]?.diplomaType
    ? getDiplomaTypeById(studentsData[0].diplomaType)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Pregled i generisanje</h2>
        <p className="text-gray-600">
          Pregledajte podatke prije generisanja diploma ({studentsData.length} diplome)
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Tip diplome: {diplomaType?.name || 'N/A'}
            </p>
            <p className="text-xs text-indigo-700 mt-0.5">
              Generisaće se {studentsData.length} {studentsData.length === 1 ? 'diploma' : 'diploma'}
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-8 shadow-lg mb-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex-shrink-0 w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                Uspešno generisano!
              </h3>
              <p className="text-lg text-green-800">{successMessage}</p>
            </div>
            <button
              onClick={onReset}
              className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md"
            >
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Generiši novu diplomu</span>
            </button>
          </div>
        </div>
      )}

      {/* Students List - Hide when success message is shown */}
      {!successMessage && (
        <div className="space-y-4">
          {studentsData.map((studentData, index) => {
          const type = getDiplomaTypeById(studentData.diplomaType);
          return (
            <div
              key={studentData.studentId}
              className="border border-gray-200 rounded-lg p-6 bg-white"
            >
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium text-sm">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {studentData.studentName}
                  </h3>
                  <p className="text-sm text-gray-500">{type?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {type?.customFields.map((field) => {
                  const value = studentData.customFieldValues[field.id];
                  return (
                    <div key={field.id}>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {field.label}
                      </p>
                      <p className="text-sm text-gray-900">
                        {value || <span className="text-gray-400">-</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Actions - Hide when success message is shown */}
      {!successMessage && (
        <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>Nazad</span>
        </button>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Generisanje...</span>
            </>
          ) : (
            <>
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>Generiši diplome</span>
            </>
          )}
        </button>
        </div>
      )}
    </div>
  );
}


