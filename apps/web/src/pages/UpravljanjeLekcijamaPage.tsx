import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type TipLekcije = 'KURAN' | 'SUFARA';

type Lekcija = {
  id: string;
  naslov: string;
  opis: string;
  tezina: 1 | 2 | 3;
  redoslijed: number;
  aktivan: boolean;
  tip: TipLekcije;
};

const initialKuran: Lekcija[] = Array.from({ length: 10 }, (_, i) => ({
  id: `kuran-${i + 1}`,
  naslov: `Kuran lekcija ${i + 1}`,
  opis: `Opis lekcije ${i + 1} za Kuran.`,
  tezina: ((i % 3) + 1) as 1 | 2 | 3,
  redoslijed: i,
  aktivan: true,
  tip: 'KURAN',
}));

const initialSufara: Lekcija[] = Array.from({ length: 10 }, (_, i) => ({
  id: `sufara-${i + 1}`,
  naslov: `Sufara lekcija ${i + 1}`,
  opis: `Opis lekcije ${i + 1} za Sufaru.`,
  tezina: ((i % 3) + 1) as 1 | 2 | 3,
  redoslijed: i,
  aktivan: true,
  tip: 'SUFARA',
}));

export default function UpravljanjeLekcijamaPage() {
  const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';
  const [activeTab, setActiveTab] = useState<TipLekcije>('KURAN');
  const [lekcije, setLekcije] = useState<Record<TipLekcije, Lekcija[]>>({
    KURAN: [],
    SUFARA: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; naslov: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedLesson = useMemo(() => {
    const list = lekcije[activeTab];
    return list.find((l) => l.id === selectedId) ?? null;
  }, [lekcije, activeTab, selectedId]);

  const [form, setForm] = useState<Omit<Lekcija, 'id'>>({
    naslov: '',
    opis: '',
    tezina: 2,
    redoslijed: 0,
    aktivan: true,
    tip: 'KURAN',
  });

  const resetForm = (tip: TipLekcije) => {
    setForm({
      naslov: '',
      opis: '',
      tezina: 2,
      redoslijed: getNextRedoslijed(tip),
      aktivan: true,
      tip,
    });
    setSelectedId(null);
  };

  const loadLessons = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kuranRes, sufaraRes] = await Promise.all([
        axios.get<Lekcija[]>(`${API_URL}/lekcije`, { params: { tip: 'KURAN' }, timeout: 8000 }),
        axios.get<Lekcija[]>(`${API_URL}/lekcije`, { params: { tip: 'SUFARA' }, timeout: 8000 }),
      ]);
      setLekcije({
        KURAN: (kuranRes.data ?? []).sort((a, b) => a.redoslijed - b.redoslijed),
        SUFARA: (sufaraRes.data ?? []).sort((a, b) => a.redoslijed - b.redoslijed),
      });
    } catch (err) {
      console.warn('Fetch lekcija nije uspio', err);
      setError('Nisam uspio dohvatiti lekcije.');
    } finally {
      setLoading(false);
    }
  };

  const getNextRedoslijed = (tip: TipLekcije) => {
    const list = lekcije[tip] ?? [];
    if (list.length === 0) return 0;
    return Math.max(...list.map((l) => l.redoslijed)) + 1;
  };

  const handleSelect = (lesson: Lekcija) => {
    setSelectedId(lesson.id);
    setForm({
      naslov: lesson.naslov,
      opis: lesson.opis,
      tezina: lesson.tezina,
      redoslijed: lesson.redoslijed,
      aktivan: lesson.aktivan,
      tip: lesson.tip,
    });
  };

  const handleSave = () => {
    const nextOrder = selectedId ? form.redoslijed : getNextRedoslijed(activeTab);
    const payload = { ...form, tip: activeTab, redoslijed: nextOrder };
    setSaving(true);
    setError(null);
    const request = selectedId
      ? axios.put(`${API_URL}/lekcije/${selectedId}`, payload, { timeout: 8000 })
      : axios.post(`${API_URL}/lekcije`, payload, { timeout: 8000 });

    request
      .then(() => loadLessons())
      .then(() => {
        if (!selectedId) {
          resetForm(activeTab);
        }
        setToast({ type: 'success', message: selectedId ? 'Lekcija ažurirana.' : 'Lekcija dodana.' });
      })
      .catch(() => {
        setError('Nisam uspio spremiti lekciju.');
        setToast({ type: 'error', message: 'Spremanje nije uspjelo.' });
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: string) => {
    const lesson = lekcije[activeTab].find((l) => l.id === id);
    if (lesson) {
      setDeleteTarget({ id, naslov: lesson.naslov });
    }
  };

  const handleToggleActive = (id: string) => {
    setSaving(true);
    setError(null);
    const current = lekcije[activeTab].find((l) => l.id === id);
    const nextValue = !current?.aktivan;
    axios
      .put(`${API_URL}/lekcije/${id}`, { aktivan: nextValue, tip: activeTab }, { timeout: 8000 })
      .then(() => {
        loadLessons();
        setToast({ type: 'success', message: nextValue ? 'Lekcija aktivirana.' : 'Lekcija deaktivirana.' });
      })
      .catch(() => {
        setError('Nisam uspio ažurirati status.');
        setToast({ type: 'error', message: 'Ažuriranje statusa nije uspjelo.' });
      })
      .finally(() => setSaving(false));
  };

  const lessonsForTab = (lekcije[activeTab] ?? []).sort((a, b) => a.redoslijed - b.redoslijed);
  const tezinaColors: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    2: 'bg-amber-100 text-amber-800 border-amber-200',
    3: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  useEffect(() => {
    loadLessons();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    axios
      .delete(`${API_URL}/lekcije/${deleteTarget.id}`, { timeout: 8000 })
      .then(() => {
        if (selectedId === deleteTarget.id) {
          resetForm(activeTab);
        }
        setDeleteTarget(null);
        loadLessons();
        setToast({ type: 'success', message: 'Lekcija obrisana.' });
      })
      .catch(() => {
        setError('Brisanje nije uspjelo.');
        setToast({ type: 'error', message: 'Brisanje nije uspjelo.' });
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      {toastNode}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lekcije (Kuran & Sufara)</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljajte fiksnim lekcijama koje važe za sve razrede.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 border border-gray-100 mb-4">
        <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
          {(['KURAN', 'SUFARA'] as TipLekcije[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                resetForm(tab);
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-blue-700 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        )}
        {loading && (
          <div className="mt-3 text-sm text-gray-500">Učitavam lekcije...</div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              {activeTab === 'KURAN' ? 'Kuran lekcije' : 'Sufara lekcije'} ({lessonsForTab.length})
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {lessonsForTab.map((lekcija) => (
              <div
                key={lekcija.id}
                className={`border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition cursor-pointer ${
                  selectedId === lekcija.id ? 'ring-2 ring-blue-200' : ''
                }`}
                onClick={() => handleSelect(lekcija)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${tezinaColors[lekcija.tezina]}`}
                    >
                      {lekcija.tezina}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{lekcija.naslov}</div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{lekcija.opis}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span>{lekcija.aktivan ? 'Aktivna' : 'Neaktivna'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(lekcija.id);
                        }}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                          lekcija.aktivan ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                        role="switch"
                        aria-checked={lekcija.aktivan}
                        title={lekcija.aktivan ? 'Deaktiviraj' : 'Aktiviraj'}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            lekcija.aktivan ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                  <div />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(lekcija.id);
                      }}
                      className="p-2 rounded-full border border-red-100 text-red-600 hover:bg-red-50"
                      title="Obriši"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4a1 1 0 011 1v2H9V4a1 1 0 011-1z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6m4-6v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {lessonsForTab.length === 0 && (
              <div className="col-span-full text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                Nema lekcija. Dodajte novu.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg shadow p-4 space-y-4 self-start">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {selectedId ? 'Uredi lekciju' : 'Nova lekcija'}
              </h3>
              <p className="text-xs text-gray-500">Za sve razrede ({activeTab})</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {activeTab}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Naslov</label>
              <input
                value={form.naslov}
                onChange={(e) => setForm((prev) => ({ ...prev, naslov: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="Unesite naslov lekcije"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Opis</label>
              <textarea
                value={form.opis}
                onChange={(e) => setForm((prev) => ({ ...prev, opis: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm px-3 py-2 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                rows={3}
                placeholder="Kratak opis lekcije"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Težina</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((prev) => ({ ...prev, tezina: t as 1 | 2 | 3 }))}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                      form.tezina === t
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Status</span>
              </div>
              <button
                onClick={() => setForm((prev) => ({ ...prev, aktivan: !prev.aktivan }))}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                  form.aktivan ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={form.aktivan}
                title={form.aktivan ? 'Aktivna' : 'Neaktivna'}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                    form.aktivan ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                resetForm(activeTab);
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {selectedId ? 'Spremi izmjene' : 'Dodaj lekciju'}
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
                <h3 className="text-base font-semibold text-gray-900">Obriši lekciju?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Da li ste sigurni da želite obrisati lekciju "{deleteTarget.naslov}"? Ova akcija se ne može poništiti.
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









