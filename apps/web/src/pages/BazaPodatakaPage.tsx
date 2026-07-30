import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';
const POTVRDA = 'OBRISI SVE';

type TabelaStat = {
  tabela: string;
  brojZapisa: number;
};

type DbStats = {
  ukupnoZapisa: number;
  tabele: TabelaStat[];
};

type TruncateResult = {
  obrisanoTabela: number;
  obrisanoZapisa: number;
  zadrzanoAdmina: number;
  kreiranDefaultAdmin: string | null;
  kreiranoRazreda: number;
};

export default function BazaPodatakaPage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [potvrdaInput, setPotvrdaInput] = useState('');
  const [zadrziAdmine, setZadrziAdmine] = useState(true);
  const [brisanje, setBrisanje] = useState(false);
  const [rezultat, setRezultat] = useState<TruncateResult | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<DbStats>(`${API_URL}/admin/database/stats`, { timeout: 20000 });
      setStats(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Greška pri čitanju stanja baze');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const zatvoriModal = () => {
    setModalOpen(false);
    setPotvrdaInput('');
  };

  const handleTruncate = async () => {
    setBrisanje(true);
    setError(null);
    setRezultat(null);
    try {
      const response = await axios.post<{ success: boolean; data: TruncateResult }>(
        `${API_URL}/admin/database/truncate`,
        { potvrda: potvrdaInput.trim(), zadrziAdmine },
        { timeout: 120000 },
      );
      setRezultat(response.data.data);
      zatvoriModal();
      await loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Greška pri brisanju baze');
    } finally {
      setBrisanje(false);
    }
  };

  const tabeleSaPodacima = stats?.tabele.filter((t) => t.brojZapisa > 0) ?? [];
  const potvrdaValidna = potvrdaInput.trim().toUpperCase() === POTVRDA;

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Baza podataka</h1>
            <p className="text-sm text-gray-600 mt-1">
              Pregled stanja baze i brisanje svih podataka (truncate).
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="shrink-0 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Osvježavam...' : 'Osvježi'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{error}</div>
        )}

        {rezultat && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900 space-y-1">
            <p className="font-semibold">Baza je ispražnjena.</p>
            <p>
              Obrisano {rezultat.obrisanoZapisa} zapisa iz {rezultat.obrisanoTabela} tabela.
            </p>
            {rezultat.zadrzanoAdmina > 0 && <p>Zadržano admin korisnika: {rezultat.zadrzanoAdmina}.</p>}
            {rezultat.kreiranDefaultAdmin && (
              <p>Kreiran je default admin korisnik: {rezultat.kreiranDefaultAdmin}</p>
            )}
            {rezultat.kreiranoRazreda > 0 && (
              <p>Ponovo su kreirani osnovni razredi ({rezultat.kreiranoRazreda}).</p>
            )}
          </div>
        )}

        {/* Stanje baze */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Stanje baze</h2>
            {stats && (
              <span className="text-sm text-gray-600">
                {stats.tabele.length} tabela · <span className="font-semibold">{stats.ukupnoZapisa}</span> zapisa
              </span>
            )}
          </div>

          {loading && !stats && <p className="text-sm text-gray-500">Učitavam...</p>}

          {stats && stats.ukupnoZapisa === 0 && (
            <p className="text-sm text-gray-600">Baza je prazna - nema zapisa ni u jednoj tabeli.</p>
          )}

          {stats && stats.ukupnoZapisa > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">Tabela</th>
                    <th className="py-2 font-medium text-right">Zapisa</th>
                  </tr>
                </thead>
                <tbody>
                  {tabeleSaPodacima.map((t) => (
                    <tr key={t.tabela} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 text-gray-900">{t.tabela}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{t.brojZapisa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tabeleSaPodacima.length < stats.tabele.length && (
                <p className="mt-3 text-xs text-gray-500">
                  Prazne tabele ({stats.tabele.length - tabeleSaPodacima.length}) nisu prikazane.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Truncate */}
        <div className="bg-white border border-red-200 shadow-sm rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-red-700">Obriši sve podatke</h2>
            <p className="text-sm text-gray-600 mt-1">
              Briše sve zapise iz svih tabela (učenici, muallimi, časovi, ocjene, poruke, importi...).
              Struktura baze i migracije ostaju nepromijenjene. Ova akcija se ne može vratiti.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Nakon brisanja sistem automatski vraća osnovne razrede (Razred 1-9 i Škola Hifza) jer bez njih
              nije moguće postaviti nastavnu godinu.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={zadrziAdmine}
              onChange={(e) => setZadrziAdmine(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span>
              Zadrži admin korisnike
              <span className="block text-xs text-gray-500">
                Ako isključiš, brišu se i admini - sistem će kreirati default admin račun da prijava ostane
                moguća.
              </span>
            </span>
          </label>

          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Obriši sve podatke
          </button>
        </div>
      </div>

      {/* Modal potvrde */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Potvrdi brisanje baze</h3>
            <p className="text-sm text-gray-600">
              Ovo će obrisati {stats ? stats.ukupnoZapisa : 'sve'} zapisa iz{' '}
              {stats ? stats.tabele.length : 'svih'} tabela. Za potvrdu ukucaj{' '}
              <span className="font-semibold text-gray-900">{POTVRDA}</span>.
            </p>
            <input
              type="text"
              value={potvrdaInput}
              onChange={(e) => setPotvrdaInput(e.target.value)}
              placeholder={POTVRDA}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500">
              {zadrziAdmine ? 'Admin korisnici će biti zadržani.' : 'Brišu se i admin korisnici.'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={zatvoriModal}
                disabled={brisanje}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Otkaži
              </button>
              <button
                onClick={handleTruncate}
                disabled={!potvrdaValidna || brisanje}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {brisanje ? 'Brišem...' : 'Obriši sve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
