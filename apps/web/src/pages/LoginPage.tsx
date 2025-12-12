import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface QuickLoginUser {
  id: string;
  ime: string | null;
  prezime: string | null;
  fotografija: string | null;
  pin: string | null;
  uloga?: 'ADMIN' | 'MUALLIM' | 'UCENIK';
  poslednjeLogiranje: string | null; // ISO string datuma poslednjeg logiranja
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickLoginUsers, setQuickLoginUsers] = useState<QuickLoginUser[]>([]);
  const [loadingQuickUsers, setLoadingQuickUsers] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<QuickLoginUser | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [parsedUsersFromStorage, setParsedUsersFromStorage] = useState<Array<{
    id: string;
    ime: string | null;
    prezime: string | null;
    fotografija: string | null;
    pin: string | null;
    poslednjeLogiranje: string;
  }>>([]);
  const { login, loginWithPin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect ako je već autentifikovan
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Učitaj muallime za brzi login iz localStorage (po browseru)
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingQuickUsers(false);
      return; // Ne učitavaj ako je već autentifikovan
    }
    
    const loadUsers = async () => {
      try {
        setLoadingQuickUsers(true);
        
        // Učitaj korisnike iz localStorage
        const quickLoginKey = 'quickLoginUsers';
        const storedUsers = localStorage.getItem(quickLoginKey);
        
        console.log('🔍 Učitavanje korisnika iz localStorage...');
        console.log('📦 Raw localStorage data:', storedUsers);
        
        if (!storedUsers) {
          console.log('⚠️ Nema korisnika u localStorage');
          setParsedUsersFromStorage([]);
          setQuickLoginUsers([]);
          setLoadingQuickUsers(false);
          return;
        }

        const usersFromStorage: Array<{
          id: string;
          ime: string | null;
          prezime: string | null;
          fotografija: string | null;
          pin: string | null;
          poslednjeLogiranje: string;
        }> = JSON.parse(storedUsers);

        // Sačuvaj parsirane korisnike za prikaz
        setParsedUsersFromStorage(usersFromStorage);

        console.log('✅ Parsirani korisnici iz localStorage:', usersFromStorage);
        console.log('📊 Broj korisnika:', usersFromStorage.length);

        // Filtriraj samo muallime (oni koji imaju PIN)
        const muallimi = usersFromStorage.filter((u) => u.pin !== null);
        console.log('👨‍🏫 Muallimi (sa PIN-om):', muallimi);
        console.log('📊 Broj muallima:', muallimi.length);

        // Učitaj detalje korisnika iz API-ja za validaciju i ažuriranje podataka
        const usersWithDetails: QuickLoginUser[] = await Promise.all(
          muallimi.map(async (user) => {
            try {
              // Pokušaj da učitaš detalje iz API-ja
              const response = await axios.get(`${API_URL}/muallimi/${user.id}`);
              return {
                id: response.data.id,
                ime: response.data.ime || user.ime,
                prezime: response.data.prezime || user.prezime,
                fotografija: response.data.fotografija || user.fotografija,
                pin: response.data.pin || user.pin,
                uloga: response.data.uloga,
                poslednjeLogiranje: user.poslednjeLogiranje, // Koristi vrijeme iz localStorage
              };
            } catch (err) {
              // Ako API ne vrati korisnika, koristi podatke iz localStorage
              console.warn(`Korisnik ${user.id} nije pronađen u API-ju, koristim podatke iz localStorage`);
              return {
                id: user.id,
                ime: user.ime,
                prezime: user.prezime,
                fotografija: user.fotografija,
                pin: user.pin,
                poslednjeLogiranje: user.poslednjeLogiranje,
              };
            }
          })
        );

        // Sortiraj po vremenu logiranja (najnoviji prvo)
        usersWithDetails.sort((a, b) => {
          const timeA = new Date(a.poslednjeLogiranje || 0).getTime();
          const timeB = new Date(b.poslednjeLogiranje || 0).getTime();
          return timeB - timeA;
        });

        console.log('🎯 Finalna lista korisnika za prikaz:', usersWithDetails);
        console.log('📅 Vremena logiranja:', usersWithDetails.map(u => ({
          ime: `${u.ime} ${u.prezime}`,
          vrijeme: u.poslednjeLogiranje,
          timeAgo: u.poslednjeLogiranje ? (() => {
            const diff = Date.now() - new Date(u.poslednjeLogiranje).getTime();
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            if (days > 0) return `${days} dana`;
            if (hours > 0) return `${hours} sati`;
            if (minutes > 0) return `${minutes} minuta`;
            return 'Sada';
          })() : 'N/A'
        })));

        setQuickLoginUsers(usersWithDetails);
        setLoadingQuickUsers(false);
      } catch (err) {
        console.error('Neuspješno učitavanje muallima za brzi login', err);
        setQuickLoginUsers([]);
        setLoadingQuickUsers(false);
      }
    };
    
    loadUsers();
  }, [isAuthenticated]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, lozinka);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Greška pri prijavi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLoginClick = (user: QuickLoginUser) => {
    setSelectedUser(user);
    setPinInput('');
    setError('');
    setShowPinModal(true);
  };

  const closePinModal = () => {
    setShowPinModal(false);
    setPinInput('');
    setSelectedUser(null);
    setError('');
  };

  // ESC key handler za zatvaranje modala
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPinModal) {
        closePinModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showPinModal]);

  // Funkcija za login sa PIN-om
  const performPinLogin = useCallback(async () => {
    if (!selectedUser || !pinInput || pinInput.length < 4) return;
    
    setError('');
    setIsLoading(true);

    try {
      if (!selectedUser || !selectedUser.id) {
        setError('Korisnik nije odabran');
        setIsLoading(false);
        return;
      }
      console.log('🔑 Attempting PIN login:', { pin: pinInput, userId: selectedUser.id, user: selectedUser });
      await loginWithPin(pinInput, selectedUser.id);
      // Samo zatvori modal ako je login uspješan
      setShowPinModal(false);
      setPinInput('');
      setSelectedUser(null);
      navigate('/');
    } catch (err: unknown) {
      let errorMessage = 'Neispravan PIN';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.message || 'Neispravan PIN';
      }
      setError(errorMessage);
      // Ne resetuj PIN input - ostavi ga da korisnik vidi šta je unio i pokuša ponovo
      // Modal ostaje otvoren
      setIsLoading(false);
    }
  }, [selectedUser, pinInput, loginWithPin, navigate]);

  // Automatski šalji zahtjev kada se unese PIN (4-6 cifara)
  // Ne pokreći automatsko slanje ako postoji greška (da korisnik može vidjeti grešku i pokušati ponovo)
  useEffect(() => {
    if (showPinModal && pinInput.length >= 4 && pinInput.length <= 6 && !isLoading && selectedUser && !error) {
      const timer = setTimeout(() => {
        performPinLogin();
      }, 500); // Mala pauza da korisnik završi unos

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [pinInput, showPinModal, isLoading, selectedUser, performPinLogin, error]);

  const getInitials = (user: QuickLoginUser) => {
    const ime = user.ime?.charAt(0).toUpperCase() || '';
    const prezime = user.prezime?.charAt(0).toUpperCase() || '';
    return ime + prezime || 'M';
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full max-h-screen overflow-y-auto">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 border border-gray-100">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-2xl shadow-lg transform hover:scale-105 transition-transform duration-200">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              E-Mekteb
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-700">
              Džemat Grbavica 2
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Prijavite se na svoj nalog
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 animate-in slide-in-from-top-2">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Email Login Form */}
          <form 
            className="space-y-4" 
            onSubmit={handleEmailLogin} 
            autoComplete="off"
            data-form-type="other"
          >
            {/* Hidden dummy fields to prevent Chrome password save popup */}
            <input 
              type="text" 
              name="fake-username" 
              autoComplete="username" 
              style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} 
              tabIndex={-1}
              readOnly
            />
            <input 
              type="password" 
              name="fake-password" 
              autoComplete="new-password" 
              style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} 
              tabIndex={-1}
              readOnly
            />
            
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email adresa
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email-input"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  required
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md"
                  placeholder="unesite@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="lozinka" className="block text-sm font-medium text-gray-700 mb-1.5">
                Lozinka
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="lozinka"
                  name="password-input"
                  type="password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  required
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md"
                  placeholder="••••••••"
                  value={lozinka}
                  onChange={(e) => setLozinka(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Prijava...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span>Prijavi se</span>
                    <svg
                      className="ml-2 h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Quick Login Avatars - Ispod forme */}
          {!loadingQuickUsers && (
            <div className="pt-4 border-t border-gray-200 space-y-3">
              {(quickLoginUsers.length > 0 || parsedUsersFromStorage.length > 0) ? (
                <>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Nedavno logirani korisnici</p>
                    <p className="text-xs text-gray-500">Kliknite na korisnika za prijavu sa PIN-om</p>
                  </div>
                  <div className="flex flex-nowrap justify-center items-start gap-3 overflow-x-auto pb-2 px-2">
                    {quickLoginUsers.map((user) => {
                      const timeAgo = user.poslednjeLogiranje 
                        ? (() => {
                            const diff = Date.now() - new Date(user.poslednjeLogiranje).getTime();
                            const minutes = Math.floor(diff / 60000);
                            const hours = Math.floor(minutes / 60);
                            const days = Math.floor(hours / 24);
                            if (days > 0) return `${days} dana`;
                            if (hours > 0) return `${hours} sati`;
                            if (minutes > 0) return `${minutes} minuta`;
                            return 'Sada';
                          })()
                        : null;
                      
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleQuickLoginClick(user)}
                          disabled={isLoading}
                          className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-indigo-50 hover:to-purple-50 border-2 border-transparent hover:border-indigo-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-lg flex-shrink-0 w-[100px] h-[110px]"
                        >
                          {user.fotografija ? (
                            <div className="w-12 h-12 flex-shrink-0 rounded-full border-2 border-white shadow-lg group-hover:border-indigo-300 transition-all overflow-hidden">
                              <img
                                src={`${API_URL}${user.fotografija}`}
                                alt={user.uloga === 'ADMIN' ? 'ADMIN' : `${user.ime} ${user.prezime}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[16px] leading-none border-2 border-white shadow-lg group-hover:border-indigo-300 transition-all">
                              {getInitials(user)}
                            </div>
                          )}
                          <div className="text-center w-full min-h-[32px] flex flex-col justify-center">
                            <span className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700 transition-colors block truncate leading-tight">
                              {user.uloga === 'ADMIN' ? 'ADMIN' : `${user.ime} ${user.prezime}`}
                            </span>
                            {timeAgo ? (
                              <span className="text-[10px] text-gray-500 group-hover:text-indigo-600 transition-colors block mt-0.5 leading-tight">
                                {timeAgo}
                              </span>
                            ) : (
                              <span className="text-[10px] text-transparent block mt-0.5 leading-tight">-</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {/* Prikaži korisnike iz localStorage koji nisu već u quickLoginUsers */}
                    {parsedUsersFromStorage
                      .filter(storageUser => !quickLoginUsers.some(quickUser => quickUser.id === storageUser.id))
                      .map((user) => {
                        const timeAgo = user.poslednjeLogiranje 
                          ? (() => {
                              const diff = Date.now() - new Date(user.poslednjeLogiranje).getTime();
                              const minutes = Math.floor(diff / 60000);
                              const hours = Math.floor(minutes / 60);
                              const days = Math.floor(hours / 24);
                              if (days > 0) return `${days} dana`;
                              if (hours > 0) return `${hours} sati`;
                              if (minutes > 0) return `${minutes} minuta`;
                              return 'Sada';
                            })()
                          : null;
                        
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleQuickLoginClick({
                              id: user.id,
                              ime: user.ime,
                              prezime: user.prezime,
                              fotografija: user.fotografija,
                              pin: user.pin,
                              uloga: undefined, // localStorage ne čuva uloga, ali će se učitati iz API-ja
                              poslednjeLogiranje: user.poslednjeLogiranje,
                            })}
                            disabled={isLoading}
                            className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-indigo-50 hover:to-purple-50 border-2 border-transparent hover:border-indigo-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-lg flex-shrink-0 w-[100px] h-[110px]"
                          >
                            {user.fotografija ? (
                              <div className="w-12 h-12 flex-shrink-0 rounded-full border-2 border-white shadow-lg group-hover:border-indigo-300 transition-all overflow-hidden">
                                <img
                                  src={`${API_URL}${user.fotografija}`}
                                  alt={`${user.ime || ''} ${user.prezime || ''}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[16px] leading-none border-2 border-white shadow-lg group-hover:border-indigo-300 transition-all">
                                {getInitials({
                                  id: user.id,
                                  ime: user.ime,
                                  prezime: user.prezime,
                                  fotografija: user.fotografija,
                                  pin: user.pin,
                                  uloga: undefined,
                                  poslednjeLogiranje: user.poslednjeLogiranje,
                                })}
                              </div>
                            )}
                            <div className="text-center w-full min-h-[32px] flex flex-col justify-center">
                              <span className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700 transition-colors block truncate leading-tight">
                                {user.ime || 'N/A'} {user.prezime || 'N/A'}
                              </span>
                              {timeAgo ? (
                                <span className="text-[10px] text-gray-500 group-hover:text-indigo-600 transition-colors block mt-0.5 leading-tight">
                                  {timeAgo}
                                </span>
                              ) : (
                                <span className="text-[10px] text-transparent block mt-0.5 leading-tight">-</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400">Nema nedavno logiranih korisnika</p>
                </div>
              )}
            </div>
          )}

          {/* PIN Modal */}
          {showPinModal && selectedUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop overlay */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={closePinModal}
              ></div>
              {/* Modal content */}
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 relative z-10 animate-in slide-in-from-bottom-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Unesite PIN</h3>
                  <button
                    type="button"
                    onClick={closePinModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4">
                  {selectedUser.fotografija ? (
                    <img
                      src={`${API_URL}${selectedUser.fotografija}`}
                      alt={`${selectedUser.ime} ${selectedUser.prezime}`}
                      className="w-20 h-20 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-indigo-200 shadow-lg">
                      {getInitials(selectedUser)}
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedUser.ime} {selectedUser.prezime}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Unesite PIN za prijavu</p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                      PIN
                    </label>
                    <div className="relative">
                      <input
                        id="pin"
                        name="pin-input"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        autoComplete="off"
                        data-lpignore="true"
                        data-form-type="other"
                        disabled={isLoading}
                        value={pinInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setPinInput(value);
                          setError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && pinInput.length >= 4 && !isLoading) {
                            e.preventDefault();
                            performPinLogin();
                          }
                        }}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center text-2xl font-mono tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="0000"
                      />
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    {!isLoading && pinInput.length > 0 && pinInput.length < 4 && (
                      <p className="mt-2 text-xs text-gray-500 text-center">
                        Unesite najmanje 4 cifre
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {loadingQuickUsers && quickLoginUsers.length === 0 && (
            <div className="pt-6 border-t border-gray-200">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
