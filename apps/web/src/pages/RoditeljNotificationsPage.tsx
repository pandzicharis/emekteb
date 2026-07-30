import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface DashboardData {
  ucenici: Array<{ id: string; ime: string; prezime: string }>;
}

interface Notification {
  id: string;
  type: 'ocjena' | 'prisustvo' | 'pohvala' | 'napomena';
  ucenikId: string;
  ucenikIme: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  metadata?: any;
}

export default function RoditeljNotificationsPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<'all' | Notification['type']>('all');
  const [filterUcenik, setFilterUcenik] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');

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

        // Generate notifications from existing data
        const allNotifications: Notification[] = [];

        for (const ucenik of dashboardRes.data.ucenici) {
          try {
            // Fetch ocjene
            const ocjeneRes = await axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/ocjene`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (ocjeneRes.data.ocjene) {
              ocjeneRes.data.ocjene.slice(0, 10).forEach((ocjena: any) => {
                allNotifications.push({
                  id: `ocjena-${ocjena.id}`,
                  type: 'ocjena',
                  ucenikId: ucenik.id,
                  ucenikIme: `${ucenik.ime} ${ucenik.prezime}`,
                  title: `Nova ocjena`,
                  message: `Ocjena ${ocjena.ocjena} iz ${ocjena.lekcija.naslov}`,
                  date: ocjena.datum,
                  read: false,
                  metadata: { ocjena: ocjena.ocjena, lekcija: ocjena.lekcija.naslov },
                });
              });
            }

            // Fetch prisustvo
            const prisustvoRes = await axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/prisustvo`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (prisustvoRes.data.prisustva) {
              prisustvoRes.data.prisustva
                .filter((p: any) => p.status === 'NEOPRAVDAN')
                .slice(0, 5)
                .forEach((prisustvo: any) => {
                  allNotifications.push({
                    id: `prisustvo-${prisustvo.id}`,
                    type: 'prisustvo',
                    ucenikId: ucenik.id,
                    ucenikIme: `${ucenik.ime} ${ucenik.prezime}`,
                    title: `Neopravdani izostanak`,
                    message: `Neopravdano prisustvo ${new Date(prisustvo.datum).toLocaleDateString('bs-BA')}`,
                    date: prisustvo.datum,
                    read: false,
                    metadata: { status: prisustvo.status, napomena: prisustvo.napomena },
                  });
                });
            }

            // Fetch napredak for pohvale
            const napredakRes = await axios.get(`${API_URL}/roditelj/ucenik/${ucenik.id}/napredak`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (napredakRes.data.napredak?.pohvaleIPriznanja) {
              napredakRes.data.napredak.pohvaleIPriznanja.slice(0, 5).forEach((pohvala: string, idx: number) => {
                allNotifications.push({
                  id: `pohvala-${ucenik.id}-${idx}`,
                  type: 'pohvala',
                  ucenikId: ucenik.id,
                  ucenikIme: `${ucenik.ime} ${ucenik.prezime}`,
                  title: `Pohvala`,
                  message: pohvala,
                  date: new Date().toISOString(), // Mock date
                  read: false,
                  metadata: { pohvala },
                });
              });
            }
          } catch (err) {
            console.error(`Error fetching notifications for ${ucenik.id}:`, err);
          }
        }

        // Sort by date (newest first)
        allNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Load read status from localStorage
        const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        const notificationsWithReadStatus = allNotifications.map((notif) => ({
          ...notif,
          read: readNotifications.includes(notif.id),
        }));

        setNotifications(notificationsWithReadStatus);
      } catch (err: any) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif))
    );

    // Save to localStorage
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    if (!readNotifications.includes(notificationId)) {
      readNotifications.push(notificationId);
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    localStorage.setItem('readNotifications', JSON.stringify(allIds));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'ocjena':
        return (
          <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      case 'prisustvo':
        return (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'pohvala':
        return (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'ocjena':
        return 'bg-amber-50 border-amber-200';
      case 'prisustvo':
        return 'bg-red-50 border-red-200';
      case 'pohvala':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType !== 'all' && notif.type !== filterType) return false;
    if (filterUcenik !== 'all' && notif.ucenikId !== filterUcenik) return false;
    if (filterRead === 'read' && !notif.read) return false;
    if (filterRead === 'unread' && notif.read) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

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
              <h1 className="text-4xl font-bold text-gray-900">Obavještenja</h1>
              <p className="mt-2 text-gray-600">Pregled svih obavještenja o vašoj djeci</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Označi sve kao pročitano ({unreadCount})
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tip obavještenja:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Svi tipovi</option>
                <option value="ocjena">Ocjene</option>
                <option value="prisustvo">Prisustvo</option>
                <option value="pohvala">Pohvale</option>
              </select>
            </div>
            {dashboardData && dashboardData.ucenici.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dijete:</label>
                <select
                  value={filterUcenik}
                  onChange={(e) => setFilterUcenik(e.target.value)}
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
                value={filterRead}
                onChange={(e) => setFilterRead(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Sve</option>
                <option value="unread">Nepročitano</option>
                <option value="read">Pročitano</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="mt-4 text-gray-500">Nema obavještenja</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <Link
                key={notification.id}
                to={`/roditelj/dijete/${notification.ucenikId}`}
                onClick={() => markAsRead(notification.id)}
                className={`block bg-white rounded-xl shadow-lg p-6 border-2 ${getNotificationColor(notification.type)} ${
                  !notification.read ? 'border-l-4 border-l-indigo-500' : ''
                } hover:shadow-xl transition-all`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <p className="text-lg font-semibold text-gray-900">{notification.title}</p>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                          {notification.ucenikIme}
                        </span>
                        {!notification.read && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            Novo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(notification.date).toLocaleDateString('bs-BA', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <p className="text-gray-700">{notification.message}</p>
                    {notification.metadata && notification.type === 'ocjena' && (
                      <div className="mt-3 flex items-center space-x-2">
                        <span className="text-2xl font-bold text-amber-600">{notification.metadata.ocjena}</span>
                        <span className="text-sm text-gray-600">iz {notification.metadata.lekcija}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}





