import { useEffect, useState } from 'react';
import axios from 'axios';

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

type TabType = 'podaci' | 'statistika' | 'ocjene';

export default function UcenikDetailsDrawer({ open, ucenikId, onClose, onSave }: Props) {
  const [ucenik, setUcenik] = useState<Ucenik | null>(null);
  const [editedUcenik, setEditedUcenik] = useState<Ucenik | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('podaci');
  
  // For adding ocjena
  const [lekcije, setLekcije] = useState<Array<{ id: string; naslov: string }>>([]);
  const [casovi, setCasovi] = useState<Array<{ id: string; datum: string; raspored: { slot?: string } | null }>>([]);
  const [loadingLekcije, setLoadingLekcije] = useState(false);
  const [newOcjena, setNewOcjena] = useState({ casId: '', lekcijaId: '', ocjena: 5, komentar: '' });

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

  // Fetch lekcije when cas is selected
  useEffect(() => {
    if (!newOcjena.casId) {
      setLekcije([]);
      return;
    }

    const fetchLekcije = async () => {
      setLoadingLekcije(true);
      try {
        const token = localStorage.getItem('token');
        // Fetch lekcije for the selected cas
        const response = await axios.get(`${API_URL}/casovi/${newOcjena.casId}/lekcije`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLekcije(response.data || []);
      } catch (err) {
        console.error('Error fetching lekcije:', err);
        // Fallback to all lekcije if endpoint doesn't exist
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/lekcije`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setLekcije(response.data || []);
        } catch (fallbackErr) {
          console.error('Error fetching all lekcije:', fallbackErr);
          setLekcije([]);
        }
      } finally {
        setLoadingLekcije(false);
      }
    };

    fetchLekcije();
  }, [newOcjena.casId]);

  // Fetch casovi when on ocjene tab
  useEffect(() => {
    if (activeTab !== 'ocjene' || !ucenikId) {
      setCasovi([]);
      return;
    }

    const fetchCasovi = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/casovi`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCasovi(response.data || []);
      } catch (err) {
        console.error('Error fetching casovi:', err);
        setCasovi([]);
      }
    };

    fetchCasovi();
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

  const handleAddOcjena = async () => {
    if (!ucenikId || !newOcjena.casId || !newOcjena.lekcijaId) return;
    
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/casovi/${newOcjena.casId}/ocjene`,
        {
          ucenikId,
          lekcijaId: newOcjena.lekcijaId,
          ocjena: newOcjena.ocjena,
          komentar: newOcjena.komentar || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh data
      const response = await axios.get<Ucenik>(`${API_URL}/ucenici/${ucenikId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUcenik(response.data);
      setEditedUcenik(response.data);
      
      // Reset form
      setNewOcjena({ casId: '', lekcijaId: '', ocjena: 5, komentar: '' });
      
      if (onSave) {
        await onSave();
      }
    } catch (err) {
      console.error('Error adding ocjena:', err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Greška pri dodavanju ocjene');
    } finally {
      setSaving(false);
    }
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

  const renderStatistikaTab = () => {
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
      </div>
    );
  };

  const renderOcjeneTab = () => {
    return (
      <div className="space-y-6">
        {/* Form za dodavanje ocjene */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Dodaj ocjenu
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Čas</label>
                <select
                  value={newOcjena.casId}
                  onChange={(e) => {
                    setNewOcjena({ ...newOcjena, casId: e.target.value, lekcijaId: '' });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Odaberi čas</option>
                  {casovi.filter(c => c.id).map((cas) => (
                    <option key={cas.id} value={cas.id}>
                      {new Date(cas.datum).toLocaleDateString('bs-BA')} - {cas.raspored?.slot}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lekcija</label>
                <select
                  value={newOcjena.lekcijaId}
                  onChange={(e) => setNewOcjena({ ...newOcjena, lekcijaId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loadingLekcije || !newOcjena.casId}
                >
                  <option value="">{loadingLekcije ? 'Učitavanje...' : 'Odaberi lekciju'}</option>
                  {lekcije.map((lekcija) => (
                    <option key={lekcija.id} value={lekcija.id}>
                      {lekcija.naslov}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ocjena</label>
                <select
                  value={newOcjena.ocjena}
                  onChange={(e) => setNewOcjena({ ...newOcjena, ocjena: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={5}>5 - Odličan</option>
                  <option value={4}>4 - Vrlo dobar</option>
                  <option value={3}>3 - Dobar</option>
                  <option value={2}>2 - Dovoljan</option>
                  <option value={1}>1 - Nedovoljan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Komentar (opcionalno)</label>
                <textarea
                  value={newOcjena.komentar}
                  onChange={(e) => setNewOcjena({ ...newOcjena, komentar: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Dodatni komentar..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddOcjena}
                  disabled={saving || !newOcjena.casId || !newOcjena.lekcijaId}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {saving ? 'Spremanje...' : 'Dodaj ocjenu'}
                </button>
                <button
                  onClick={() => {
                    setNewOcjena({ casId: '', lekcijaId: '', ocjena: 5, komentar: '' });
                  }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Resetuj
                </button>
              </div>
            </div>
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
        {activeTab === 'statistika' && renderStatistikaTab()}
        {activeTab === 'ocjene' && renderOcjeneTab()}
      </div>
    );
  };

  if (!open) return null;

  return (
    <>
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
              onClick={() => setActiveTab('statistika')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'statistika'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistika
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

