import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import UcenikDetailsDrawer from '../components/UcenikDetailsDrawer';

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
  status: string | null;
  opis: string | null;
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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [quickProsjekFilter, setQuickProsjekFilter] = useState<string | null>(null); // 'excellent', 'good', 'average', 'poor'
  // Prikaži samo aktivne učenike po defaultu
  const [showOnlyActive, setShowOnlyActive] = useState<boolean>(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    prosjekMin: null as number | null,
    prosjekMax: null as number | null,
    spol: null as string | null,
    status: null as string | null,
    mjestoRodjenja: '',
    adresaStanovanja: '',
    imaPosebnePotrebe: null as boolean | null,
    tipStambenogObjekta: '',
    razred: null as number | null,
    mektebStepen: '',
    nivoObrazovanja: '',
    datumRodjenjaOd: '',
    datumRodjenjaDo: '',
    brojBraceMin: null as number | null,
    brojBraceMax: null as number | null,
    brojSestaraMin: null as number | null,
    brojSestaraMax: null as number | null,
  });
  const [pendingFilters, setPendingFilters] = useState(advancedFilters);
  const [exporting, setExporting] = useState(false);

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

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      setUcenici([]);
      setHasMore(true);
      fetchUcenici(true, 1);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Reset and fetch when quick filters change
  useEffect(() => {
    setCurrentPage(1);
    setUcenici([]);
    setHasMore(true);
    fetchUcenici(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickProsjekFilter, advancedFilters]);

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
  }, [currentPage, loadingMore, hasMore, loading, selectedRazredNaziv, sortField, sortDirection]);

  useEffect(() => {
    const scrollContainer = tableContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const handleScroll = () => {
      if (loading || loadingMore || !hasMore || loadingRef.current) {
        return;
      }

      const scrollTop = scrollContainer.scrollTop;
      const previousScrollTop = lastScrollTopRef.current;
      
      if (scrollTop === previousScrollTop) {
        return;
      }
      
      lastScrollTopRef.current = scrollTop;

      const containerHeight = scrollContainer.clientHeight;
      const scrollHeight = scrollContainer.scrollHeight;
      const scrollBottom = scrollTop + containerHeight;
      const threshold = 200;

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

    scrollContainer.addEventListener('scroll', throttledHandleScroll, { passive: true });
    window.addEventListener('resize', throttledHandleScroll, { passive: true });
    
    return () => {
      scrollContainer.removeEventListener('scroll', throttledHandleScroll);
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

  const hasActiveFilters = searchQuery.trim() || quickProsjekFilter !== null || 
    Object.values(advancedFilters).some(v => v !== null && v !== '');

  const fetchUcenici = async (isInitial = false, pageOverride?: number) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const token = localStorage.getItem('token');
      
      // If filters are active, fetch all data in chunks
      let allUcenici: Ucenik[] = [];
      let totalCount = 0;
      let totalPagesCount = 1;
      
      if (hasActiveFilters && isInitial) {
        // Fetch all pages when filters are active
        let page = 1;
        let hasMorePages = true;
        while (hasMorePages) {
          const url = `${API_URL}/ucenici?page=${page}&limit=${limit}${selectedRazredNaziv ? `&razredNaziv=${encodeURIComponent(selectedRazredNaziv)}` : ''}`;
          const response = await axios.get<PaginatedResponse>(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const responseData = response.data;
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && 'data' in responseData) {
            const pageUcenici = responseData.data || [];
            allUcenici = [...allUcenici, ...pageUcenici];
            if (page === 1) {
        totalCount = responseData.total || 0;
        totalPagesCount = responseData.totalPages || 1;
            }
            hasMorePages = page < (responseData.totalPages || 1) && (responseData.data || []).length === limit;
            page++;
          } else {
            hasMorePages = false;
          }
        }
      } else {
        // Normal pagination - no filtering
        const pageToUse = pageOverride !== undefined ? pageOverride : currentPage;
        const url = `${API_URL}/ucenici?page=${pageToUse}&limit=${limit}${selectedRazredNaziv ? `&razredNaziv=${encodeURIComponent(selectedRazredNaziv)}` : ''}`;
        const response = await axios.get<PaginatedResponse>(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const responseData = response.data;
        if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && 'data' in responseData) {
          const pageUcenici = responseData.data || [];
          allUcenici = pageUcenici;
          totalCount = responseData.total || 0;
          totalPagesCount = responseData.totalPages || 1;
        }
      }
      
      // Apply filters
      let filteredUcenici = allUcenici;
      
      if (hasActiveFilters) {
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          filteredUcenici = filteredUcenici.filter(u => 
            (u.ime?.toLowerCase().includes(query) || false) ||
            (u.prezime?.toLowerCase().includes(query) || false) ||
            (`${u.ime || ''} ${u.prezime || ''}`.toLowerCase().includes(query))
          );
        }
        
        // Quick prosjek filter
        if (quickProsjekFilter) {
          filteredUcenici = filteredUcenici.filter(u => {
            if (u.prosjek === null) return false;
            switch (quickProsjekFilter) {
              case 'excellent': 
                return u.prosjek >= 4.5;
              case 'very_good':
                return u.prosjek >= 4.0 && u.prosjek < 4.5;
              case 'good': 
                return u.prosjek >= 3.5 && u.prosjek < 4.0;
              case 'average': 
                return u.prosjek >= 2.5 && u.prosjek < 3.5;
              case 'poor': 
                return u.prosjek < 2.5;
              default: 
                return true;
            }
          });
        }
        
        // Advanced prosjek filter
        if (advancedFilters.prosjekMin !== null || advancedFilters.prosjekMax !== null) {
          filteredUcenici = filteredUcenici.filter(u => {
            if (u.prosjek === null) return false;
            if (advancedFilters.prosjekMin !== null && u.prosjek < advancedFilters.prosjekMin) return false;
            if (advancedFilters.prosjekMax !== null && u.prosjek > advancedFilters.prosjekMax) return false;
            return true;
          });
        }
        
        // Advanced filters
        if (advancedFilters.spol) {
          filteredUcenici = filteredUcenici.filter(u => u.spol === advancedFilters.spol);
        }
        if (advancedFilters.status) {
          filteredUcenici = filteredUcenici.filter(u => u.status === advancedFilters.status);
        }
        if (advancedFilters.mjestoRodjenja) {
          filteredUcenici = filteredUcenici.filter(u => 
            u.mjestoRodjenja?.toLowerCase().includes(advancedFilters.mjestoRodjenja.toLowerCase())
          );
        }
        if (advancedFilters.adresaStanovanja) {
          filteredUcenici = filteredUcenici.filter(u => 
            u.adresaStanovanja?.toLowerCase().includes(advancedFilters.adresaStanovanja.toLowerCase())
          );
        }
        if (advancedFilters.razred !== null) {
          filteredUcenici = filteredUcenici.filter(u => u.obrazovanje?.razred === advancedFilters.razred);
        }
        if (advancedFilters.mektebStepen) {
          filteredUcenici = filteredUcenici.filter(u => 
            u.obrazovanje?.mektebStepen?.toLowerCase().includes(advancedFilters.mektebStepen.toLowerCase())
          );
        }
        if (advancedFilters.nivoObrazovanja) {
          filteredUcenici = filteredUcenici.filter(u => 
            u.obrazovanje?.nivoObrazovanja?.toLowerCase().includes(advancedFilters.nivoObrazovanja.toLowerCase())
          );
        }
        if (advancedFilters.datumRodjenjaOd) {
          filteredUcenici = filteredUcenici.filter(u => {
            if (!u.datumRodjenja) return false;
            return new Date(u.datumRodjenja) >= new Date(advancedFilters.datumRodjenjaOd);
          });
        }
        if (advancedFilters.datumRodjenjaDo) {
          filteredUcenici = filteredUcenici.filter(u => {
            if (!u.datumRodjenja) return false;
            return new Date(u.datumRodjenja) <= new Date(advancedFilters.datumRodjenjaDo);
          });
        }
      }

      // Global filter: samo aktivni učenici (osim ako je isključeno)
      if (showOnlyActive) {
        filteredUcenici = filteredUcenici.filter(u => u.status === 'AKTIVAN');
      }
      
      const sortedUcenici = sortUcenici(filteredUcenici, sortField, sortDirection);
      
      if (isInitial || hasActiveFilters) {
        setUcenici(sortedUcenici);
          setCurrentPage(1);
        if (hasActiveFilters) {
          setHasMore(false); // Disable infinite scroll when filters are active
          setTotal(filteredUcenici.length);
        } else {
          setTotal(totalCount);
          const pageToUse = pageOverride !== undefined ? pageOverride : 1;
          setHasMore(pageToUse < totalPagesCount && allUcenici.length === limit);
        }
      } else {
        // Normal pagination without filters
        const pageToUse = pageOverride !== undefined ? pageOverride : currentPage;
        setUcenici((prev) => [...prev, ...sortedUcenici]);
        setTotal(totalCount);
        setHasMore(pageToUse < totalPagesCount && allUcenici.length === limit);
      }
      
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
    const defaultColor = { 
      bg: 'bg-gray-50', 
      text: 'text-gray-600', 
      border: 'border-gray-200', 
      activeBg: 'bg-gray-600', 
      activeText: 'text-white' 
    };
    
    if (!razredNaziv) return defaultColor;
    
    const razredNum = parseInt(razredNaziv.replace('Razred ', ''));
    
    // Diskretnije boje za različite razrede - svjetlije verzije
    const colors = [
      { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', activeBg: 'bg-purple-600', activeText: 'text-white' }, // Razred 1
      { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', activeBg: 'bg-indigo-600', activeText: 'text-white' }, // Razred 2
      { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', activeBg: 'bg-blue-600', activeText: 'text-white' }, // Razred 3
      { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', activeBg: 'bg-cyan-600', activeText: 'text-white' }, // Razred 4
      { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', activeBg: 'bg-teal-600', activeText: 'text-white' }, // Razred 5
      { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', activeBg: 'bg-green-600', activeText: 'text-white' }, // Razred 6
      { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', activeBg: 'bg-emerald-600', activeText: 'text-white' }, // Razred 7
      { bg: 'bg-lime-50', text: 'text-lime-600', border: 'border-lime-200', activeBg: 'bg-lime-600', activeText: 'text-white' }, // Razred 8
      { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', activeBg: 'bg-amber-600', activeText: 'text-white' }, // Razred 9
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

  const getProsjekColor = (prosjek: number | null) => {
    if (prosjek === null) return { bg: 'bg-gray-200', text: 'text-gray-600', bar: 'bg-gray-300' };
    if (prosjek >= 4.5) return { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' };
    if (prosjek >= 3.5) return { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
    if (prosjek >= 2.5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' };
    return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' };
  };

  const ProsjekBar = ({ prosjek }: { prosjek: number | null }) => {
    if (prosjek === null) return null;
    const percentage = (prosjek / 5) * 100;
    const colors = getProsjekColor(prosjek);

  return (
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  const AvatarIcon = ({ ucenik }: { ucenik: Ucenik }) => {
    if (ucenik.fotografija) {
      return (
        <img 
          src={`${API_URL}/${ucenik.fotografija}`} 
          alt={`${ucenik.ime} ${ucenik.prezime}`}
          className="w-10 h-10 rounded-full object-cover border border-gray-200"
        />
      );
    }
    
    const initials = `${ucenik.ime?.[0] || ''}${ucenik.prezime?.[0] || ''}`.toUpperCase() || '?';
    const colors = getRazredColor(ucenik.razredNaziv);
    
    return (
      <div className={`w-10 h-10 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center font-medium text-sm border ${colors.border}`}>
        {initials}
      </div>
    );
  };

  // Calculate stats
  const stats = {
    total: total,
    withProsjek: ucenici.filter(u => u.prosjek !== null).length,
    avgProsjek: ucenici.filter(u => u.prosjek !== null).length > 0
      ? (ucenici.filter(u => u.prosjek !== null).reduce((sum, u) => sum + (u.prosjek || 0), 0) / ucenici.filter(u => u.prosjek !== null).length).toFixed(2)
      : '0.00',
    excellent: ucenici.filter(u => u.prosjek !== null && u.prosjek >= 4.5).length,
    good: ucenici.filter(u => u.prosjek !== null && u.prosjek >= 3.5 && u.prosjek < 4.5).length,
    average: ucenici.filter(u => u.prosjek !== null && u.prosjek >= 2.5 && u.prosjek < 3.5).length,
    poor: ucenici.filter(u => u.prosjek !== null && u.prosjek < 2.5).length,
    active: ucenici.filter(u => u.status === 'AKTIVAN').length,
    archived: ucenici.filter(u => u.status === 'ARHIVIRAN').length,
    byGrade: (() => {
      const grades = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
      ucenici.forEach((u) => {
        if (u.prosjek === null || u.prosjek === undefined) return;
        let g = Math.round(u.prosjek);
        if (g < 1) g = 1;
        if (g > 5) g = 5;
        grades[g as 1 | 2 | 3 | 4 | 5] += 1;
      });
      return grades;
    })(),
    byRazred: (() => {
      const map = new Map<string, { sum: number; count: number }>();
      ucenici.forEach((u) => {
        if (!u.razredNaziv || u.prosjek === null || u.prosjek === undefined) return;
        const entry = map.get(u.razredNaziv) || { sum: 0, count: 0 };
        entry.sum += u.prosjek;
        entry.count += 1;
        map.set(u.razredNaziv, entry);
      });
      return Array.from(map.entries()).map(([razred, data]) => ({
        razred,
        avg: data.count > 0 ? (data.sum / data.count).toFixed(2) : '0.00',
        count: data.count,
      }));
    })() as Array<{ razred: string; avg: string; count: number }>,
  };

  // Export to CSV
  const handleExportCSV = () => {
    setExporting(true);
    try {
      const headers = ['Ime', 'Prezime', 'Email', 'Datum rođenja', 'Spol', 'Status', 'Razred', 'Prosjek', 'Mjesto rođenja', 'Adresa'];
      const rows = ucenici.map(u => [
        u.ime || '',
        u.prezime || '',
        u.email || '',
        u.datumRodjenja ? new Date(u.datumRodjenja).toLocaleDateString('bs-BA') : '',
        u.spol === 'MUSKO' ? 'Muško' : u.spol === 'ZENSKO' ? 'Žensko' : '',
        u.status === 'AKTIVAN' ? 'Aktivan' : u.status === 'ARHIVIRAN' ? 'Arhiviran' : '',
        u.razredNaziv || '',
        u.prosjek?.toFixed(2) || '',
        u.mjestoRodjenja || '',
        u.adresaStanovanja || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ucenici_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export error:', err);
      alert('Greška pri export-u podataka');
    } finally {
      setExporting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // / for search focus
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"][placeholder*="Pretraži"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
      // Esc to close advanced filters
      if (e.key === 'Escape' && showAdvancedFilters) {
        setShowAdvancedFilters(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdvancedFilters]);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-full p-6 lg:p-10">
      {/* Header with Export */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Učenici</h1>
          <p className="text-sm text-gray-600">
            Pregled svih učenika • <span className="font-semibold text-gray-900">{total}</span> ukupno
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting || ucenici.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Export...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </>
          )}
        </button>
      </div>

      {/* Combined Stats Card */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="space-y-3">
          {/* Red 1: Ukupno + Prosjek u istom redu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ukupno */}
            <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600">Ukupno učenika</p>
                <p className="text-lg font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
            {/* Aktivni */}
            <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600">Aktivni učenici</p>
                <p className="text-lg font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
            {/* Arhivirani */}
            <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="p-2 bg-rose-100 rounded-lg">
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600">Arhivirani učenici</p>
                <p className="text-lg font-bold text-gray-900">{stats.archived}</p>
              </div>
            </div>
            {/* Prosjek */}
            <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600">Prosjek ocjena</p>
                <p className="text-lg font-bold text-gray-900">{stats.avgProsjek}</p>
                <p className="text-[11px] text-gray-500">{stats.withProsjek} učenika sa ocjenama</p>
              </div>
            </div>
          </div>

          {/* Red 2: Ocjene 1-5 u istom redu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[5, 4, 3, 2, 1].map((g) => {
              const colors: Record<number, { iconBg: string; iconText: string; bar: string }> = {
                5: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-700', bar: 'bg-emerald-500' },
                4: { iconBg: 'bg-cyan-100', iconText: 'text-cyan-700', bar: 'bg-cyan-500' },
                3: { iconBg: 'bg-blue-100', iconText: 'text-blue-700', bar: 'bg-blue-500' },
                2: { iconBg: 'bg-amber-100', iconText: 'text-amber-700', bar: 'bg-amber-500' },
                1: { iconBg: 'bg-rose-100', iconText: 'text-rose-700', bar: 'bg-rose-500' },
              };
              const count = stats.byGrade[g as 1 | 2 | 3 | 4 | 5] || 0;
              const percent =
                stats.withProsjek && Number(stats.withProsjek) > 0
                  ? Math.round((count / Number(stats.withProsjek)) * 100)
                  : 0;
              return (
                <div key={g} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[g].iconBg}`}>
                    <span className={`text-sm font-bold ${colors[g].iconText}`}>{g}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{count} učenika</span>
                      <span className="text-gray-500">{percent}%</span>
                    </div>
                    <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[g].bar} rounded-full transition-all duration-300`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* All Filters Container */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Razred Filter Tabs */}
        {razredi.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex">
              <button
                onClick={() => setSelectedRazredNaziv(null)}
                className={`flex-1 px-3 py-2 font-medium text-xs transition-colors relative ${
                  selectedRazredNaziv === null
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <span>SVI</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    selectedRazredNaziv === null
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {razredi.reduce((sum, r) => sum + r.brojUcenika, 0)}
                  </span>
                </span>
              </button>
              {razredi.map((razred) => {
                const colors = getRazredColor(razred.naziv);
                return (
                  <button
                    key={razred.id}
                    onClick={() => setSelectedRazredNaziv(razred.id)}
                    className={`flex-1 px-3 py-2 font-medium text-xs transition-colors relative border-l border-gray-200 ${
                      selectedRazredNaziv === razred.id
                        ? `${colors.activeBg} ${colors.activeText}`
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <span>{razred.naziv}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        selectedRazredNaziv === razred.id
                          ? `${colors.activeBg} ${colors.activeText} border-transparent`
                          : `${colors.bg} ${colors.text} ${colors.border}`
                      }`}>
                        {razred.brojUcenika}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Filters Row */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Pretraži učenike po imenu ili prezimenu... (/)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-50 rounded-r-lg transition-colors"
                  >
                    <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Prosjek Filters */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Prosjek:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { key: 'excellent', label: 'Odličan', color: 'emerald', icon: 'M5 13l4 4L19 7' },
                  { key: 'very_good', label: 'Vrlo dobar', color: 'cyan', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { key: 'good', label: 'Dobar', color: 'blue', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { key: 'average', label: 'Dovoljan', color: 'yellow', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { key: 'poor', label: 'Nedovoljan', color: 'red', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setQuickProsjekFilter(quickProsjekFilter === filter.key ? null : filter.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      quickProsjekFilter === filter.key
                        ? `bg-${filter.color}-100 text-${filter.color}-700 border border-${filter.color}-300`
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={filter.icon} />
                    </svg>
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aktivni switch */}
            <div className="flex items-center gap-2 px-2 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs font-medium text-gray-600">Aktivan</span>
              <button
                type="button"
                onClick={() => setShowOnlyActive(!showOnlyActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showOnlyActive ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={showOnlyActive}
                title="Prikaži samo aktivne učenike"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    showOnlyActive ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => {
                setShowAdvancedFilters(!showAdvancedFilters);
                if (!showAdvancedFilters) {
                  setPendingFilters(advancedFilters);
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                showAdvancedFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Napredni</span>
              {Object.values(advancedFilters).some(v => v !== null && v !== '') && (
                <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full font-semibold">
                  {Object.values(advancedFilters).filter(v => v !== null && v !== '').length}
                </span>
              )}
            </button>
          </div>

          {/* Active Filters Chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap pt-3 mt-3 border-t border-gray-200">
              <span className="text-xs text-gray-500 font-medium">
                Aktivni filteri: <span className="text-blue-600 font-semibold">{ucenici.length}</span> rezultata
              </span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
                  {quickProsjekFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-md border border-emerald-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {quickProsjekFilter === 'excellent' 
                    ? 'Odličan' 
                    : quickProsjekFilter === 'very_good'
                      ? 'Vrlo dobar'
                      : quickProsjekFilter === 'good' 
                        ? 'Dobar' 
                        : quickProsjekFilter === 'average' 
                          ? 'Dovoljan' 
                          : 'Nedovoljan'}
                  <button
                    onClick={() => setQuickProsjekFilter(null)}
                    className="hover:bg-emerald-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {advancedFilters.prosjekMin !== null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-200">
                  Prosjek: {advancedFilters.prosjekMin.toFixed(1)}+
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, prosjekMin: null })}
                    className="hover:bg-purple-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {advancedFilters.prosjekMax !== null && advancedFilters.prosjekMax < 5 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-200">
                  Prosjek: ≤{advancedFilters.prosjekMax.toFixed(1)}
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, prosjekMax: null })}
                    className="hover:bg-purple-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {advancedFilters.spol && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md border border-indigo-200">
                  Spol: {advancedFilters.spol === 'MUSKO' ? 'Muško' : 'Žensko'}
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, spol: null })}
                    className="hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {advancedFilters.status && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md border border-indigo-200">
                  Status: {advancedFilters.status === 'AKTIVAN' ? 'Aktivan' : 'Arhiviran'}
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, status: null })}
                    className="hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {advancedFilters.razred !== null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-md border border-amber-200">
                  Razred: {advancedFilters.razred}
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, razred: null })}
                    className="hover:bg-amber-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="px-4 pb-4 pt-4 border-t border-gray-200 bg-gray-50">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-900">Napredni filteri</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPendingFilters({
                      prosjekMin: null,
                      prosjekMax: null,
                      spol: null,
                      status: null,
                      mjestoRodjenja: '',
                      adresaStanovanja: '',
                      imaPosebnePotrebe: null,
                      tipStambenogObjekta: '',
                      razred: null,
                      mektebStepen: '',
                      nivoObrazovanja: '',
                      datumRodjenjaOd: '',
                      datumRodjenjaDo: '',
                      brojBraceMin: null,
                      brojBraceMax: null,
                      brojSestaraMin: null,
                      brojSestaraMax: null,
                    });
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Resetuj
                </button>
                <button
                  onClick={() => {
                    setAdvancedFilters(pendingFilters);
                    setCurrentPage(1);
                    setUcenici([]);
                    setHasMore(true);
                    fetchUcenici(true, 1);
                    setShowAdvancedFilters(false);
                  }}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Primijeni
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Prosjek Range */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Prosjek ocjena</h4>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Min</label>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.1"
                        value={pendingFilters.prosjekMin ?? 0}
                        onChange={(e) => setPendingFilters({ ...pendingFilters, prosjekMin: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="mt-2 text-center">
                        <span className="text-sm font-semibold text-blue-600">{pendingFilters.prosjekMin?.toFixed(1) ?? '0.0'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Max</label>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.1"
                        value={pendingFilters.prosjekMax ?? 5}
                        onChange={(e) => setPendingFilters({ ...pendingFilters, prosjekMax: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="mt-2 text-center">
                        <span className="text-sm font-semibold text-blue-600">{pendingFilters.prosjekMax?.toFixed(1) ?? '5.0'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Osnovni podaci */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Osnovni podaci</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Spol */}
                  <div className="group">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Spol</label>
                    <select
                      value={pendingFilters.spol || ''}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, spol: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    >
                      <option value="">Svi</option>
                      <option value="MUSKO">Muško</option>
                      <option value="ZENSKO">Žensko</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                    <select
                      value={pendingFilters.status || ''}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, status: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    >
                      <option value="">Svi</option>
                      <option value="AKTIVAN">Aktivan</option>
                      <option value="ARHIVIRAN">Arhiviran</option>
                    </select>
                  </div>

                  {/* Mjesto rođenja */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Mjesto rođenja</label>
                    <input
                      type="text"
                      value={pendingFilters.mjestoRodjenja}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, mjestoRodjenja: e.target.value })}
                      placeholder="Unesite mjesto..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>

                  {/* Adresa stanovanja */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Adresa stanovanja</label>
                    <input
                      type="text"
                      value={pendingFilters.adresaStanovanja}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, adresaStanovanja: e.target.value })}
                      placeholder="Unesite adresu..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>

                  {/* Posebne potrebe */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Posebne potrebe</label>
                    <select
                      value={pendingFilters.imaPosebnePotrebe === null ? '' : pendingFilters.imaPosebnePotrebe ? 'true' : 'false'}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, imaPosebnePotrebe: e.target.value === '' ? null : e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    >
                      <option value="">Svi</option>
                      <option value="true">Da</option>
                      <option value="false">Ne</option>
                    </select>
                  </div>

                  {/* Tip stambenog objekta */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Tip stambenog objekta</label>
                    <select
                      value={pendingFilters.tipStambenogObjekta}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, tipStambenogObjekta: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    >
                      <option value="">Svi</option>
                      <option value="Stan">Stan</option>
                      <option value="Kuća">Kuća</option>
                      <option value="Podstanar">Podstanar</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Obrazovanje */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Obrazovanje</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Razred */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Razred</label>
                    <input
                      type="number"
                      min="1"
                      max="9"
                      value={pendingFilters.razred ?? ''}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, razred: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Unesite razred..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>

                  {/* Mekteb stepen */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Mekteb stepen</label>
                    <input
                      type="text"
                      value={pendingFilters.mektebStepen}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, mektebStepen: e.target.value })}
                      placeholder="Unesite stepen..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>

                  {/* Nivo obrazovanja */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Nivo obrazovanja</label>
                    <input
                      type="text"
                      value={pendingFilters.nivoObrazovanja}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, nivoObrazovanja: e.target.value })}
                      placeholder="Unesite nivo..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Datum i porodica */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Datum rođenja</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Od</label>
                    <input
                      type="date"
                      value={pendingFilters.datumRodjenjaOd}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, datumRodjenjaOd: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Do</label>
                    <input
                      type="date"
                      value={pendingFilters.datumRodjenjaDo}
                      onChange={(e) => setPendingFilters({ ...pendingFilters, datumRodjenjaDo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Porodica */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Porodica</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Broj braće</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={pendingFilters.brojBraceMin ?? 0}
                          onChange={(e) => setPendingFilters({ ...pendingFilters, brojBraceMin: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="mt-1 text-center">
                          <span className="text-xs text-gray-600">Min: <span className="font-semibold text-blue-600">{pendingFilters.brojBraceMin ?? 0}</span></span>
                        </div>
                      </div>
                      <div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={pendingFilters.brojBraceMax ?? 10}
                          onChange={(e) => setPendingFilters({ ...pendingFilters, brojBraceMax: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="mt-1 text-center">
                          <span className="text-xs text-gray-600">Max: <span className="font-semibold text-blue-600">{pendingFilters.brojBraceMax ?? 10}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Broj sestara</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={pendingFilters.brojSestaraMin ?? 0}
                          onChange={(e) => setPendingFilters({ ...pendingFilters, brojSestaraMin: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="mt-1 text-center">
                          <span className="text-xs text-gray-600">Min: <span className="font-semibold text-blue-600">{pendingFilters.brojSestaraMin ?? 0}</span></span>
                        </div>
                      </div>
                      <div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={pendingFilters.brojSestaraMax ?? 10}
                          onChange={(e) => setPendingFilters({ ...pendingFilters, brojSestaraMax: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="mt-1 text-center">
                          <span className="text-xs text-gray-600">Max: <span className="font-semibold text-blue-600">{pendingFilters.brojSestaraMax ?? 10}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
          <div className="space-y-4">
            {/* Skeleton Loader */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-12rem)]">
          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col w-full">
            <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-20 bg-gradient-to-b from-gray-50 to-white border-b-2 border-gray-300 shadow-md">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/50"
                      onClick={() => handleSort('prezime')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Učenik</span>
                        <SortIcon field="prezime" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/50"
                      onClick={() => handleSort('datumRodjenja')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Datum rođenja</span>
                        <SortIcon field="datumRodjenja" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/50"
                      onClick={() => handleSort('razred')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Obrazovanje</span>
                        <SortIcon field="razred" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/50"
                      onClick={() => handleSort('prosjek')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Prosjek</span>
                        <SortIcon field="prosjek" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50/50">
                      Razred u mektebu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {!ucenici || ucenici.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Nema učenika</p>
                            {hasActiveFilters ? (
                              <p className="text-xs text-gray-500 mb-3">Pokušajte promijeniti filtere</p>
                            ) : (
                              <p className="text-xs text-gray-500">Nema učenika u bazi podataka</p>
                            )}
                          </div>
                          {hasActiveFilters && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setQuickProsjekFilter(null);
                                setAdvancedFilters({
                                  prosjekMin: null,
                                  prosjekMax: null,
                                  spol: null,
                                  status: null,
                                  mjestoRodjenja: '',
                                  adresaStanovanja: '',
                                  imaPosebnePotrebe: null,
                                  tipStambenogObjekta: '',
                                  razred: null,
                                  mektebStepen: '',
                                  nivoObrazovanja: '',
                                  datumRodjenjaOd: '',
                                  datumRodjenjaDo: '',
                                  brojBraceMin: null,
                                  brojBraceMax: null,
                                  brojSestaraMin: null,
                                  brojSestaraMax: null,
                                });
                                setCurrentPage(1);
                                setUcenici([]);
                                setHasMore(true);
                                fetchUcenici(true, 1);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Obriši sve filtere
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ucenici.map((ucenik, index) => (
                      <tr
                        key={ucenik.id}
                        onClick={() => setSelectedUcenik(ucenik)}
                        className={`group cursor-pointer transition-all duration-200 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        } hover:bg-blue-50 ${
                          selectedUcenik?.id === ucenik.id 
                            ? 'bg-blue-50 shadow-sm' 
                            : ''
                        }`}
                      >
                        <td className={`px-6 py-4 ${selectedUcenik?.id === ucenik.id ? 'border-l-4 border-blue-600' : ''}`}>
                          <div className="flex items-center gap-3">
                            <AvatarIcon ucenik={ucenik} />
                            <div className="flex-1 min-w-0" onClick={() => setSelectedUcenik(ucenik)}>
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {ucenik.ime && ucenik.prezime
                                  ? `${ucenik.ime} ${ucenik.prezime}`
                                  : ucenik.ime || ucenik.prezime || 'Nepoznato'}
                              </div>
                              {ucenik.status && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`w-2 h-2 rounded-full ${
                                    ucenik.status === 'AKTIVAN' ? 'bg-green-500' : 'bg-gray-400'
                                  }`}></span>
                                  <span className="text-xs text-gray-500">
                                    {ucenik.status === 'AKTIVAN' ? 'Aktivan' : ucenik.status === 'ARHIVIRAN' ? 'Arhiviran' : ucenik.status}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDate(ucenik.datumRodjenja)}
                          </div>
                          {ucenik.datumRodjenja && getAge(ucenik.datumRodjenja) !== null && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {getAge(ucenik.datumRodjenja)} godina
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {ucenik.obrazovanje?.razred ? (
                                <div className="text-sm font-medium text-gray-900">
                                  {ucenik.obrazovanje.razred}. razred
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {ucenik.prosjek !== null ? (
                            <div className="flex flex-col gap-1.5 min-w-[100px]">
                              <div className="flex items-baseline gap-1.5">
                                <span className={`text-sm font-semibold ${getProsjekColor(ucenik.prosjek).text}`}>
                                {ucenik.prosjek.toFixed(2)}
                              </span>
                                <span className="text-xs text-gray-400">/ 5.00</span>
                              </div>
                              <ProsjekBar prosjek={ucenik.prosjek} />
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {ucenik.razredNaziv ? (
                            (() => {
                              const colors = getRazredColor(ucenik.razredNaziv);
                              return (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
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

        </div>
      )}

      {/* Ucenik Details Drawer */}
      <UcenikDetailsDrawer
        open={selectedUcenik !== null}
        ucenikId={selectedUcenik?.id || null}
        onClose={() => setSelectedUcenik(null)}
        onSave={async () => {
          // Refresh data after save
          await fetchUcenici(true, currentPage);
        }}
      />
    </div>
  );
}
