import { useState, useEffect } from 'react';
import { Ucenik, StudentDiplomaData } from './types';
import { DIPLOMA_TYPES, getDiplomaTypeById } from './constants';

interface CustomFieldsStepProps {
  diplomaType: string | null;
  selectedStudents: Ucenik[];
  studentsData: StudentDiplomaData[];
  onStudentsDataChange: (data: StudentDiplomaData[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CustomFieldsStep({
  diplomaType,
  selectedStudents,
  studentsData,
  onStudentsDataChange,
  onNext,
  onBack,
}: CustomFieldsStepProps) {
  const [localData, setLocalData] = useState<StudentDiplomaData[]>(studentsData);

  useEffect(() => {
    // Initialize data for all selected students if not already present
    if (diplomaType && selectedStudents.length > 0) {
      const newData: StudentDiplomaData[] = selectedStudents.map((student) => {
        const existing = studentsData.find((sd) => sd.studentId === student.id);
        if (existing) return existing;

        // Initialize with empty values
        const type = getDiplomaTypeById(diplomaType);
        const customFieldValues: Record<string, any> = {};
        const today = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
        type?.customFields.forEach((field) => {
          // Set default value for date fields to today
          if (field.type === 'date') {
            customFieldValues[field.id] = today;
          } else {
            customFieldValues[field.id] = '';
          }
        });

        return {
          studentId: student.id,
          studentName: `${student.ime || ''} ${student.prezime || ''}`.trim(),
          diplomaType,
          customFieldValues,
        };
      });

      setLocalData(newData);
      onStudentsDataChange(newData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diplomaType, selectedStudents]);

  const updateField = (studentId: string, fieldId: string, value: any) => {
    const updated = localData.map((sd) => {
      if (sd.studentId === studentId) {
        return {
          ...sd,
          customFieldValues: {
            ...sd.customFieldValues,
            [fieldId]: value,
          },
        };
      }
      return sd;
    });
    setLocalData(updated);
    onStudentsDataChange(updated);
  };

  const type = diplomaType ? getDiplomaTypeById(diplomaType) : null;
  if (!type || selectedStudents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Nema podataka za prikaz</p>
      </div>
    );
  }

  const getInitials = (student: Ucenik) => {
    const first = student.ime?.[0] || '';
    const last = student.prezime?.[0] || '';
    return `${first}${last}`.toUpperCase() || '?';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Postavke za učenike</h2>
        <p className="text-gray-600">
          Popunite potrebne podatke za svakog učenika ({selectedStudents.length} učenika)
        </p>
      </div>

      <div className="space-y-6">
        {selectedStudents.map((student) => {
          const studentData = localData.find((sd) => sd.studentId === student.id);
          if (!studentData) return null;

          return (
            <div
              key={student.id}
              className="border border-gray-200 rounded-lg p-6 bg-gray-50"
            >
              {/* Student Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium">
                  {student.fotografija ? (
                    <img
                      src={`${import.meta.env['VITE_API_URL'] || 'http://localhost:3000'}/${student.fotografija}`}
                      alt={`${student.ime} ${student.prezime}`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(student)
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {student.ime} {student.prezime}
                  </h3>
                  {student.razredNaziv && (
                    <p className="text-sm text-gray-500">{student.razredNaziv}</p>
                  )}
                </div>
              </div>

              {/* Custom Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {type.customFields.map((field) => {
                  const value = studentData.customFieldValues[field.id] || '';
                  const isRequired = field.required;
                  const hasError = isRequired && !value;

                  return (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {field.label}
                        {isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'select' && field.options ? (
                        <select
                          value={value}
                          onChange={(e) =>
                            updateField(student.id, field.id, e.target.value)
                          }
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            hasError ? 'border-red-300' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Odaberite...</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={value}
                          onChange={(e) =>
                            updateField(student.id, field.id, e.target.value)
                          }
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            hasError ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={value}
                          onChange={(e) =>
                            updateField(student.id, field.id, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            hasError ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            updateField(student.id, field.id, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            hasError ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                      )}
                      {hasError && (
                        <p className="mt-1 text-xs text-red-600">
                          Ovo polje je obavezno
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation Summary */}
      {(() => {
        const invalidStudents = selectedStudents.filter((student) => {
          const studentData = localData.find((sd) => sd.studentId === student.id);
          if (!studentData) return true;
          const type = getDiplomaTypeById(diplomaType || '');
          if (!type) return true;
          return type.customFields.some((field) => {
            if (!field.required) return false;
            const value = studentData.customFieldValues[field.id];
            return !value || value === '';
          });
        });

        if (invalidStudents.length > 0) {
          return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-sm font-medium text-yellow-800">
                  Molimo popunite sva obavezna polja ({invalidStudents.length} učenik{invalidStudents.length !== 1 ? 'a' : ''})
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
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
        {(() => {
          const invalidCount = selectedStudents.filter((student) => {
            const studentData = localData.find((sd) => sd.studentId === student.id);
            if (!studentData) return true;
            const type = getDiplomaTypeById(diplomaType || '');
            if (!type) return true;
            return type.customFields.some((field) => {
              if (!field.required) return false;
              const value = studentData.customFieldValues[field.id];
              return !value || value === '';
            });
          }).length;

          const canProceed = invalidCount === 0 && localData.length === selectedStudents.length;

          return (
            <button
              onClick={onNext}
              disabled={!canProceed}
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
          );
        })()}
      </div>
    </div>
  );
}

