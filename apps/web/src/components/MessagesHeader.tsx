import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface Message {
  id: string;
  naslov: string;
  sadrzaj: string;
  procitana: boolean;
  kreiran: string;
  posiljalac: {
    id: string;
    ime: string | null;
    prezime: string | null;
    email: string | null;
    fotografija: string | null;
    uloga?: string;
  };
}

export default function MessagesHeader() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch messages from API
        const response = await axios.get(`${API_URL}/poruke/primljene`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setMessages(response.data.slice(0, 10));
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (messageId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/poruke/${messageId}/procitano`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, procitana: true } : msg)));
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const unreadCount = messages.filter((m) => !m.procitana).length;

  const getSenderName = (message: Message) => {
    if (message.posiljalac.ime && message.posiljalac.prezime) {
      return `${message.posiljalac.ime} ${message.posiljalac.prezime}`;
    }
    return message.posiljalac.email || 'Nepoznato';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
              <h3 className="font-semibold text-gray-900">Poruke</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    navigate('/komunikacija');
                    setShowDropdown(false);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Vidi sve →
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Učitavanje...</div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nema poruka</div>
              ) : (
                messages.map((message) => (
                  <Link
                    key={message.id}
                    to="/komunikacija"
                    onClick={() => {
                      markAsRead(message.id);
                      setShowDropdown(false);
                    }}
                    className={`block p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      !message.procitana ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">{getSenderName(message)}</p>
                          {!message.procitana && (
                            <span className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{message.naslov}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(message.kreiran).toLocaleDateString('bs-BA', {
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
                to="/komunikacija"
                onClick={() => setShowDropdown(false)}
                className="block text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Vidi sve poruke →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}





