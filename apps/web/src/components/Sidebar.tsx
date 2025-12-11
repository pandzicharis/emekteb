import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type MenuEntry =
  | { type: 'item'; path: string; name: string; icon: ReactNode }
  | { type: 'label'; name: string }
  | { type: 'group'; name: string; icon?: ReactNode; items: Array<{ path: string; name: string; icon: ReactNode }> };

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const getMenuItems = (uloga: string): MenuEntry[] => {
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

  // Za MUALLIM, vraćamo samo Dashboard
  if (uloga === 'MUALLIM') {
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
      ],
    }
  );

  if (uloga === 'ADMIN') {
    baseItems.push({
      type: 'group',
      name: 'Ucenici',
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
  }

  return baseItems;
};

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const menuItems = getMenuItems(user?.uloga || '');
  const [nastavaOpen, setNastavaOpen] = useState(true);
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
                return (
                  <li key={`group-${idx}`} className="mt-2 space-y-1">
                    <button
                      onClick={(e) => {
                        if (ensureOpen(e)) return;
                        setNastavaOpen((v) => !v);
                      }}
                      className={`w-full flex items-center ${isOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-3 rounded-lg text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white transition-colors border border-transparent hover:border-gray-700`}
                    >
                      <span className="flex-shrink-0 flex items-center justify-center">
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
                          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${nastavaOpen ? '' : '-rotate-90'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        nastavaOpen && isOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <ul className="mt-1 space-y-1 pl-2">
                        {nastavaOpen && isOpen &&
                          item.items.map((child) => {
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
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                  }`}
                                  title={!isOpen ? child.name : undefined}
                                >
                                  <span className="flex-shrink-0 flex items-center justify-center">{child.icon}</span>
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
                    <span className="flex-shrink-0 flex items-center justify-center">{item.icon}</span>
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
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                  {user.uloga === 'ADMIN'
                    ? 'A'
                    : user.ime && user.prezime
                    ? `${user.ime.charAt(0).toUpperCase()}${user.prezime.charAt(0).toUpperCase()}`
                    : user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className={`min-w-0 ${isOpen ? 'opacity-100' : 'opacity-0 max-w-0 overflow-hidden'} transition-all duration-300`}>
                  <div className="text-sm text-gray-300 font-medium truncate">
                    {user.ime && user.prezime ? `${user.ime} ${user.prezime}` : user.email}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">{user.uloga.toLowerCase()}</div>
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

