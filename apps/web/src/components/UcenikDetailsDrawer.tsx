import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import WeekendDatePicker from './WeekendDatePicker';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface Ucenik {
  id: string;
  ime: string | null;
  prezime: string | null;
  email: string | null;
  fotografija: string | null;
  aktivan: boolean;
  datumRodjenja: string | null;
  spol: string | null;
  mjestoRodjenja: string | null;
  adresaStanovanja: string | null;
  status: string | null;
  eksterniId: number | null;
  razredNaziv?: string | null;
  grupaNaziv?: string | null;
  terminOpis?: string | null;
  obrazovanje: {
    id: string;
    nivoObrazovanja: string | null;
    razred: number | null;
    mektebStepen: string | null;
    predskolskaNaziv: string | null;
    osnovnaNaziv: string | null;
    srednjaNaziv: string | null;
    fakultetNaziv: string | null;
  } | null;
  roditelji: Array<{
    id: string;
    tip: string;
    imePrezime: string;
    datumRodjenja: string | null;
    mjestoRodjenja: string | null;
    email: string | null;
    mobitel: string | null;
    telefon: string | null;
    zaposlen: boolean | null;
    obrazovanje: string | null;
    zanimanje: string | null;
  }>;
  kontakti: Array<{
    id: string;
    tip: string;
    vrijednost: string;
    primarni: boolean;
  }>;
  prosjek: number | null;
  prosjekDistribution: {
    excellent: number;
    vrlodobar: number;
    good: number;
    average: number;
    poor: number;
  };
  imaRoditelje: string | null;
  roditeljiZajedno: string | null;
  roditeljiRazdvojeni: string | null;
  roditeljiClanoviIz: string | null;
  brojBrace: number | null;
  brojSestara: number | null;
  tipStambenogObjekta: string | null;
  imaPosebnePotrebe: boolean;
  posebnePotrebeOpis: string | null;
  idPunktaDzemata: number | null;
  clanMrezeMladih: string | null;
  ucenikSkoleHifza: string | null;
}

interface Props {
  open: boolean;
  ucenikId: string | null;
  onClose: () => void;
  onSave?: () => Promise<void> | void;
}

type TabType = 'podaci' | 'ocjene' | 'prisustvo';

export default function UcenikDetailsDrawer({ open, ucenikId, onClose, onSave }: Props) {
  const [ucenik, setUcenik] = useState<Ucenik | null>(null);
  const [editedUcenik, setEditedUcenik] = useState<Ucenik | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('podaci');
  
  // For new ocjena/prisustvo form with date
  const [nastavnaGodina, setNastavnaGodina] = useState<{ id: string; naziv: string; datumOd: string; datumDo: string } | null>(null);
  const [allowedWeekendDays, setAllowedWeekendDays] = useState<Array<'subota' | 'nedjelja'>>([]);
  const [lekcijeForRazred, setLekcijeForRazred] = useState<Array<{ id: string; naslov: string; tip?: string | null }>>([]);
  const [selectedDateForOcjena, setSelectedDateForOcjena] = useState<Date | null>(null);
  const [selectedLekcijaForOcjena, setSelectedLekcijaForOcjena] = useState<string>('');
  const [ocjenaValue, setOcjenaValue] = useState<number>(5);
  const [komentarForOcjena, setKomentarForOcjena] = useState<string>('');
  const [lekcijaSearch, setLekcijaSearch] = useState<string>('');
  const [selectedOcjeneFilter, setSelectedOcjeneFilter] = useState<Set<number>>(new Set([5, 4, 3, 2, 1]));
  
  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{ type: 'ocjena' | 'prisustvo'; id: string } | null>(null);
  // For prisustvo quick add
  const [selectedDateForPrisustvo, setSelectedDateForPrisustvo] = useState<Date | null>(null);
  const [prisustvoStatus, setPrisustvoStatus] = useState<'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN'>('PRISUTAN');
  const [prisustvoNapomena, setPrisustvoNapomena] = useState<string>('');

  // For displaying ocjene with lekcije
  const [ocjeneWithLekcije, setOcjeneWithLekcije] = useState<Array<{
    id: string;
    ocjena: number;
    komentar: string | null;
    datum: string;
    vrijeme: string;
    lekcija: {
      id: string;
      naslov: string;
    };
  }>>([]);
  const [loadingOcjene, setLoadingOcjene] = useState(false);

  // For displaying prisustvo stats
  const [prisustvoStats, setPrisustvoStats] = useState<{
    total: number;
    prisutan: number;
    opravdan: number;
    neopravdan: number;
    prisustvoDistribution: {
      prisutan: number;
      opravdan: number;
      neopravdan: number;
    };
    prisustva: Array<{
      id: string;
      status: string;
      napomena: string | null;
      datum: string;
      kreiran: string;
    }>;
  } | null>(null);
  const [loadingPrisustvo, setLoadingPrisustvo] = useState(false);

  // Fetch ucenik details
  useEffect(() => {
    if (!open || !ucenikId) {
      setUcenik(null);
      return;
    }

    const fetchUcenik = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get<Ucenik>(`${API_URL}/ucenici/${ucenikId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUcenik(response.data);
        setEditedUcenik(response.data);
        setHasChanges(false);
      } catch (err) {
        console.error('Error fetching ucenik:', err);
        const axiosError = err as { response?: { data?: { message?: string } } };
        setError(axiosError.response?.data?.message || 'Greška pri učitavanju podataka');
      } finally {
        setLoading(false);
      }
    };

    fetchUcenik();
  }, [open, ucenikId]);

  // Fetch ocjene with lekcije when on ocjene tab
  useEffect(() => {
    if (activeTab !== 'ocjene' || !ucenikId) {
      setOcjeneWithLekcije([]);
      return;
    }

    const fetchOcjeneWithLekcije = async () => {
      setLoadingOcjene(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/ucenici/${ucenikId}/ocjene`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOcjeneWithLekcije(response.data || []);
      } catch (err) {
        console.error('Error fetching ocjene with lekcije:', err);
        setOcjeneWithLekcije([]);
      } finally {
        setLoadingOcjene(false);
      }
    };

    fetchOcjeneWithLekcije();
  }, [activeTab, ucenikId]);

  // Fetch nastavna godina and lekcije when on ocjene tab
  useEffect(() => {
    if ((activeTab !== 'ocjene' && activeTab !== 'prisustvo') || !ucenikId || !ucenik) {
      return;
    }

    const fetchData = async () => {
        try {
          const token = localStorage.getItem('token');

        // Fetch nastavna godina from dashboard
        const dashboardRes = await axios.get(`${API_URL}/muallimi/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
          });

        if (dashboardRes.data?.nastavnaGodina) {
          const ng = dashboardRes.data.nastavnaGodina;
          setNastavnaGodina({
            id: ng.id,
            naziv: ng.naziv,
            datumOd: ng.datumOd,
            datumDo: ng.datumDo,
          });

          // Fetch lekcije for razred only if on ocjene tab
          if (activeTab === 'ocjene') {
            // Fetch lekcije for razred - need to find razred from ucenik
            // For now, we'll fetch all lekcije and filter later if needed
            const lekcijeRes = await axios.get(`${API_URL}/lekcije`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setLekcijeForRazred(lekcijeRes.data || []);
          }
        }

        // Fetch allowed weekend days for this ucenik (subota/nedjelja) for their grupa
        if (ucenikId) {
          const allowedDaysRes = await axios.get<{ allowedDays: Array<'subota' | 'nedjelja'> }>(
            `${API_URL}/ucenici/${ucenikId}/allowed-days`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          setAllowedWeekendDays(allowedDaysRes.data?.allowedDays || []);
        }
      } catch (err) {
        console.error('Error fetching nastavna godina, lekcije and allowed days:', err);
      }
    };

    fetchData();
  }, [activeTab, ucenikId, ucenik]);

  // Fetch prisustvo stats when on prisustvo tab
  useEffect(() => {
    if (activeTab !== 'prisustvo' || !ucenikId) {
      setPrisustvoStats(null);
      return;
    }

    const fetchPrisustvoStats = async () => {
      setLoadingPrisustvo(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/ucenici/${ucenikId}/prisustvo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPrisustvoStats(response.data);
      } catch (err) {
        console.error('Error fetching prisustvo stats:', err);
        setPrisustvoStats(null);
      } finally {
        setLoadingPrisustvo(false);
      }
    };

    fetchPrisustvoStats();
  }, [activeTab, ucenikId]);


  const getAge = (dateString: string | null) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get prosjek distribution from API
  const prosjekDistribution = ucenik?.prosjekDistribution || {
    excellent: 0,
    vrlodobar: 0,
    good: 0,
    average: 0,
    poor: 0,
  };
  
  const totalOcjena = prosjekDistribution.excellent + prosjekDistribution.vrlodobar + 
    prosjekDistribution.good + prosjekDistribution.average + prosjekDistribution.poor;

  const handleSave = async () => {
    if (!editedUcenik || !ucenikId) return;
    
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare update payload
      const updatePayload: {
        ime: string | null;
        prezime: string | null;
        email: string | null;
        datumRodjenja: string | null;
        spol: string | null;
        status: string | null;
        mjestoRodjenja: string | null;
        adresaStanovanja: string | null;
        imaRoditelje: string | null;
        roditeljiZajedno: string | null;
        roditeljiRazdvojeni: string | null;
        roditeljiClanoviIz: string | null;
        brojBrace: number | null;
        brojSestara: number | null;
        tipStambenogObjekta: string | null;
        imaPosebnePotrebe: boolean;
        posebnePotrebeOpis: string | null;
        idPunktaDzemata: number | null;
        clanMrezeMladih: string | null;
        ucenikSkoleHifza: string | null;
        obrazovanje?: {
          nivoObrazovanja: string | null;
          razred: number | null;
          mektebStepen: string | null;
          predskolskaNaziv: string | null;
          osnovnaNaziv: string | null;
          srednjaNaziv: string | null;
          fakultetNaziv: string | null;
        };
      } = {
        ime: editedUcenik.ime,
        prezime: editedUcenik.prezime,
        email: editedUcenik.email,
        datumRodjenja: editedUcenik.datumRodjenja,
        spol: editedUcenik.spol,
        status: editedUcenik.status,
        mjestoRodjenja: editedUcenik.mjestoRodjenja,
        adresaStanovanja: editedUcenik.adresaStanovanja,
        imaRoditelje: editedUcenik.imaRoditelje,
        roditeljiZajedno: editedUcenik.roditeljiZajedno,
        roditeljiRazdvojeni: editedUcenik.roditeljiRazdvojeni,
        roditeljiClanoviIz: editedUcenik.roditeljiClanoviIz,
        brojBrace: editedUcenik.brojBrace,
        brojSestara: editedUcenik.brojSestara,
        tipStambenogObjekta: editedUcenik.tipStambenogObjekta,
        imaPosebnePotrebe: editedUcenik.imaPosebnePotrebe,
        posebnePotrebeOpis: editedUcenik.posebnePotrebeOpis,
        idPunktaDzemata: editedUcenik.idPunktaDzemata,
        clanMrezeMladih: editedUcenik.clanMrezeMladih,
        ucenikSkoleHifza: editedUcenik.ucenikSkoleHifza,
      };
      
      if (editedUcenik.obrazovanje) {
        updatePayload.obrazovanje = {
          nivoObrazovanja: editedUcenik.obrazovanje.nivoObrazovanja,
          razred: editedUcenik.obrazovanje.razred,
          mektebStepen: editedUcenik.obrazovanje.mektebStepen,
          predskolskaNaziv: editedUcenik.obrazovanje.predskolskaNaziv,
          osnovnaNaziv: editedUcenik.obrazovanje.osnovnaNaziv,
          srednjaNaziv: editedUcenik.obrazovanje.srednjaNaziv,
          fakultetNaziv: editedUcenik.obrazovanje.fakultetNaziv,
        };
      }
      
      await axios.put(`${API_URL}/ucenici/${ucenikId}`, updatePayload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Refresh data
      const response = await axios.get<Ucenik>(`${API_URL}/ucenici/${ucenikId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUcenik(response.data);
      setEditedUcenik(response.data);
      setHasChanges(false);
      
      if (onSave) {
        await onSave();
      }
    } catch (err) {
      console.error('Error saving ucenik:', err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Greška pri spremanju podataka');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: unknown, nested?: string) => {
    if (!editedUcenik) return;
    
    const updated = { ...editedUcenik };
    if (nested) {
      if (!updated[nested as keyof Ucenik]) {
        (updated as Record<string, unknown>)[nested] = {};
      }
      (updated as Record<string, unknown>)[nested] = {
        ...((updated as Record<string, unknown>)[nested] as Record<string, unknown>),
        [field]: value,
      };
    } else {
      (updated as Record<string, unknown>)[field] = value;
    }
    
    setEditedUcenik(updated as Ucenik);
    setHasChanges(true);
  };

  const currentUcenik = editedUcenik || ucenik;

  // Render functions for each tab
  const renderPodaciTab = () => {
    if (!currentUcenik) return null;
    
    return (
      <div className="space-y-6">
        {/* Osnovni podaci */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Osnovni podaci
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ime</label>
                <input
                  type="text"
                  value={currentUcenik?.ime || ''}
                  onChange={(e) => updateField('ime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prezime</label>
                <input
                  type="text"
                  value={currentUcenik?.prezime || ''}
                  onChange={(e) => updateField('prezime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={currentUcenik?.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Datum rođenja</label>
                <input
                  type="date"
                  value={currentUcenik?.datumRodjenja ? new Date(currentUcenik.datumRodjenja).toISOString().split('T')[0] : ''}
                  onChange={(e) => updateField('datumRodjenja', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {currentUcenik?.datumRodjenja && getAge(currentUcenik.datumRodjenja) !== null && (
                  <p className="text-xs text-gray-500 mt-1">{getAge(currentUcenik.datumRodjenja)} godina</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Spol</label>
                <select
                  value={currentUcenik?.spol || ''}
                  onChange={(e) => updateField('spol', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-</option>
                  <option value="MUSKO">Muško</option>
                  <option value="ZENSKO">Žensko</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={currentUcenik?.status || ''}
                  onChange={(e) => updateField('status', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-</option>
                  <option value="AKTIVAN">Aktivan</option>
                  <option value="ARHIVIRAN">Arhiviran</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Mjesto rođenja</label>
                <input
                  type="text"
                  value={currentUcenik?.mjestoRodjenja || ''}
                  onChange={(e) => updateField('mjestoRodjenja', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresa stanovanja</label>
                <input
                  type="text"
                  value={currentUcenik?.adresaStanovanja || ''}
                  onChange={(e) => updateField('adresaStanovanja', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Obrazovanje */}
        {currentUcenik?.obrazovanje && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Obrazovanje
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nivo obrazovanja</label>
                  <input
                    type="text"
                    value={currentUcenik.obrazovanje.nivoObrazovanja || ''}
                    onChange={(e) => updateField('nivoObrazovanja', e.target.value || null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Razred</label>
                  <input
                    type="number"
                    value={currentUcenik.obrazovanje.razred || ''}
                    onChange={(e) => updateField('razred', e.target.value ? parseInt(e.target.value) : null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mekteb stepen</label>
                  <input
                    type="text"
                    value={currentUcenik.obrazovanje.mektebStepen || ''}
                    onChange={(e) => updateField('mektebStepen', e.target.value || null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Predškolska ustanova</label>
                  <input
                    type="text"
                    value={currentUcenik.obrazovanje.predskolskaNaziv || ''}
                    onChange={(e) => updateField('predskolskaNaziv', e.target.value || null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Osnovna škola</label>
                  <input
                    type="text"
                    value={currentUcenik.obrazovanje.osnovnaNaziv || ''}
                    onChange={(e) => updateField('osnovnaNaziv', e.target.value || null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Srednja škola</label>
                  <input
                    type="text"
                    value={currentUcenik.obrazovanje.srednjaNaziv || ''}
                    onChange={(e) => updateField('srednjaNaziv', e.target.value || null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fakultet</label>
                  <input
                    type="text"
                    value={currentUcenik.obrazovanje.fakultetNaziv || ''}
                    onChange={(e) => updateField('fakultetNaziv', e.target.value || null, 'obrazovanje')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Roditelji */}
        {currentUcenik?.roditelji && currentUcenik.roditelji.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Roditelji
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {currentUcenik.roditelji.map((roditelj) => (
                  <div key={roditelj.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {roditelj.tip === 'MAJKA' ? 'Majka' : 'Otac'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Ime i prezime</label>
                        <input
                          type="text"
                          value={roditelj.imePrezime}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Datum rođenja</label>
                        <input
                          type="date"
                          value={roditelj.datumRodjenja ? new Date(roditelj.datumRodjenja).toISOString().split('T')[0] : ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={roditelj.email || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mobitel</label>
                        <input
                          type="tel"
                          value={roditelj.mobitel || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                        <input
                          type="tel"
                          value={roditelj.telefon || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Zaposlen</label>
                        <select
                          value={roditelj.zaposlen ? 'true' : 'false'}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        >
                          <option value="true">Da</option>
                          <option value="false">Ne</option>
                        </select>
                      </div>
                      {roditelj.obrazovanje && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Obrazovanje</label>
                          <input
                            type="text"
                            value={roditelj.obrazovanje}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                          />
                        </div>
                      )}
                      {roditelj.zanimanje && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Zanimanje</label>
                          <input
                            type="text"
                            value={roditelj.zanimanje}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Porodični podaci */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Porodični podaci
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ima roditelje</label>
                <input
                  type="text"
                  value={currentUcenik.imaRoditelje || ''}
                  onChange={(e) => updateField('imaRoditelje', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Roditelji zajedno</label>
                <input
                  type="text"
                  value={currentUcenik.roditeljiZajedno || ''}
                  onChange={(e) => updateField('roditeljiZajedno', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Roditelji razdvojeni</label>
                <input
                  type="text"
                  value={currentUcenik.roditeljiRazdvojeni || ''}
                  onChange={(e) => updateField('roditeljiRazdvojeni', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Roditelji članovi iz</label>
                <input
                  type="text"
                  value={currentUcenik.roditeljiClanoviIz || ''}
                  onChange={(e) => updateField('roditeljiClanoviIz', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Broj braće</label>
                <input
                  type="number"
                  value={currentUcenik.brojBrace ?? 0}
                  onChange={(e) => updateField('brojBrace', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Broj sestara</label>
                <input
                  type="number"
                  value={currentUcenik.brojSestara ?? 0}
                  onChange={(e) => updateField('brojSestara', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Tip stambenog objekta</label>
                <input
                  type="text"
                  value={currentUcenik.tipStambenogObjekta || ''}
                  onChange={(e) => updateField('tipStambenogObjekta', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Posebne potrebe */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Posebne potrebe
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ima posebne potrebe</label>
                <select
                  value={currentUcenik.imaPosebnePotrebe ? 'true' : 'false'}
                  onChange={(e) => updateField('imaPosebnePotrebe', e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="true">Da</option>
                  <option value="false">Ne</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Opis posebnih potreba</label>
                <textarea
                  value={currentUcenik.posebnePotrebeOpis || ''}
                  onChange={(e) => updateField('posebnePotrebeOpis', e.target.value || null)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dodatni podaci */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Dodatni podaci
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ID punkta džemata</label>
                <input
                  type="number"
                  value={currentUcenik.idPunktaDzemata || ''}
                  onChange={(e) => updateField('idPunktaDzemata', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Član mreže mladih</label>
                <input
                  type="text"
                  value={currentUcenik.clanMrezeMladih || ''}
                  onChange={(e) => updateField('clanMrezeMladih', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Učenik škole hifza</label>
                <input
                  type="text"
                  value={currentUcenik.ucenikSkoleHifza || ''}
                  onChange={(e) => updateField('ucenikSkoleHifza', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Kontakti */}
        {currentUcenik?.kontakti && currentUcenik.kontakti.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Kontakti
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {currentUcenik.kontakti.map((kontakt) => (
                  <div key={kontakt.id} className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-700">
                          {kontakt.tip === 'TELEFON' ? 'Telefon' : kontakt.tip === 'MOBITEL' ? 'Mobitel' : 'Email'}
                        </span>
                        {kontakt.primarni && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Primarni
                          </span>
                        )}
                      </div>
                      <input
                        type={kontakt.tip === 'EMAIL' ? 'email' : 'tel'}
                        value={kontakt.vrijednost}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getActiveGradeClasses = (grade: number) => {
    switch (grade) {
      case 5:
        return 'bg-emerald-100 border-emerald-300 text-emerald-700';
      case 4:
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 3:
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 2:
        return 'bg-orange-50 border-orange-200 text-orange-700';
      case 1:
      default:
        return 'bg-rose-50 border-rose-200 text-rose-700';
    }
  };

  const getPrisustvoColor = (status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN') => {
    if (status === 'PRISUTAN') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (status === 'OPRAVDAN') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-rose-50 border-rose-200 text-rose-700';
  };

  const getPrisustvoText = (status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN') => {
    if (status === 'PRISUTAN') return 'Prisutan';
    if (status === 'OPRAVDAN') return 'Opravdan';
    return 'Neopravdan';
  };

  const filteredLekcijeForOcjena = useMemo(() => {
    const term = lekcijaSearch.trim().toLowerCase();
    if (!term) return lekcijeForRazred;
    return lekcijeForRazred.filter((l) => {
      const titleMatch = l.naslov.toLowerCase().includes(term);
      const tipLabel =
        l.tip === 'KURAN' ? 'kuran' : l.tip === 'SUFARA' ? 'sufara' : 'ilmihal';
      const tipMatch = tipLabel.toLowerCase().includes(term);
      return titleMatch || tipMatch;
    });
  }, [lekcijeForRazred, lekcijaSearch]);

  const filteredOcjeneWithLekcije = useMemo(() => {
    return ocjeneWithLekcije.filter((ocjena) => selectedOcjeneFilter.has(ocjena.ocjena));
  }, [ocjeneWithLekcije, selectedOcjeneFilter]);

  const toggleOcjenaFilter = (ocjena: number) => {
    setSelectedOcjeneFilter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ocjena)) {
        newSet.delete(ocjena);
      } else {
        newSet.add(ocjena);
      }
      return newSet;
    });
  };

  const handleDeleteOcjena = async (ocjenaId: string) => {
    if (!ucenikId) return;
    setDeleteModal(null); // Close modal immediately
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/ucenici/${ucenikId}/ocjene/${ocjenaId}/delete`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const refreshed = await axios.get(`${API_URL}/ucenici/${ucenikId}/ocjene`, { headers: { Authorization: `Bearer ${token}` } });
      setOcjeneWithLekcije(refreshed.data || []);
    } catch (err: unknown) {
      console.error('Error deleting ocjena', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr.response?.data?.message || 'Greška pri brisanju ocjene');
    }
  };

  const handleDeletePrisustvo = async (prisustvoId: string) => {
    if (!ucenikId) return;
    setDeleteModal(null); // Close modal immediately
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/ucenici/${ucenikId}/prisustvo/${prisustvoId}/delete`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const refreshed = await axios.get(`${API_URL}/ucenici/${ucenikId}/prisustvo`, { headers: { Authorization: `Bearer ${token}` } });
      setPrisustvoStats(refreshed.data);
    } catch (err: unknown) {
      console.error('Error deleting prisustvo', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr.response?.data?.message || 'Greška pri brisanju prisustva');
    }
  };

  // Helper function to format date as YYYY-MM-DD without timezone conversion
  const formatDateOnly = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAddPrisustvo = async () => {
    if (!ucenikId || !selectedDateForPrisustvo) {
      alert('Odaberite datum i status');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/ucenici/${ucenikId}/prisustvo-with-date`,
        {
          datum: formatDateOnly(selectedDateForPrisustvo),
          status: prisustvoStatus,
          napomena: prisustvoNapomena || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const refreshed = await axios.get(`${API_URL}/ucenici/${ucenikId}/prisustvo`, { headers: { Authorization: `Bearer ${token}` } });
      setPrisustvoStats(refreshed.data);
      setSelectedDateForPrisustvo(null);
      setPrisustvoNapomena('');
      setPrisustvoStatus('PRISUTAN');
    } catch (err: unknown) {
      console.error('Error adding prisustvo', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr.response?.data?.message || 'Greška pri dodavanju prisustva');
    }
  };

  const renderOcjeneStatsTab = () => {
    if (!currentUcenik) return null;

    if (totalOcjena === 0) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nema ocjena</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Ovaj učenik još nema unesene ocjene. Ocjene će se prikazati ovdje kada budu dodane.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Prosjek ocjena */}
        {currentUcenik?.prosjek !== null && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Ukupan prosjek
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Prosjek ocjena</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${
                      currentUcenik.prosjek >= 4.5 ? 'text-emerald-600' :
                      currentUcenik.prosjek >= 3.5 ? 'text-blue-600' :
                      currentUcenik.prosjek >= 2.5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {currentUcenik.prosjek.toFixed(2)}
                    </span>
                    <span className="text-lg text-gray-400">/ 5.00</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${
                    currentUcenik.prosjek >= 4.5 ? 'text-emerald-600' :
                    currentUcenik.prosjek >= 3.5 ? 'text-blue-600' :
                    currentUcenik.prosjek >= 2.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {((currentUcenik.prosjek / 5) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500">postignuće</div>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    currentUcenik.prosjek >= 4.5 ? 'bg-emerald-500' :
                    currentUcenik.prosjek >= 3.5 ? 'bg-blue-500' :
                    currentUcenik.prosjek >= 2.5 ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${(currentUcenik.prosjek / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Distribucija ocjena */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Distribucija ocjena
              </h3>
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                <span className="font-medium">{totalOcjena}</span> ukupno
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-5 gap-4">
              {/* Odličan */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-2">Odličan</div>
                <div className="text-2xl font-bold text-emerald-600 mb-1">{prosjekDistribution.excellent}</div>
                {totalOcjena > 0 && (
                  <div className="text-xs text-gray-500">
                    {((prosjekDistribution.excellent / totalOcjena) * 100).toFixed(0)}%
                  </div>
                )}
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                    style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.excellent / totalOcjena) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Vrlo dobar */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-2">Vrlo dobar</div>
                <div className="text-2xl font-bold text-cyan-600 mb-1">{prosjekDistribution.vrlodobar}</div>
                {totalOcjena > 0 && (
                  <div className="text-xs text-gray-500">
                    {((prosjekDistribution.vrlodobar / totalOcjena) * 100).toFixed(0)}%
                  </div>
                )}
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                    style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.vrlodobar / totalOcjena) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Dobar */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-2">Dobar</div>
                <div className="text-2xl font-bold text-blue-600 mb-1">{prosjekDistribution.good}</div>
                {totalOcjena > 0 && (
                  <div className="text-xs text-gray-500">
                    {((prosjekDistribution.good / totalOcjena) * 100).toFixed(0)}%
                  </div>
                )}
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.good / totalOcjena) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Dovoljan */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-2">Dovoljan</div>
                <div className="text-2xl font-bold text-yellow-600 mb-1">{prosjekDistribution.average}</div>
                {totalOcjena > 0 && (
                  <div className="text-xs text-gray-500">
                    {((prosjekDistribution.average / totalOcjena) * 100).toFixed(0)}%
                  </div>
                )}
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full transition-all duration-500" 
                    style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.average / totalOcjena) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Nedovoljan */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-2">Nedovoljan</div>
                <div className="text-2xl font-bold text-red-600 mb-1">{prosjekDistribution.poor}</div>
                {totalOcjena > 0 && (
                  <div className="text-xs text-gray-500">
                    {((prosjekDistribution.poor / totalOcjena) * 100).toFixed(0)}%
                  </div>
                )}
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full transition-all duration-500" 
                    style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.poor / totalOcjena) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Bar Chart Graf */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Graf distribucije ocjena</h4>
              <div className="space-y-3">
                {/* Odličan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Odličan (5)</span>
                    <span className="text-xs font-semibold text-emerald-600">{prosjekDistribution.excellent}</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.excellent / totalOcjena) * 100 : 0}%` }}
                    >
                      {prosjekDistribution.excellent > 0 && (
                        <span className="text-xs font-medium text-white">
                          {((prosjekDistribution.excellent / totalOcjena) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vrlo dobar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Vrlo dobar (4)</span>
                    <span className="text-xs font-semibold text-cyan-600">{prosjekDistribution.vrlodobar}</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.vrlodobar / totalOcjena) * 100 : 0}%` }}
                    >
                      {prosjekDistribution.vrlodobar > 0 && (
                        <span className="text-xs font-medium text-white">
                          {((prosjekDistribution.vrlodobar / totalOcjena) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dobar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Dobar (3)</span>
                    <span className="text-xs font-semibold text-blue-600">{prosjekDistribution.good}</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.good / totalOcjena) * 100 : 0}%` }}
                    >
                      {prosjekDistribution.good > 0 && (
                        <span className="text-xs font-medium text-white">
                          {((prosjekDistribution.good / totalOcjena) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dovoljan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Dovoljan (2)</span>
                    <span className="text-xs font-semibold text-yellow-600">{prosjekDistribution.average}</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.average / totalOcjena) * 100 : 0}%` }}
                    >
                      {prosjekDistribution.average > 0 && (
                        <span className="text-xs font-medium text-white">
                          {((prosjekDistribution.average / totalOcjena) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nedovoljan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Nedovoljan (1)</span>
                    <span className="text-xs font-semibold text-red-600">{prosjekDistribution.poor}</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${totalOcjena > 0 ? (prosjekDistribution.poor / totalOcjena) * 100 : 0}%` }}
                    >
                      {prosjekDistribution.poor > 0 && (
                        <span className="text-xs font-medium text-white">
                          {((prosjekDistribution.poor / totalOcjena) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Forma za dodavanje ocjene */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Dodaj ocjenu
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Datum picker */}
            {nastavnaGodina && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Datum
                </label>
                <WeekendDatePicker
                  selectedDate={selectedDateForOcjena}
                  onDateSelect={(date) => setSelectedDateForOcjena(date)}
                  startDate={new Date(nastavnaGodina.datumOd)}
                  endDate={new Date(nastavnaGodina.datumDo)}
                  allowedDays={allowedWeekendDays}
                  singleColumn={true}
                />
              </div>
            )}

            {/* Lekcije - sa filterom kao u CasEntryDrawer */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lekcija
              </label>
              
              {/* Search + brojač */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <svg
                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                    />
                  </svg>
                  <input
                    value={lekcijaSearch}
                    onChange={(e) => setLekcijaSearch(e.target.value)}
                    placeholder="Pretraži po nazivu ili tipu lekcije (npr. kuran, sufara, ilmihal)..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
              </div>
                <div className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-lg border border-gray-200">
                  {filteredLekcijeForOcjena.length}/{lekcijeForRazred.length}
                </div>
              </div>

              {/* Scrollable lista lekcija */}
              <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
                {filteredLekcijeForOcjena.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-500">
                    Nema lekcija za prikaz sa zadatim filterom.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {filteredLekcijeForOcjena.map((lekcija) => {
                      const selected = selectedLekcijaForOcjena === lekcija.id;
                      const tip = (lekcija.tip ?? 'ILMIHAL') as 'ILMIHAL' | 'KURAN' | 'SUFARA';

                      const tipBadgeClasses =
                        tip === 'KURAN'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : tip === 'SUFARA'
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200';

                      const tipLabel =
                        tip === 'KURAN' ? 'Kuran' : tip === 'SUFARA' ? 'Sufara' : 'Ilmihal';

                      return (
                        <li key={lekcija.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedLekcijaForOcjena(lekcija.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors text-left ${
                              selected
                                ? 'bg-blue-50/70'
                                : 'hover:bg-gray-100/70'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                selected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300'
                              }`}>
                                {selected && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-sm text-gray-900">{lekcija.naslov}</span>
                            </div>
                            <span
                              className={`ml-3 inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${tipBadgeClasses}`}
                            >
                              {tipLabel}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Ocjene - UI kao u CasEntryDrawer */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ocjena
              </label>
              <div className="flex items-center gap-1">
                {[5, 4, 3, 2, 1].map((g) => {
                  const active = ocjenaValue === g;
    return (
                    <button
                      key={g}
                      onClick={() => setOcjenaValue(g)}
                      className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                        active
                          ? getActiveGradeClasses(g)
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-200 hover:text-blue-700'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Komentar */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Komentar (opcionalno)
              </label>
                <textarea
                value={komentarForOcjena}
                onChange={(e) => setKomentarForOcjena(e.target.value)}
                placeholder="Kratak komentar..."
                  rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

            {/* Submit button */}
                <button
              onClick={async () => {
                if (!selectedDateForOcjena || !selectedLekcijaForOcjena || !ucenikId) {
                  alert('Molimo popunite sva polja');
                  return;
                }

                try {
                  const token = localStorage.getItem('token');
                  
                  await axios.post(
                    `${API_URL}/ucenici/${ucenikId}/ocjena-with-date`,
                    {
                      datum: formatDateOnly(selectedDateForOcjena),
                      lekcijaId: selectedLekcijaForOcjena,
                      ocjena: ocjenaValue,
                      komentar: komentarForOcjena || undefined,
                    },
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  );

                  // Reset form
                  setSelectedDateForOcjena(null);
                  setSelectedLekcijaForOcjena('');
                  setOcjenaValue(5);
                  setKomentarForOcjena('');

                  // Refresh ocjene list
                  const response = await axios.get(`${API_URL}/ucenici/${ucenikId}/ocjene`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  setOcjeneWithLekcije(response.data || []);

                  // Refresh prisustvo stats
                  const prisustvoRes = await axios.get(`${API_URL}/ucenici/${ucenikId}/prisustvo`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  setPrisustvoStats(prisustvoRes.data);
                } catch (err: unknown) {
                  console.error('Error adding ocjena:', err);
                  const axiosErr = err as { response?: { data?: { message?: string } } };
                  alert(axiosErr.response?.data?.message || 'Greška pri dodavanju ocjene');
                }
              }}
              disabled={!selectedDateForOcjena || !selectedLekcijaForOcjena}
              className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dodaj ocjenu
                </button>
          </div>
        </div>

        {/* Historija ocjena */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Historija ocjena
            </h3>
          </div>
          <div className="p-6">
              {loadingOcjene ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
              ) : ocjeneWithLekcije.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Nema unesenih ocjena za lekcije.</p>
                </div>
              ) : (
                <>
                  {/* Filteri za ocjene */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      {[5, 4, 3, 2, 1].map((ocjena) => {
                        const isSelected = selectedOcjeneFilter.has(ocjena);
                        const count = ocjeneWithLekcije.filter((o) => o.ocjena === ocjena).length;
                        return (
                          <button
                            key={ocjena}
                            type="button"
                            onClick={() => toggleOcjenaFilter(ocjena)}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-all ${
                              isSelected
                                ? getActiveGradeClasses(ocjena)
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <span className="text-lg font-bold">{ocjena}</span>
                            <span className={`text-[10px] font-semibold ${
                              isSelected ? 'text-gray-700' : 'text-gray-500'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lista filtriranih ocjena */}
                  {filteredOcjeneWithLekcije.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">Nema ocjena za odabrane filtere.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOcjeneWithLekcije.map((ocjenaItem) => (
                    <div
                      key={ocjenaItem.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors relative"
                    >
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {ocjenaItem.lekcija.naslov}
                          </h4>
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-lg border text-sm font-semibold flex items-center justify-center ${getActiveGradeClasses(ocjenaItem.ocjena)}`}>
                              {ocjenaItem.ocjena}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{new Date(ocjenaItem.datum).toLocaleDateString('bs-BA', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric' 
                            })}</span>
                          </div>
                          {ocjenaItem.komentar && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              <span className="max-w-md">{ocjenaItem.komentar}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ type: 'ocjena', id: ocjenaItem.id })}
                        className="absolute bottom-2 right-2 text-red-500 hover:text-red-700 transition-colors"
                        title="Obriši ocjenu"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                      ))}
              </div>
                  )}
                </>
              )}
          </div>
        </div>
      </div>
    );
  };

  const renderPrisustvoTab = () => {
    if (!currentUcenik) return null;

    if (!prisustvoStats) {
      if (loadingPrisustvo) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        );
      }
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nema podataka o prisustvu</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Ovaj učenik još nema unesene podatke o prisustvu.
            </p>
          </div>
        </div>
      );
    }

    const { total, prisutan, prisustvoDistribution, prisustva } = prisustvoStats;
    const prisustvoProcenat = total > 0 ? ((prisutan / total) * 100).toFixed(1) : '0';

    return (
      <div className="space-y-6">
        {/* Ukupno prisustvo */}
        {total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
                Ukupno prisustvo
            </h3>
          </div>
          <div className="p-6">
              <div className="flex items-center justify-between mb-4">
              <div>
                  <div className="text-sm text-gray-500 mb-1">Procenat prisustva</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${
                      parseFloat(prisustvoProcenat) >= 90 ? 'text-emerald-600' :
                      parseFloat(prisustvoProcenat) >= 75 ? 'text-blue-600' :
                      parseFloat(prisustvoProcenat) >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {prisustvoProcenat}%
                    </span>
              </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${
                    parseFloat(prisustvoProcenat) >= 90 ? 'text-emerald-600' :
                    parseFloat(prisustvoProcenat) >= 75 ? 'text-blue-600' :
                    parseFloat(prisustvoProcenat) >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {prisutan}/{total}
                  </div>
                  <div className="text-xs text-gray-500">prisutan/ukupno</div>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    parseFloat(prisustvoProcenat) >= 90 ? 'bg-emerald-500' :
                    parseFloat(prisustvoProcenat) >= 75 ? 'bg-blue-500' :
                    parseFloat(prisustvoProcenat) >= 50 ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${prisustvoProcenat}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Distribucija prisustva */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Distribucija prisustva
              </h3>
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                <span className="font-medium">{total}</span> ukupno
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              {/* Prisutan */}
              <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 hover:bg-emerald-100/50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-xs font-medium text-emerald-700 mb-1">Prisutan</div>
                  <div className="text-2xl font-bold text-emerald-700 mb-1">{prisustvoDistribution.prisutan}</div>
                  {total > 0 && (
                    <div className="text-xs text-emerald-600 mb-2">
                      {((prisustvoDistribution.prisutan / total) * 100).toFixed(0)}%
                    </div>
                  )}
                  <div className="w-full h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (prisustvoDistribution.prisutan / total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Opravdan */}
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 hover:bg-amber-100/50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-xs font-medium text-amber-700 mb-1">Opravdan</div>
                  <div className="text-2xl font-bold text-amber-700 mb-1">{prisustvoDistribution.opravdan}</div>
                  {total > 0 && (
                    <div className="text-xs text-amber-600 mb-2">
                      {((prisustvoDistribution.opravdan / total) * 100).toFixed(0)}%
                    </div>
                  )}
                  <div className="w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (prisustvoDistribution.opravdan / total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Neopravdan */}
              <div className="bg-rose-50 rounded-lg border border-rose-200 p-4 hover:bg-rose-100/50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-xs font-medium text-rose-700 mb-1">Neopravdan</div>
                  <div className="text-2xl font-bold text-rose-700 mb-1">{prisustvoDistribution.neopravdan}</div>
                  {total > 0 && (
                    <div className="text-xs text-rose-600 mb-2">
                      {((prisustvoDistribution.neopravdan / total) * 100).toFixed(0)}%
                    </div>
                  )}
                  <div className="w-full h-1.5 bg-rose-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (prisustvoDistribution.neopravdan / total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Forma za dodavanje prisustva */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Dodaj prisustvo
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Datum picker */}
            {nastavnaGodina && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Datum
                </label>
                <WeekendDatePicker
                  selectedDate={selectedDateForPrisustvo}
                  onDateSelect={(date) => setSelectedDateForPrisustvo(date)}
                  startDate={new Date(nastavnaGodina.datumOd)}
                  endDate={new Date(nastavnaGodina.datumDo)}
                  allowedDays={allowedWeekendDays}
                  singleColumn={true}
                />
              </div>
            )}

            {/* Status */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="flex items-center gap-2">
                {(['PRISUTAN', 'OPRAVDAN', 'NEOPRAVDAN'] as const).map((status) => {
                  const active = prisustvoStatus === status;
                  const label = status === 'PRISUTAN' ? 'Prisutan' : status === 'OPRAVDAN' ? 'Opravdan' : 'Neopravdan';
                  const cls = getPrisustvoColor(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setPrisustvoStatus(status)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        active ? cls : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Napomena */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Napomena (opcionalno)
              </label>
                <textarea
                value={prisustvoNapomena}
                onChange={(e) => setPrisustvoNapomena(e.target.value)}
                placeholder="Dodatna napomena..."
                  rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

            {/* Submit button */}
                <button
              onClick={handleAddPrisustvo}
              disabled={!selectedDateForPrisustvo}
              className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dodaj prisustvo
                </button>
          </div>
        </div>

        {/* Lista prisustva */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Historija prisustva
            </h3>
          </div>
          <div className="p-6">
            {prisustva.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Nema unesenih podataka o prisustvu.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {prisustva.map((prisustvoItem) => (
                  <div
                    key={prisustvoItem.id}
                    className={`p-4 rounded-lg border hover:bg-gray-50 transition-colors relative ${
                      prisustvoItem.status === 'PRISUTAN' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : prisustvoItem.status === 'OPRAVDAN'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            prisustvoItem.status === 'PRISUTAN' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : prisustvoItem.status === 'OPRAVDAN'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {prisustvoItem.status === 'PRISUTAN' ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : prisustvoItem.status === 'OPRAVDAN' ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                            <svg className="w-4 h-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{new Date(prisustvoItem.datum).toLocaleDateString('bs-BA', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric' 
                            })}</span>
                          </div>
                        </div>
                        {prisustvoItem.napomena && (
                          <div className="flex items-start gap-1.5 text-xs text-gray-600 mt-2 pl-9">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <span className="flex-1">{prisustvoItem.napomena}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${getPrisustvoColor(prisustvoItem.status as 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN')}`}>
                          {getPrisustvoText(prisustvoItem.status as 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN')}
                        </div>
                      </div>
                    </div>
                <button
                      type="button"
                      onClick={() => setDeleteModal({ type: 'prisustvo', id: prisustvoItem.id })}
                      className="absolute bottom-2 right-2 text-red-500 hover:text-red-700 transition-colors"
                      title="Obriši prisustvo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                </button>
              </div>
                ))}
            </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        </div>
      );
    }

    if (!currentUcenik) {
      return null;
    }

    return (
      <div className="space-y-6">
        {activeTab === 'podaci' && renderPodaciTab()}
        {activeTab === 'ocjene' && renderOcjeneStatsTab()}
        {activeTab === 'prisustvo' && renderPrisustvoTab()}
      </div>
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Potvrdi brisanje
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Da li ste sigurni da želite obrisati {deleteModal.type === 'ocjena' ? 'ovu ocjenu' : 'ovo prisustvo'}? Ova akcija se ne može poništiti.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Odustani
                </button>
                <button
                  onClick={() => {
                    if (deleteModal.type === 'ocjena') {
                      handleDeleteOcjena(deleteModal.id);
                    } else {
                      handleDeletePrisustvo(deleteModal.id);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Obriši
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            {currentUcenik?.fotografija ? (
              <img
                src={`${API_URL}/${currentUcenik.fotografija}`}
                alt={`${currentUcenik.ime} ${currentUcenik.prezime}`}
                className="w-12 h-12 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-lg">
                {currentUcenik?.ime?.[0] || ''}{currentUcenik?.prezime?.[0] || ''}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {currentUcenik?.ime && currentUcenik?.prezime
                  ? `${currentUcenik.ime} ${currentUcenik.prezime}`
                  : currentUcenik?.ime || currentUcenik?.prezime || 'Učenik'}
              </h2>
              {currentUcenik?.email && (
                <p className="text-sm text-gray-500">{currentUcenik.email}</p>
              )}
              {(currentUcenik?.razredNaziv || currentUcenik?.grupaNaziv || currentUcenik?.terminOpis) && (
                <p className="mt-1 text-xs text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7h4l2-3h6l2 3h4M5 21h14a2 2 0 002-2v-8H3v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>
                    {currentUcenik?.razredNaziv && <span>{currentUcenik.razredNaziv}</span>}
                    {currentUcenik?.grupaNaziv && (
                      <span>
                        {currentUcenik?.razredNaziv ? ' · ' : ''}
                        Grupa {currentUcenik.grupaNaziv}
                      </span>
                    )}
                    {currentUcenik?.terminOpis && (
                      <span>
                        {(currentUcenik?.razredNaziv || currentUcenik?.grupaNaziv) ? ' · ' : ''}
                        {currentUcenik.terminOpis}
                      </span>
                    )}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('podaci')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'podaci'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Podaci
              </div>
            </button>
            <button
              onClick={() => setActiveTab('ocjene')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'ocjene'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Ocjene
              </div>
            </button>
            <button
              onClick={() => setActiveTab('prisustvo')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'prisustvo'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Prisustvo
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Footer with Save button */}
        {activeTab === 'podaci' && hasChanges && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Odustani
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {saving ? 'Spremanje...' : 'Spremi promjene'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

