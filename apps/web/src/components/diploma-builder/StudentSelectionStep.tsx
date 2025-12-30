import { useState, useEffect } from 'react';
import axios from 'axios';
import { Ucenik } from './types';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface StudentSelectionStepProps {
  selectedStudents: Ucenik[];
  onStudentsChange: (students: Ucenik[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StudentSelectionStep({
  selectedStudents,
  onStudentsChange,
  onNext,
  onBack,
}: StudentSelectionStepProps) {
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUcenici();
  }, []);

  const fetchUcenici = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/ucenici?page=1&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data.data || response.data || [];
      // Filter samo aktivne učenike
      const aktivni = data.filter((u: Ucenik) => u.status === 'AKTIVAN');
      setUcenici(aktivni);
    } catch (error) {
      console.error('Error fetching ucenici:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (student: Ucenik) => {
    const isSelected = selectedStudents.some((s) => s.id === student.id);
    if (isSelected) {
      onStudentsChange(selectedStudents.filter((s) => s.id !== student.id));
    } else {
      onStudentsChange([...selectedStudents, student]);
    }
  };

  const filteredStudents = ucenici.filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${u.ime || ''} ${u.prezime || ''}`.toLowerCase();
    return fullName.includes(query);
  });

  const getInitials = (ucenik: Ucenik) => {
    const first = ucenik.ime?.[0] || '';
    const last = ucenik.prezime?.[0] || '';
    return `${first}${last}`.toUpperCase() || '?';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Odaberite učenike</h2>
        <p className="text-gray-600">
          Odaberite učenike za koje želite generisati diplome ({selectedStudents.length} odabrano)
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Pretraži učenike po imenu ili prezimenu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-50 rounded-r-lg transition-colors"
          >
            <svg
              className="h-4 w-4 text-gray-400 hover:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>Nema učenika za prikaz</p>
            </div>
          ) : (
            filteredStudents.map((ucenik) => {
              const isSelected = selectedStudents.some((s) => s.id === ucenik.id);
              return (
                <div
                  key={ucenik.id}
                  onClick={() => toggleStudent(ucenik)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center font-medium text-sm ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300 bg-white text-gray-600'
                      }`}
                    >
                      {ucenik.fotografija ? (
                        <img
                          src={`${API_URL}/${ucenik.fotografija}`}
                          alt={`${ucenik.ime} ${ucenik.prezime}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        getInitials(ucenik)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {ucenik.ime} {ucenik.prezime}
                      </p>
                      {ucenik.razredNaziv && (
                        <p className="text-xs text-gray-500 mt-0.5">{ucenik.razredNaziv}</p>
                      )}
                    </div>
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

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
        <button
          onClick={onNext}
          disabled={selectedStudents.length === 0}
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


