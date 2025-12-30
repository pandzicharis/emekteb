import { useState, useEffect } from 'react';
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
  primalac?: {
    id: string;
    ime: string | null;
    prezime: string | null;
    email: string | null;
    fotografija: string | null;
    uloga?: string;
  };
}

interface MoguciPrimalac {
  id: string;
  ime: string | null;
  prezime: string | null;
  email: string | null;
  fotografija: string | null;
  uloga?: string;
}

export default function KomunikacijaPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [moguciPrimaoci, setMoguciPrimaoci] = useState<MoguciPrimalac[]>([]);
  const [loadingPrimaoci, setLoadingPrimaoci] = useState(false);
  const [newMessage, setNewMessage] = useState({
    receiverId: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
    fetchMogucePrimaoce();
  }, [user]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get<Message[]>(`${API_URL}/poruke/primljene`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data);
    } catch (err) {
      console.error('Error fetching messages:', err);
      const errorMessage = axios.isAxiosError(err) && err.response?.data?.message 
        ? err.response.data.message 
        : 'Greška pri učitavanju poruka';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchMogucePrimaoce = async () => {
    try {
      setLoadingPrimaoci(true);
      const token = localStorage.getItem('token');
      const response = await axios.get<MoguciPrimalac[]>(`${API_URL}/poruke/moguci-primaoci`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMoguciPrimaoci(response.data);
    } catch (err) {
      console.error('Error fetching moguci primaoci:', err);
    } finally {
      setLoadingPrimaoci(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.receiverId || !newMessage.subject || !newMessage.message.trim()) {
      setError('Molimo popunite sva polja');
      return;
    }

    try {
      setSending(true);
      setError(null);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/poruke`,
        {
          primalacId: newMessage.receiverId,
          naslov: newMessage.subject,
          sadrzaj: newMessage.message,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setComposeOpen(false);
      setNewMessage({ receiverId: '', subject: '', message: '' });
      // Refresh messages
      await fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = axios.isAxiosError(err) && err.response?.data?.message 
        ? err.response.data.message 
        : 'Greška pri slanju poruke';
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

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

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje poruka...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Komunikacija</h1>
            <p className="mt-2 text-gray-600">Poruke i obavještenja</p>
          </div>
          <button
            onClick={() => setComposeOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova poruka
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-indigo-50">
              <h2 className="font-semibold text-gray-900">
                Primljene poruke {unreadCount > 0 && <span className="text-indigo-600">({unreadCount})</span>}
              </h2>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              {messages.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nema poruka</div>
              ) : (
                messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => {
                      setSelectedMessage(message);
                      if (!message.procitana) {
                        markAsRead(message.id);
                      }
                    }}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      !message.procitana ? 'bg-indigo-50/50' : ''
                    } ${selectedMessage?.id === message.id ? 'bg-indigo-100' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900 text-sm">{getSenderName(message)}</p>
                      {!message.procitana && (
                        <span className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full mt-1"></span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1 truncate">{message.naslov}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(message.kreiran).toLocaleDateString('bs-BA', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            {selectedMessage ? (
              <div>
                <div className="mb-6">
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2 mb-4"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Nazad na listu
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedMessage.naslov}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <span>Od: {getSenderName(selectedMessage)}</span>
                    <span>•</span>
                    <span>
                      {new Date(selectedMessage.kreiran).toLocaleDateString('bs-BA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.sadrzaj}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>Odaberite poruku za pregled</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compose Modal */}
        {composeOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
                <h3 className="text-lg font-bold text-gray-900">Nova poruka</h3>
                <button
                  onClick={() => {
                    setComposeOpen(false);
                    setError(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Za:</label>
                  {loadingPrimaoci ? (
                    <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                      Učitavanje...
                    </div>
                  ) : (
                    <select
                      value={newMessage.receiverId}
                      onChange={(e) => setNewMessage({ ...newMessage, receiverId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Odaberite primaoca...</option>
                      {moguciPrimaoci.map((primalac) => (
                        <option key={primalac.id} value={primalac.id}>
                          {primalac.ime && primalac.prezime
                            ? `${primalac.ime} ${primalac.prezime}${primalac.uloga ? ` (${primalac.uloga})` : ''}`
                            : primalac.email || 'Nepoznato'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Naslov:</label>
                  <input
                    type="text"
                    value={newMessage.subject}
                    onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Naslov poruke"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Poruka:</label>
                  <textarea
                    value={newMessage.message}
                    onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                    rows={10}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Unesite poruku..."
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setComposeOpen(false);
                      setError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    disabled={sending}
                  >
                    Otkaži
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.receiverId || !newMessage.subject || !newMessage.message.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Slanje...' : 'Pošalji'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

