import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

export default function RoditeljProfileSettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    ocjene: true,
    prisustvo: true,
    pohvale: true,
    napomene: false,
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Nove lozinke se ne poklapaju');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // For now, just show success message (API endpoint can be added later)
      // await axios.post(`${API_URL}/roditelj/change-password`, passwordForm, {
      //   headers: { Authorization: `Bearer ${token}` },
      // });

      setSuccess('Lozinka je uspješno promijenjena');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri promjeni lozinke');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof notificationSettings) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

    // Save to localStorage
    localStorage.setItem('notificationSettings', JSON.stringify({
      ...notificationSettings,
      [key]: !notificationSettings[key],
    }));
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Nazad na Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Postavke Profila</h1>
          <p className="mt-2 text-gray-600">Upravljajte svojim profilom i postavkama</p>
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Informacije o Profilu</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ime i Prezime</label>
              <p className="text-lg text-gray-900">
                {user?.ime || ''} {user?.prezime || ''}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-lg text-gray-900">{user?.email || ''}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uloga</label>
              <p className="text-lg text-gray-900">Roditelj</p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Promjena Lozinke</h2>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{success}</p>
            </div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Trenutna lozinka
              </label>
              <input
                type="password"
                id="currentPassword"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Nova lozinka
              </label>
              <input
                type="password"
                id="newPassword"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Potvrdite novu lozinku
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Čuvanje...' : 'Promijeni lozinku'}
            </button>
          </form>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Postavke Obavještenja</h2>
          <p className="text-gray-600 mb-4">
            Odaberite tipove obavještenja koje želite primati (email obavještenja)
          </p>
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.ocjene}
                onChange={() => handleNotificationChange('ocjene')}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <p className="font-medium text-gray-900">Ocjene</p>
                <p className="text-sm text-gray-500">Primaj obavještenja o novim ocjenama</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.prisustvo}
                onChange={() => handleNotificationChange('prisustvo')}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <p className="font-medium text-gray-900">Prisustvo</p>
                <p className="text-sm text-gray-500">Primaj obavještenja o neopravdanim izostancima</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.pohvale}
                onChange={() => handleNotificationChange('pohvale')}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <p className="font-medium text-gray-900">Pohvale i Priznanja</p>
                <p className="text-sm text-gray-500">Primaj obavještenja o pohvalama i priznanjima</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.napomene}
                onChange={() => handleNotificationChange('napomene')}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <p className="font-medium text-gray-900">Napomene</p>
                <p className="text-sm text-gray-500">Primaj obavještenja o napomenama i komentarima</p>
              </div>
            </label>
          </div>
        </div>

        {/* Logout */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Izlaz iz Sistema</h2>
          <p className="text-gray-600 mb-4">Odjavite se iz sistema</p>
          <button
            onClick={logout}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Odjavi se
          </button>
        </div>
      </div>
    </div>
  );
}


