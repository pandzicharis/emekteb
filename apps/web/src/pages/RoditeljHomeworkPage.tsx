import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface DashboardData {
  ucenici: Array<{ id: string; ime: string; prezime: string }>;
}

interface Homework {
  id: string;
  ucenikId: string;
  ucenikIme: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  completedDate?: string;
}

export default function RoditeljHomeworkPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [selectedUcenikId, setSelectedUcenikId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHomework, setNewHomework] = useState({
    ucenikId: '',
    title: '',
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch dashboard to get children list
        const dashboardRes = await axios.get<DashboardData>(`${API_URL}/roditelj/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDashboardData(dashboardRes.data);

        // Load homeworks from localStorage (frontend only for now)
        const savedHomeworks = JSON.parse(localStorage.getItem('homeworks') || '[]');
        setHomeworks(savedHomeworks);
      } catch (err: any) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomework.ucenikId || !newHomework.title || !newHomework.dueDate) {
      return;
    }

    const ucenik = dashboardData?.ucenici.find((u) => u.id === newHomework.ucenikId);
    const homework: Homework = {
      id: `hw-${Date.now()}`,
      ucenikId: newHomework.ucenikId,
      ucenikIme: ucenik ? `${ucenik.ime} ${ucenik.prezime}` : '',
      title: newHomework.title,
      description: newHomework.description,
      dueDate: newHomework.dueDate,
      completed: false,
    };

    const updatedHomeworks = [...homeworks, homework];
    setHomeworks(updatedHomeworks);
    localStorage.setItem('homeworks', JSON.stringify(updatedHomeworks));

    setNewHomework({
      ucenikId: '',
      title: '',
      description: '',
      dueDate: '',
    });
    setShowAddForm(false);
  };

  const toggleComplete = (homeworkId: string) => {
    const updatedHomeworks = homeworks.map((hw) => {
      if (hw.id === homeworkId) {
        return {
          ...hw,
          completed: !hw.completed,
          completedDate: !hw.completed ? new Date().toISOString() : undefined,
        };
      }
      return hw;
    });
    setHomeworks(updatedHomeworks);
    localStorage.setItem('homeworks', JSON.stringify(updatedHomeworks));
  };

  const deleteHomework = (homeworkId: string) => {
    const updatedHomeworks = homeworks.filter((hw) => hw.id !== homeworkId);
    setHomeworks(updatedHomeworks);
    localStorage.setItem('homeworks', JSON.stringify(updatedHomeworks));
  };

  const filteredHomeworks = homeworks.filter((hw) => {
    if (selectedUcenikId !== 'all' && hw.ucenikId !== selectedUcenikId) return false;
    if (filterStatus === 'completed' && !hw.completed) return false;
    if (filterStatus === 'pending' && hw.completed) return false;
    return true;
  });

  const getHomeworkStatus = (homework: Homework) => {
    if (homework.completed) return 'completed';
    const dueDate = new Date(homework.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'overdue';
    if (dueDate.getTime() === today.getTime()) return 'due-today';
    return 'pending';
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Zadaće</h1>
              <p className="mt-2 text-gray-600">Upravljajte zadaćama vaše djece</p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Dodaj Zadaću</span>
            </button>
          </div>
        </div>

        {/* Add Homework Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Dodaj Novu Zadaću</h2>
            <form onSubmit={handleAddHomework} className="space-y-4">
              {dashboardData && dashboardData.ucenici.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dijete</label>
                  <select
                    value={newHomework.ucenikId}
                    onChange={(e) => setNewHomework({ ...newHomework, ucenikId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Izaberi dijete</option>
                    {dashboardData.ucenici.map((ucenik) => (
                      <option key={ucenik.id} value={ucenik.id}>
                        {ucenik.ime} {ucenik.prezime}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Naslov</label>
                <input
                  type="text"
                  value={newHomework.title}
                  onChange={(e) => setNewHomework({ ...newHomework, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opis</label>
                <textarea
                  value={newHomework.description}
                  onChange={(e) => setNewHomework({ ...newHomework, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rok za završetak</label>
                <input
                  type="date"
                  value={newHomework.dueDate}
                  onChange={(e) => setNewHomework({ ...newHomework, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div className="flex items-center space-x-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Dodaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewHomework({ ucenikId: '', title: '', description: '', dueDate: '' });
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Otkaži
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData && dashboardData.ucenici.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filtriraj po djetetu:</label>
                <select
                  value={selectedUcenikId}
                  onChange={(e) => setSelectedUcenikId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">Sva djeca</option>
                  {dashboardData.ucenici.map((ucenik) => (
                    <option key={ucenik.id} value={ucenik.id}>
                      {ucenik.ime} {ucenik.prezime}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Sve</option>
                <option value="pending">U toku</option>
                <option value="completed">Završeno</option>
              </select>
            </div>
          </div>
        </div>

        {/* Homeworks List */}
        <div className="space-y-4">
          {filteredHomeworks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-gray-500">Nema zadaća</p>
            </div>
          ) : (
            filteredHomeworks.map((homework) => {
              const status = getHomeworkStatus(homework);
              return (
                <div
                  key={homework.id}
                  className={`bg-white rounded-xl shadow-lg p-6 border-2 ${
                    homework.completed
                      ? 'border-green-200 bg-green-50'
                      : status === 'overdue'
                      ? 'border-red-200 bg-red-50'
                      : status === 'due-today'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <input
                          type="checkbox"
                          checked={homework.completed}
                          onChange={() => toggleComplete(homework.id)}
                          className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <h3
                          className={`text-xl font-semibold ${
                            homework.completed ? 'line-through text-gray-500' : 'text-gray-900'
                          }`}
                        >
                          {homework.title}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                          {homework.ucenikIme}
                        </span>
                        {status === 'overdue' && !homework.completed && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            Zakašnjeno
                          </span>
                        )}
                        {status === 'due-today' && !homework.completed && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            Danas
                          </span>
                        )}
                        {homework.completed && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Završeno
                          </span>
                        )}
                      </div>
                      {homework.description && (
                        <p className="text-gray-700 mb-3 ml-8">{homework.description}</p>
                      )}
                      <div className="ml-8 flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            Rok: {new Date(homework.dueDate).toLocaleDateString('bs-BA')}
                          </span>
                        </div>
                        {homework.completed && homework.completedDate && (
                          <div className="flex items-center space-x-2 text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>
                              Završeno: {new Date(homework.completedDate).toLocaleDateString('bs-BA')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteHomework(homework.id)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


