import { useEffect, useState } from 'react';
import axios from 'axios';

type SlobodanDan = {
  id: string;
  nastavnaGodina: {
    id: string;
    naziv: string;
    datumOd: string;
    datumDo: string;
  };
  datum: string;
  razlog: string;
  kreiran: string;
  azuriran: string;
};

type NastavnaGodina = {
  id: string;
  naziv: string;
  datumOd: string;
  datumDo: string;
};

export default function SlobodniDaniPage() {
  const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';
  const [slobodniDani, setSlobodniDani] = useState<SlobodanDan[]>([]);
  const [nastavneGodine, setNastavneGodine] = useState<NastavnaGodina[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; naziv: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedNastavnaGodinaId, setSelectedNastavnaGodinaId] = useState<string>('');

  const [form, setForm] = useState<{
    nastavnaGodinaId: string;
    datum: string;
    razlog: string;
  }>({
    nastavnaGodinaId: '',
    datum: '',
    razlog: '',
  });

  const selectedSlobodanDan = slobodniDani.find((sd) => sd.id === selectedId) ?? null;

  const resetForm = () => {
    setForm({
      nastavnaGodinaId: selectedNastavnaGodinaId || (nastavneGodine.length > 0 ? nastavneGodine[0].id : ''),
      datum: '',
      razlog: '',
    });
    setSelectedId(null);
  };

  const loadNastavneGodine = async () => {
    try {
      const response = await axios.get<NastavnaGodina[]>(`${API_URL}/nastavne-godine`, { timeout: 8000 });
      setNastavneGodine(response.data || []);
      if (response.data && response.data.length > 0 && !selectedNastavnaGodinaId) {
        setSelectedNastavnaGodinaId(response.data[0].id);
        setForm((prev) => ({ ...prev, nastavnaGodinaId: response.data[0].id }));
      }
    } catch (err) {
      console.error('Error loading nastavne godine:', err);
    }
  };

  const loadSlobodniDani = async (nastavnaGodinaId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = nastavnaGodinaId ? { nastavnaGodinaId } : {};
      const response = await axios.get<SlobodanDan[]>(`${API_URL}/slobodni-dani`, {
        params,
        timeout: 8000,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setSlobodniDani(response.data || []);
    } catch (err) {
      console.warn('Fetch slobodnih dana nije uspio', err);
      setError('Nisam uspio dohvatiti slobodne dane.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNastavneGodine();
  }, []);

  useEffect(() => {
    if (selectedNastavnaGodinaId) {
      loadSlobodniDani(selectedNastavnaGodinaId);
    } else {
      loadSlobodniDani();
    }
  }, [selectedNastavnaGodinaId]);

  const handleSelect = (slobodanDan: SlobodanDan) => {
    setSelectedId(slobodanDan.id);
    setForm({
      nastavnaGodinaId: slobodanDan.nastavnaGodina.id,
      datum: slobodanDan.datum.split('T')[0], // Extract YYYY-MM-DD from ISO string
      razlog: slobodanDan.razlog,
    });
  };

  const handleSave = () => {
    if (!form.nastavnaGodinaId) {
      setError('Odaberite nastavnu godinu');
      return;
    }
    if (!form.datum) {
      setError('Unesite datum');
      return;
    }
    if (!form.razlog || form.razlog.trim().length < 3) {
      setError('Razlog mora imati najmanje 3 karaktera');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      nastavnaGodinaId: form.nastavnaGodinaId,
      datum: form.datum, // YYYY-MM-DD format
      razlog: form.razlog.trim(),
    };

    const request = selectedId
      ? axios.put(
          `${API_URL}/slobodni-dani/${selectedId}`,
          { datum: payload.datum, razlog: payload.razlog },
          {
            timeout: 8000,
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          },
        )
      : axios.post(`${API_URL}/slobodni-dani`, payload, {
          timeout: 8000,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

    request
      .then(() => {
        loadSlobodniDani(selectedNastavnaGodinaId);
        if (!selectedId) {
          resetForm();
        }
        setToast({ type: 'success', message: selectedId ? 'Slobodan dan ažuriran.' : 'Slobodan dan dodan.' });
      })
      .catch((err) => {
        const errorMessage = err.response?.data?.message || err.message || 'Spremanje nije uspjelo.';
        setError(errorMessage);
        setToast({ type: 'error', message: errorMessage });
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: string) => {
    const slobodanDan = slobodniDani.find((sd) => sd.id === id);
    if (slobodanDan) {
      const datumStr = new Date(slobodanDan.datum).toLocaleDateString('bs-BA');
      setDeleteTarget({ id, naziv: `${datumStr} - ${slobodanDan.razlog}` });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    axios
      .delete(`${API_URL}/slobodni-dani/${deleteTarget.id}`, {
        timeout: 8000,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      .then(() => {
        if (selectedId === deleteTarget.id) {
          resetForm();
        }
        setDeleteTarget(null);
        loadSlobodniDani(selectedNastavnaGodinaId);
        setToast({ type: 'success', message: 'Slobodan dan obrisan.' });
      })
      .catch((err) => {
        const errorMessage = err.response?.data?.message || err.message || 'Brisanje nije uspjelo.';
        setError(errorMessage);
        setToast({ type: 'error', message: errorMessage });
      })
      .finally(() => setSaving(false));
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('bs-BA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };

  const toastNode = toast ? (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}
      >
        <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {toast.type === 'success' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <div className="text-sm leading-5">{toast.message}</div>
      </div>
    </div>
  ) : null;

  const filteredSlobodniDani = slobodniDani.filter((sd) => {
    if (!selectedNastavnaGodinaId) return true;
    return sd.nastavnaGodina.id === selectedNastavnaGodinaId;
  });

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      {toastNode}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Slobodni dani</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljajte slobodnim danima kada mekteb ne radi.</p>
        </div>
      </div>

      {/* Filter za nastavnu godinu */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-100 mb-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-gray-700">Nastavna godina:</label>
          <select
            value={selectedNastavnaGodinaId}
            onChange={(e) => {
              setSelectedNastavnaGodinaId(e.target.value);
              setForm((prev) => ({ ...prev, nastavnaGodinaId: e.target.value }));
            }}
            className="rounded-lg border border-gray-200 bg-gray-50 text-sm px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          >
            <option value="">Sve nastavne godine</option>
            {nastavneGodine.map((ng) => (
              <option key={ng.id} value={ng.id}>
                {ng.naziv}
              </option>
            ))}
          </select>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        {loading && <div className="mt-3 text-sm text-gray-500">Učitavam slobodne dane...</div>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Slobodni dani ({filteredSlobodniDani.length})
            </h2>
          </div>

          <div className="space-y-3">
            {filteredSlobodniDani.map((slobodanDan) => {
              const dateStr = formatDate(slobodanDan.datum);
              const today = isToday(slobodanDan.datum);
              return (
                <div
                  key={slobodanDan.id}
                  className={`border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition cursor-pointer ${
                    selectedId === slobodanDan.id ? 'ring-2 ring-blue-200' : ''
                  } ${today ? 'border-blue-300 bg-blue-50/30' : ''}`}
                  onClick={() => handleSelect(slobodanDan)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="text-base font-semibold text-gray-900">{dateStr}</div>
                        {today && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Danas
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Razlog:</span> {slobodanDan.razlog}
                      </div>
                      <div className="text-xs text-gray-500">
                        {slobodanDan.nastavnaGodina.naziv}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(slobodanDan.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Obriši"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredSlobodniDani.length === 0 && (
              <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                Nema slobodnih dana. Dodajte novi.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg shadow p-4 space-y-4 self-start">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {selectedId ? 'Uredi slobodan dan' : 'Novi slobodan dan'}
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nastavna godina *</label>
              <select
                value={form.nastavnaGodinaId}
                onChange={(e) => setForm((prev) => ({ ...prev, nastavnaGodinaId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                disabled={!!selectedId}
              >
                <option value="">Odaberite nastavnu godinu</option>
                {nastavneGodine.map((ng) => (
                  <option key={ng.id} value={ng.id}>
                    {ng.naziv}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Datum *</label>
              <input
                type="date"
                value={form.datum}
                onChange={(e) => setForm((prev) => ({ ...prev, datum: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                disabled={!!selectedId}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Razlog *</label>
              <textarea
                value={form.razlog}
                onChange={(e) => setForm((prev) => ({ ...prev, razlog: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                rows={4}
                placeholder="Unesite razlog zašto je dan slobodan"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                resetForm();
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Spremanje...' : selectedId ? 'Spremi izmjene' : 'Dodaj slobodan dan'}
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">Obriši slobodan dan?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Da li ste sigurni da želite obrisati slobodan dan "{deleteTarget.naziv}"? Ova akcija se ne može
                  poništiti.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Odustani
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                Obriši
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


