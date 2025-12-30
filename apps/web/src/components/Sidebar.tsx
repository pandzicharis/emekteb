import { useState, useEffect, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

type MenuEntry =
  | { type: 'item'; path: string; name: string; icon: ReactNode }
  | { type: 'label'; name: string }
  | { type: 'group'; name: string; icon?: ReactNode; items: Array<{ path: string; name: string; icon: ReactNode }> };

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const getMenuItems = (uloga: string, hasSkolaHifza: boolean = false, ucenici: Array<{ id: string; ime: string; prezime: string }> = []): MenuEntry[] => {
  const baseItems: MenuEntry[] = [
    {
      type: 'item',
      path: '/',
      name: 'Dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
  ];

  // Za RODITELJ, dodajemo menu items (bez grupiranja - svi itemi na istom nivou)
  if (uloga === 'RODITELJ') {
    const roditeljItems: MenuEntry[] = [...baseItems];

    // Dodaj linkove ka svakom djetetu kao direktne iteme
    if (ucenici.length > 0) {
      ucenici.forEach((ucenik) => {
        roditeljItems.push({
          type: 'item',
          path: `/roditelj/dijete/${ucenik.id}`,
          name: `${ucenik.ime} ${ucenik.prezime}`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        });
      });
    }

    // Kalendar
    roditeljItems.push({
      type: 'item',
      path: '/roditelj/kalendar',
      name: 'Kalendar',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    });

    // Statistike
    roditeljItems.push({
      type: 'item',
      path: '/roditelj/statistike',
      name: 'Statistike',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    });

    // Obavještenja
    roditeljItems.push({
      type: 'item',
      path: '/roditelj/obavjestenja',
      name: 'Obavještenja',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    });

    // Komunikacija
    roditeljItems.push({
      type: 'item',
      path: '/komunikacija',
      name: 'Komunikacija',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    });

    // Zadaće
    roditeljItems.push({
      type: 'item',
      path: '/roditelj/zadace',
      name: 'Zadaće',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    });

    // Postavke
    roditeljItems.push({
      type: 'item',
      path: '/roditelj/postavke',
      name: 'Postavke',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    });

    return roditeljItems;
  }

  // Za MUALLIM, dodajemo grupu Nastava
  if (uloga === 'MUALLIM') {
    const nastavaItems = [
      {
        path: '/casovi',
        name: 'Časovi',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        path: '/ucenici',
        name: 'Učenici',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        path: '/diplome-builder',
        name: 'Diplome',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
    ];

    // Dodaj "Škola hifza" samo ako muallim ima SKOLA_HIFZA razred
    if (hasSkolaHifza) {
      nastavaItems.push({
        path: '/skola-hifza',
        name: 'Škola hifza',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      });
    }

    baseItems.push(
      {
        type: 'group',
        name: 'Nastava',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l-2 2H6a2 2 0 00-2 2v7a2 2 0 002 2h4l2-2 2 2h4a2 2 0 002-2v-7a2 2 0 00-2-2h-4l-2-2z" />
          </svg>
        ),
        items: nastavaItems,
      },
      {
        type: 'item',
        path: '/izvjestaji',
        name: 'Izvještaji',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        type: 'item',
        path: '/komunikacija',
        name: 'Komunikacija',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ),
      },
      {
        type: 'item',
        path: '/zakljucivanje-godine',
        name: 'Zaključivanje godine',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      }
    );
    return baseItems;
  }

  baseItems.push(
    {
      type: 'group',
      name: 'Nastava',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l-2 2H6a2 2 0 00-2 2v7a2 2 0 002 2h4l2-2 2 2h4a2 2 0 002-2v-7a2 2 0 00-2-2h-4l-2-2z" />
        </svg>
      ),
      items: [
        {
          path: '/lekcije',
          name: 'Lekcije',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ),
        },
        {
          path: '/setup-nastavna-godina',
          name: 'Nastavna godina',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 19h14M5 7h14M5 15h14" />
            </svg>
          ),
        },
        {
          path: '/nastavni-plan',
          name: 'Nastavni plan',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h11m-11 4h11m-11 4h11m-6 4h6M5 5h.01M5 9h.01M5 13h.01M5 17h.01" />
            </svg>
          ),
        },
        ...(uloga === 'ADMIN' ? [{
          path: '/slobodni-dani',
          name: 'Slobodni dani',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        }] : []),
      ],
    }
  );

  if (uloga === 'ADMIN') {
    baseItems.push({
      type: 'group',
      name: 'Učenici',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 20v-2a3 3 0 013-3h8a3 3 0 013 3v2M7 7a5 5 0 1010 0 5 5 0 00-10 0z" />
        </svg>
      ),
      items: [
        {
          path: '/import',
          name: 'Import',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16l4-4m-4 4l-4-4m4 4V4m8 12v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" />
            </svg>
          ),
        },
      ],
    });

    baseItems.push({
      type: 'group',
      name: 'Postavke',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      items: [
        {
          path: '/settings/muallimi',
          name: 'Muallimi',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
      ],
    });
  }

  return baseItems;
};

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [hasSkolaHifza, setHasSkolaHifza] = useState(false);
  const [ucenici, setUcenici] = useState<Array<{ id: string; ime: string; prezime: string }>>([]);
  const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

  // Provjeri da li muallim ima SKOLA_HIFZA razred
  useEffect(() => {
    if (user?.uloga === 'MUALLIM') {
      const checkSkolaHifza = async () => {
        try {
          const response = await axios.get(`${API_URL}/muallimi/dashboard`, { timeout: 8000 });
          const dashboardData = response.data;
          // Provjeri da li postoji razred sa SKOLA_HIFZA u rasporedu
          const hasHifza = dashboardData?.razredi?.some(
            (r: any) => r.razred?.ilmihal === 'SKOLA_HIFZA' || r.razred?.ilmihal === 'ŠKOLA HIFZA'
          ) || dashboardData?.raspored?.some(
            (item: any) => item.grupa?.razred?.ilmihal === 'SKOLA_HIFZA' || item.grupa?.razred?.ilmihal === 'ŠKOLA HIFZA'
          );
          setHasSkolaHifza(!!hasHifza);
        } catch (error) {
          console.warn('Neuspješno dohvaćanje dashboard podataka za provjeru Škole Hifza', error);
          setHasSkolaHifza(false);
        }
      };
      checkSkolaHifza();
    }
  }, [user?.uloga, API_URL]);

  // Učitaj djecu za roditelje
  useEffect(() => {
    if (user?.uloga === 'RODITELJ') {
      const fetchUcenici = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/roditelj/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          });
          if (response.data.ucenici) {
            setUcenici(
              response.data.ucenici.map((ucenik: any) => ({
                id: ucenik.id,
                ime: ucenik.ime,
                prezime: ucenik.prezime,
              }))
            );
          }
        } catch (error) {
          console.warn('Neuspješno dohvaćanje djece za sidebar', error);
        }
      };
      fetchUcenici();
    }
  }, [user?.uloga, API_URL]);

  const menuItems = getMenuItems(user?.uloga || '', hasSkolaHifza, ucenici);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Nastava': location.pathname.startsWith('/casovi') || location.pathname.startsWith('/lekcije') || location.pathname.startsWith('/setup-nastavna-godina') || location.pathname.startsWith('/nastavni-plan') || location.pathname.startsWith('/ucenici') || location.pathname.startsWith('/skola-hifza'),
    'Postavke': location.pathname.startsWith('/settings'),
  });
  
  useEffect(() => {
    // Automatski otvori Postavke grupu ako je aktivna ruta
    if (location.pathname.startsWith('/settings')) {
      setOpenGroups(prev => ({
        ...prev,
        'Postavke': true,
      }));
    }
    // Automatski otvori Nastava grupu ako je aktivna ruta
    if (location.pathname.startsWith('/casovi') || location.pathname.startsWith('/lekcije') || location.pathname.startsWith('/setup-nastavna-godina') || location.pathname.startsWith('/nastavni-plan') || location.pathname.startsWith('/ucenici') || location.pathname.startsWith('/skola-hifza')) {
      setOpenGroups(prev => ({
        ...prev,
        'Nastava': true,
      }));
    }
  }, [location.pathname]);
  
  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const ensureOpen = (e?: MouseEvent) => {
    if (!isOpen) {
      e?.preventDefault();
      e?.stopPropagation();
      onToggle();
      return true;
    }
    return false;
  };

  return (
    <>
      {/* Overlay za mobile */}
      <div
        className={`fixed inset-0 bg-gray-600 z-20 lg:hidden transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-75 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onToggle}
        style={{ willChange: 'opacity' }}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gray-900 text-white z-30 transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'w-64' : 'w-20'
        }`}
        style={{ 
          willChange: 'width',
          transform: 'translateZ(0)', // Force GPU acceleration
        }}
      >
        {/* Header */}
        <div className={`flex items-center h-16 px-4 border-b border-gray-800 transition-all duration-300 ease-in-out ${
          isOpen ? 'justify-between' : 'justify-center'
        }`}>
          <div className={`${isOpen ? 'flex' : 'hidden'} items-center gap-3`}>
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl shadow-sm flex-shrink-0">
              <svg
                className="h-6 w-6 text-white"
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
            <div
              className={`transition-all duration-300 ease-in-out ${
                isOpen
                  ? 'opacity-100 max-w-full ml-0'
                  : 'opacity-0 max-w-0 overflow-hidden ml-0'
              }`}
              style={{ willChange: 'opacity, max-width' }}
            >
              <h1 className="text-xl font-bold text-white whitespace-nowrap">
                E-Mekteb
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">
                Džemat Grbavica 2
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg
              className="w-6 h-6 transition-transform duration-300 ease-in-out"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="mt-8 flex-1 overflow-y-auto">
          <ul className="space-y-3 px-3 text-[13px]">
            {menuItems.map((item, idx) => {
              if (item.type === 'group') {
                const isGroupOpen = openGroups[item.name] ?? false;
                return (
                  <li key={`group-${idx}`} className="mt-2 space-y-1">
                    <button
                      onClick={(e) => {
                        if (ensureOpen(e)) return;
                        toggleGroup(item.name);
                      }}
                      className={`w-full flex items-center ${isOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-3 rounded-lg text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white transition-colors border border-transparent hover:border-gray-700`}
                    >
                      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                        {item.icon ?? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M5 12h14M5 17h9" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`flex-1 text-left transition-all ${
                          isOpen
                            ? 'opacity-100 max-w-full duration-300 delay-100'
                            : 'opacity-0 max-w-0 overflow-hidden'
                        }`}
                        style={{ willChange: 'opacity, max-width' }}
                      >
                        {item.name}
                      </span>
                      {isOpen && (
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isGroupOpen ? '' : '-rotate-90'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isGroupOpen && isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden min-h-0">
                        <ul className={`space-y-1 pl-2 ${isGroupOpen && isOpen ? 'mt-1' : 'mt-0'}`}>
                          {item.items.map((child) => {
                            const isActive = location.pathname === child.path;
                            return (
                              <li key={child.path}>
                                <Link
                                  to={child.path}
                                      onClick={(e) => ensureOpen(e)}
                                  className={`flex items-center rounded-lg transition-colors ${
                                    isOpen ? 'gap-3 px-6' : 'justify-center px-0'
                                  } py-2 ${
                                    isActive
                                      ? child.path === '/skola-hifza'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-blue-600 text-white'
                                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                  }`}
                                  title={!isOpen ? child.name : undefined}
                                >
                                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6">{child.icon}</span>
                                  <span
                                    className={`font-medium whitespace-nowrap transition-all ease-in-out ${
                                      isOpen
                                        ? 'opacity-100 max-w-full duration-300 delay-100'
                                        : 'opacity-0 max-w-0 overflow-hidden duration-300'
                                    }`}
                                    style={{ willChange: 'opacity, max-width' }}
                                  >
                                    {child.name}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </li>
                );
              }
              if (item.type === 'label') {
                return (
                  <li key={`label-${idx}`} className={`px-4 text-xs font-semibold text-gray-500 ${isOpen ? 'mt-4 mb-2' : 'mt-4 mb-1'}`}>
                    {isOpen ? item.name : '•'}
                  </li>
                );
              }
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={(e) => ensureOpen(e)}
                    className={`flex items-center rounded-lg transition-colors ${
                      isOpen ? 'gap-3 px-4' : 'justify-center px-0'
                    } py-3 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                    title={!isOpen ? item.name : undefined}
                  >
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6">{item.icon}</span>
                    <span
                      className={`font-medium whitespace-nowrap transition-all ease-in-out ${
                        isOpen
                          ? 'opacity-100 max-w-full duration-300 delay-100'
                          : 'opacity-0 max-w-0 overflow-hidden duration-300'
                      }`}
                      style={{ willChange: 'opacity, max-width' }}
                    >
                      {item.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className={`border-t border-gray-800 transition-all duration-300 ease-in-out ${isOpen ? 'p-4' : 'px-2 py-3'}`}>
          {user && (
            <div className={`flex items-center ${isOpen ? 'gap-3 justify-between' : 'gap-0 justify-center'}`}>
              <div className={`flex items-center justify-center ${isOpen ? 'gap-3 min-w-0' : ''}`}>
                {user.fotografija ? (
                  <img
                    src={`${import.meta.env['VITE_API_URL'] || 'http://localhost:3000'}${user.fotografija}`}
                    alt={user.ime && user.prezime ? `${user.ime} ${user.prezime}` : (user.email || 'User')}
                    className="flex-shrink-0 w-10 h-10 rounded-full object-cover border-2 border-gray-700"
                  />
                ) : (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                    {user.uloga === 'ADMIN'
                      ? 'A'
                      : user.ime && user.prezime
                      ? `${user.ime.charAt(0).toUpperCase()}${user.prezime.charAt(0).toUpperCase()}`
                      : user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className={`min-w-0 ${isOpen ? 'opacity-100' : 'opacity-0 max-w-0 overflow-hidden'} transition-all duration-300`}>
                  <div className="text-sm text-gray-300 font-medium truncate">
                    {user.uloga === 'ADMIN' ? 'ADMIN' : (user.ime && user.prezime ? `${user.ime} ${user.prezime}` : user.email)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.uloga === 'ADMIN' ? (user.email || '') : user.uloga.toLowerCase()}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className={`flex-shrink-0 p-2 rounded-lg transition-all ease-in-out text-gray-300 hover:bg-gray-800 hover:text-white ${
                  isOpen ? 'opacity-100 scale-100' : 'hidden'
                }`}
                title="Odjavi se"
                aria-label="Odjavi se"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

