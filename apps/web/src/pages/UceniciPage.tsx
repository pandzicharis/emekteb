import { useState, useEffect, useCallback, useRef } from 'react';
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
  obrazovanje: {
    nivoObrazovanja: string | null;
    razred: number | null;
    mektebStepen: string | null;
  } | null;
  prosjek: number | null;
  razredNaziv: string | null;
  eksterniId: number | null;
}

interface RazredMekteba {
  id: string; // mektebStepen
  naziv: string; // mektebStepen
  brojUcenika: number;
}

interface PaginatedResponse {
  data: Ucenik[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type SortField = 'ime' | 'prezime' | 'datumRodjenja' | 'prosjek' | 'razred';
type SortDirection = 'asc' | 'desc';

export default function UceniciPage() {
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [razredi, setRazredi] = useState<RazredMekteba[]>([]);
  const [selectedRazredNaziv, setSelectedRazredNaziv] = useState<string | null>(null);
  const [selectedUcenik, setSelectedUcenik] = useState<Ucenik | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>('prezime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const limit = 50;
  const loadingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Fetch razredi on mount
  useEffect(() => {
    fetchRazredi();
  }, []);

  // Fetch ucenici on mount
  useEffect(() => {
    fetchUcenici(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset and fetch ucenici when razred filter changes
  useEffect(() => {
    setCurrentPage(1);
    setUcenici([]);
    setHasMore(true);
    fetchUcenici(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRazredNaziv]);

  const fetchRazredi = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<RazredMekteba[]>(`${API_URL}/ucenici/razredi`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRazredi(response.data);
    } catch (err: any) {
      console.error('Error fetching razredi:', err);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingRef.current || loadingMore || !hasMore || loading) {
      return;
    }
    
    loadingRef.current = true;
    const nextPage = currentPage + 1;
    
    try {
      setLoadingMore(true);
      setError(null);
      const token = localStorage.getItem('token');
      const url = `${API_URL}/ucenici?page=${nextPage}&limit=${limit}${selectedRazredNaziv ? `&razredNaziv=${encodeURIComponent(selectedRazredNaziv)}` : ''}`;
      
      const response = await axios.get<PaginatedResponse>(
        url,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const responseData = response.data;
      let newUcenici: Ucenik[] = [];
      let totalCount = 0;
      let totalPagesCount = 1;
      
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && 'data' in responseData) {
        newUcenici = responseData.data || [];
        totalCount = responseData.total || 0;
        totalPagesCount = responseData.totalPages || 1;
      }
      
      const sortedUcenici = sortUcenici(newUcenici, sortField, sortDirection);
      setUcenici((prev) => [...prev, ...sortedUcenici]);
      setTotal(totalCount);
      setCurrentPage(nextPage);
      setHasMore(nextPage < totalPagesCount && newUcenici.length === limit);
      
    } catch (err: any) {
      console.error('Error loading more ucenici:', err);
      setError(err.response?.data?.message || 'Greška pri učitavanju učenika');
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [currentPage, loadingMore, hasMore, loading, selectedRazredNaziv]);

  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (!mainElement) {
      console.warn('Main element not found for scroll detection');
      return;
    }

    const handleScroll = () => {
      if (loading || loadingMore || !hasMore || loadingRef.current) {
        return;
      }

      const scrollTop = mainElement.scrollTop;
      const previousScrollTop = lastScrollTopRef.current;
      
      if (scrollTop === previousScrollTop) {
        return;
      }
      
      lastScrollTopRef.current = scrollTop;

      const containerHeight = mainElement.clientHeight;
      const scrollHeight = mainElement.scrollHeight;
      const scrollBottom = scrollTop + containerHeight;
      const threshold = 300;

      if (scrollBottom >= scrollHeight - threshold) {
        loadMore();
      }
    };

    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    mainElement.addEventListener('scroll', throttledHandleScroll, { passive: true });
    window.addEventListener('resize', throttledHandleScroll, { passive: true });
    
    return () => {
      mainElement.removeEventListener('scroll', throttledHandleScroll);
      window.removeEventListener('resize', throttledHandleScroll);
    };
  }, [loading, loadingMore, hasMore, loadMore]);

  const sortUcenici = (uceniciToSort: Ucenik[], field: SortField, direction: SortDirection): Ucenik[] => {
    return [...uceniciToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case 'ime':
          aValue = a.ime || '';
          bValue = b.ime || '';
          break;
        case 'prezime':
          aValue = a.prezime || '';
          bValue = b.prezime || '';
          break;
        case 'datumRodjenja':
          aValue = a.datumRodjenja ? new Date(a.datumRodjenja).getTime() : 0;
          bValue = b.datumRodjenja ? new Date(b.datumRodjenja).getTime() : 0;
          break;
        case 'prosjek':
          aValue = a.prosjek ?? -1;
          bValue = b.prosjek ?? -1;
          break;
        case 'razred':
          aValue = a.obrazovanje?.razred ?? 0;
          bValue = b.obrazovanje?.razred ?? 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return direction === 'asc' ? comparison : -comparison;
      } else {
        const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        return direction === 'asc' ? comparison : -comparison;
      }
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const fetchUcenici = async (isInitial = false, pageOverride?: number) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const token = localStorage.getItem('token');
      const pageToUse = pageOverride !== undefined ? pageOverride : currentPage;
      const url = `${API_URL}/ucenici?page=${pageToUse}&limit=${limit}${selectedRazredNaziv ? `&razredNaziv=${encodeURIComponent(selectedRazredNaziv)}` : ''}`;
      
      const response = await axios.get<PaginatedResponse>(
        url,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const responseData = response.data;
      let newUcenici: Ucenik[] = [];
      let totalCount = 0;
      let totalPagesCount = 1;
      
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && 'data' in responseData) {
        newUcenici = responseData.data || [];
        totalCount = responseData.total || 0;
        totalPagesCount = responseData.totalPages || 1;
      }
      
      const sortedUcenici = sortUcenici(newUcenici, sortField, sortDirection);
      
      if (isInitial) {
        setUcenici(sortedUcenici);
        if (pageToUse === 1) {
          setCurrentPage(1);
        }
      } else {
        setUcenici((prev) => [...prev, ...sortedUcenici]);
      }
      
      setTotal(totalCount);
      setHasMore(pageToUse < totalPagesCount && newUcenici.length === limit);
      
    } catch (err: any) {
      console.error('Error fetching ucenici:', err);
      setError(err.response?.data?.message || 'Greška pri učitavanju učenika');
      if (isInitial) {
        setUcenici([]);
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Re-sort when sort field or direction changes
  useEffect(() => {
    if (ucenici.length > 0) {
      const sorted = sortUcenici([...ucenici], sortField, sortDirection);
      setUcenici(sorted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('bs-BA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const getAge = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const today = new Date();
      const birthDate = new Date(dateString);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  const getRazredColor = (razredNaziv: string | null) => {
    const defaultColor = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', activeBg: 'bg-gray-600', activeText: 'text-white' };
    
    if (!razredNaziv) return defaultColor;
    
    const razredNum = parseInt(razredNaziv.replace('Razred ', ''));
    
    // Različite boje za različite razrede
    const colors = [
      { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', activeBg: 'bg-purple-600', activeText: 'text-white' }, // Razred 1
      { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', activeBg: 'bg-indigo-600', activeText: 'text-white' }, // Razred 2
      { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', activeBg: 'bg-blue-600', activeText: 'text-white' }, // Razred 3
      { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', activeBg: 'bg-cyan-600', activeText: 'text-white' }, // Razred 4
      { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', activeBg: 'bg-teal-600', activeText: 'text-white' }, // Razred 5
      { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', activeBg: 'bg-green-600', activeText: 'text-white' }, // Razred 6
      { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', activeBg: 'bg-emerald-600', activeText: 'text-white' }, // Razred 7
      { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-300', activeBg: 'bg-lime-600', activeText: 'text-white' }, // Razred 8
      { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', activeBg: 'bg-amber-600', activeText: 'text-white' }, // Razred 9
    ];
    
    return colors[(razredNum - 1) % colors.length] || defaultColor;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Učenici</h1>
          <p className="text-sm text-gray-600 mt-1">
            Pregled svih učenika ({total} ukupno)
          </p>
        </div>
      </div>

      {/* Razred Filter Tabs */}
      {razredi.length > 0 && (
        <div className="mb-6">
          <div className="w-full rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex">
              <button
                onClick={() => setSelectedRazredNaziv(null)}
                className={`flex-1 px-4 py-2.5 font-medium text-sm transition-all duration-200 relative ${
                  selectedRazredNaziv === null
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                SVI
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  selectedRazredNaziv === null
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {razredi.reduce((sum, r) => sum + r.brojUcenika, 0)}
                </span>
                {selectedRazredNaziv === null && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
              {razredi.map((razred) => {
                const colors = getRazredColor(razred.naziv);
                return (
                  <button
                    key={razred.id}
                    onClick={() => setSelectedRazredNaziv(razred.id)}
                    className={`flex-1 px-4 py-2.5 font-medium text-sm transition-all duration-200 relative border-l border-gray-200 ${
                      selectedRazredNaziv === razred.id
                        ? `${colors.activeBg} ${colors.activeText}`
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {razred.naziv}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      selectedRazredNaziv === razred.id
                        ? `${colors.activeBg} ${colors.activeText} border-transparent`
                        : `${colors.bg} ${colors.text} ${colors.border}`
                    }`}>
                      {razred.brojUcenika}
                    </span>
                    {selectedRazredNaziv === razred.id && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.activeBg}`}></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      ) : (
        <div className={`flex gap-6 h-[calc(100vh-12rem)] ${selectedUcenik ? 'items-stretch' : ''}`}>
          {/* Tabela - smanjena kada je selektovan učenik */}
          <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${
            selectedUcenik ? 'flex-1 overflow-y-auto' : 'w-full overflow-y-auto'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('prezime')}
                    >
                      <div className="flex items-center gap-2">
                        Učenik
                        <SortIcon field="prezime" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('datumRodjenja')}
                    >
                      <div className="flex items-center gap-2">
                        Datum rođenja
                        <SortIcon field="datumRodjenja" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('razred')}
                    >
                      <div className="flex items-center gap-2">
                        Obrazovanje
                        <SortIcon field="razred" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('prosjek')}
                    >
                      <div className="flex items-center gap-2">
                        Prosjek
                        <SortIcon field="prosjek" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Razred u mektebu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!ucenici || ucenici.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                        Nema učenika
                      </td>
                    </tr>
                  ) : (
                    ucenici.map((ucenik) => (
                      <tr
                        key={ucenik.id}
                        onClick={() => setSelectedUcenik(ucenik)}
                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                          selectedUcenik?.id === ucenik.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {ucenik.ime && ucenik.prezime
                              ? `${ucenik.ime} ${ucenik.prezime}`
                              : ucenik.ime || ucenik.prezime || 'Nepoznato'}
                          </div>
                          {ucenik.spol && (
                            <div className="text-xs text-gray-500 mt-1">
                              {ucenik.spol === 'MUSKO' ? 'Muško' : 'Žensko'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(ucenik.datumRodjenja)}
                          </div>
                          {ucenik.datumRodjenja && (
                            <div className="text-xs text-gray-500 mt-1">
                              {getAge(ucenik.datumRodjenja) !== null
                                ? `${getAge(ucenik.datumRodjenja)} godina`
                                : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ucenik.obrazovanje ? (
                            <div>
                              {ucenik.obrazovanje.razred && (
                                <div className="text-sm font-medium text-gray-900">
                                  {ucenik.obrazovanje.razred}. razred
                                </div>
                              )}
                              {ucenik.obrazovanje.mektebStepen && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {ucenik.obrazovanje.mektebStepen}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ucenik.prosjek !== null ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${
                                ucenik.prosjek >= 4.5
                                  ? 'text-emerald-600'
                                  : ucenik.prosjek >= 3.5
                                  ? 'text-blue-600'
                                  : ucenik.prosjek >= 2.5
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}>
                                {ucenik.prosjek.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ucenik.razredNaziv ? (
                            (() => {
                              const colors = getRazredColor(ucenik.razredNaziv);
                              return (
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                                  {ucenik.razredNaziv}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="mt-6 flex items-center justify-center py-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600">Učitavanje učenika...</span>
                </div>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && ucenici.length > 0 && (
              <div className="mt-6 text-center py-4">
                <p className="text-sm text-gray-500">
                  Prikazano svih <span className="font-semibold">{ucenici.length}</span> od{' '}
                  <span className="font-semibold">{total}</span> učenika
                </p>
              </div>
            )}
          </div>

          {/* Detalji učenika */}
          {selectedUcenik && (
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
              {/* Header */}
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedUcenik.ime && selectedUcenik.prezime
                      ? `${selectedUcenik.ime} ${selectedUcenik.prezime}`
                      : selectedUcenik.ime || selectedUcenik.prezime || 'Nepoznato'}
                  </h2>
                  {selectedUcenik.razredNaziv && (
                    <div className="mt-2">
                      {(() => {
                        const colors = getRazredColor(selectedUcenik.razredNaziv);
                        return (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {selectedUcenik.razredNaziv}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedUcenik(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - scrollable */}
              <div className="flex-1 overflow-y-auto p-6">

                <div className="space-y-6">
                  {/* Osnovni podaci */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Osnovni podaci
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                    {selectedUcenik.datumRodjenja && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Datum rođenja</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedUcenik.datumRodjenja)}
                          {getAge(selectedUcenik.datumRodjenja) !== null && (
                            <span className="text-gray-500 ml-2">({getAge(selectedUcenik.datumRodjenja)} godina)</span>
                          )}
                        </p>
                      </div>
                    )}
                    {selectedUcenik.spol && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Spol</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedUcenik.spol === 'MUSKO' ? 'Muško' : 'Žensko'}
                        </p>
                      </div>
                    )}
                    {selectedUcenik.mjestoRodjenja && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Mjesto rođenja</p>
                        <p className="text-sm font-medium text-gray-900">{selectedUcenik.mjestoRodjenja}</p>
                      </div>
                    )}
                    {selectedUcenik.adresaStanovanja && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Adresa stanovanja</p>
                        <p className="text-sm font-medium text-gray-900">{selectedUcenik.adresaStanovanja}</p>
                      </div>
                    )}
                    {selectedUcenik.email && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="text-sm font-medium text-gray-900">{selectedUcenik.email}</p>
                      </div>
                    )}
                    {selectedUcenik.prosjek !== null && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Prosjek</p>
                        <p className={`text-lg font-bold ${
                          selectedUcenik.prosjek >= 4.5
                            ? 'text-emerald-600'
                            : selectedUcenik.prosjek >= 3.5
                            ? 'text-blue-600'
                            : selectedUcenik.prosjek >= 2.5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {selectedUcenik.prosjek.toFixed(2)}
                        </p>
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Obrazovanje */}
                  {selectedUcenik.obrazovanje && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Obrazovanje
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                      {selectedUcenik.obrazovanje.nivoObrazovanja && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Nivo obrazovanja</p>
                          <p className="text-sm font-medium text-gray-900">{selectedUcenik.obrazovanje.nivoObrazovanja}</p>
                        </div>
                      )}
                      {selectedUcenik.obrazovanje.razred !== null && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Razred</p>
                          <p className="text-sm font-medium text-gray-900">{selectedUcenik.obrazovanje.razred}. razred</p>
                        </div>
                      )}
                      {selectedUcenik.obrazovanje.mektebStepen && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Mekteb stepen</p>
                          <p className="text-sm font-medium text-gray-900">{selectedUcenik.obrazovanje.mektebStepen}</p>
                        </div>
                      )}
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Status
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedUcenik.aktivan
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedUcenik.aktivan ? 'Aktivan' : 'Neaktivan'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
