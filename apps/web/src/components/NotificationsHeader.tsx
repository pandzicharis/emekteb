import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface Notification {
  id: string;
  type: 'ocjena' | 'prisustvo' | 'pohvala' | 'napomena' | 'general';
  title: string;
  message: string;
  date: string;
  read: boolean;
  link?: string;
}

export default function NotificationsHeader() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch notifications from API
        const response = await axios.get(`${API_URL}/notifikacije`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const notifications: Notification[] = response.data.map((notif: any) => ({
          id: notif.id,
          type: notif.tip.toLowerCase() as 'ocjena' | 'prisustvo' | 'pohvala' | 'napomena' | 'general',
          title: notif.naslov,
          message: notif.poruka,
          date: notif.kreiran,
          read: notif.procitana,
          link: notif.link || undefined,
        }));

        setNotifications(notifications.slice(0, 10));
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/notifikacije/${notificationId}/procitano`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNotifications((prev) => prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif)));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/notifikacije/sve-procitano`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'ocjena':
        return (
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      case 'prisustvo':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Don't show for roles that don't have notifications page
  const notificationsPagePath =
    user?.uloga === 'RODITELJ'
      ? '/roditelj/obavjestenja'
      : user?.uloga === 'MUALLIM'
      ? '/obavjestenja'
      : user?.uloga === 'ADMIN'
      ? '/obavjestenja'
      : null;

  if (!notificationsPagePath) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-96 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Obavještenja</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Označi sve kao pročitano
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Učitavanje...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nema obavještenja</div>
              ) : (
                notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    to={notification.link || notificationsPagePath}
                    onClick={() => {
                      markAsRead(notification.id);
                      setShowDropdown(false);
                    }}
                    className={`block p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                          {!notification.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.date).toLocaleDateString('bs-BA', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <Link
                to={notificationsPagePath}
                onClick={() => setShowDropdown(false)}
                className="block text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Vidi sve obavještenja →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

